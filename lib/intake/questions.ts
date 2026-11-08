// Las preguntas que el agente le hace a la persona para completar el acuerdo (chat de /nuevo).
// Lógica pura, sin React ni IA: mira qué datos faltan, arma la próxima pregunta y valida la respuesta.
// Las respuestas se aplican acá mismo, así que contestar no gasta pedidos a la IA.

import {
  isContact,
  type DetailsValues,
  type MilestoneRow,
} from "@/lib/agreement-form";
import { parseAmountToUnits } from "@/lib/amounts";
import { CURRENCIES, type Currency } from "@/lib/validation/agreement";

export type Question =
  | { kind: "milestoneTitle"; rowId: string; text: string }
  | { kind: "milestoneAmount"; rowId: string; text: string }
  | { kind: "clientCurrency"; text: string }
  | { kind: "clientContact"; text: string }
  | { kind: "title"; text: string }
  | { kind: "description"; text: string };

export type AnswerResult =
  | { ok: true; details: DetailsValues; rows: MilestoneRow[] }
  | { ok: false; message: string };

/** Cómo llamamos a cada hito en las preguntas: su título, o "el hito 2" si todavía no tiene. */
function milestoneLabel(row: MilestoneRow, index: number): string {
  const title = row.title.trim();
  return title ? `"${title}"` : `el hito ${index + 1}`;
}

function hasValidAmount(row: MilestoneRow): boolean {
  const units = parseAmountToUnits(row.amount);
  return units !== null && units > BigInt(0);
}

/** La próxima pregunta que falta responder, o null si ya está todo para crear el acuerdo. */
export function nextQuestion(
  details: DetailsValues,
  rows: readonly MilestoneRow[],
): Question | null {
  for (const [index, row] of rows.entries()) {
    if (!row.title.trim()) {
      return {
        kind: "milestoneTitle",
        rowId: row.id,
        text: `¿Qué entregás en el hito ${index + 1}?`,
      };
    }
  }
  for (const [index, row] of rows.entries()) {
    if (!hasValidAmount(row)) {
      return {
        kind: "milestoneAmount",
        rowId: row.id,
        text: `¿Cuánto cobrás por ${milestoneLabel(row, index)}? Escribí solo el monto, por ejemplo 500.`,
      };
    }
  }
  if (!details.clientCurrency) {
    return {
      kind: "clientCurrency",
      text: "¿En qué moneda te paga tu cliente?",
    };
  }
  if (!details.title.trim()) {
    return { kind: "title", text: "¿Qué nombre le ponemos al trabajo?" };
  }
  if (!details.description.trim()) {
    return {
      kind: "description",
      text: "Contame en una frase de qué se trata el trabajo.",
    };
  }
  if (!isContact(details.clientContact.trim())) {
    return {
      kind: "clientContact",
      text: "¿Cómo le aviso a tu cliente? Pasame su WhatsApp o su mail.",
    };
  }
  return null;
}

const CURRENCY_WORDS: [Currency, RegExp][] = [
  ["wARS", /\b(w?ars|argentin\w*|pesos? arg\w*)\b/i],
  ["wBRL", /\b(w?brl|reales?|real|brasil\w*|brazil\w*)\b/i],
  ["wMXN", /\b(w?mxn|mexic\w*|pesos? mex\w*)\b/i],
];

/** "reales", "BRL" o "wBRL" → "wBRL". Devuelve null si no se entiende. */
export function parseCurrencyAnswer(answer: string): Currency | null {
  const exact = CURRENCIES.find(
    (currency) => currency.toLowerCase() === answer.trim().toLowerCase(),
  );
  if (exact) return exact;
  return CURRENCY_WORDS.find(([, words]) => words.test(answer))?.[0] ?? null;
}

function updateRow(
  rows: readonly MilestoneRow[],
  rowId: string,
  changes: Partial<MilestoneRow>,
): MilestoneRow[] {
  return rows.map((row) => (row.id === rowId ? { ...row, ...changes } : row));
}

/** Aplica lo que contestó la persona a la pregunta. Si no sirve, devuelve qué decirle. */
export function applyAnswer(
  question: Question,
  answer: string,
  details: DetailsValues,
  rows: readonly MilestoneRow[],
): AnswerResult {
  const text = answer.trim();
  const accepted = (
    nextDetails: DetailsValues,
    nextRows: readonly MilestoneRow[],
  ): AnswerResult => ({ ok: true, details: nextDetails, rows: [...nextRows] });

  switch (question.kind) {
    case "milestoneTitle":
      return accepted(details, updateRow(rows, question.rowId, { title: text }));

    case "milestoneAmount": {
      // Sacamos símbolos y palabras ("R$ 500", "500 reales") y dejamos solo el número.
      const number = text.replace(/[^\d.,]/g, "");
      const units = parseAmountToUnits(number);
      if (units === null || units <= BigInt(0)) {
        return {
          ok: false,
          message:
            "No entendí el monto. Escribilo solo con números, por ejemplo 500 o 1500,50.",
        };
      }
      return accepted(
        details,
        updateRow(rows, question.rowId, { amount: number }),
      );
    }

    case "clientCurrency": {
      const currency = parseCurrencyAnswer(text);
      if (!currency) {
        return {
          ok: false,
          message: "Elegí una: wARS (pesos argentinos), wBRL (reales) o wMXN (pesos mexicanos).",
        };
      }
      return accepted({ ...details, clientCurrency: currency }, rows);
    }

    case "clientContact":
      if (!isContact(text)) {
        return {
          ok: false,
          message:
            "Eso no parece un WhatsApp ni un mail. Probá con algo como cliente@mail.com o +54 9 11 2345 6789.",
        };
      }
      return accepted({ ...details, clientContact: text }, rows);

    case "title":
      return accepted({ ...details, title: text }, rows);

    case "description":
      return accepted({ ...details, description: text }, rows);
  }
}
