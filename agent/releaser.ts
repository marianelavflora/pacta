// Liberador v1 (PAC-26): paga al freelancer el hito aprobado desde la bóveda del agente.
// No usa viem ni claves: la cadena llega por parámetro (`ReleaserChain`), que en producción
// arma agent/releaser-server.ts con el cliente único de lib/chain/wallet.ts (el que pone el tag).
//
// Por qué no puede pagar dos veces (de afuera hacia adentro):
//   1. Antes de mandar nada se guarda un movimiento `payout` en `pending`. La base tiene un
//      índice único que no deja dos `payout` activos por hito: el segundo intento falla ahí.
//   2. El hito pasa de `approved` a `converting` con un update condicional: solo uno gana.
//   3. Si una corrida se corta a la mitad, la siguiente NO reenvía: reconcilia con la cadena
//      (mira el recibo del tx_hash guardado) o espera.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAddress, type Address, type Hash } from "viem";

import type { TokenSymbol } from "@/lib/chain/tokens";

export type ReleaserChain = {
  balanceOf(token: Address, owner: Address): Promise<bigint>;
  /**
   * Simula el `transfer` SIN enviarlo. Tira error si revertiria. Se llama antes de guardar
   * nada: si falla aca sabemos con seguridad que no salio plata.
   */
  simulateTransfer(token: Address, to: Address, amount: bigint): Promise<void>;
  /** Manda un `transfer` ERC-20 desde la wallet del agente y devuelve el hash. */
  transfer(token: Address, to: Address, amount: bigint): Promise<Hash>;
  /** Espera el recibo. Si no llega a tiempo, tira error (el pago queda pendiente de reconciliar). */
  waitForReceipt(hash: Hash): Promise<{ status: "success" | "reverted" }>;
  /** Recibo ya minado, o null si todavía no existe. */
  getReceipt(hash: Hash): Promise<{ status: "success" | "reverted" } | null>;
};

/**
 * Cambio de una moneda por otra (PAC-32). En producción lo arma agent/releaser-server.ts con Textile.
 * Sin `converter`, un acuerdo con monedas distintas queda en `needs_conversion` (no se paga).
 */
export type Converter = {
  /** Cuánto se espera recibir (estimado, ya contrastado con la referencia), o null si hoy no hay ruta real. */
  estimate(from: TokenSymbol, to: TokenSymbol, amountIn: bigint): Promise<bigint | null>;
  /**
   * Hace el cambio. Si falla, el error trae `moneyMayHaveMoved`: false = seguro que no salió plata
   * (se reintenta); true = pudo salir (lo mira una persona).
   */
  convert(
    request: { from: TokenSymbol; to: TokenSymbol; amountIn: bigint; minAmountOut: bigint },
    onProgress: (legs: unknown[]) => Promise<void>,
  ): Promise<{ amountOut: bigint; finalTxHash: Hash; legs: unknown[] }>;
};

export type ReleaserDeps = {
  db: SupabaseClient;
  chain: ReleaserChain;
  /** Opcional: cambia de moneda cuando el cliente deposita en una y la freelancer cobra en otra. */
  converter?: Converter;
  agentAddress: Address;
  tokenAddress: (currency: TokenSymbol) => Address;
  /**
   * Tope de seguridad por pago según la moneda de cobro, en unidades mínimas (opcional).
   * Un tope por moneda porque 1 wBRL y 1 wARS valen muy distinto. Los topes completos son PAC-46.
   */
  maxPayoutByCurrency?: Partial<Record<TokenSymbol, bigint>>;
  /** Aviso "hito pagado" (PAC-42). Opcional: un aviso que falla nunca frena ni deshace un pago. */
  onPaid?: (agreementId: string, milestoneId: string) => Promise<unknown>;
};

export type ReleaseResult =
  | { kind: "paid"; txHash: string; amount: string }
  | { kind: "already_paid" }
  | { kind: "in_progress" } // otra corrida lo está pagando, o falta confirmar la tx
  | { kind: "not_found" }
  | { kind: "wrong_status"; status: string }
  | { kind: "needs_conversion" } // moneda del cliente distinta a la de cobro: lo hace PAC-32
  | { kind: "no_freelancer_wallet" }
  | { kind: "over_cap" }
  | { kind: "insufficient_balance" }
  | { kind: "tx_failed"; reason: string } // seguro que NO salio plata (simulacion o recibo revertido): reintentable
  | { kind: "needs_review"; reason: string }; // puede que la tx haya salido: NO se reintenta solo, lo mira una persona

