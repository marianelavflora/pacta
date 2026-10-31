// Lógica pura del formulario de /nuevo (PAC-16 y PAC-17): validación y total.
// La validación fuerte final es la del esquema compartido con la API (lib/validation/agreement.ts).

import { parseAmountToUnits } from "@/lib/amounts";
import { CURRENCIES, MAX_REVIEW_DAYS, type Currency } from "@/lib/validation/agreement";

export const MAX_MILESTONES = 10;
export const DEFAULT_REVIEW_DAYS = 3;

export type DetailsValues = {
  title: string;
  description: string;
  clientContact: string;
  clientCurrency: Currency | "";
  payoutCurrency: Currency | "";
};

export type MilestoneRow = {
  id: string;
  title: string;
  amount: string; // lo que escribió la persona
  reviewDays: string;
};

export type DetailsErrors = Partial<Record<keyof DetailsValues, string>>;
export type MilestoneErrors = { title?: string; amount?: string; reviewDays?: string };

export const emptyDetails: DetailsValues = {
  title: "",
  description: "",
  clientContact: "",
  clientCurrency: "",
  payoutCurrency: "wARS",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isContact(value: string): boolean {
  if (EMAIL.test(value)) return true;
  const digits = value.replace(/[\s()+-]/g, "");
  return /^\d{8,15}$/.test(digits);
}

export function validateDetails(values: DetailsValues): DetailsErrors {
  const errors: DetailsErrors = {};
  if (!values.title.trim()) errors.title = "Poné un título para el trabajo";
  if (!values.description.trim()) errors.description = "Contanos de qué se trata el trabajo";
  const contact = values.clientContact.trim();
  if (!contact) errors.clientContact = "Necesitamos un WhatsApp o un mail";
  else if (!isContact(contact)) errors.clientContact = "Revisá el WhatsApp o el mail: no parece válido";
  if (!CURRENCIES.includes(values.clientCurrency as Currency))
    errors.clientCurrency = "Elegí la moneda de tu cliente";
  if (!CURRENCIES.includes(values.payoutCurrency as Currency))
    errors.payoutCurrency = "Elegí la moneda en la que cobrás";
  return errors;
}

export function validateMilestone(row: MilestoneRow): MilestoneErrors {
  const errors: MilestoneErrors = {};
  if (!row.title.trim()) errors.title = "Contá qué entregás en este hito";
  if (!row.amount.trim()) errors.amount = "Poné el monto del hito";
  else {
    const units = parseAmountToUnits(row.amount);
    if (units === null) errors.amount = "El monto no es válido. Escribilo así: 500 o 1500,50";
    else if (units <= BigInt(0)) errors.amount = "El monto tiene que ser mayor a 0";
  }
  const days = Number(row.reviewDays);
  if (!row.reviewDays.trim() || !Number.isInteger(days) || days < 0 || days > MAX_REVIEW_DAYS)
    errors.reviewDays = `Poné entre 0 y ${MAX_REVIEW_DAYS} días`;
  return errors;
}

export function validateMilestones(rows: readonly MilestoneRow[]): {
  rowErrors: MilestoneErrors[];
  listError?: string;
  valid: boolean;
} {
  const rowErrors = rows.map(validateMilestone);
  let listError: string | undefined;
  if (rows.length < 1) listError = "Agregá al menos un hito";
  else if (rows.length > MAX_MILESTONES) listError = `Podés cargar hasta ${MAX_MILESTONES} hitos`;
  const valid = !listError && rowErrors.every((e) => Object.keys(e).length === 0);
  return { rowErrors, listError, valid };
}

/** Suma de los montos válidos; las filas vacías o inválidas cuentan 0. */
export function totalUnits(rows: readonly MilestoneRow[]): bigint {
  return rows.reduce((sum, row) => sum + (parseAmountToUnits(row.amount) ?? BigInt(0)), BigInt(0));
}

/** Hitos en el formato que espera POST /api/agreements (monto como texto en unidades mínimas). */
export function toMilestonePayload(rows: readonly MilestoneRow[]) {
  return rows.map((row) => ({
    title: row.title.trim(),
    amount: (parseAmountToUnits(row.amount) ?? BigInt(0)).toString(),
    reviewDays: Number(row.reviewDays),
  }));
}

/** Pedido completo para POST /api/agreements (PAC-18). Las monedas ya tienen que estar validadas. */
export function buildAgreementPayload(
  details: DetailsValues,
  rows: readonly MilestoneRow[],
  freelancerWallet: string,
) {
  return {
    freelancerWallet,
    title: details.title.trim(),
    description: details.description.trim(),
    clientContact: details.clientContact.trim(),
    clientCurrency: details.clientCurrency,
    payoutCurrency: details.payoutCurrency,
    milestones: toMilestonePayload(rows),
  };
}

/** Link de WhatsApp con un mensaje listo para mandarle al cliente. */
export function buildWhatsAppShareUrl(title: string, link: string): string {
  const text = `Hola! Armé el acuerdo "${title.trim()}" en Pactá. Revisalo y depositá desde acá: ${link}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
