// Esquema del pedido para crear un acuerdo (PAC-14).
// Lo usan la API (app/api/agreements/route.ts) y el formulario de la web.
// Los montos llegan como texto en unidades mínimas (18 decimales) y salen como bigint:
// nunca se pasan a number, porque se pierden decimales.

import { z } from "zod";

// Monedas que acepta la base (check de agreements.client_currency en 0001).
export const CURRENCIES = ["wARS", "wBRL", "wMXN"] as const;
export type Currency = (typeof CURRENCIES)[number];

// Tope de días de revisión de un hito, para que nadie ponga 10000 por error.
export const MAX_REVIEW_DAYS = 60;

const requiredText = (missing: string) =>
  z.string({ error: missing }).trim().min(1, missing);

const currency = (missing: string, invalid: string) =>
  z.enum(CURRENCIES, {
    error: (issue) => (issue.input === undefined ? missing : invalid),
  });

// Monto en unidades mínimas: texto con solo dígitos y mayor a 0.
// Máximo 78 dígitos, como numeric(78, 0) en la base (lo que entra en un uint256).
export const amountSchema = z
  .string({
    error: (issue) =>
      issue.input === undefined
        ? "Falta el monto del hito"
        : "El monto tiene que ir como texto, por ejemplo \"500000000000000000000\"",
  })
  .trim()
  .regex(/^\d{1,78}$/, "El monto tiene que ser un número entero, sin puntos ni comas")
  .transform((value) => BigInt(value))
  .refine((value) => value > BigInt(0), "El monto del hito tiene que ser mayor a 0");

export const milestoneInputSchema = z.object({
  title: requiredText("Falta el título del hito"),
  amount: amountSchema,
  reviewDays: z
    .number({ error: "Los días de revisión tienen que ser un número" })
    .int("Los días de revisión tienen que ser un número entero")
    .min(0, "Los días de revisión no pueden ser negativos")
    .max(MAX_REVIEW_DAYS, `Los días de revisión no pueden ser más de ${MAX_REVIEW_DAYS}`)
    .default(3),
});

export const createAgreementSchema = z.object({
  freelancerWallet: z
    .string({ error: "Falta la wallet de la freelancer" })
    .trim()
    .regex(/^0x[0-9a-fA-F]{40}$/, "La wallet de la freelancer no es válida")
    // En la base las wallets van en minúscula.
    .transform((wallet) => wallet.toLowerCase()),
  // Opcional: si la usuaria es nueva, se guarda con este nombre.
  freelancerName: z.string().trim().max(100, "El nombre es demasiado largo").optional(),
  title: requiredText("Falta el título del trabajo"),
  description: requiredText("Falta la descripción del trabajo"),
  clientContact: requiredText("Falta el contacto del cliente"),
  clientCurrency: currency("Falta la moneda del cliente", "La moneda del cliente no es válida"),
  payoutCurrency: currency("Falta la moneda de cobro", "La moneda de cobro no es válida"),
  milestones: z
    .array(milestoneInputSchema, { error: "Faltan los hitos del trabajo" })
    .min(1, "Agregá al menos un hito")
    .max(20, "Un acuerdo puede tener como mucho 20 hitos")
    .refine(
      (milestones) => sumMilestoneAmounts(milestones).toString().length <= 78,
      "El total del acuerdo es demasiado grande",
    ),
});

export type CreateAgreementInput = z.infer<typeof createAgreementSchema>;
export type MilestoneInput = z.infer<typeof milestoneInputSchema>;

// Suma los montos de los hitos. El total siempre se calcula acá, nunca se confía en la web.
export function sumMilestoneAmounts(milestones: readonly { amount: bigint }[]): bigint {
  return milestones.reduce((total, milestone) => total + milestone.amount, BigInt(0));
}
