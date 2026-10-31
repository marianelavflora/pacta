// PAC-14 · Esquema de lib/validation/agreement.ts (lo usan la API y el formulario).
import { describe, expect, it } from "vitest";
import { createAgreementSchema, sumMilestoneAmounts } from "@/lib/validation/agreement";

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

describe("createAgreementSchema", () => {
  const firstError = (body: unknown) => {
    const parsed = createAgreementSchema.safeParse(body);
    expect(parsed.success).toBe(false);
    return parsed.error?.issues[0]?.message;
  };

  it("acepta un acuerdo válido y pasa los montos a bigint", () => {
    const parsed = createAgreementSchema.parse(validBody());
    expect(parsed.milestones[0].amount).toBe(500000000000000000000n);
    expect(typeof parsed.milestones[1].amount).toBe("bigint");
    expect(parsed.freelancerWallet).toBe(WALLET.toLowerCase());
  });

  it("pone 3 días de revisión si no vienen", () => {
    const body = validBody();
    body.milestones = [{ title: "Único", amount: "1" } as (typeof body.milestones)[number]];
    expect(createAgreementSchema.parse(body).milestones[0].reviewDays).toBe(3);
  });

  it("no pierde precisión con montos enormes", () => {
    const huge = "123456789012345678901234567890123456789";
    const body = { ...validBody(), milestones: [{ title: "Grande", amount: huge, reviewDays: 3 }] };
    expect(createAgreementSchema.parse(body).milestones[0].amount.toString()).toBe(huge);
  });

  it.each([
    ["description", "Falta la descripción del trabajo"],
    ["title", "Falta el título del trabajo"],
    ["clientContact", "Falta el contacto del cliente"],
    ["freelancerWallet", "Falta la wallet de la freelancer"],
    ["clientCurrency", "Falta la moneda del cliente"],
    ["payoutCurrency", "Falta la moneda de cobro"],
    ["milestones", "Faltan los hitos del trabajo"],
  ])("si falta %s, avisa en castellano", (field, message) => {
    const body: Record<string, unknown> = validBody();
    delete body[field];
    expect(firstError(body)).toBe(message);
  });

  it("rechaza un texto vacío o con solo espacios", () => {
    expect(firstError({ ...validBody(), description: "   " })).toBe("Falta la descripción del trabajo");
  });

  it("rechaza monedas que no son wARS, wBRL ni wMXN", () => {
    expect(firstError({ ...validBody(), clientCurrency: "USDC" })).toBe(
      "La moneda del cliente no es válida",
    );
    expect(firstError({ ...validBody(), payoutCurrency: "wars" })).toBe(
      "La moneda de cobro no es válida",
    );
  });

  it("rechaza una wallet mal escrita", () => {
    expect(firstError({ ...validBody(), freelancerWallet: "0xabc" })).toBe(
      "La wallet de la freelancer no es válida",
    );
  });

  it("pide al menos un hito", () => {
    expect(firstError({ ...validBody(), milestones: [] })).toBe("Agregá al menos un hito");
  });

  it.each([
    ["0", "El monto del hito tiene que ser mayor a 0"],
    ["-5", "El monto tiene que ser un número entero, sin puntos ni comas"],
    ["1.5", "El monto tiene que ser un número entero, sin puntos ni comas"],
    ["1e18", "El monto tiene que ser un número entero, sin puntos ni comas"],
    ["", "El monto tiene que ser un número entero, sin puntos ni comas"],
  ])("rechaza el monto %j", (amount, message) => {
    const body = { ...validBody(), milestones: [{ title: "Hito", amount, reviewDays: 3 }] };
    expect(firstError(body)).toBe(message);
  });

  it("rechaza montos que llegan como number en vez de texto", () => {
    const body = { ...validBody(), milestones: [{ title: "Hito", amount: 500, reviewDays: 3 }] };
    expect(firstError(body)).toMatch(/^El monto tiene que ir como texto/);
  });

  it("rechaza días de revisión negativos o con coma", () => {
    const withDays = (reviewDays: number) => ({
      ...validBody(),
      milestones: [{ title: "Hito", amount: "1", reviewDays }],
    });
    expect(firstError(withDays(-1))).toBe("Los días de revisión no pueden ser negativos");
    expect(firstError(withDays(1.5))).toBe("Los días de revisión tienen que ser un número entero");
  });
});

describe("sumMilestoneAmounts", () => {
  it("suma con bigint sin perder decimales", () => {
    expect(sumMilestoneAmounts([{ amount: 10n ** 18n + 1n }, { amount: 2n * 10n ** 18n }])).toBe(
      3n * 10n ** 18n + 1n,
    );
  });
});
