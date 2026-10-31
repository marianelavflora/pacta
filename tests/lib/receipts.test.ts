import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { getReceiptByMilestoneId } from "@/lib/receipts";

const ID = "11111111-1111-4111-8111-111111111111";
const PAID = "1500000000000000000000"; // 1.500 con 18 decimales

type Rows = Record<string, Record<string, unknown> | null>;

// Base falsa: cada tabla devuelve su fila; guarda los filtros y columnas pedidas.
function fakeDb(rows: Rows, log: string[] = []) {
  const db = {
    from(table: string) {
      const q = {
        select(cols: string) {
          log.push(`${table}:${cols}`);
          return q;
        },
        eq(col: string, val: unknown) {
          log.push(`${table}.${col}=${String(val)}`);
          return q;
        },
        order: () => q,
        limit: () => q,
        maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
        single: async () => ({ data: rows[table] ?? null, error: null }),
      };
      return q;
    },
  };
  return db as unknown as SupabaseClient;
}

const base: Rows = {
  milestones: {
    id: ID,
    agreement_id: "a1",
    position: 2,
    title: "Diseño",
    amount: "1000000000000000000000",
    status: "paid",
    paid_at: "2026-11-02T15:00:00Z",
  },
  agreements: { title: "Web", client_currency: "wBRL", payout_currency: "wARS", freelancer_id: "u1" },
  users: { name: "Flor", wallet: "0xabc" },
  movements: {
    amount_out: PAID,
    to_currency: "wARS",
    tx_hash: "0xdead",
    created_at: "2026-11-02T14:59:00Z",
  },
};

describe("getReceiptByMilestoneId", () => {
  it("arma el recibo con el pago confirmado y los montos como texto", async () => {
    const log: string[] = [];
    const r = await getReceiptByMilestoneId(fakeDb(base, log), ID);
    expect(r?.payout).toEqual({
      amount: PAID,
      currency: "wARS",
      txHash: "0xdead",
      at: "2026-11-02T14:59:00Z",
    });
    expect(r?.freelancer).toEqual({ name: "Flor", wallet: "0xabc" });
    expect(r?.milestoneAmount).toBe("1000000000000000000000");
    expect(log).toContain("movements.kind=payout");
    expect(log).toContain("movements.status=confirmed");
    expect(log.some((l) => l.includes("amount_out::text"))).toBe(true);
  });

  it("sin pago confirmado devuelve payout null (no es error)", async () => {
    const r = await getReceiptByMilestoneId(
      fakeDb({ ...base, movements: null, milestones: { ...base.milestones, status: "approved" } }),
      ID,
    );
    expect(r?.payout).toBeNull();
    expect(r?.milestoneStatus).toBe("approved");
  });

  it("hito inexistente o id mal formado devuelve null", async () => {
    expect(await getReceiptByMilestoneId(fakeDb({ ...base, milestones: null }), ID)).toBeNull();
    expect(await getReceiptByMilestoneId(fakeDb(base), "no-es-uuid")).toBeNull();
  });

  it("no filtra datos privados", async () => {
    const log: string[] = [];
    const r = await getReceiptByMilestoneId(
      fakeDb({ ...base, users: { ...base.users, whatsapp: "+54911", email: "x@y.z" } }, log),
      ID,
    );
    const text = JSON.stringify(r) + log.join(" ");
    expect(text).not.toMatch(/whatsapp|email|signature|contact|\+54911/);
  });
});
