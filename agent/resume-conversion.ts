// Recuperación de un cambio de moneda que quedó a medias (PAC-32).
//
// Caso: el tramo 1 (moneda → USDT) salió y el hito quedó en `converting` con el cambio en `pending`; el USDT
// está en la wallet del agente. Lo retoma el liberador solo, en su próximo barrido (`recoverConversion`), o una
// persona con `npm run conversion:resume` (`planResume` + `resumeConversion`). En los dos casos se hace SOLO
// el tramo 2 (USDT → moneda de cobro): el tramo 1 nunca se repite.
//
// Por qué retomar es seguro: cada hash que se manda se guarda en `details` ANTES de esperar su recibo, y el
// tramo 1 se verifica en la cadena (recibo exitoso y USDT recibido en ese bloque) antes de seguir.
// Estados que se reconocen:
//   1. Un solo tramo guardado (el 1 salió y el 2 ni empezó)        → se hace el tramo 2.
//   2. Dos tramos, el 2 sin hash de swap (se cortó antes de swapear) → se hace el tramo 2 con una cotización nueva.
//   3. Dos tramos, el 2 con hash y recibo exitoso                  → se cierra el cambio, sin mandar nada.
//   4. Dos tramos, el 2 con hash y recibo revertido                → se reintenta el tramo 2 (revertir no mueve plata).
//   5. Dos tramos, el 2 con hash y todavía sin recibo              → se espera (no se manda nada).
// Un tope de intentos evita gastar comisiones sin fin: pasado el tope, queda a revisión manual.
//
// Sin claves ni viem: la cadena y Textile llegan por parámetro, así que se prueba sin red.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address, Hash } from "viem";

import type { TokenSymbol } from "@/lib/chain/tokens";
import {
  receivedInBlock,
  runSecondLeg,
  type LegRecord,
  type TextileSwapDeps,
} from "@/lib/fx/textile-swap";
import { rateText } from "./releaser";

export type ResumeDeps = {
  db: SupabaseClient;
  swap: TextileSwapDeps;
  usdt: Address;
  tokenAddress: (currency: TokenSymbol) => Address;
  /** Cuánto se espera recibir por el monto original (cotización real de Textile), o null si hoy no hay ruta. */
  estimate: (from: TokenSymbol, to: TokenSymbol, amountIn: bigint) => Promise<bigint | null>;
  /**
   * Recibo ya minado (sin esperar), o null si todavía no existe. Sin esto no se puede distinguir un swap
   * pendiente de uno que no salió, así que el estado 5 se trata como "esperar".
   */
  getReceipt?: (hash: Hash) => Promise<{ status: "success" | "reverted"; blockNumber?: bigint } | null>;
};

type Row = Record<string, unknown>;

type Base = {
  milestoneId: string;
  movementId: string;
  from: TokenSymbol;
  to: TokenSymbol;
  /** Lo que se vendió en el tramo 1, en la moneda de origen. */
  amountIn: bigint;
  attempts: number;
};

export type ResumePlan = Base & {
  action: "second_leg";
  /** El USDT que realmente llegó del tramo 1 (leído del bloque de su recibo). */
  usdtAmount: bigint;
  estimate: bigint;
  minAmountOut: bigint;
  firstLeg: LegRecord;
};

export type FinalizePlan = Base & {
  action: "finalize";
  legs: LegRecord[];
  amountOut: bigint;
  finalTxHash: Hash;
};

export type WaitPlan = Base & { action: "wait"; reason: string };

export type RecoveryPlan = ResumePlan | FinalizePlan | WaitPlan;

// Se acepta recibir hasta 10 % menos que lo estimado (igual que en el liberador).
const MIN_OUT_PERCENT = BigInt(90);
const HUNDRED = BigInt(100);
/** Intentos automáticos de retomar un mismo cambio antes de dejarlo a revisión manual. */
export const MAX_RECOVERY_ATTEMPTS = 5;

function fail(message: string): never {
  throw new Error(message);
}

