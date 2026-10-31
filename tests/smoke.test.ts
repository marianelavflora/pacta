import { describe, expect, it } from "vitest";

// Test de ejemplo: si `npm test` pasa, Vitest está bien configurado.
describe("smoke", () => {
  it("suma montos en bigint sin perder precisión", () => {
    const oneToken = 10n ** 18n;
    expect(oneToken + oneToken).toBe(2n * 10n ** 18n);
  });
});
