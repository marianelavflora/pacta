// PAC-34 · Recibo v2: tipo de cambio efectivo del pago frente a la referencia. Lógica pura.
import { describe, expect, it } from "vitest";
import { parseRate } from "@/lib/fx/math";
import { describeReceiptFx } from "@/lib/fx/receipt";

const units = (whole: number) => BigInt(whole) * BigInt(10) ** BigInt(18);

describe("describeReceiptFx", () => {
  const base = {
    clientCurrency: "wBRL",
    payoutCurrency: "wARS",
    milestoneAmount: units(600),
    paidAmount: units(168000),
    referenceRate: parseRate("280"),
  };

  it("calcula el tipo de cambio efectivo y lo compara con la referencia", () => {
    const fx = describeReceiptFx({ ...base, paidAmount: units(170400) });
    expect(fx?.paidRate).toBe(parseRate("284"));
    expect(fx?.diffBasisPoints).toBe(142); // 284 contra 280 = +1,42857 %: el bigint trunca
  });

  it("un pago por debajo de la referencia da diferencia negativa", () => {
    expect(describeReceiptFx({ ...base })?.diffBasisPoints).toBe(0);
    expect(
      describeReceiptFx({ ...base, paidAmount: units(165000) })
        ?.diffBasisPoints,
    ).toBeLessThan(0);
  });

  it("sin referencia devuelve el tipo de cambio pero no la diferencia", () => {
    const fx = describeReceiptFx({ ...base, referenceRate: null });
    expect(fx?.paidRate).toBe(parseRate("280"));
    expect(fx?.diffBasisPoints).toBeNull();
  });

  it("si no hubo cambio de moneda no hay tipo de cambio", () => {
    expect(describeReceiptFx({ ...base, payoutCurrency: "wBRL" })).toBeNull();
  });

  it("con montos en cero no calcula nada", () => {
    expect(describeReceiptFx({ ...base, paidAmount: BigInt(0) })).toBeNull();
    expect(
      describeReceiptFx({ ...base, milestoneAmount: BigInt(0) }),
    ).toBeNull();
  });
});
