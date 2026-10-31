// PAC-22 · POST /api/milestones/[id]/deliver. Sin red: la base es un doble en memoria.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it } from "vitest";
import { deliverMilestone } from "@/lib/milestones";
import { deliverMilestoneSchema } from "@/lib/validation/milestone";

type Row = Record<string, unknown>;

class FakeDb {
  tables: Record<string, Row[]> = { users: [], agreements: [], milestones: [] };
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
  private filters: [string, unknown][] = [];
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
    this.filters.push([column, value]);
    return this;
  }
  private run() {
    if (this.db.failTable === this.table) return { data: null, error: { message: "boom secreto" } };
    const rows = this.db.tables[this.table].filter((r) =>
      this.filters.every(([c, v]) => r[c] === v),
    );
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

const WALLET = "0x" + "a".repeat(40);
const MILESTONE = "11111111-1111-1111-1111-111111111111";
const input = deliverMilestoneSchema.parse({
  freelancerWallet: "0x" + "A".repeat(40),
  deliveryUrl: "https://example.com/entrega",
  deliveryNote: "Listo el primer tramo",
});

let db: FakeDb;
const milestone = () => db.tables.milestones[0];

beforeEach(() => {
  db = new FakeDb();
  db.tables.users.push({ id: "u1", wallet: WALLET, phone: "+5491100000000" });
  db.tables.agreements.push({ id: "a1", freelancer_id: "u1", client_contact: "cliente@mail.com" });
  db.tables.milestones.push({
    id: MILESTONE,
    agreement_id: "a1",
    status: "funded",
    amount: "500000000000000000000",
    delivery_url: null,
    delivery_note: null,
    delivered_at: null,
  });
});

describe("deliverMilestone", () => {
  it("pasa un hito funded a delivered y guarda link, nota y fecha", async () => {
    const res = await deliverMilestone(db.asClient(), MILESTONE, input);
    expect(res.kind).toBe("delivered");
    expect(milestone()).toMatchObject({
      status: "delivered",
      delivery_url: "https://example.com/entrega",
      delivery_note: "Listo el primer tramo",
    });
    expect(milestone().delivered_at).toEqual(expect.any(String));
    if (res.kind === "delivered") {
      expect(res.milestone.amount).toBe("500000000000000000000");
      expect(JSON.stringify(res)).not.toMatch(/phone|cliente@mail|agreement_id/);
    }
  });

  it("es idempotente: si ya está delivered devuelve lo guardado sin pisarlo", async () => {
    await deliverMilestone(db.asClient(), MILESTONE, input);
    const before = { ...milestone() };
    const again = await deliverMilestone(db.asClient(), MILESTONE, {
      ...input,
      deliveryUrl: "https://otro.com/x",
      deliveryNote: "otra nota",
    });
    expect(again.kind).toBe("already_delivered");
    expect(milestone()).toEqual(before);
    if (again.kind === "already_delivered") {
      expect(again.milestone.deliveryUrl).toBe("https://example.com/entrega");
    }
  });

  it.each(["pending", "reminded", "approved", "expired", "converting", "paid", "paused"])(
    "no entrega un hito en %s",
    async (status) => {
      milestone().status = status;
      const res = await deliverMilestone(db.asClient(), MILESTONE, input);
      expect(res).toEqual({ kind: "wrong_status", status });
      expect(milestone().status).toBe(status);
      expect(milestone().delivery_url).toBeNull();
    },
  );

  it("otra wallet no puede entregar (forbidden) y no cambia nada", async () => {
    const res = await deliverMilestone(db.asClient(), MILESTONE, {
      ...input,
      freelancerWallet: "0x" + "b".repeat(40),
    });
    expect(res.kind).toBe("forbidden");
    expect(milestone().status).toBe("funded");
  });

  it("not_found si el hito no existe", async () => {
    const res = await deliverMilestone(
      db.asClient(),
      "22222222-2222-2222-2222-222222222222",
      input,
    );
    expect(res.kind).toBe("not_found");
  });

  it("si la base falla, tira un error (la ruta responde 500 sin detalles)", async () => {
    db.failTable = "milestones";
    await expect(deliverMilestone(db.asClient(), MILESTONE, input)).rejects.toThrow();
  });
});

describe("deliverMilestoneSchema", () => {
  const ok = { freelancerWallet: WALLET, deliveryUrl: "https://example.com/x" };

  it("acepta sin nota y pasa la wallet a minúscula", () => {
    const parsed = deliverMilestoneSchema.parse({ ...ok, freelancerWallet: "0x" + "A".repeat(40) });
    expect(parsed.freelancerWallet).toBe(WALLET);
    expect(parsed.deliveryNote).toBeUndefined();
  });

  it.each(["http://example.com", "javascript:alert(1)", "no es un link", ""])(
    "rechaza el link %j",
    (deliveryUrl) => {
      const res = deliverMilestoneSchema.safeParse({ ...ok, deliveryUrl });
      expect(res.success).toBe(false);
    },
  );

  it("pide link y wallet válida, y limita la nota", () => {
    expect(deliverMilestoneSchema.safeParse({ freelancerWallet: WALLET }).success).toBe(false);
    expect(deliverMilestoneSchema.safeParse({ ...ok, freelancerWallet: "0x123" }).success).toBe(
      false,
    );
    expect(deliverMilestoneSchema.safeParse({ ...ok, deliveryNote: "x".repeat(1001) }).success).toBe(
      false,
    );
  });
});
