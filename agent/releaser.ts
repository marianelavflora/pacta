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
  /** Manda un `transfer` ERC-20 desde la wallet del agente y devuelve el hash. */
  transfer(token: Address, to: Address, amount: bigint): Promise<Hash>;
  /** Espera el recibo. Si no llega a tiempo, tira error (el pago queda pendiente de reconciliar). */
  waitForReceipt(hash: Hash): Promise<{ status: "success" | "reverted" }>;
  /** Recibo ya minado, o null si todavía no existe. */
  getReceipt(hash: Hash): Promise<{ status: "success" | "reverted" } | null>;
};

export type ReleaserDeps = {
  db: SupabaseClient;
  chain: ReleaserChain;
  agentAddress: Address;
  tokenAddress: (currency: TokenSymbol) => Address;
  /** Tope de seguridad por pago, en unidades mínimas (opcional). Los topes completos son PAC-46. */
  maxPayoutPerMilestone?: bigint;
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
  | { kind: "tx_failed"; reason: string }; // el hito vuelve a `approved` y se puede reintentar

type Row = Record<string, unknown>;
const UNIQUE_VIOLATION = "23505";

function fail(step: string, error: { message: string }): never {
  throw new Error(`No se pudo ${step}: ${error.message}`);
}

const hashOf = (value: string) => value.toLowerCase() as Hash;

/** Paga un hito `approved`. Seguro de llamar muchas veces: nunca paga dos veces. */
export async function releaseMilestone(deps: ReleaserDeps, milestoneId: string): Promise<ReleaseResult> {
  const { db, chain } = deps;

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
  if (status !== "approved") return { kind: "wrong_status", status };

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

  // PUNTO DE EXTENSIÓN (PAC-32): acá va la conversión de FX (cotizar, swap y pagar el monto
  // convertido). En v1 solo se paga cuando el cliente depositó en la moneda en que cobra la freelancer.
  if (agreement.client_currency !== currency) return { kind: "needs_conversion" };

  const userRes = await db.from("users").select("wallet").eq("id", agreement.freelancer_id).single();
  if (userRes.error) fail("buscar a la freelancer", userRes.error);
  const wallet = (userRes.data as Row).wallet as string;
  if (!isAddress(wallet)) return { kind: "no_freelancer_wallet" };

  if (deps.maxPayoutPerMilestone !== undefined && amount > deps.maxPayoutPerMilestone) {
    return { kind: "over_cap" };
  }

  const token = deps.tokenAddress(currency);
  if ((await chain.balanceOf(token, deps.agentAddress)) < amount) return { kind: "insufficient_balance" };

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

  // 2) Reservar el hito: approved → converting. Solo una corrida lo logra.
  const claim = await db
    .from("milestones")
    .update({ status: "converting" })
    .eq("id", milestoneId)
    .eq("status", "approved")
    .select("id");
  if (claim.error) fail("reservar el hito", claim.error);
  if (!claim.data?.length) {
    await markFailed(db, movementId);
    return { kind: "in_progress" };
  }

  // 3) Mandar la transferencia (por el cliente único con tag).
  let txHash: Hash;
  try {
    txHash = hashOf(await chain.transfer(token, wallet as Address, amount));
  } catch (error) {
    await failAndReopen(db, movementId, milestoneId);
    return { kind: "tx_failed", reason: error instanceof Error ? error.message : "error al enviar" };
  }
  const saved = await db.from("movements").update({ tx_hash: txHash }).eq("id", movementId);
  if (saved.error) fail("guardar el hash del pago", saved.error);

  // 4) Esperar el recibo. Si tarda de más queda pendiente y la próxima corrida reconcilia.
  let receipt: { status: "success" | "reverted" };
  try {
    receipt = await chain.waitForReceipt(txHash);
  } catch {
    return { kind: "in_progress" };
  }
  return settle(db, movementId, milestoneId, txHash, receipt.status, amount);
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
    // Sin pago activo: el hito quedó trabado sin plata en camino. Se reabre para reintentar.
    const reopen = await db
      .from("milestones")
      .update({ status: "approved" })
      .eq("id", milestoneId)
      .eq("status", "converting");
    if (reopen.error) fail("reabrir el hito", reopen.error);
    return { kind: "in_progress" };
  }
  if (!movement.tx_hash) return { kind: "in_progress" }; // no sabemos si salió: no reenviamos
  const hash = movement.tx_hash as Hash;
  const receipt = await chain.getReceipt(hash).catch(() => null);
  if (!receipt) return { kind: "in_progress" };
  return settle(db, movement.id as string, milestoneId, hash, receipt.status, BigInt(String(movement.amount_out)));
}

async function settle(
  db: SupabaseClient,
  movementId: string,
  milestoneId: string,
  txHash: Hash,
  status: "success" | "reverted",
  amount: bigint,
): Promise<ReleaseResult> {
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
  // TODO: llamar al aviso "hito pagado" de lib/notify/events.ts cuando exista (#42).
  return { kind: "paid", txHash, amount: amount.toString() };
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
    .in("status", ["approved", "converting"])
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
