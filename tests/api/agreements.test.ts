// PAC-14 · POST /api/agreements. Sin red: la base es un doble en memoria.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAgreement } from "@/lib/agreements";
import { createAgreementSchema } from "@/lib/validation/agreement";

// ---------- Doble de Supabase ----------
// Guarda filas en memoria y responde como el cliente real ({ data, error }).
// Solo cubre lo que usa lib/agreements.ts: select/eq/maybeSingle/single, insert, delete.
type Row = Record<string, unknown>;
type DbError = { code?: string; message: string };

class FakeDb {
  tables: Record<string, Row[]> = { users: [], agreements: [], milestones: [] };
  // Errores forzados: la próxima vez que se haga `op` en `table`, devuelve este error.
  failures: { table: string; op: "select" | "insert"; error: DbError }[] = [];
  private nextId = 1;

  failNext(table: string, op: "select" | "insert", error: DbError) {
    this.failures.push({ table, op, error });
  }

  takeFailure(table: string, op: "select" | "insert") {
    const index = this.failures.findIndex((f) => f.table === table && f.op === op);
    if (index === -1) return null;
    return this.failures.splice(index, 1)[0].error;
  }

  from(table: string) {
    return new FakeQuery(this, table);
  }

  newId() {
    return `id-${this.nextId++}`;
  }

  asClient() {
    return this as unknown as SupabaseClient;
  }
}

class FakeQuery {
  private op: "select" | "insert" | "delete" = "select";
  private rows: Row[] = [];
  private filters: [string, unknown][] = [];
  private returning = false;

  constructor(private db: FakeDb, private table: string) {}

  select() {
    if (this.op === "insert") this.returning = true;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.op = "insert";
    this.rows = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  maybeSingle() {
    return Promise.resolve(this.run("maybe"));
  }
  single() {
    return Promise.resolve(this.run("single"));
  }
  then<T>(resolve: (value: { data: unknown; error: DbError | null }) => T) {
    return Promise.resolve(this.run("many")).then(resolve);
  }

  private run(mode: "maybe" | "single" | "many") {
    const table = this.db.tables[this.table];
    if (this.op === "delete") {
      this.db.tables[this.table] = table.filter((r) => !this.matches(r));
      return { data: null, error: null };
    }
    const forced = this.db.takeFailure(this.table, this.op);
    if (forced) return { data: null, error: forced };

    let result: Row[];
    if (this.op === "insert") {
      result = this.rows.map((r) => ({ id: this.db.newId(), ...r }));
      table.push(...result);
      if (!this.returning) return { data: null, error: null };
    } else {
      result = table.filter((r) => this.matches(r));
    }
    if (mode === "many") return { data: result, error: null };
    if (mode === "single" && result.length !== 1) {
      return { data: null, error: { code: "PGRST116", message: "no rows" } };
    }
    return { data: result[0] ?? null, error: null };
  }

  private matches(row: Row) {
    return this.filters.every(([column, value]) => row[column] === value);
  }
}

// ---------- Datos de ejemplo ----------
const WALLET = "0xAb569A8d8A5b60CFfdf9B88EdE099c80d8328E73";
const validBody = () => ({
  freelancerWallet: WALLET,
  title: "Logo",
  description: "Logo y manual de marca",
  clientContact: "+5511999999999",
  clientCurrency: "wBRL",
  payoutCurrency: "wARS",
  milestones: [
    { title: "Bocetos", amount: "500000000000000000000", reviewDays: 3 },
    { title: "Logo final", amount: "1500000000000000000000", reviewDays: 5 },
  ],
});

// ---------- Guardado en la base ----------
describe("createAgreement", () => {
  let db: FakeDb;
  beforeEach(() => {
    db = new FakeDb();
  });

  it("crea la usuaria, el acuerdo y los hitos en orden, con el total calculado", async () => {
    const created = await createAgreement(db.asClient(), createAgreementSchema.parse(validBody()));

    expect(db.tables.users).toHaveLength(1);
    expect(db.tables.users[0].wallet).toBe(WALLET.toLowerCase());

    const [agreement] = db.tables.agreements;
    expect(agreement.total_amount).toBe("2000000000000000000000");
    expect(agreement.client_currency).toBe("wBRL");
    expect(agreement.payout_currency).toBe("wARS");
    expect(agreement.freelancer_id).toBe(db.tables.users[0].id);
    expect(agreement.public_id).toMatch(/^[0-9a-zA-Z]{8}$/);

    expect(db.tables.milestones.map((m) => [m.position, m.title, m.amount, m.review_days])).toEqual([
      [1, "Bocetos", "500000000000000000000", 3],
      [2, "Logo final", "1500000000000000000000", 5],
    ]);
    expect(db.tables.milestones.every((m) => m.agreement_id === agreement.id)).toBe(true);

    expect(created).toEqual({
      id: agreement.id,
      publicId: agreement.public_id,
      clientUrl: `/a/${agreement.public_id}`,
      totalAmount: 2000000000000000000000n,
    });
  });

  it("reusa la usuaria si la wallet ya existe", async () => {
    db.tables.users.push({ id: "user-existente", wallet: WALLET.toLowerCase(), name: "Flor" });
    await createAgreement(db.asClient(), createAgreementSchema.parse(validBody()));
    expect(db.tables.users).toHaveLength(1);
    expect(db.tables.agreements[0].freelancer_id).toBe("user-existente");
  });

  it("prueba con otro public_id si el primero ya existe", async () => {
    db.failNext("agreements", "insert", { code: "23505", message: "duplicate public_id" });
    const created = await createAgreement(db.asClient(), createAgreementSchema.parse(validBody()));
    expect(db.tables.agreements).toHaveLength(1);
    expect(created.publicId).toBe(db.tables.agreements[0].public_id);
  });

  it("si fallan los hitos, borra el acuerdo para no dejarlo a medias", async () => {
    db.failNext("milestones", "insert", { message: "boom" });
    await expect(
      createAgreement(db.asClient(), createAgreementSchema.parse(validBody())),
    ).rejects.toThrow("No se pudo guardar los hitos");
    expect(db.tables.agreements).toHaveLength(0);
  });
});

// ---------- Route handler ----------
const fakeDb = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => fakeDb.current }));

