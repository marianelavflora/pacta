// Recordatorios y auto-liberación (PAC-38 y PAC-39). Corre por cron y es seguro llamarlo muchas veces.
//
// Línea de tiempo de un hito entregado y sin respuesta del cliente:
//   día 0  delivered  → aviso de "hay un hito para revisar" (al entregar)
//   día 3  reminded   → segundo aviso al cliente
//   día 6  expired    → se libera solo; el liberador (releaser.ts) lo paga como si estuviera aprobado
//
// Cada paso es un update condicional por estado: si dos corridas coinciden, solo una lo logra y
// avisa. Así nadie recibe el aviso dos veces.
import type { SupabaseClient } from "@supabase/supabase-js";

import { onAutoRelease, onReviewReminder } from "@/lib/notify/events";

export const REMINDER_AFTER = 3; // unidades de tiempo desde la entrega
export const RELEASE_AFTER = 3; // unidades de tiempo desde el recordatorio (día 6 en total)

const UNIT_MS = { days: 86_400_000, minutes: 60_000 } as const;

/** `TIME_UNIT=minutes` deja probar los plazos de 3 y 6 días en minutos. Cualquier otro valor: días. */
export function timeUnitMs(raw: string | undefined = process.env.TIME_UNIT): number {
  return raw?.trim() === "minutes" ? UNIT_MS.minutes : UNIT_MS.days;
}

export type ReminderSummary = { reminded: number; expired: number };
type Row = Record<string, unknown>;

type Step = {
  from: "delivered" | "reminded";
  to: "reminded" | "expired";
  /** Columna con la fecha desde la que se cuenta el plazo. */
  dueColumn: "delivered_at" | "reminded_at";
  /** Columna donde se anota cuándo pasó al estado nuevo (la tabla no tiene una para `expired`). */
  stampColumn?: "reminded_at";
};

function fail(step: string, error: { message: string }): never {
  throw new Error(`No se pudo ${step}: ${error.message}`);
}

/** Pasa los hitos vencidos de `step.from` a `step.to` y devuelve solo los que ganó esta corrida. */
async function advance(db: SupabaseClient, step: Step, cutoffIso: string, now: Date): Promise<Row[]> {
  const due = await db
    .from("milestones")
    .select("id, agreement_id")
    .eq("status", step.from)
    .lte(step.dueColumn, cutoffIso);
  if (due.error) fail("buscar hitos vencidos", due.error);

  const patch: Row = { status: step.to };
  if (step.stampColumn) patch[step.stampColumn] = now.toISOString();

  const won: Row[] = [];
  for (const row of (due.data ?? []) as Row[]) {
    const update = await db.from("milestones").update(patch).eq("id", row.id).eq("status", step.from).select("id");
    if (update.error) fail("actualizar el hito", update.error);
    if (update.data?.length) won.push(row);
  }
  return won;
}

export async function runReminders(
  db: SupabaseClient,
  now: Date = new Date(),
  unitMs: number = timeUnitMs(),
): Promise<ReminderSummary> {
  const cutoff = (units: number) => new Date(now.getTime() - units * unitMs).toISOString();

  // Primero el día 6, así un hito muy atrasado no recibe recordatorio y liberación en la misma corrida.
  const expired = await advance(
    db,
    { from: "reminded", to: "expired", dueColumn: "reminded_at" },
    cutoff(RELEASE_AFTER),
    now,
  );
  const reminded = await advance(
    db,
    { from: "delivered", to: "reminded", dueColumn: "delivered_at", stampColumn: "reminded_at" },
    cutoff(REMINDER_AFTER),
    now,
  );

  await Promise.all([
    ...reminded.map((row) => onReviewReminder(db, row.agreement_id as string, row.id as string)),
    ...expired.map((row) => onAutoRelease(db, row.agreement_id as string, row.id as string)),
  ]);
  return { reminded: reminded.length, expired: expired.length };
}
