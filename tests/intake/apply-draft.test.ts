// PAC-37 · De la propuesta de la IA al formulario de /nuevo. Lógica pura, sin red.
import { describe, expect, it } from "vitest";
import { emptyDetails, MAX_MILESTONES, totalUnits, type MilestoneRow } from "@/lib/agreement-form";
import { applyIntakeDraft, type IntakeDraftResponse } from "@/lib/intake/apply-draft";

let counter = 0;
const makeRow = (): MilestoneRow => ({ id: `fila-${++counter}`, title: "", amount: "", reviewDays: "3" });

const draft: IntakeDraftResponse = {
  title: "Logo y web",
  clientCurrency: "wBRL",
  milestones: [
    { title: "Logo", amount: "300", reviewDays: 5 },
    { title: "Web", amount: "700.5", reviewDays: 3 },
  ],
  notes: [],
};

describe("applyIntakeDraft", () => {
  it("carga título, moneda e hitos, y deja el texto original como descripción", () => {
    const applied = applyIntakeDraft(draft, "  Hago un logo y una web  ", emptyDetails, makeRow);

    expect(applied.details).toMatchObject({
      title: "Logo y web",
      clientCurrency: "wBRL",
      description: "Hago un logo y una web",
    });
    expect(applied.rows.map((row) => [row.title, row.amount, row.reviewDays])).toEqual([
      ["Logo", "300", "5"],
      ["Web", "700.5", "3"],
    ]);
  });

  it("el total del formulario se calcula con los montos propuestos (y cambia si se edita uno)", () => {
    const applied = applyIntakeDraft(draft, "texto", emptyDetails, makeRow);
    expect(totalUnits(applied.rows)).toBe(BigInt("1000500000000000000000"));

    const edited = applied.rows.map((row) => (row.title === "Web" ? { ...row, amount: "800" } : row));
    expect(totalUnits(edited)).toBe(BigInt("1100000000000000000000"));
  });

  it("no pisa lo que la persona ya escribió", () => {
    const current = { ...emptyDetails, title: "Mi título", description: "Mi descripción", clientCurrency: "wMXN" as const };
    const applied = applyIntakeDraft(draft, "otro texto", current, makeRow);

    expect(applied.details).toMatchObject({
      title: "Mi título",
      description: "Mi descripción",
      clientCurrency: "wMXN",
    });
  });

  it("sin título ni moneda en la propuesta deja esos campos como estaban", () => {
    const applied = applyIntakeDraft({ milestones: draft.milestones, notes: [] }, "texto", emptyDetails, makeRow);
    expect(applied.details.title).toBe("");
    expect(applied.details.clientCurrency).toBe("");
  });

  it("un hito sin monto queda con el monto vacío para que la persona lo complete", () => {
    const applied = applyIntakeDraft(
      { milestones: [{ title: "Diseño", amount: "", reviewDays: 3 }], notes: ["Falta el monto de \"Diseño\"."] },
      "texto",
      emptyDetails,
      makeRow,
    );
    expect(applied.rows[0].amount).toBe("");
    expect(applied.notes).toEqual(['Falta el monto de "Diseño".']);
  });

  it(`corta en ${MAX_MILESTONES} hitos (tope del formulario) y avisa`, () => {
    const many = Array.from({ length: MAX_MILESTONES + 3 }, (_, index) => ({
      title: `Hito ${index + 1}`,
      amount: "10",
      reviewDays: 3,
    }));
    const applied = applyIntakeDraft({ milestones: many, notes: [] }, "texto", emptyDetails, makeRow);

    expect(applied.rows).toHaveLength(MAX_MILESTONES);
    expect(applied.notes[0]).toMatch(new RegExp(`más de ${MAX_MILESTONES} hitos`));
  });

  it("cada fila tiene un id propio", () => {
    const applied = applyIntakeDraft(draft, "texto", emptyDetails, makeRow);
    expect(new Set(applied.rows.map((row) => row.id)).size).toBe(applied.rows.length);
  });
});
