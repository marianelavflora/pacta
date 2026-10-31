import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MILESTONE_STATUSES,
  MOVEMENT_KINDS,
  MOVEMENT_STATUSES,
  QUOTE_SOURCES,
} from "@/lib/validation/statuses";

const sql = readFileSync(
  fileURLToPath(
    new URL("../supabase/migrations/0002_milestones_movements_quotes.sql", import.meta.url),
  ),
  "utf8",
);

// Devuelve el bloque `create table <name> (...)` del SQL.
function tableBlock(name: string): string {
  const start = sql.indexOf(`create table if not exists ${name} (`);
  expect(start, `falta la tabla ${name}`).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf("\n);", start);
  return sql.slice(start, end);
}

// Lee los valores de `check (<column> in ('a', 'b'))` dentro de una tabla.
function checkValues(table: string, column: string): string[] {
  const match = tableBlock(table).match(
    new RegExp(`\\n\\s+${column} text[^\\n]*check \\(${column} in \\(([^)]*)\\)\\)`),
  );
  expect(match, `falta el check de ${table}.${column}`).not.toBeNull();
  return [...match![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe("listas de valores: TypeScript y SQL coinciden", () => {
  it("estados del hito", () => {
    expect(checkValues("milestones", "status")).toEqual([...MILESTONE_STATUSES]);
  });

  it("los estados del hito son los oficiales de AGENTS.md", () => {
    expect([...MILESTONE_STATUSES].sort()).toEqual(
      ["pending", "funded", "delivered", "reminded", "approved", "expired", "converting", "paid", "paused"].sort(),
    );
  });

  it("tipos y estados de movimiento", () => {
    expect(checkValues("movements", "kind")).toEqual([...MOVEMENT_KINDS]);
    expect(checkValues("movements", "status")).toEqual([...MOVEMENT_STATUSES]);
  });

  it("fuentes de cotización", () => {
    expect(checkValues("quotes", "source")).toEqual([...QUOTE_SOURCES]);
  });
});

describe("migración 0002", () => {
  it("los montos on-chain son numeric(78, 0)", () => {
    for (const [table, column] of [
      ["milestones", "amount"],
      ["movements", "amount_in"],
      ["movements", "amount_out"],
      ["quotes", "amount_in"],
    ]) {
      expect(tableBlock(table)).toMatch(new RegExp(`\\n\\s+${column} numeric\\(78, 0\\)`));
    }
  });

  it("borrar un acuerdo borra sus hitos", () => {
    expect(tableBlock("milestones")).toMatch(
      /agreement_id uuid not null references agreements \(id\) on delete cascade/,
    );
  });

  it("tx_hash es único y hay un solo pago por hito", () => {
    expect(tableBlock("movements")).toMatch(/\n\s+tx_hash text unique/);
    expect(sql).toMatch(/create unique index if not exists movements_milestone_kind_once_key/);
    expect(sql).toMatch(/create unique index if not exists milestones_agreement_position_key/);
  });
});
