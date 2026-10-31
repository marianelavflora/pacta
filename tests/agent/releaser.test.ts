// PAC-26 · Liberador v1. Sin red: base en memoria y cadena falsa.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address, Hash } from "viem";

import { releaseApproved, releaseMilestone, type ReleaserChain, type ReleaserDeps } from "@/agent/releaser";

const AGENT = "0xab569A8d8A5b60CFfdf9B88EdE099c80d8328E73" as Address;
const FREELANCER = "0x" + "f1".repeat(20);
const TOKEN = "0x7d0f189d248bffe3888903d071bacd5f8c435845" as Address;
const E18 = BigInt(10) ** BigInt(18);
const HUNDRED = BigInt(100) * E18;
const HASH = ("0x" + "ab".repeat(32)) as Hash;

type Row = Record<string, unknown>;

class FakeDb {
  tables: Record<string, Row[]> = { milestones: [], agreements: [], users: [], movements: [] };
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
  private filters: ((r: Row) => boolean)[] = [];
  constructor(
    private db: FakeDb,
    private table: string,
  ) {}
  select() {
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
    this.filters.push((r) => r[c] === v);
    return this;
  }
  neq(c: string, v: unknown) {
    this.filters.push((r) => r[c] !== v);
    return this;
  }
  in(c: string, v: unknown[]) {
    this.filters.push((r) => v.includes(r[c]));
    return this;
  }
  order() {
    return this;
  }
  private run(): { data: Row[] | null; error: { message: string; code?: string } | null } {
    const rows = this.db.tables[this.table];
    if (this.op === "insert") {
      const p = this.patch;
      // Índice único parcial de 0002: un payout/conversion activo por hito.
      if (
        this.table === "movements" &&
        rows.some((r) => r.milestone_id === p.milestone_id && r.kind === p.kind && r.status !== "failed")
      ) {
        return { data: null, error: { message: "duplicate key", code: "23505" } };
      }
      const row = { id: `mv${rows.length}`, tx_hash: null, ...p };
      rows.push(row);
      return { data: [{ ...row }], error: null };
    }
    const matched = rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === "update") matched.forEach((r) => Object.assign(r, this.patch));
    return { data: matched.map((r) => ({ ...r })), error: null };
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

let db: FakeDb;
let chain: {
  balanceOf: ReturnType<typeof vi.fn>;
  simulateTransfer: ReturnType<typeof vi.fn>;
  transfer: ReturnType<typeof vi.fn>;
  waitForReceipt: ReturnType<typeof vi.fn>;
  getReceipt: ReturnType<typeof vi.fn>;
};

function setup(overrides: { status?: string; clientCurrency?: string; wallet?: string } = {}) {
  db = new FakeDb();
  db.tables.users.push({ id: "u1", wallet: overrides.wallet ?? FREELANCER });
  db.tables.agreements.push({
    id: "a1",
    freelancer_id: "u1",
    client_currency: overrides.clientCurrency ?? "wARS",
    payout_currency: "wARS",
  });
  db.tables.milestones.push({
    id: "m1",
    agreement_id: "a1",
    status: overrides.status ?? "approved",
    amount: HUNDRED.toString(),
  });
  chain = {
    balanceOf: vi.fn(async () => BigInt(1000) * E18),
    simulateTransfer: vi.fn(async () => undefined),
    transfer: vi.fn(async () => HASH),
    waitForReceipt: vi.fn(async () => ({ status: "success" as const })),
    getReceipt: vi.fn(async () => null),
  };
}

const deps = (extra: Partial<ReleaserDeps> = {}): ReleaserDeps => ({
  db: db.asClient(),
  chain: chain as unknown as ReleaserChain,
  agentAddress: AGENT,
  tokenAddress: () => TOKEN,
  ...extra,
});
const milestone = () => db.tables.milestones[0];

describe("liberador: pagar un hito aprobado", () => {
  beforeEach(() => setup());

  it("paga, guarda el movimiento y deja el hito en paid", async () => {
    const result = await releaseMilestone(deps(), "m1");
    expect(result).toEqual({ kind: "paid", txHash: HASH, amount: HUNDRED.toString() });
    expect(chain.transfer).toHaveBeenCalledWith(TOKEN, FREELANCER, HUNDRED);
    expect(db.tables.movements).toHaveLength(1);
    expect(db.tables.movements[0]).toMatchObject({ kind: "payout", status: "confirmed", tx_hash: HASH, milestone_id: "m1" });
    expect(milestone().status).toBe("paid");
    expect(milestone().paid_at).toBeTruthy();
  });

  it("si la tarea corre dos veces, paga una sola vez", async () => {
    await releaseMilestone(deps(), "m1");
    const second = await releaseMilestone(deps(), "m1");
    expect(second).toEqual({ kind: "already_paid" });
    expect(chain.transfer).toHaveBeenCalledTimes(1);
    expect(db.tables.movements).toHaveLength(1);
  });

  it("dos ejecuciones a la vez pagan una sola vez", async () => {
    chain.transfer.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return HASH;
    });
    const results = await Promise.all([releaseMilestone(deps(), "m1"), releaseMilestone(deps(), "m1")]);
    expect(results.map((r) => r.kind).sort()).toEqual(["in_progress", "paid"]);
    expect(chain.transfer).toHaveBeenCalledTimes(1);
    expect(db.tables.movements.filter((m) => m.status !== "failed")).toHaveLength(1);
  });

