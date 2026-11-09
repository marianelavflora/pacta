// Recuperación de un cambio de moneda que quedó a medias (PAC-32).
//
// Caso: el tramo 1 (moneda → USDT) salió y el hito quedó en `converting` con el cambio en `pending`; el USDT
// está en la wallet del agente. El liberador NUNCA retoma esto solo (podría cambiar dos veces): lo hace una
// persona con `npm run conversion:resume`, que usa este módulo. Hace SOLO el tramo 2 (USDT → moneda de cobro) y
// deja el cambio confirmado; el pago lo hace después el liberador de siempre (retoma un cambio confirmado
// sin cambiar de nuevo).
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
};

export type ResumePlan = {
  milestoneId: string;
  movementId: string;
  from: TokenSymbol;
  to: TokenSymbol;
  /** Lo que se vendió en el tramo 1, en la moneda de origen. */
  amountIn: bigint;
  /** El USDT que realmente llegó del tramo 1 (leído del bloque de su recibo). */
  usdtAmount: bigint;
  estimate: bigint;
  minAmountOut: bigint;
  firstLeg: LegRecord;
};

type Row = Record<string, unknown>;

// Se acepta recibir hasta 10 % menos que lo estimado (igual que en el liberador).
const MIN_OUT_PERCENT = BigInt(90);
const HUNDRED = BigInt(100);

function fail(message: string): never {
  throw new Error(message);
}

/** Revisa que el hito sea retomable y arma el plan. No manda nada ni escribe en la base. */
export async function planResume(deps: ResumeDeps, milestoneId: string): Promise<ResumePlan> {
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

  const legs = ((movement.details as { legs?: LegRecord[] } | null)?.legs ?? []) as LegRecord[];
  if (legs.length !== 1) fail(`Se esperaba exactamente 1 tramo guardado y hay ${legs.length}: revisar a mano.`);
  const firstLeg = legs[0];
  if (!firstLeg.swapHash) fail("El tramo 1 no tiene hash de swap: no se sabe si salió. Revisar a mano.");

  // El tramo 1 tiene que haber salido bien, y se lee cuánto USDT llegó EN ESE BLOQUE (no "lo último").
  const receipt = await swap.chain.waitForReceipt(firstLeg.swapHash as Hash);
  if (receipt.status !== "success") fail("El swap del tramo 1 se revirtió: no hay nada que retomar. Revisar a mano.");
  if (receipt.blockNumber === undefined) fail("El recibo del tramo 1 no trae el bloque.");
  const usdtAmount = await receivedInBlock(swap, deps.usdt, receipt.blockNumber);
  if (usdtAmount <= BigInt(0)) fail("El tramo 1 no entregó USDT: revisar a mano.");

  // Y ese USDT tiene que estar hoy en la wallet del agente.
  const usdtBalance = await swap.chain.balanceOf(deps.usdt);
  if (usdtBalance < usdtAmount) fail(`El agente tiene ${usdtBalance} de USDT y el tramo 2 necesita ${usdtAmount}.`);

  const from = movement.from_currency as TokenSymbol;
  const to = movement.to_currency as TokenSymbol;
  const amountIn = BigInt(String(movement.amount_in));
  const estimate = await deps.estimate(from, to, amountIn);
  if (estimate === null || estimate <= BigInt(0)) fail("Textile no tiene una ruta real hoy para este cambio.");

  return {
    milestoneId,
    movementId: movement.id as string,
    from,
    to,
    amountIn,
    usdtAmount,
    estimate,
    minAmountOut: (estimate * MIN_OUT_PERCENT) / HUNDRED,
    firstLeg: { ...firstLeg, receivedAmount: usdtAmount.toString() },
  };
}

/** Hace el tramo 2 y deja el cambio confirmado. MANDA TRANSACCIONES: solo se llama con aprobación expresa. */
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
      .update({ details: { provider: "textile", legs: [...legs] } })
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
  const confirmed = await db
    .from("movements")
    .update({
      status: "confirmed",
      amount_out: second.received.toString(),
      fx_rate: rateText(plan.amountIn, second.received),
      tx_hash: finalTxHash.toLowerCase(),
      details: { provider: "textile", legs },
    })
    .eq("id", plan.movementId);
  if (confirmed.error) {
    fail(`El tramo 2 salió (${finalTxHash}, recibido ${second.received}) pero no se pudo guardar: ${confirmed.error.message}. Revisar a mano.`);
  }
  return { amountOut: second.received, finalTxHash };
}
