// Base en memoria que imita lo mínimo de supabase-js para probar el liberador sin red.
// Incluye el índice único parcial de 0002: un payout/conversion activo por hito.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Row = Record<string, unknown>;

export class FakeDb {
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
