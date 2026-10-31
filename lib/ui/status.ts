// Textos amigables de los estados del hito, sin jerga (PAC-19).
import { MILESTONE_STATUSES, type MilestoneStatus } from "@/lib/validation/statuses";

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: "Esperando depósito",
  funded: "Depositado",
  delivered: "Entregado",
  reminded: "Esperando tu respuesta",
  approved: "Aprobado",
  expired: "Liberado por falta de respuesta",
  converting: "Convirtiendo",
  paid: "Pagado",
  paused: "En pausa",
};

/** Texto del estado de un hito; si llega uno desconocido, no se rompe la pantalla. */
export function milestoneStatusLabel(status: string): string {
  return (MILESTONE_STATUSES as readonly string[]).includes(status)
    ? MILESTONE_STATUS_LABELS[status as MilestoneStatus]
    : "En proceso";
}
