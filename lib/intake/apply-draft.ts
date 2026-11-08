// Pasa la propuesta de la IA (PAC-35) al formulario de /nuevo (PAC-37).
// Lógica pura, sin React: la usa AgreementForm y se prueba en tests/intake.
//
// Regla de fondo: la IA propone y la persona decide. Por eso nunca pisamos lo que ya
// escribió en los datos del trabajo; solo completamos lo que está vacío.

import { MAX_MILESTONES, type DetailsValues, type MilestoneRow } from "@/lib/agreement-form";
import type { Currency } from "@/lib/validation/agreement";

/** Forma de lo que devuelve POST /api/intake (la misma que IntakeDraft del servidor). */
export type IntakeDraftResponse = {
  title?: string;
  clientCurrency?: Currency;
  milestones: { title: string; amount: string; reviewDays: number }[];
  notes: string[];
};

export type AppliedDraft = {
  details: DetailsValues;
  rows: MilestoneRow[];
  /** Avisos para mostrar arriba del formulario (incluye los de la IA). */
  notes: string[];
};

/**
 * @param makeRow crea una fila de hito con un id nuevo (el formulario ya tiene esa función).
 * @param originalText lo que contó la persona: queda como descripción si estaba vacía,
 *   porque el formulario la pide igual.
 */
export function applyIntakeDraft(
  draft: IntakeDraftResponse,
  originalText: string,
  currentDetails: DetailsValues,
  makeRow: () => MilestoneRow,
): AppliedDraft {
  const details: DetailsValues = {
    ...currentDetails,
    title: currentDetails.title.trim() || draft.title || "",
    description: currentDetails.description.trim() || originalText.trim(),
    clientCurrency: currentDetails.clientCurrency || draft.clientCurrency || "",
  };

  const proposed = draft.milestones.slice(0, MAX_MILESTONES);
  const rows = proposed.map((milestone) => ({
    ...makeRow(),
    title: milestone.title,
    amount: milestone.amount,
    reviewDays: String(milestone.reviewDays),
  }));

  const notes = [...draft.notes];
  if (draft.milestones.length > MAX_MILESTONES) {
    notes.push(
      `Había más de ${MAX_MILESTONES} hitos y cargamos los primeros ${MAX_MILESTONES}. Agrupá partes del trabajo si hace falta.`,
    );
  }

  return { details, rows, notes };
}