type Row = Record<string, unknown>;
const UNIQUE_VIOLATION = "23505";
const PAYABLE = ["approved", "expired"];

function fail(step: string, error: { message: string }): never {
  throw new Error(`No se pudo ${step}: ${error.message}`);
}

const hashOf = (value: string) => value.toLowerCase() as Hash;

/** Paga un hito `approved`. Seguro de llamar muchas veces: nunca paga dos veces. */
export async function releaseMilestone(deps: ReleaserDeps, milestoneId: string): Promise<ReleaseResult> {
  const { db } = deps;

  const found = await db
    .from("milestones")
    .select("id, agreement_id, status, amount::text")
    .eq("id", milestoneId)
    .maybeSingle();
  if (found.error) fail("buscar el hito", found.error);
  if (!found.data) return { kind: "not_found" };
  const milestone = found.data as Row;
  const status = milestone.status as string;

  if (status === "paid") return { kind: "already_paid" };
  if (status === "converting") return reconcile(deps, milestoneId);
  // `expired` = el cliente no respondió en 6 días y el agente lo liberó solo (agent/reminders.ts).
  if (!PAYABLE.includes(status)) return { kind: "wrong_status", status };

  const agreementId = milestone.agreement_id as string;
  const amount = BigInt(String(milestone.amount));

  const agreementRes = await db
    .from("agreements")
    .select("client_currency, payout_currency, freelancer_id")
    .eq("id", agreementId)
    .single();
  if (agreementRes.error) fail("buscar el acuerdo", agreementRes.error);
  const agreement = agreementRes.data as Row;
  const currency = agreement.payout_currency as TokenSymbol;

  const userRes = await db.from("users").select("wallet").eq("id", agreement.freelancer_id).single();
  if (userRes.error) fail("buscar a la freelancer", userRes.error);
  const wallet = (userRes.data as Row).wallet as string;
  if (!isAddress(wallet)) return { kind: "no_freelancer_wallet" };

  // Monedas distintas: primero se cambia (PAC-32) y después se paga lo que llegó.
  if (agreement.client_currency !== currency) {
    if (!deps.converter) return { kind: "needs_conversion" };
    return convertAndPay(deps, {
      milestoneId,
      agreementId,
      from: agreement.client_currency as TokenSymbol,
      to: currency,
      wallet: wallet as Address,
      amountIn: amount,
    });
  }

  return sendPayout(deps, { milestoneId, agreementId, currency, wallet: wallet as Address, amount, claim: true });
}

type PayoutPlan = {
  milestoneId: string;
  agreementId: string;
  currency: TokenSymbol;
  wallet: Address;
  amount: bigint;
  /** true = el hito todavía está `approved` y hay que reservarlo; false = ya está `converting`. */
  claim: boolean;
};

