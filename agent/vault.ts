// Bóveda del agente (PAC-21): detecta los depósitos del cliente y financia el acuerdo.
// SOLO LEE la cadena: no manda transacciones ni usa AGENT_PRIVATE_KEY (la wallet y el
// cliente de lectura llegan por parámetro; los arma la ruta). Así se prueba sin red.
import { verifyTx } from "@celo/attribution-tags";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAddress, parseAbiItem, parseEventLogs, type Address, type Hash, type Log } from "viem";

import type { TokenSymbol } from "@/lib/chain/tokens";

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

/** Lo mínimo que usamos del cliente público de viem (el real y el falso de los tests lo cumplen). */
export type VaultChainClient = {
  getTransactionReceipt(args: { hash: Hash }): Promise<{
    status: "success" | "reverted";
    logs: Log[];
  }>;
  getBlockNumber(): Promise<bigint>;
  getLogs(args: {
    address: Address;
    event: typeof transferEvent;
    args: { to: Address };
    fromBlock: bigint;
    toBlock: bigint;
  }): Promise<Log[]>;
  // Para verifyTx.
  getTransaction: (args: { hash: Hash }) => Promise<unknown>;
};

export type VaultDeps = {
  db: SupabaseClient;
  client: VaultChainClient;
  /** Wallet del agente (la bóveda): destino de los depósitos. */
  agentAddress: Address;
  /** Tag de atribución que tiene que llevar la transacción. */
  tag: string;
  /** Token (dirección) de cada moneda en la red configurada. */
  tokenAddress: (currency: TokenSymbol) => Address;
};

export type DepositResult =
  | { kind: "recorded" | "already_recorded"; amount: string; fundedMilestones: string[]; agreementFunded: boolean }
  | { kind: "agreement_not_found" }
  | { kind: "tx_not_found" }
  | { kind: "tx_failed" }
  | { kind: "wrong_transfer" } // otro token, otro destino, o no hay una sola transferencia clara
  | { kind: "no_tag" }
  | { kind: "wrong_sender" } // el acuerdo ya tiene otra wallet de cliente
  | { kind: "tx_used_elsewhere" }; // esa transacción ya está asignada a otro acuerdo

type Row = Record<string, unknown>;
const UNIQUE_VIOLATION = "23505";

function fail(step: string, error: { message: string }): never {
  throw new Error(`No se pudo ${step}: ${error.message}`);
}

const AGREEMENT_COLUMNS =
  "id, public_id, client_wallet, client_currency, total_amount::text, status, created_at";

/** Verifica el depósito en la cadena (recibo, transferencia y tag) y lo registra en la base. */
export async function confirmDeposit(
  deps: VaultDeps,
  publicId: string,
  txHash: Hash,
): Promise<DepositResult> {
  const { db, client } = deps;
  const found = await db.from("agreements").select(AGREEMENT_COLUMNS).eq("public_id", publicId).maybeSingle();
  if (found.error) fail("buscar el acuerdo", found.error);
  if (!found.data) return { kind: "agreement_not_found" };
  const agreement = found.data as Row;
  const agreementId = agreement.id as string;
  const hash = txHash.toLowerCase() as Hash;

  // 1) Leer la cadena.
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash });
  } catch {
    return { kind: "tx_not_found" };
  }
  if (receipt.status !== "success") return { kind: "tx_failed" };

  const token = deps.tokenAddress(agreement.client_currency as TokenSymbol).toLowerCase();
  const agent = deps.agentAddress.toLowerCase();
  const transfers = parseEventLogs({ abi: [transferEvent], logs: receipt.logs }).filter(
    (log) => log.address.toLowerCase() === token && log.args.to?.toLowerCase() === agent,
  );
  // Tiene que haber una sola transferencia del token esperado hacia la bóveda.
  if (transfers.length !== 1) return { kind: "wrong_transfer" };
  const amount = transfers[0].args.value;
  const sender = transfers[0].args.from?.toLowerCase();
  if (amount === undefined || sender === undefined || amount <= BigInt(0)) {
    return { kind: "wrong_transfer" };
  }

  // Sin tag no suma y no se puede agregar después (regla 1 de AGENTS.md).
  const attribution = await verifyTx({ client: client as never, hash }).catch(() => null);
  if (!attribution || !attribution.codes.includes(deps.tag)) return { kind: "no_tag" };

  // 1b) Una tx ya asignada a otro acuerdo no puede tocar este (ni fijar su wallet de cliente).
  const prior = await db.from("movements").select("agreement_id").eq("tx_hash", hash).maybeSingle();
  if (prior.error) fail("buscar el depósito", prior.error);
  if (prior.data && (prior.data as Row).agreement_id !== agreementId) {
    return { kind: "tx_used_elsewhere" };
  }

  // 2) La wallet del cliente: la primera que deposita queda fija.
  const current = agreement.client_wallet as string | null;
  if (current && current !== sender) return { kind: "wrong_sender" };
  if (!current) {
    const claim = await db
      .from("agreements")
      .update({ client_wallet: sender })
      .eq("id", agreementId)
      .is("client_wallet", null)
      .select("id");
    if (claim.error) fail("guardar la wallet del cliente", claim.error);
    if (!claim.data?.length) {
      // Alguien llegó antes: si no es la misma wallet, se rechaza.
      const again = await db.from("agreements").select("client_wallet").eq("id", agreementId).single();
      if (again.error) fail("releer el acuerdo", again.error);
      if ((again.data as Row).client_wallet !== sender) return { kind: "wrong_sender" };
    }
  }

  // 3) Guardar el movimiento. tx_hash es único: reprocesar la misma tx no duplica nada.
  const inserted = await db.from("movements").insert({
    agreement_id: agreementId,
    kind: "deposit",
    from_currency: agreement.client_currency,
    amount_in: amount.toString(),
    tx_hash: hash,
    status: "confirmed",
  });
  let duplicated = false;
  if (inserted.error) {
    if (inserted.error.code !== UNIQUE_VIOLATION) fail("guardar el depósito", inserted.error);
    duplicated = true;
    const existing = await db.from("movements").select("agreement_id").eq("tx_hash", hash).maybeSingle();
    if (existing.error) fail("buscar el depósito", existing.error);
    if (existing.data && (existing.data as Row).agreement_id !== agreementId) {
      return { kind: "tx_used_elsewhere" };
    }
  }

  // 4) Financiar hitos con lo depositado. Se recalcula siempre desde la base, así
  // también repara el caso de una corrida anterior que se cortó a la mitad.
  const { fundedMilestones, agreementFunded } = await fundMilestones(db, agreementId, agreement);
  return {
    kind: duplicated ? "already_recorded" : "recorded",
    amount: amount.toString(),
    fundedMilestones,
    agreementFunded,
  };
}