  it("si la tx se revierte, el movimiento queda failed y el hito se puede reintentar", async () => {
    chain.waitForReceipt.mockResolvedValueOnce({ status: "reverted" });
    const first = await releaseMilestone(deps(), "m1");
    expect(first.kind).toBe("tx_failed");
    expect(db.tables.movements[0].status).toBe("failed");
    expect(milestone().status).toBe("approved");

    chain.transfer.mockResolvedValueOnce(("0x" + "cd".repeat(32)) as Hash);
    const retry = await releaseMilestone(deps(), "m1");
    expect(retry.kind).toBe("paid");
    expect(db.tables.movements.filter((m) => m.status === "confirmed")).toHaveLength(1);
  });

  it("si la simulacion revierte (seguro que no salio), no queda nada a medias y el hito sigue approved", async () => {
    chain.simulateTransfer.mockRejectedValueOnce(new Error("execution reverted"));
    const result = await releaseMilestone(deps(), "m1");
    expect(result).toMatchObject({ kind: "tx_failed" });
    expect(chain.transfer).not.toHaveBeenCalled();
    expect(db.tables.movements).toHaveLength(0);
    expect(milestone().status).toBe("approved");
  });

  it("si el envio falla SIN hash (ambiguo), queda pending/converting para revision manual y no se reintenta", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    chain.transfer.mockRejectedValueOnce(new Error("timeout de RPC"));
    const result = await releaseMilestone(deps(), "m1");
    expect(result.kind).toBe("needs_review");
    expect(db.tables.movements[0]).toMatchObject({ status: "pending", tx_hash: null });
    expect(milestone().status).toBe("converting");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("REVISION MANUAL"));

    // Las corridas siguientes (y el barrido del cron) no reenvian.
    expect((await releaseMilestone(deps(), "m1")).kind).toBe("needs_review");
    await releaseApproved(deps());
    expect(chain.transfer).toHaveBeenCalledTimes(1);
    expect(db.tables.movements).toHaveLength(1);
    log.mockRestore();
  });

  it("si el recibo tarda, queda pendiente y la próxima corrida reconcilia sin reenviar", async () => {
    chain.waitForReceipt.mockRejectedValueOnce(new Error("timeout"));
    expect((await releaseMilestone(deps(), "m1")).kind).toBe("in_progress");
    expect(milestone().status).toBe("converting");
    expect(db.tables.movements[0]).toMatchObject({ status: "pending", tx_hash: HASH });

    chain.getReceipt.mockResolvedValueOnce({ status: "success" });
    expect((await releaseMilestone(deps(), "m1")).kind).toBe("paid");
    expect(chain.transfer).toHaveBeenCalledTimes(1);
    expect(milestone().status).toBe("paid");
  });

  it("converting sin tx_hash no reenvía (no sabemos si salió)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    setup({ status: "converting" });
    db.tables.movements.push({
      id: "mv0",
      milestone_id: "m1",
      kind: "payout",
      status: "pending",
      tx_hash: null,
      amount_out: HUNDRED.toString(),
    });
    expect((await releaseMilestone(deps(), "m1")).kind).toBe("needs_review");
    expect(chain.transfer).not.toHaveBeenCalled();
  });

  it("no paga si el saldo del agente no alcanza", async () => {
    chain.balanceOf.mockResolvedValue(BigInt(99) * E18);
    expect((await releaseMilestone(deps(), "m1")).kind).toBe("insufficient_balance");
    expect(chain.transfer).not.toHaveBeenCalled();
    expect(db.tables.movements).toHaveLength(0);
    expect(milestone().status).toBe("approved");
  });

  it.each(["pending", "funded", "delivered", "reminded", "paused", "expired"])(
    "no paga un hito en estado %s",
    async (status) => {
      setup({ status });
      const result = await releaseMilestone(deps(), "m1");
      expect(result).toEqual({ kind: "wrong_status", status });
      expect(chain.transfer).not.toHaveBeenCalled();
      expect(db.tables.movements).toHaveLength(0);
    },
  );

  it("hito inexistente", async () => {
    expect((await releaseMilestone(deps(), "nope")).kind).toBe("not_found");
  });

  it("si la moneda del cliente es otra, no paga (la conversión es PAC-32)", async () => {
    setup({ clientCurrency: "wBRL" });
    expect((await releaseMilestone(deps(), "m1")).kind).toBe("needs_conversion");
    expect(chain.transfer).not.toHaveBeenCalled();
  });

  it("wallet inválida de la freelancer: no paga", async () => {
    setup({ wallet: "no-es-una-wallet" });
    expect((await releaseMilestone(deps(), "m1")).kind).toBe("no_freelancer_wallet");
    expect(chain.transfer).not.toHaveBeenCalled();
  });

  it("respeta el tope opcional por pago", async () => {
    expect((await releaseMilestone(deps({ maxPayoutPerMilestone: BigInt(50) * E18 }), "m1")).kind).toBe("over_cap");
    expect(chain.transfer).not.toHaveBeenCalled();
    expect((await releaseMilestone(deps({ maxPayoutPerMilestone: HUNDRED }), "m1")).kind).toBe("paid");
  });

  it("el barrido paga los aprobados y resume el resultado", async () => {
    const summary = await releaseApproved(deps());
    expect(summary).toMatchObject({ processed: 1, paid: 1 });
  });
});

// Pendiente (otros tickets): recordatorios y topes.
describe("agente: recordatorios y topes", () => {
  it.todo("manda el segundo aviso al día 3 sin respuesta (reminded)");
  it.todo("libera el hito solo al día 6 sin respuesta (expired)");
  it.todo("respeta el tope por acuerdo y el tope diario (PAC-46)");
});