/** Manda el pago al freelancer. Es el mismo camino con o sin cambio de moneda antes. */
async function sendPayout(deps: ReleaserDeps, plan: PayoutPlan): Promise<ReleaseResult> {
  const { db, chain } = deps;
  const { milestoneId, agreementId, currency, wallet, amount } = plan;

  const cap = deps.maxPayoutByCurrency?.[currency];
  if (cap !== undefined && amount > cap) return { kind: "over_cap" };

  const token = deps.tokenAddress(currency);
  if ((await chain.balanceOf(token, deps.agentAddress)) < amount) return { kind: "insufficient_balance" };

  // 0) Simular el transfer antes de tocar nada. Si revierte, es seguro que no salio plata:
  //    no queda ningun estado a medias y el hito sigue como estaba.
  try {
    await chain.simulateTransfer(token, wallet, amount);
  } catch (error) {
    return { kind: "tx_failed", reason: error instanceof Error ? error.message : "la simulacion fallo" };
  }

  // 1) Primero el movimiento `pending`: el índice único frena a la segunda corrida.
  const inserted = await db
    .from("movements")
    .insert({
      agreement_id: agreementId,
      milestone_id: milestoneId,
      kind: "payout",
      from_currency: currency,
      to_currency: currency,
      amount_in: amount.toString(),
      amount_out: amount.toString(),
      status: "pending",
    })
    .select("id")
    .single();
  if (inserted.error) {
    if (inserted.error.code === UNIQUE_VIOLATION) return { kind: "in_progress" };
    fail("guardar el pago", inserted.error);
  }
  const movementId = (inserted.data as Row).id as string;

  // 2) Reservar el hito: approved → converting. Solo una corrida lo logra. (Si venimos de un cambio de
  //    moneda, el hito ya está `converting` desde antes y no hay nada que reservar.)
  if (plan.claim) {
    const claim = await db
      .from("milestones")
      .update({ status: "converting" })
      .eq("id", milestoneId)
      .in("status", PAYABLE)
      .select("id");
    if (claim.error) fail("reservar el hito", claim.error);
    if (!claim.data?.length) {
      await markFailed(db, movementId);
      return { kind: "in_progress" };
    }
  }

  // 3) Mandar la transferencia (por el cliente único con tag).
  let txHash: Hash;
  try {
    txHash = hashOf(await chain.transfer(token, wallet, amount));
  } catch (error) {
    // Error SIN hash (timeout de RPC, error ambiguo): no sabemos si la tx salio. NO se marca
    // `failed` ni se reabre el hito: queda `pending` + `converting` para revision manual y no
    // hay reintento automatico (reconcile no reenvia sin hash).
    const reason = error instanceof Error ? error.message : "error al enviar";
    console.error(
      `[releaser] NECESITA REVISION MANUAL: milestone ${milestoneId}, movement ${movementId}. El envio fallo sin hash (${reason}). Revisa la wallet del agente antes de tocar nada.`,
    );
    return { kind: "needs_review", reason: "El envio fallo sin hash: revisar a mano" };
  }
  const saved = await db.from("movements").update({ tx_hash: txHash }).eq("id", movementId);
  if (saved.error) {
    console.error(
      `[releaser] NECESITA REVISION MANUAL: la tx ${txHash} salio pero no se pudo guardar el hash (milestone ${milestoneId}, movement ${movementId}).`,
    );
    return { kind: "needs_review", reason: "La tx salio pero no se guardo el hash: revisar a mano" };
  }

  // 4) Esperar el recibo. Si tarda de más queda pendiente y la próxima corrida reconcilia.
  let receipt: { status: "success" | "reverted" };
  try {
    receipt = await chain.waitForReceipt(txHash);
  } catch {
    return { kind: "in_progress" };
  }
  return settle(deps, movementId, milestoneId, txHash, receipt.status, amount);
}

// ---------- Cambio de moneda (PAC-32) ----------

type ConversionPlan = {
  milestoneId: string;
  agreementId: string;
  from: TokenSymbol;
  to: TokenSymbol;
  wallet: Address;
  amountIn: bigint;
};

// Se acepta recibir hasta 10 % menos que lo estimado: cubre la comisión y el movimiento del precio entre
// la estimación y la cotización en firme. Más abajo que eso, el tramo 2 no se manda.
const MIN_OUT_PERCENT = BigInt(90);
const HUNDRED = BigInt(100);
const RATE_DECIMALS = BigInt(12);

/** amountOut/amountIn como decimal con 12 decimales, para guardar en `fx_rate`. */
export function rateText(amountIn: bigint, amountOut: bigint): string {
  const scale = BigInt(10) ** RATE_DECIMALS;
  const scaled = (amountOut * scale) / amountIn;
  const whole = scaled / scale;
  const fraction = (scaled % scale).toString().padStart(Number(RATE_DECIMALS), "0");
  return `${whole}.${fraction}`;
}

/**
 * Cambia el monto del hito a la moneda de cobro y paga lo que llegó. Por qué no puede cambiar dos veces:
 * el movimiento `conversion` en `pending` se guarda ANTES de mandar nada y el índice único de la base
 * no deja dos activos por hito. Si algo se corta a la mitad, no se reintenta solo: se revisa a mano.
 */