/** Pasa a `funded` los hitos `pending`, en orden de `position`, mientras alcance lo depositado. */
async function fundMilestones(db: SupabaseClient, agreementId: string, agreement: Row) {
  const deposits = await db
    .from("movements")
    .select("amount_in::text")
    .eq("agreement_id", agreementId)
    .eq("kind", "deposit")
    .eq("status", "confirmed");
  if (deposits.error) fail("sumar los depósitos", deposits.error);
  const deposited = ((deposits.data ?? []) as Row[]).reduce(
    (sum, row) => sum + BigInt(String(row.amount_in)),
    BigInt(0),
  );

  const list = await db
    .from("milestones")
    .select("id, position, status, amount::text")
    .eq("agreement_id", agreementId)
    .order("position", { ascending: true });
  if (list.error) fail("leer los hitos", list.error);
  const milestones = (list.data ?? []) as Row[];

  // Se acumula el monto de cada hito en orden: se financia mientras lo depositado alcance.
  let covered = BigInt(0);
  const fundedMilestones: string[] = [];
  let allCovered = milestones.length > 0;
  for (const m of milestones) {
    covered += BigInt(String(m.amount));
    if (covered > deposited) {
      allCovered = false;
      break; // en orden: si este no alcanza, los siguientes tampoco se financian
    }
    if (m.status !== "pending") continue;
    const upd = await db
      .from("milestones")
      .update({ status: "funded" })
      .eq("id", m.id)
      .eq("status", "pending")
      .select("id");
    if (upd.error) fail("financiar el hito", upd.error);
    if (upd.data?.length) fundedMilestones.push(m.id as string);
  }

  const agreementFunded = allCovered && deposited >= BigInt(String(agreement.total_amount));
  if (agreementFunded && agreement.status === "pending") {
    const upd = await db
      .from("agreements")
      .update({ status: "funded", funded_at: new Date().toISOString() })
      .eq("id", agreementId)
      .eq("status", "pending");
    if (upd.error) fail("marcar el acuerdo como financiado", upd.error);
    // TODO: llamar a onAgreementFunded (lib/notify/events.ts) cuando exista (#42).
  }
  return { fundedMilestones, agreementFunded };
}

export type ScanSummary = {
  scanned: number;
  recorded: number;
  skipped: number;
  fromBlock: string;
  toBlock: string;
};

/**
 * Barrido de solo lectura para el cron: mira las transferencias recientes hacia la bóveda y
 * confirma las que vienen de la wallet de un acuerdo todavía sin financiar. Los acuerdos
 * sin `client_wallet` se asignan al avisar el depósito (POST /api/agreements/[id]/deposit).
 */
export async function scanDeposits(deps: VaultDeps, lookbackBlocks: bigint): Promise<ScanSummary> {
  const { db, client } = deps;
  const open = await db
    .from("agreements")
    .select(AGREEMENT_COLUMNS)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (open.error) fail("buscar acuerdos sin financiar", open.error);
  const agreements = ((open.data ?? []) as Row[]).filter(
    (a) => typeof a.client_wallet === "string" && isAddress(a.client_wallet as string),
  );

  const toBlock = await client.getBlockNumber();
  const fromBlock = toBlock > lookbackBlocks ? toBlock - lookbackBlocks : BigInt(0);
  const summary: ScanSummary = {
    scanned: 0,
    recorded: 0,
    skipped: 0,
    fromBlock: String(fromBlock),
    toBlock: String(toBlock),
  };

  const currencies = [...new Set(agreements.map((a) => a.client_currency as TokenSymbol))];
  for (const currency of currencies) {
    const logs = await client.getLogs({
      address: deps.tokenAddress(currency),
      event: transferEvent,
      args: { to: deps.agentAddress },
      fromBlock,
      toBlock,
    });
    const seen = new Set<string>();
    for (const log of parseEventLogs({ abi: [transferEvent], logs })) {
      const hash = log.transactionHash?.toLowerCase();
      if (!hash || seen.has(hash)) continue;
      seen.add(hash);
      summary.scanned++;
      const from = log.args.from?.toLowerCase();
      // El acuerdo más viejo (orden de creación) de esa wallet y moneda sin financiar.
      const match = agreements.find(
        (a) => a.client_currency === currency && (a.client_wallet as string).toLowerCase() === from,
      );
      if (!match) {
        summary.skipped++;
        continue;
      }
      const result = await confirmDeposit(deps, match.public_id as string, hash as Hash);
      if (result.kind === "recorded") summary.recorded++;
      else summary.skipped++;
    }
  }
  return summary;
}
