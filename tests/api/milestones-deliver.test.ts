// PAC-22 · POST /api/milestones/[id]/deliver. Sin red: la base es un doble en memoria.
// A1 (auditoría de seguridad): la entrega se firma con la wallet de la freelancer; decir cuál es no alcanza.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { buildDeliveryTypedData } from "@/lib/chain/delivery";
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

const CHAIN_ID = 42220;
const MILESTONE = "11111111-1111-1111-1111-111111111111";
const OTHER_MILESTONE = "22222222-2222-2222-2222-222222222222";
const URL_OK = "https://example.com/entrega";
// Cuentas de prueba con claves al azar: firman de verdad, así se prueba la verificación completa.
const freelancer = privateKeyToAccount(generatePrivateKey());
const stranger = privateKeyToAccount(generatePrivateKey());

type Signer = typeof freelancer;
async function sign(options: { who?: Signer; milestoneId?: string; deliveryUrl?: string; position?: number } = {}) {
  return (options.who ?? freelancer).signTypedData(
    buildDeliveryTypedData({
      chainId: CHAIN_ID,
      agreementPublicId: "AbCd1234",
      milestoneId: options.milestoneId ?? MILESTONE,
      position: options.position ?? 1,
      deliveryUrl: options.deliveryUrl ?? URL_OK,
    }),
  );
}

let input: ReturnType<typeof deliverMilestoneSchema.parse>;

let db: FakeDb;
const milestone = () => db.tables.milestones[0];

beforeEach(async () => {
  input = deliverMilestoneSchema.parse({
    signature: await sign(),
    deliveryUrl: URL_OK,
    deliveryNote: "Listo el primer tramo",
  });
  db = new FakeDb();
  db.tables.users.push({ id: "u1", wallet: freelancer.address, phone: "+5491100000000" });
  db.tables.agreements.push({ id: "a1", public_id: "AbCd1234", freelancer_id: "u1", client_contact: "cliente@mail.com" });
  db.tables.milestones.push({
    id: MILESTONE,
    agreement_id: "a1",
    position: 1,
    status: "funded",
    amount: "500000000000000000000",
    delivery_url: null,
    delivery_note: null,
    delivered_at: null,
  });
});

describe("deliverMilestone", () => {
  it("pasa un hito funded a delivered y guarda link, nota y fecha", async () => {
    const res = await deliverMilestone(db.asClient(), MILESTONE, input, CHAIN_ID);
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
    await deliverMilestone(db.asClient(), MILESTONE, input, CHAIN_ID);
    const before = { ...milestone() };
    const again = await deliverMilestone(
      db.asClient(),
      MILESTONE,
      { ...input, deliveryNote: "otra nota" },
      CHAIN_ID,
    );
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
      const res = await deliverMilestone(db.asClient(), MILESTONE, input, CHAIN_ID);
      expect(res).toEqual({ kind: "wrong_status", status });
      expect(milestone().status).toBe(status);
      expect(milestone().delivery_url).toBeNull();
    },
  );

  describe("la firma manda (A1)", () => {
    const rejected = async (signature: string, deliveryUrl = URL_OK) => {
      const res = await deliverMilestone(
        db.asClient(),
        MILESTONE,
        { ...input, signature, deliveryUrl },
        CHAIN_ID,
      );
      expect(res.kind).toBe("forbidden");
      expect(milestone().status).toBe("funded");
      expect(milestone().delivery_url).toBeNull();
    };

    it("una firma de otra wallet no entrega (forbidden) y no cambia nada", async () => {
      await rejected(await sign({ who: stranger }));
    });

    it("conocer la wallet de la freelancer no alcanza: sin su firma no hay entrega", async () => {
      await rejected("0x" + "ab".repeat(65));
    });

    it("una firma basura no rompe nada: forbidden", async () => {
      await rejected("0x" + "00".repeat(65));
    });

    it("la firma está atada al link: no sirve para entregar otro link", async () => {
      await rejected(await sign({ deliveryUrl: "https://example.com/entrega" }), "https://phishing.example/robo");
    });

    it("la firma está atada al hito: no sirve para otro hito del mismo acuerdo", async () => {
      await rejected(await sign({ milestoneId: OTHER_MILESTONE }));
    });

    it("la firma está atada a la red: una firma de otra red no vale", async () => {
      const other = await freelancer.signTypedData(
        buildDeliveryTypedData({
          chainId: 11142220,
          agreementPublicId: "AbCd1234",
          milestoneId: MILESTONE,
          position: 1,
          deliveryUrl: URL_OK,
        }),
      );
      await rejected(other);
    });

    it("sin firma válida nadie se entera del estado del hito (forbidden antes que wrong_status)", async () => {
      milestone().status = "paid";
      const res = await deliverMilestone(
        db.asClient(),
        MILESTONE,
        { ...input, signature: await sign({ who: stranger }) },
        CHAIN_ID,
      );
      expect(res.kind).toBe("forbidden");
    });
  });

  it("not_found si el hito no existe", async () => {
    const res = await deliverMilestone(
      db.asClient(),
      OTHER_MILESTONE,
      input,
      CHAIN_ID,
    );
    expect(res.kind).toBe("not_found");
  });

  it("si la base falla, tira un error (la ruta responde 500 sin detalles)", async () => {
    db.failTable = "milestones";
    await expect(deliverMilestone(db.asClient(), MILESTONE, input, CHAIN_ID)).rejects.toThrow();
  });
});

describe("deliverMilestoneSchema", () => {
  const SIGNATURE = "0x" + "ab".repeat(65);
  const ok = { signature: SIGNATURE, deliveryUrl: "https://example.com/x" };

  it("acepta sin nota", () => {
    const parsed = deliverMilestoneSchema.parse(ok);
    expect(parsed.signature).toBe(SIGNATURE);
    expect(parsed.deliveryNote).toBeUndefined();
  });

  it("ya no acepta la wallet escrita a mano en lugar de la firma", () => {
    expect(deliverMilestoneSchema.safeParse({ freelancerWallet: "0x" + "a".repeat(40), deliveryUrl: "https://example.com/x" }).success).toBe(false);
  });

  it.each(["http://example.com", "javascript:alert(1)", "no es un link", ""])(
    "rechaza el link %j",
    (deliveryUrl) => {
      const res = deliverMilestoneSchema.safeParse({ ...ok, deliveryUrl });
      expect(res.success).toBe(false);
    },
  );

  it("pide link y firma válida, y limita la nota", () => {
    expect(deliverMilestoneSchema.safeParse({ signature: SIGNATURE }).success).toBe(false);
    expect(deliverMilestoneSchema.safeParse({ ...ok, signature: "0x123" }).success).toBe(false);
    expect(deliverMilestoneSchema.safeParse({ ...ok, deliveryNote: "x".repeat(1001) }).success).toBe(false);
  });
});
