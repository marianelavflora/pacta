// PAC-21 · Bóveda: detectar depósitos. Sin red: cliente público falso y base en memoria.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics, parseAbiItem, type Address, type Hash } from "viem";

const verifyTx = vi.hoisted(() => vi.fn());
vi.mock("@celo/attribution-tags", () => ({ verifyTx }));

import { confirmDeposit, scanDeposits, type VaultDeps } from "@/agent/vault";

const transfer = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const AGENT = "0xab569A8d8A5b60CFfdf9B88EdE099c80d8328E73" as Address;
const TOKEN = "0xd76f5faf6888e24d9f04bf92a0c8b921fe4390e0" as Address;
const OTHER_TOKEN = "0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d" as Address;
const CLIENT = "0x" + "c1".repeat(20);
const OTHER_CLIENT = "0x" + "c2".repeat(20);
const TAG = "celo_test";
const E18 = BigInt(10) ** BigInt(18);
const hashOf = (n: number) => ("0x" + n.toString(16).padStart(64, "0")) as Hash;

type Row = Record<string, unknown>;

class FakeDb {
  tables: Record<string, Row[]> = { agreements: [], milestones: [], movements: [] };
  from(table: string) {
    return new FakeQuery(this, table);
  }
  asClient() {
    return this as unknown as SupabaseClient;
  }
}

class FakeQuery {
  private op: "select" | "update" | "insert" = "select";
  private patch: Row = {};
  private filters: [string, unknown][] = [];
  private orderBy: string | null = null;
  private returning = false;
  constructor(
    private db: FakeDb,
    private table: string,
  ) {}
  select() {
    if (this.op === "select") this.returning = true;
    else this.returning = true;
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.patch = patch;
    return this;
  }
  insert(row: Row) {
    this.op = "insert";
    this.patch = row;
    return this;
  }
  eq(c: string, v: unknown) {
    this.filters.push([c, v]);
    return this;
  }
  is(c: string, v: unknown) {
    this.filters.push([c, v]);
    return this;
  }
  order(c: string) {
    this.orderBy = c;
    return this;
  }
  private run(): { data: Row[] | null; error: { message: string; code?: string } | null } {
    const rows = this.db.tables[this.table];
    if (this.op === "insert") {
      const hash = this.patch.tx_hash;
      if (hash && rows.some((r) => r.tx_hash === hash)) {
        return { data: null, error: { message: "duplicate key", code: "23505" } };
      }
      rows.push({ id: `m${rows.length}`, ...this.patch });
      return { data: null, error: null };
    }
    const matched = rows.filter((r) => this.filters.every(([c, v]) => r[c] === v));
    if (this.op === "update") matched.forEach((r) => Object.assign(r, this.patch));
    const out = matched.map((r) => ({ ...r }));
    if (this.orderBy) out.sort((a, b) => Number(a[this.orderBy!]) - Number(b[this.orderBy!]));
    return { data: out, error: null };
  }
  maybeSingle() {
    const res = this.run();
    return Promise.resolve({ data: res.data?.[0] ?? null, error: res.error });
  }
  single() {
    return this.maybeSingle();
  }
  then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
    return Promise.resolve(this.run()).then(resolve, reject);
  }
}

type FakeTx = { status?: "success" | "reverted"; token?: Address; to?: Address; from?: string; amount: bigint };

function makeClient(txs: Record<string, FakeTx>) {
  const logFor = (hash: Hash, tx: FakeTx) => ({
    address: tx.token ?? TOKEN,
    topics: encodeEventTopics({
      abi: [transfer],
      eventName: "Transfer",
      args: { from: (tx.from ?? CLIENT) as Address, to: tx.to ?? AGENT },
    }),
    data: encodeAbiParameters([{ type: "uint256" }], [tx.amount]),
    transactionHash: hash,
  });
  return {
    async getTransactionReceipt({ hash }: { hash: Hash }) {
      const tx = txs[hash];
      if (!tx) throw new Error("not found");
      return { status: tx.status ?? "success", logs: [logFor(hash, tx)] } as never;
    },
    async getBlockNumber() {
      return BigInt(5000);
    },
    getLogs: vi.fn(async () => Object.entries(txs).map(([h, tx]) => logFor(h as Hash, tx)) as never),
    async getTransaction() {
      return {};
    },
  };
}

