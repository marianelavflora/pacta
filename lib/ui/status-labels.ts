// Textos simples de cada estado del hito, para la freelancer (PAC-23).
// Los estados son los oficiales de lib/validation/statuses.ts.

const FREELANCER_LABELS: Record<string, string> = {
  pending: "Esperando el depósito",
  funded: "Listo para entregar",
  delivered: "Entregado · esperando aprobación",
  reminded: "Le recordamos al cliente",
  approved: "Aprobado · preparando tu pago",
  expired: "Plazo vencido · liberando tu pago",
  converting: "Convirtiendo tu pago",
  paid: "Cobrado",
  paused: "En pausa",
};

export function milestoneStatusLabel(status: string): string {
  return FREELANCER_LABELS[status] ?? "En proceso";
}
