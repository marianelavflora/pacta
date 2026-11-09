// Topes de pago por moneda (lib/chain/payout-caps.ts). Lógica pura.
import { describe, expect, it } from "vitest";
import { parseMaxPayout, parseMaxPayoutsByCurrency } from "@/lib/chain/payout-caps";

const E18 = BigInt(10) ** BigInt(18);

describe("parseMaxPayout", () => {
  it("vacío significa sin tope", () => {
    expect(parseMaxPayout(undefined)).toBeUndefined();
    expect(parseMaxPayout("  ")).toBeUndefined();
  });

  it("pasa a unidades mínimas", () => {
    expect(parseMaxPayout("250")).toBe(BigInt(250) * E18);
  });

  it("falla (no ignora) si está mal escrito o es 0, y nombra la variable", () => {
    expect(() => parseMaxPayout("mucho", "MAX_PAYOUT_PER_MILESTONE_WARS")).toThrow(/_WARS/);
    expect(() => parseMaxPayout("0")).toThrow(/mayor a 0/);
  });
});

describe("parseMaxPayoutsByCurrency", () => {
  it("cada moneda usa su tope y las demás el general", () => {
    const caps = parseMaxPayoutsByCurrency({
      MAX_PAYOUT_PER_MILESTONE: "250",
      MAX_PAYOUT_PER_MILESTONE_ARS: "30000",
    });
    expect(caps.wARS).toBe(BigInt(30000) * E18);
    expect(caps.wBRL).toBe(BigInt(250) * E18);
    expect(caps.wMXN).toBe(BigInt(250) * E18);
  });

  it("sin nada, ninguna moneda tiene tope", () => {
    expect(parseMaxPayoutsByCurrency({})).toEqual({
      wARS: undefined,
      wBRL: undefined,
      wMXN: undefined,
    });
  });
});
