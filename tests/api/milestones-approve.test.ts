// PAC-25 · POST /api/milestones/[id]/approve. Sin red: la base es un doble en memoria.
import type { SupabaseClient } from "@supabase/supabase-js";
import { privateKeyToAccount } from "viem/accounts";
import { beforeEach, describe, expect, it } from "vitest";
import { approveMilestone } from "@/lib/approvals";
import { buildApprovalTypedData } from "@/lib/chain/approval";
import { approveMilestoneSchema } from "@/lib/validation/milestone";

type Row = Record<string, unknown>;

class FakeDb {
  tables: Record<string, Row[]> = { agreements: [], milestones: [] };
  failTable: string | null = null;
  from(table: string) {
    return new FakeQuery(this, table);
  }
  asClient() {
    return this as unknown as SupabaseClient;
  }
}

class FakeQuery {
  private patch: Row | null = null;
  private filters: ((r: Row) => boolean)[] = [];
  private columns: string[] | null = null;
  constructor(
    private db: FakeDb,
    private table: string,
  ) {}
  select(columns?: string) {
    if (columns) this.columns = columns.split(",").map((c) => c.trim().replace(/::text$/, ""));
    return this;
  }
  update(patch: Row) {
    this.patch = patch;
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((r) => r[column] === value);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((r) => values.includes(r[column]));
    return this;
  }
  private run() {
    if (this.db.failTable === this.table) return { data: null, error: { message: "boom secreto" } };
    const rows = this.db.tables[this.table].filter((r) => this.filters.every((f) => f(r)));
    if (this.patch) rows.forEach((r) => Object.assign(r, this.patch));
    const cols = this.columns;
    const out = rows.map((r) => (cols ? Object.fromEntries(cols.map((c) => [c, r[c]])) : { ...r }));
    return { data: out, error: null };
  }
  maybeSingle() {
    const res = this.run();
    return Promise.resolve(res.error ? res : { data: res.data?.[0] ?? null, error: null });
  }
  single() {
    return this.maybeSingle();
  }
}

// Claves públicas conocidas de Hardhat (nunca la del agente).
const client = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const other = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);
const CHAIN = 11142220;
const MILESTONE = "11111111-1111-1111-1111-111111111111";
const OTHER_MILESTONE = "22222222-2222-2222-2222-222222222222";
const AMOUNT = 500000000000000000000n;

const typed = (over: Partial<Parameters<typeof buildApprovalTypedData>[0]> = {}) =>
  buildApprovalTypedData({
    chainId: CHAIN,
    agreementPublicId: "abc123",
    milestoneId: MILESTONE,
    position: 1,
    amount: AMOUNT,
    currency: "wBRL",
    ...over,
  });
const sign = (account = client, over = {}) => account.signTypedData(typed(over));

let db: FakeDb;
const milestone = () => db.tables.milestones[0];

beforeEach(() => {
  db = new FakeDb();
  db.tables.agreements.push({
    id: "a1",
    public_id: "abc123",
    client_wallet: client.address.toLowerCase(),
    client_currency: "wBRL",
  });
  db.tables.milestones.push({
    id: MILESTONE,
    agreement_id: "a1",
    position: 1,
    status: "delivered",
    amount: AMOUNT.toString(),
    approval_signature: null,
    approved_at: null,
  });
});

describe("mensaje de firma", () => {
  it("es determinístico, legible e incluye acuerdo, hito, posición, monto, moneda y red", () => {
    const a = typed();
    expect(a).toEqual(typed());
    expect(a.message.mensaje).toBe(
      "Apruebo el hito 1 del acuerdo abc123 y autorizo liberar 500 wBRL a la freelancer.",
    );
    expect(a.message).toMatchObject({ hito: MILESTONE, posicion: 1n, monto: "500", moneda: "wBRL" });
    expect(a.domain.chainId).toBe(CHAIN);
  });
});

describe("approveMilestone", () => {
  it.each(["delivered", "reminded"])("aprueba un hito en %s con la firma del cliente", async (s) => {
    milestone().status = s;
    const res = await approveMilestone(db.asClient(), MILESTONE, await sign(), CHAIN);
    expect(res.kind).toBe("approved");
    expect(milestone()).toMatchObject({ status: "approved" });
    expect(milestone().approval_signature).toMatch(/^0x/);
    expect(milestone().approved_at).toEqual(expect.any(String));
    expect(JSON.stringify(res)).not.toMatch(/signature|client_wallet|agreement_id/);
  });

  it("rechaza la firma de otra wallet (forbidden) y no cambia nada", async () => {
    const res = await approveMilestone(db.asClient(), MILESTONE, await sign(other), CHAIN);
    expect(res.kind).toBe("forbidden");
    expect(milestone().status).toBe("delivered");
    expect(milestone().approval_signature).toBeNull();
  });

  it("rechaza una firma hecha para otro hito, otra posición o otra red", async () => {
    for (const over of [{ milestoneId: OTHER_MILESTONE }, { position: 2 }, { chainId: 42220 }]) {
      const res = await approveMilestone(db.asClient(), MILESTONE, await sign(client, over), CHAIN);
      expect(res.kind).toBe("forbidden");
    }
    expect(milestone().status).toBe("delivered");
  });

  it("rechaza una firma basura", async () => {
    const res = await approveMilestone(db.asClient(), MILESTONE, "0x" + "1".repeat(130), CHAIN);
    expect(res.kind).toBe("forbidden");
  });

  it.each(["pending", "funded", "expired", "paused"])("no aprueba un hito en %s", async (status) => {
    milestone().status = status;
    const res = await approveMilestone(db.asClient(), MILESTONE, await sign(), CHAIN);
    expect(res).toEqual({ kind: "wrong_status", status });
    expect(milestone().status).toBe(status);
  });

  it.each(["approved", "converting", "paid"])("es idempotente si ya está %s", async (status) => {
    milestone().status = status;
    milestone().approval_signature = "0xprimera";
    milestone().approved_at = "2026-11-01T00:00:00.000Z";
    const res = await approveMilestone(db.asClient(), MILESTONE, await sign(), CHAIN);
    expect(res.kind).toBe("already_approved");
    expect(milestone()).toMatchObject({ status, approval_signature: "0xprimera" });
    expect(milestone().approved_at).toBe("2026-11-01T00:00:00.000Z");
  });

  it("not_found si el hito no existe", async () => {
    const res = await approveMilestone(db.asClient(), OTHER_MILESTONE, await sign(), CHAIN);
    expect(res.kind).toBe("not_found");
  });

  it("avisa si el acuerdo todavía no tiene client_wallet", async () => {
    db.tables.agreements[0].client_wallet = null;
    const res = await approveMilestone(db.asClient(), MILESTONE, await sign(), CHAIN);
    expect(res.kind).toBe("no_client_wallet");
    expect(milestone().status).toBe("delivered");
  });

  it("si la base falla tira un error (la ruta responde 500 sin detalles)", async () => {
    db.failTable = "milestones";
    await expect(approveMilestone(db.asClient(), MILESTONE, await sign(), CHAIN)).rejects.toThrow();
  });
});

describe("approveMilestoneSchema", () => {
  it("pide una firma con formato válido", () => {
    expect(approveMilestoneSchema.safeParse({}).success).toBe(false);
    expect(approveMilestoneSchema.safeParse({ signature: "0x12" }).success).toBe(false);
    expect(approveMilestoneSchema.safeParse({ signature: "0x" + "a".repeat(130) }).success).toBe(true);
  });
});