let db: FakeDb;
function setup(txs: Record<string, FakeTx>, clientWallet: string | null = null) {
  db = new FakeDb();
  db.tables.agreements.push({
    id: "a1",
    public_id: "abcd1234",
    client_wallet: clientWallet,
    client_currency: "wBRL",
    total_amount: String(2000n * E18),
    status: "pending",
    created_at: 1,
  });
  [500n, 1000n, 500n].forEach((amount, i) =>
    db.tables.milestones.push({
      id: `ms${i + 1}`,
      agreement_id: "a1",
      position: i + 1,
      status: "pending",
      amount: String(amount * E18),
    }),
  );
  const deps: VaultDeps = {
    db: db.asClient(),
    client: makeClient(txs) as never,
    agentAddress: AGENT,
    tag: TAG,
    tokenAddress: (c) => (c === "wBRL" ? TOKEN : OTHER_TOKEN),
  };
  return deps;
}

const statuses = () => db.tables.milestones.map((m) => m.status);

beforeEach(() => {
  verifyTx.mockReset();
  verifyTx.mockResolvedValue({ codes: [TAG] });
});

describe("confirmDeposit", () => {
  it("depósito completo: guarda el movimiento, fija la wallet y financia todo", async () => {
    const deps = setup({ [hashOf(1)]: { amount: 2000n * E18 } });
    const res = await confirmDeposit(deps, "abcd1234", hashOf(1));
    expect(res).toMatchObject({ kind: "recorded", agreementFunded: true, amount: String(2000n * E18) });
    expect(statuses()).toEqual(["funded", "funded", "funded"]);
    expect(db.tables.agreements[0]).toMatchObject({ client_wallet: CLIENT, status: "funded" });
    expect(db.tables.movements).toHaveLength(1);
    expect(db.tables.movements[0]).toMatchObject({ kind: "deposit", status: "confirmed", tx_hash: hashOf(1) });
  });

  it("en partes: financia los hitos en orden a medida que alcanza", async () => {
    const deps = setup({
      [hashOf(1)]: { amount: 400n * E18 },
      [hashOf(2)]: { amount: 100n * E18 },
      [hashOf(3)]: { amount: 1000n * E18 },
      [hashOf(4)]: { amount: 500n * E18 },
    });
    expect(await confirmDeposit(deps, "abcd1234", hashOf(1))).toMatchObject({ fundedMilestones: [] });
    expect(statuses()).toEqual(["pending", "pending", "pending"]);
    // 400 + 100 = 500: alcanza para el hito 1.
    expect(await confirmDeposit(deps, "abcd1234", hashOf(2))).toMatchObject({ fundedMilestones: ["ms1"] });
    // 1500: alcanza para el 2, no para el 3.
    expect(await confirmDeposit(deps, "abcd1234", hashOf(3))).toMatchObject({
      fundedMilestones: ["ms2"],
      agreementFunded: false,
    });
    expect(statuses()).toEqual(["funded", "funded", "pending"]);
    expect(db.tables.agreements[0].status).toBe("pending");
    expect(await confirmDeposit(deps, "abcd1234", hashOf(4))).toMatchObject({ agreementFunded: true });
    expect(statuses()).toEqual(["funded", "funded", "funded"]);
    expect(db.tables.agreements[0].status).toBe("funded");
  });

  it("repetido: la misma tx no duplica el movimiento ni vuelve a contar", async () => {
    const deps = setup({ [hashOf(1)]: { amount: 500n * E18 } });
    await confirmDeposit(deps, "abcd1234", hashOf(1));
    const again = await confirmDeposit(deps, "abcd1234", hashOf(1));
    expect(again).toMatchObject({ kind: "already_recorded", fundedMilestones: [] });
    expect(db.tables.movements).toHaveLength(1);
    expect(statuses()).toEqual(["funded", "pending", "pending"]);
  });

  it("acepta el hash en mayúsculas y lo guarda en minúsculas", async () => {
    const deps = setup({ [hashOf(255)]: { amount: 500n * E18 } });
    await confirmDeposit(deps, "abcd1234", hashOf(255).toUpperCase().replace("0X", "0x") as Hash);
    expect(db.tables.movements[0].tx_hash).toBe(hashOf(255));
  });

  it("remitente distinto al de la wallet ya fijada: rechaza y no guarda nada", async () => {
    const deps = setup({ [hashOf(1)]: { amount: 500n * E18, from: OTHER_CLIENT } }, CLIENT);
    expect(await confirmDeposit(deps, "abcd1234", hashOf(1))).toEqual({ kind: "wrong_sender" });
    expect(db.tables.movements).toHaveLength(0);
    expect(statuses()).toEqual(["pending", "pending", "pending"]);
  });

  it("token equivocado o destinatario equivocado", async () => {
    const deps = setup({
      [hashOf(1)]: { amount: 500n * E18, token: OTHER_TOKEN },
      [hashOf(2)]: { amount: 500n * E18, to: ("0x" + "99".repeat(20)) as Address },
    });
    expect(await confirmDeposit(deps, "abcd1234", hashOf(1))).toEqual({ kind: "wrong_transfer" });
    expect(await confirmDeposit(deps, "abcd1234", hashOf(2))).toEqual({ kind: "wrong_transfer" });
    expect(db.tables.movements).toHaveLength(0);
    expect(db.tables.agreements[0].client_wallet).toBeNull();
  });

  it("tx fallida o inexistente", async () => {
    const deps = setup({ [hashOf(1)]: { amount: 500n * E18, status: "reverted" } });
    expect(await confirmDeposit(deps, "abcd1234", hashOf(1))).toEqual({ kind: "tx_failed" });
    expect(await confirmDeposit(deps, "abcd1234", hashOf(9))).toEqual({ kind: "tx_not_found" });
    expect(db.tables.movements).toHaveLength(0);
  });

  it("sin tag (o con otro tag): no suma", async () => {
    const deps = setup({ [hashOf(1)]: { amount: 500n * E18 } });
    verifyTx.mockResolvedValueOnce(null);
    expect(await confirmDeposit(deps, "abcd1234", hashOf(1))).toEqual({ kind: "no_tag" });
    verifyTx.mockResolvedValueOnce({ codes: ["celo_otro"] });
    expect(await confirmDeposit(deps, "abcd1234", hashOf(1))).toEqual({ kind: "no_tag" });
    expect(db.tables.movements).toHaveLength(0);
  });

  it("acuerdo inexistente y tx ya usada en otro acuerdo", async () => {
    const deps = setup({ [hashOf(1)]: { amount: 500n * E18 } });
    expect(await confirmDeposit(deps, "nadie123", hashOf(1))).toEqual({ kind: "agreement_not_found" });
    db.tables.movements.push({ id: "x", agreement_id: "otro", kind: "deposit", tx_hash: hashOf(1) });
    expect(await confirmDeposit(deps, "abcd1234", hashOf(1))).toEqual({ kind: "tx_used_elsewhere" });
    // La tx de otro acuerdo no debe fijar la wallet de cliente de este.
    expect(db.tables.agreements[0].client_wallet).toBeNull();
  });

  it("nunca manda transacciones: el cliente falso no tiene métodos de escritura", async () => {
    const deps = setup({ [hashOf(1)]: { amount: 500n * E18 } });
    expect(Object.keys(deps.client)).not.toContain("sendTransaction");
    expect(Object.keys(deps.client)).not.toContain("writeContract");
  });
});

describe("scanDeposits", () => {
  it("confirma las transferencias de la wallet de un acuerdo abierto y es idempotente", async () => {
    const deps = setup({ [hashOf(1)]: { amount: 500n * E18 }, [hashOf(2)]: { amount: 5n * E18, from: OTHER_CLIENT } }, CLIENT);
    const first = await scanDeposits(deps, BigInt(2000));
    expect(first).toMatchObject({ scanned: 2, recorded: 1, skipped: 1 });
    expect(statuses()).toEqual(["funded", "pending", "pending"]);
    const second = await scanDeposits(deps, BigInt(2000));
    expect(second.recorded).toBe(0);
    expect(db.tables.movements).toHaveLength(1);
  });
});