describe("POST /api/agreements", () => {
  let db: FakeDb;
  beforeEach(() => {
    db = new FakeDb();
    fakeDb.current = db.asClient();
  });

  const post = async (body: unknown) => {
    const { POST } = await import("@/app/api/agreements/route");
    const response = await POST(
      new Request("http://localhost/api/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );
    return { status: response.status, json: await response.json() };
  };

  it("devuelve 201 con id, publicId, clientUrl y el total como texto", async () => {
    const { status, json } = await post(validBody());
    expect(status).toBe(201);
    expect(json).toEqual({
      id: db.tables.agreements[0].id,
      publicId: db.tables.agreements[0].public_id,
      clientUrl: `/a/${db.tables.agreements[0].public_id}`,
      totalAmount: "2000000000000000000000",
    });
  });

  it("ignora un total que mande la web y usa la suma de los hitos", async () => {
    await post({ ...validBody(), totalAmount: "1" });
    expect(db.tables.agreements[0].total_amount).toBe("2000000000000000000000");
  });

  it("devuelve 400 si falta la descripción", async () => {
    const body: Record<string, unknown> = validBody();
    delete body.description;
    const { status, json } = await post(body);
    expect(status).toBe(400);
    expect(json).toEqual({ error: "Falta la descripción del trabajo", field: "description" });
    expect(db.tables.agreements).toHaveLength(0);
  });

  it("devuelve 400 si la moneda no es válida", async () => {
    const { status, json } = await post({ ...validBody(), clientCurrency: "USD" });
    expect(status).toBe(400);
    expect(json.error).toBe("La moneda del cliente no es válida");
  });

  it("devuelve 400 si el cuerpo no es JSON", async () => {
    const { status, json } = await post("esto no es json");
    expect(status).toBe(400);
    expect(json.error).toBe("El pedido no es un JSON válido");
  });

  it("devuelve 500 con un mensaje amable si la base falla", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.failNext("users", "select", { message: "sin conexión" });
    const { status, json } = await post(validBody());
    expect(status).toBe(500);
    expect(json.error).toBe("No pudimos guardar el acuerdo. Probá de nuevo en un rato.");
    // El detalle interno de la base no le llega a la persona.
    expect(JSON.stringify(json)).not.toContain("sin conexión");
  });
});

// Se completan cuando existan `app/api/agreements/[id]` y `app/api/milestones/`.
describe("API de acuerdos (pendiente)", () => {
  it.todo("GET /api/agreements/[id] devuelve el acuerdo por publicId");
  it.todo("GET /api/agreements/[id] devuelve 404 si no existe");
  it.todo("deliver pasa un hito de funded a delivered");
  it.todo("approve pasa un hito de delivered o reminded a approved");
});