/** Lee el estado del cambio y decide qué corresponde hacer. No manda nada ni escribe en la base. */
export async function inspectConversion(deps: ResumeDeps, milestoneId: string): Promise<RecoveryPlan> {
  const { db, swap } = deps;

  const milestone = await db.from("milestones").select("status, agreement_id, amount::text").eq("id", milestoneId).maybeSingle();
  if (milestone.error) fail(`No se pudo buscar el hito: ${milestone.error.message}`);
  if (!milestone.data) fail("El hito no existe.");
  const milestoneRow = milestone.data as Row;
  if (milestoneRow.status !== "converting") fail(`El hito está en "${String(milestoneRow.status)}": solo se retoman los que están en "converting".`);

  const conversion = await db
    .from("movements")
    .select("id, status, from_currency, to_currency, amount_in::text, details")
    .eq("milestone_id", milestoneId)
    .eq("kind", "conversion")
    .neq("status", "failed")
    .maybeSingle();
  if (conversion.error) fail(`No se pudo buscar el cambio: ${conversion.error.message}`);
  if (!conversion.data) fail("El hito no tiene un cambio de moneda activo.");
  const movement = conversion.data as Row;
  if (movement.status !== "pending") fail(`El cambio está "${String(movement.status)}": solo se retoma uno en "pending".`);

  const details = (movement.details ?? {}) as { legs?: LegRecord[]; recoveryAttempts?: number };
  const legs = details.legs ?? [];
  if (legs.length < 1 || legs.length > 2) fail(`Se esperaban 1 o 2 tramos guardados y hay ${legs.length}: revisar a mano.`);
  const firstLeg = legs[0];
  if (!firstLeg.swapHash) fail("El tramo 1 no tiene hash de swap: no se sabe si salió. Revisar a mano.");

  const base: Base = {
    milestoneId,
    movementId: movement.id as string,
    from: movement.from_currency as TokenSymbol,
    to: movement.to_currency as TokenSymbol,
    amountIn: BigInt(String(movement.amount_in)),
    attempts: Number(details.recoveryAttempts ?? 0),
  };

  // El tramo 1 tiene que haber salido bien, y se lee cuánto USDT llegó EN ESE BLOQUE (no "lo último").
  const receipt = await swap.chain.waitForReceipt(firstLeg.swapHash as Hash);
  if (receipt.status !== "success") fail("El swap del tramo 1 se revirtió: no hay nada que retomar. Revisar a mano.");
  if (receipt.blockNumber === undefined) fail("El recibo del tramo 1 no trae el bloque.");
  const usdtAmount = await receivedInBlock(swap, deps.usdt, receipt.blockNumber);
  if (usdtAmount <= BigInt(0)) fail("El tramo 1 no entregó USDT: revisar a mano.");

  // Estados 3, 4 y 5: el tramo 2 ya tiene hash de swap.
  const secondHash = legs[1]?.swapHash;
  if (secondHash) {
    const secondReceipt = deps.getReceipt ? await deps.getReceipt(secondHash as Hash).catch(() => null) : null;
    if (!secondReceipt) {
      return { ...base, action: "wait", reason: "El swap del tramo 2 todavía no tiene recibo: se espera." };
    }
    if (secondReceipt.status === "success") {
      if (secondReceipt.blockNumber === undefined) fail("El recibo del tramo 2 no trae el bloque.");
      const amountOut = await receivedInBlock(swap, deps.tokenAddress(base.to), secondReceipt.blockNumber);
      if (amountOut <= BigInt(0)) fail("El tramo 2 salió pero no entregó nada: revisar a mano.");
      return {
        ...base,
        action: "finalize",
        legs: [{ ...firstLeg, receivedAmount: usdtAmount.toString() }, { ...legs[1], receivedAmount: amountOut.toString() }],
        amountOut,
        finalTxHash: secondHash as Hash,
      };
    }
    // Revertido (estado 4): no movió plata, se puede reintentar con una cotización nueva.
  }

  // Estados 1, 2 y 4: se hace el tramo 2. El USDT tiene que estar hoy en la wallet del agente.
  const usdtBalance = await swap.chain.balanceOf(deps.usdt);
  if (usdtBalance < usdtAmount) fail(`El agente tiene ${usdtBalance} de USDT y el tramo 2 necesita ${usdtAmount}.`);

  const estimate = await deps.estimate(base.from, base.to, base.amountIn);
  if (estimate === null || estimate <= BigInt(0)) fail("Textile no tiene una ruta real hoy para este cambio.");

  return {
    ...base,
    action: "second_leg",
    usdtAmount,
    estimate,
    minAmountOut: (estimate * MIN_OUT_PERCENT) / HUNDRED,
    firstLeg: { ...firstLeg, receivedAmount: usdtAmount.toString() },
  };
}

