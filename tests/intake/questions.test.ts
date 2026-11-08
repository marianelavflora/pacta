// Preguntas del agente para completar el acuerdo (lib/intake/questions.ts). Lógica pura.
import { describe, expect, it } from "vitest";
import { emptyDetails, type DetailsValues, type MilestoneRow } from "@/lib/agreement-form";
import {
  applyAnswer,
  nextQuestion,
  parseCurrencyAnswer,
} from "@/lib/intake/questions";

const complete: DetailsValues = {
  title: "Logo",
  description: "Logo y manual",
  clientContact: "cliente@mail.com",
  clientCurrency: "wBRL",
  payoutCurrency: "wARS",
};
const row = (over: Partial<MilestoneRow> = {}): MilestoneRow => ({
  id: "r1",
  title: "Logo",
  amount: "300",
  reviewDays: "3",
  ...over,
});

describe("nextQuestion", () => {
  it("devuelve null cuando está todo completo", () => {
    expect(nextQuestion(complete, [row()])).toBeNull();
  });

  it("pregunta el monto del hito que no lo tiene, nombrándolo", () => {
    const q = nextQuestion(complete, [row(), row({ id: "r2", title: "Web", amount: "" })]);
    expect(q).toMatchObject({ kind: "milestoneAmount", rowId: "r2" });
    expect(q?.text).toMatch(/"Web"/);
  });

  it("sigue el orden: hitos, moneda, título, contacto", () => {
    const base = { ...emptyDetails, description: "algo" };
    expect(nextQuestion(base, [row()])?.kind).toBe("clientCurrency");
    expect(nextQuestion({ ...base, clientCurrency: "wBRL" }, [row()])?.kind).toBe("title");
    expect(
      nextQuestion({ ...base, clientCurrency: "wBRL", title: "Logo" }, [row()])?.kind,
    ).toBe("clientContact");
  });

  it("un contacto inválido sigue pendiente", () => {
    expect(nextQuestion({ ...complete, clientContact: "hola" }, [row()])?.kind).toBe(
      "clientContact",
    );
  });
});

describe("applyAnswer", () => {
  it("guarda el monto limpiando símbolos y palabras", () => {
    const q = { kind: "milestoneAmount", rowId: "r1", text: "" } as const;
    const result = applyAnswer(q, "R$ 1.500,50 reales", complete, [row({ amount: "" })]);
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.rows[0].amount).toBe("1.500,50");
  });

  it("rechaza un monto que no se entiende o es cero, sin tocar nada", () => {
    const q = { kind: "milestoneAmount", rowId: "r1", text: "" } as const;
    expect(applyAnswer(q, "mucho", complete, [row({ amount: "" })]).ok).toBe(false);
    expect(applyAnswer(q, "0", complete, [row({ amount: "" })]).ok).toBe(false);
  });

  it("entiende la moneda por código o por nombre", () => {
    const q = { kind: "clientCurrency", text: "" } as const;
    const result = applyAnswer(q, "en reales", emptyDetails, [row()]);
    expect(result.ok && result.details.clientCurrency).toBe("wBRL");
    expect(applyAnswer(q, "dólares", emptyDetails, [row()]).ok).toBe(false);
  });

  it("valida el contacto (solo mail)", () => {
    const q = { kind: "clientContact", text: "" } as const;
    expect(applyAnswer(q, "no sé", complete, [row()]).ok).toBe(false);
    const mail = applyAnswer(q, " ana@mail.com ", complete, [row()]);
    expect(mail.ok && mail.details.clientContact).toBe("ana@mail.com");
    expect(applyAnswer(q, "+54 9 11 2345 6789", complete, [row()]).ok).toBe(false);
  });

  it("guarda título del trabajo y título del hito", () => {
    const title = applyAnswer({ kind: "title", text: "" }, "Mi marca", complete, [row()]);
    expect(title.ok && title.details.title).toBe("Mi marca");
    const hito = applyAnswer({ kind: "milestoneTitle", rowId: "r1", text: "" }, "Boceto", complete, [
      row({ title: "" }),
    ]);
    expect(hito.ok && hito.rows[0].title).toBe("Boceto");
  });
});

describe("parseCurrencyAnswer", () => {
  it.each([
    ["wARS", "wARS"],
    ["brl", "wBRL"],
    ["pesos mexicanos", "wMXN"],
    ["argentinos", "wARS"],
  ])("%s → %s", (answer, expected) => {
    expect(parseCurrencyAnswer(answer)).toBe(expected);
  });
});
