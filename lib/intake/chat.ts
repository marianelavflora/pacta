// Textos y reglas del chat del agente en /nuevo (PAC-37 v2). Lógica pura, sin React.

import { currencyName } from "@/lib/ui/currency";
import type { DetailsValues } from "@/lib/agreement-form";

export const WELCOME_MESSAGE =
  "Contame qué trabajo vas a hacer: qué entregás, en cuántas partes y cuánto cobrás. Yo armo los hitos y vos los revisás.";

export const EXAMPLE_TEXT =
  "Logo y manual de marca para una agencia de São Paulo, 3 entregas en un mes, 1500 reales en total.";

export const FAILURE_MESSAGE =
  "No pude armar los hitos con ese texto. Podés contármelo de otra forma o cargarlos a mano.";

/** Todo lo que la persona le fue diciendo al agente, en orden, para que el último cambio mande. */
export function joinUserMessages(userTexts: readonly string[]): string {
  return userTexts
    .map((text) => text.trim())
    .filter(Boolean)
    .join("\n");
}

/** Mensaje del agente que explica cómo se va a cobrar, con lo que ya sabe del acuerdo. */
export function explainAgreement(
  details: Pick<DetailsValues, "clientCurrency" | "payoutCurrency">,
): string {
  const reminders =
    "Si tu cliente no responde una entrega en 3 días le aviso de nuevo, y a los 6 te pago igual.";

  if (!details.clientCurrency) {
    return `Todavía no sé en qué moneda te paga tu cliente: tocá "Cambiar monedas" para elegirla. ${reminders}`;
  }
  const payout = details.payoutCurrency || "wARS";
  return `Tu cliente paga en ${details.clientCurrency} (${currencyName(details.clientCurrency)}) y vos cobrás en ${payout}. ${reminders} ¿Va?`;
}

/** Aplica la misma cantidad de días de revisión a todos los hitos (el atajo "Cambiar plazos"). */
export function withReviewDays<T extends { reviewDays: string }>(
  rows: readonly T[],
  days: string,
): T[] {
  return rows.map((row) => ({ ...row, reviewDays: days }));
}