/** Plan para la persona que corre `conversion:resume`: solo vale si hay que hacer el tramo 2. */
export async function planResume(deps: ResumeDeps, milestoneId: string): Promise<ResumePlan> {
  const plan = await inspectConversion(deps, milestoneId);
  if (plan.action === "second_leg") return plan;
  if (plan.action === "finalize") fail("El tramo 2 ya salió y tiene recibo: no hace falta mandar nada, el liberador cierra el cambio solo.");
  fail(plan.reason);
}

/** Cierra el cambio como confirmado, con lo que realmente llegó. */
async function confirmConversion(
  db: SupabaseClient,
  movementId: string,
  amountIn: bigint,
  amountOut: bigint,
  finalTxHash: Hash,
  legs: LegRecord[],
) {
  const confirmed = await db
    .from("movements")
    .update({
      status: "confirmed",
      amount_out: amountOut.toString(),
      fx_rate: rateText(amountIn, amountOut),
      tx_hash: finalTxHash.toLowerCase(),
      details: { provider: "textile", legs },
    })
    .eq("id", movementId);
  if (confirmed.error) {
    fail(`El tramo 2 salió (${finalTxHash}, recibido ${amountOut}) pero no se pudo guardar: ${confirmed.error.message}. Revisar a mano.`);
  }
}

/** Hace el tramo 2 y deja el cambio confirmado. MANDA TRANSACCIONES. */
export async function resumeConversion(
  deps: ResumeDeps,
  plan: ResumePlan,
): Promise<{ amountOut: bigint; finalTxHash: Hash }> {
  const { db } = deps;
  const legs: LegRecord[] = [plan.firstLeg];

  const saveProgress = async (record: LegRecord) => {
    legs[1] = record;
    const saved = await db
      .from("movements")
      .update({ details: { provider: "textile", legs: [...legs], recoveryAttempts: plan.attempts } })
      .eq("id", plan.movementId);
    if (saved.error) console.error("[resume] no se pudo guardar el avance", saved.error.message);
  };

  const second = await runSecondLeg(
    deps.swap,
    { usdt: deps.usdt, toToken: deps.tokenAddress(plan.to), usdtAmount: plan.usdtAmount, minAmountOut: plan.minAmountOut },
    saveProgress,
  );
  legs[1] = second.record;
  const finalTxHash = second.record.swapHash as Hash;
  await confirmConversion(db, plan.movementId, plan.amountIn, second.received, finalTxHash, legs);
  return { amountOut: second.received, finalTxHash };
}

export type RecoveryOutcome =
  | { kind: "completed"; amountOut: bigint }
  | { kind: "wait"; reason: string }
  | { kind: "needs_review"; reason: string };

/**
 * Lo que usa el liberador: retoma un cambio a medias por su cuenta, con tope de intentos. Nunca tira error:
 * si no se puede, devuelve `needs_review` y el hito queda tal cual (el próximo barrido lo vuelve a mirar).
 */
export async function recoverConversion(deps: ResumeDeps, milestoneId: string): Promise<RecoveryOutcome> {
  let plan: RecoveryPlan;
  try {
    plan = await inspectConversion(deps, milestoneId);
  } catch (error) {
    return { kind: "needs_review", reason: error instanceof Error ? error.message : "no se pudo revisar el cambio" };
  }

  if (plan.action === "wait") return { kind: "wait", reason: plan.reason };

  if (plan.action === "finalize") {
    try {
      await confirmConversion(deps.db, plan.movementId, plan.amountIn, plan.amountOut, plan.finalTxHash, plan.legs);
      return { kind: "completed", amountOut: plan.amountOut };
    } catch (error) {
      return { kind: "needs_review", reason: error instanceof Error ? error.message : "no se pudo cerrar el cambio" };
    }
  }

  // Tramo 2: con tope de intentos, anotado ANTES de mandar nada.
  if (plan.attempts >= MAX_RECOVERY_ATTEMPTS) {
    return { kind: "needs_review", reason: `Ya se intentó retomar ${plan.attempts} veces: revisar a mano.` };
  }
  const counted = { ...plan, attempts: plan.attempts + 1 };
  const saved = await deps.db
    .from("movements")
    .update({ details: { provider: "textile", legs: [counted.firstLeg], recoveryAttempts: counted.attempts } })
    .eq("id", plan.movementId);
  if (saved.error) return { kind: "needs_review", reason: `No se pudo anotar el intento: ${saved.error.message}` };

  try {
    const result = await resumeConversion(deps, counted);
    return { kind: "completed", amountOut: result.amountOut };
  } catch (error) {
    return { kind: "needs_review", reason: error instanceof Error ? error.message : "el tramo 2 falló" };
  }
}
