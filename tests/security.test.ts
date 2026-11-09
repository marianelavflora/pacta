// Refuerzos de seguridad del informe de la auditoría: límite de pedidos, freno de mainnet y
// largos máximos de los textos. Sin red.
import { beforeEach, describe, expect, it } from "vitest";
import {
  assertMainnetApproved,
  assertPayoutCapForMainnet,
} from "@/lib/chain/mainnet-guard";
import { clientKey, isRateLimited, resetRateLimits } from "@/lib/rate-limit";
import { createAgreementSchema } from "@/lib/validation/agreement";

describe("isRateLimited", () => {
  beforeEach(() => resetRateLimits());
  const limit = { max: 3, windowMs: 60_000 };

  it("deja pasar hasta el máximo y frena el siguiente", () => {
    expect([1, 2, 3].map(() => isRateLimited("ip-1", limit, 1000))).toEqual([
      false,
      false,
      false,
    ]);
    expect(isRateLimited("ip-1", limit, 1000)).toBe(true);
  });

  it("cada IP tiene su propio contador", () => {
    for (let i = 0; i < 3; i++) isRateLimited("ip-1", limit, 1000);
    expect(isRateLimited("ip-2", limit, 1000)).toBe(false);
  });

  it("después de la ventana vuelve a dejar pasar", () => {
    for (let i = 0; i < 3; i++) isRateLimited("ip-1", limit, 1000);
    expect(isRateLimited("ip-1", limit, 1000 + 60_001)).toBe(false);
  });
});

describe("clientKey", () => {
  it("usa la primera IP de x-forwarded-for", () => {
    const request = new Request("http://localhost/x", {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
    });
    expect(clientKey(request)).toBe("1.2.3.4");
  });

  it("si no hay datos, devuelve un valor fijo", () => {
    expect(clientKey(new Request("http://localhost/x"))).toBe("desconocido");
  });
});

describe("freno de mainnet", () => {
  const MAINNET = 42220;
  const TESTNET = 11142220;

  it("en testnet no pide nada", () => {
    expect(() => assertMainnetApproved(TESTNET, undefined)).not.toThrow();
    expect(() => assertPayoutCapForMainnet(TESTNET, {})).not.toThrow();
  });

  it("en mainnet falla si no está aprobada o el valor es otro", () => {
    expect(() => assertMainnetApproved(MAINNET, undefined)).toThrow(
      /APPROVED_MAINNET/,
    );
    expect(() => assertMainnetApproved(MAINNET, "no")).toThrow(
      /APPROVED_MAINNET/,
    );
  });

  it("en mainnet pasa con yes, true o 1", () => {
    for (const value of ["yes", "TRUE", " 1 "]) {
      expect(() => assertMainnetApproved(MAINNET, value)).not.toThrow();
    }
  });

  it("en mainnet el tope por pago es obligatorio", () => {
    expect(() => assertPayoutCapForMainnet(MAINNET, {})).toThrow(
      /MAX_PAYOUT_PER_MILESTONE/,
    );
    // Con tope solo para dos monedas, falta la tercera.
    expect(() =>
      assertPayoutCapForMainnet(MAINNET, { wARS: BigInt(500), wBRL: BigInt(5) }),
    ).toThrow(/wMXN/);
    expect(() =>
      assertPayoutCapForMainnet(MAINNET, {
        wARS: BigInt(500),
        wBRL: BigInt(5),
        wMXN: BigInt(20),
      }),
    ).not.toThrow();
    // En testnet no hace falta.
    expect(() => assertPayoutCapForMainnet(11142220, {})).not.toThrow();
  });
});

describe("largos máximos del acuerdo", () => {
  const valid = {
    freelancerWallet: "0x" + "a".repeat(40),
    title: "Logo",
    description: "Un logo",
    clientContact: "cliente@mail.com",
    clientCurrency: "wBRL",
    payoutCurrency: "wARS",
    milestones: [
      { title: "Entrega", amount: "1000000000000000000", reviewDays: 3 },
    ],
  };

  it("acepta un acuerdo normal", () => {
    expect(createAgreementSchema.safeParse(valid).success).toBe(true);
  });

  it("rechaza títulos, descripciones y contactos gigantes", () => {
    expect(
      createAgreementSchema.safeParse({ ...valid, title: "x".repeat(201) })
        .success,
    ).toBe(false);
    expect(
      createAgreementSchema.safeParse({
        ...valid,
        description: "x".repeat(2001),
      }).success,
    ).toBe(false);
    expect(
      createAgreementSchema.safeParse({
        ...valid,
        clientContact: "x".repeat(201),
      }).success,
    ).toBe(false);
  });

  it("rechaza títulos de hito gigantes", () => {
    const milestones = [{ ...valid.milestones[0], title: "x".repeat(201) }];
    expect(
      createAgreementSchema.safeParse({ ...valid, milestones }).success,
    ).toBe(false);
  });
});