async function convertAndPay(deps: ReleaserDeps, plan: ConversionPlan): Promise<ReleaseResult> {
  const { db, chain, converter } = deps;
  const { milestoneId, agreementId, from, to, wallet, amountIn } = plan;
  if (!converter) return { kind: "needs_conversion" };

  // 0) Antes de tocar nada: saldo, ruta real disponible y tope. Si algo falla acá no salió plata.
  if ((await chain.balanceOf(deps.tokenAddress(from), deps.agentAddress)) < amountIn) {
    return { kind: "insufficient_balance" };
  }
  const estimate = await converter.estimate(from, to, amountIn).catch(() => null);
  if (estimate === null || estimate <= BigInt(0)) return { kind: "needs_conversion" };
  const cap = deps.maxPayoutByCurrency?.[to];
  if (cap !== undefined && estimate > cap) return { kind: "over_cap" };

  // 1) El movimiento `conversion` pending, con el detalle de cada tramo. Si la columna `details` no
  //    existe (falta la migración 0003) esto falla acá, antes de mover nada.
  const inserted = await db
    .from("movements")
    .insert({
      agreement_id: agreementId,
      milestone_id: milestoneId,
      kind: "conversion",
      from_currency: from,
      to_currency: to,
      amount_in: amountIn.toString(),
      status: "pending",
      details: { provider: "textile", legs: [] },
    })
    .select("id")
    .single();
  if (inserted.error) {
    if (inserted.error.code !== UNIQUE_VIOLATION) fail("guardar el cambio de moneda", inserted.error);
    return resumeIfAlreadyConverted(deps, milestoneId);
  }
  const movementId = (inserted.data as Row).id as string;

  // 2) Reservar el hito: approved → converting. Solo una corrida lo logra.
  const claim = await db
    .from("milestones")
    .update({ status: "converting" })
    .eq("id", milestoneId)
    .in("status", PAYABLE)
    .select("id");
  if (claim.error) fail("reservar el hito", claim.error);
  if (!claim.data?.length) {
    await markFailed(db, movementId);
    return { kind: "in_progress" };
  }

  // 3) El cambio. Cada hash nuevo se guarda en `details` apenas aparece.
  let result: Awaited<ReturnType<Converter["convert"]>>;
  try {
    result = await converter.convert(
      { from, to, amountIn, minAmountOut: (estimate * MIN_OUT_PERCENT) / HUNDRED },
      async (legs) => {
        const progress = await db
          .from("movements")
          .update({ details: { provider: "textile", legs } })
          .eq("id", movementId);
        if (progress.error) throw new Error(progress.error.message);
      },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "el cambio falló";
    // Solo se reintenta si el conversor dice, explícitamente, que NO salió plata. Un error sin esa
    // información (timeout, error raro) se trata como que pudo salir.
    const surelyNoMoneyMoved = (error as { moneyMayHaveMoved?: boolean } | null)?.moneyMayHaveMoved === false;
    if (surelyNoMoneyMoved) {
      // Seguro que no salió plata: el movimiento queda `failed` (libera el índice) y el hito se reabre.
      await failAndReopen(db, movementId, milestoneId);
      return { kind: "tx_failed", reason };
    }
    console.error(
      `[releaser] NECESITA REVISION MANUAL: el cambio de moneda del milestone ${milestoneId} (movement ${movementId}) falló y pudo haber salido plata (${reason}). Mirá la wallet del agente antes de tocar nada.`,
    );
    return { kind: "needs_review", reason: "El cambio de moneda quedó a medias: revisar a mano" };
  }

  // 4) Guardar el cambio como confirmado, con lo que realmente llegó.
  const confirmed = await db
    .from("movements")
    .update({
      status: "confirmed",
      amount_out: result.amountOut.toString(),
      fx_rate: rateText(amountIn, result.amountOut),
      tx_hash: hashOf(result.finalTxHash),
      details: { provider: "textile", legs: result.legs },
    })
    .eq("id", movementId);
  if (confirmed.error) {
    console.error(
      `[releaser] NECESITA REVISION MANUAL: el cambio del milestone ${milestoneId} se hizo (recibido ${result.amountOut}) pero no se pudo guardar (movement ${movementId}).`,
    );
    return { kind: "needs_review", reason: "El cambio se hizo pero no se pudo guardar: revisar a mano" };
  }

  // 5) Pagar lo que llegó. El hito ya está `converting`: no hay que reservarlo otra vez.
  return sendPayout(deps, { milestoneId, agreementId, currency: to, wallet, amount: result.amountOut, claim: false });
}

/** Hito en `converting`: sin tx_hash no se reenvía nada; con hash se mira la cadena. */
async function reconcile(deps: ReleaserDeps, milestoneId: string): Promise<ReleaseResult> {
  const { db, chain } = deps;
  const res = await db
    .from("movements")
    .select("id, status, tx_hash, amount_out::text")
    .eq("milestone_id", milestoneId)
    .eq("kind", "payout")
    .neq("status", "failed")
    .maybeSingle();
  if (res.error) fail("buscar el pago", res.error);
  const movement = res.data as Row | null;
  if (!movement) {
    // Sin pago activo: puede haber un cambio de moneda ya hecho al que le falta el pago, o a medias.
    const conversion = await db
      .from("movements")
      .select("id, status, amount_out::text")
      .eq("milestone_id", milestoneId)
      .eq("kind", "conversion")
      .neq("status", "failed")
      .maybeSingle();
    if (conversion.error) fail("buscar el cambio de moneda", conversion.error);
    if (conversion.data) {
      const swap = conversion.data as Row;
      if (swap.status !== "confirmed") {
        // Quedó a medias: puede haber USDT del agente en el medio. No se reintenta nunca solo.
        console.error(
          `[releaser] NECESITA REVISION MANUAL: milestone ${milestoneId} en converting con un cambio de moneda sin confirmar.`,
        );
        return { kind: "needs_review", reason: "Cambio de moneda sin confirmar: revisar a mano" };
      }
      return resumePayoutAfterConversion(deps, milestoneId, BigInt(String(swap.amount_out)));
    }
    // Sin pago ni cambio activos: el hito quedó trabado sin plata en camino. Se reabre para reintentar.
    const reopen = await db
      .from("milestones")
      .update({ status: "approved" })
      .eq("id", milestoneId)
      .eq("status", "converting");
    if (reopen.error) fail("reabrir el hito", reopen.error);
    return { kind: "in_progress" };
  }
  if (!movement.tx_hash) {
    // No sabemos si salio: no reenviamos nunca. Si otra corrida esta justo enviando, se resuelve sola.
    console.error(
      `[releaser] NECESITA REVISION MANUAL: milestone ${milestoneId} en converting con pago pendiente y sin hash.`,
    );
    return { kind: "needs_review", reason: "Pago pendiente sin hash: revisar a mano" };
  }
  const hash = movement.tx_hash as Hash;
  const receipt = await chain.getReceipt(hash).catch(() => null);
  if (!receipt) return { kind: "in_progress" };
  return settle(deps, movement.id as string, milestoneId, hash, receipt.status, BigInt(String(movement.amount_out)));
}

/**
 * Ya hay un cambio de moneda activo para este hito. Si está confirmado (el pago falló y el hito se reabrió),
 * se reserva el hito y se paga lo que llegó, SIN cambiar otra vez. Si no, otra corrida lo está haciendo.
 */
async function resumeIfAlreadyConverted(deps: ReleaserDeps, milestoneId: string): Promise<ReleaseResult> {
  const { db } = deps;
  const conversion = await db
    .from("movements")
    .select("status, amount_out::text")
    .eq("milestone_id", milestoneId)
    .eq("kind", "conversion")
    .neq("status", "failed")
    .maybeSingle();
  if (conversion.error) fail("buscar el cambio de moneda", conversion.error);
  const swap = conversion.data as Row | null;
  if (!swap || swap.status !== "confirmed") return { kind: "in_progress" };

  const claim = await db
    .from("milestones")
    .update({ status: "converting" })
    .eq("id", milestoneId)
    .in("status", PAYABLE)
    .select("id");
  if (claim.error) fail("reservar el hito", claim.error);
  if (!claim.data?.length) return { kind: "in_progress" };
  return resumePayoutAfterConversion(deps, milestoneId, BigInt(String(swap.amount_out)));
}

/** El cambio ya está confirmado pero el pago no salió (se cortó la corrida): se paga lo que llegó. */
async function resumePayoutAfterConversion(
  deps: ReleaserDeps,
  milestoneId: string,
  amount: bigint,
): Promise<ReleaseResult> {
  const { db } = deps;
  const found = await db.from("milestones").select("agreement_id").eq("id", milestoneId).single();
  if (found.error) fail("buscar el hito", found.error);
  const agreementId = (found.data as Row).agreement_id as string;
  const agreementRes = await db
    .from("agreements")
    .select("payout_currency, freelancer_id")
    .eq("id", agreementId)
    .single();
  if (agreementRes.error) fail("buscar el acuerdo", agreementRes.error);
  const agreement = agreementRes.data as Row;
  const userRes = await db.from("users").select("wallet").eq("id", agreement.freelancer_id).single();
  if (userRes.error) fail("buscar a la freelancer", userRes.error);
  const wallet = (userRes.data as Row).wallet as string;
  if (!isAddress(wallet)) return { kind: "no_freelancer_wallet" };
  return sendPayout(deps, {
    milestoneId,
    agreementId,
    currency: agreement.payout_currency as TokenSymbol,
    wallet,
    amount,
    claim: false,
  });
}

async function settle(
  deps: ReleaserDeps,
  movementId: string,
  milestoneId: string,
  txHash: Hash,
  status: "success" | "reverted",
  amount: bigint,
): Promise<ReleaseResult> {
  const { db } = deps;
  if (status === "reverted") {
    await failAndReopen(db, movementId, milestoneId);
    return { kind: "tx_failed", reason: "La transacción se revirtió" };
  }
  const confirmed = await db.from("movements").update({ status: "confirmed" }).eq("id", movementId);
  if (confirmed.error) fail("confirmar el pago", confirmed.error);
  const paid = await db
    .from("milestones")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", milestoneId)
    .eq("status", "converting");
  if (paid.error) fail("marcar el hito como pagado", paid.error);
  await announcePaid(deps, milestoneId);
  return { kind: "paid", txHash, amount: amount.toString() };
}

/** Avisa que el hito se pagó. El pago ya está hecho: si el aviso falla, solo se anota en el log. */
async function announcePaid(deps: ReleaserDeps, milestoneId: string) {
  if (!deps.onPaid) return;
  try {
    const res = await deps.db.from("milestones").select("agreement_id").eq("id", milestoneId).single();
    if (res.error) throw new Error(res.error.message);
    await deps.onPaid((res.data as Row).agreement_id as string, milestoneId);
  } catch (error) {
    console.error("[releaser] no se pudo avisar el pago", milestoneId, error instanceof Error ? error.message : error);
  }
}

async function markFailed(db: SupabaseClient, movementId: string) {
  const res = await db.from("movements").update({ status: "failed" }).eq("id", movementId);
  if (res.error) fail("marcar el pago como fallido", res.error);
}

/** Pago fallido: el movimiento queda `failed` (libera el índice) y el hito vuelve a `approved`. */
async function failAndReopen(db: SupabaseClient, movementId: string, milestoneId: string) {
  await markFailed(db, movementId);
  const res = await db
    .from("milestones")
    .update({ status: "approved" })
    .eq("id", milestoneId)
    .eq("status", "converting");
  if (res.error) fail("reabrir el hito", res.error);
}

export type ReleaseSummary = { processed: number; paid: number; results: Record<string, string> };

/** Barrido para el cron: intenta pagar todos los hitos aprobados (y reconcilia los `converting`). */
export async function releaseApproved(deps: ReleaserDeps): Promise<ReleaseSummary> {
  const list = await deps.db
    .from("milestones")
    .select("id")
    .in("status", [...PAYABLE, "converting"])
    .order("approved_at", { ascending: true });
  if (list.error) fail("buscar hitos aprobados", list.error);
  const summary: ReleaseSummary = { processed: 0, paid: 0, results: {} };
  for (const row of (list.data ?? []) as Row[]) {
    const id = row.id as string;
    summary.processed++;
    try {
      const result = await releaseMilestone(deps, id);
      summary.results[id] = result.kind;
      if (result.kind === "paid") summary.paid++;
    } catch (error) {
      console.error("releaseMilestone", id, error);
      summary.results[id] = "error";
    }
  }
  return summary;
}
