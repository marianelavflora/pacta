// PAC-37 v2 · Textos y reglas del chat del agente, y símbolos de moneda. Lógica pura.
import { describe, expect, it } from "vitest";
import { explainAgreement, joinUserMessages, withReviewDays } from "@/lib/intake/chat";
import { currencyName, currencySymbol, formatTypedAmount } from "@/lib/ui/currency";

describe("joinUserMessages", () => {
  it("junta lo que dijo la persona en orden y descarta lo vacío", () => {
    expect(joinUserMessages(["  Hago un logo por 300 ", "", "El logo cuesta 400"])).toBe(
      "Hago un logo por 300\nEl logo cuesta 400",
    );
  });
});

describe("explainAgreement", () => {
  it("explica monedas y plazos cuando ya sabe la moneda del cliente", () => {
    const text = explainAgreement({ clientCurrency: "wBRL", payoutCurrency: "wARS" });
    expect(text).toMatch(/wBRL \(reales\)/);
    expect(text).toMatch(/cobrás en wARS/);
    expect(text).toMatch(/3 días/);
    expect(text).toMatch(/6 te pago igual/);
  });

  it("si falta la moneda del cliente, manda a 'Cambiar monedas'", () => {
    expect(explainAgreement({ clientCurrency: "", payoutCurrency: "wARS" })).toMatch(/Cambiar monedas/);
  });
});

describe("withReviewDays", () => {
  it("cambia los días de todos los hitos sin tocar lo demás", () => {
    const rows = [
      { id: "a", title: "Uno", reviewDays: "3" },
      { id: "b", title: "Dos", reviewDays: "5" },
    ];
    expect(withReviewDays(rows, "7")).toEqual([
      { id: "a", title: "Uno", reviewDays: "7" },
      { id: "b", title: "Dos", reviewDays: "7" },
    ]);
  });
});

describe("monedas en pantalla", () => {
  it("usa R$ para reales, $ para pesos y MX$ para pesos mexicanos", () => {
    expect(currencySymbol("wBRL")).toBe("R$");
    expect(currencySymbol("wARS")).toBe("$");
    expect(currencySymbol("wMXN")).toBe("MX$");
    expect(currencySymbol("XYZ")).toBe("XYZ");
    expect(currencyName("wBRL")).toBe("reales");
  });

  it("formatea lo que escribió la persona y no inventa números", () => {
    expect(formatTypedAmount("wBRL", "450")).toBe("R$ 450");
    expect(formatTypedAmount("wBRL", "1500,5")).toBe("R$ 1.500,5");
    expect(formatTypedAmount("", "450")).toBe("450");
    expect(formatTypedAmount("wBRL", "")).toBe("—");
    expect(formatTypedAmount("wBRL", "abc")).toBe("—");
  });
});
