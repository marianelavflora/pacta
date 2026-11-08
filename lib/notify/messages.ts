// Textos de los avisos (PAC-42): uno por cambio de estado. Castellano rioplatense y simple.
// Funciones puras: reciben datos ya armados y devuelven asunto y cuerpo. No mandan nada.

export type NotifyEvent =
  | "deposit_received"
  | "milestone_delivered"
  | "review_reminder"
  | "milestone_approved"
  | "auto_release"
  | "milestone_paid";

export type MessageData = {
  /** Nombre de quien recibe el aviso. */
  recipientName: string;
  /** Título del acuerdo. */
  agreementTitle: string;
  /** Título del hito, si el aviso es de un hito. */
  milestoneTitle?: string;
  /** Monto ya formateado para leer, por ejemplo "R$ 600". */
  amount?: string;
  /** Link a la pantalla donde la persona puede actuar o ver el estado. */
  link: string;
};

export type Message = { subject: string; body: string };

const milestoneOf = (data: MessageData) =>
  data.milestoneTitle ? `el hito "${data.milestoneTitle}"` : "un hito";

const BUILDERS: Record<NotifyEvent, (data: MessageData) => Message> = {
  deposit_received: (d) => ({
    subject: `Recibimos el depósito de "${d.agreementTitle}"`,
    body: `Hola ${d.recipientName}, recibimos el depósito${d.amount ? ` de ${d.amount}` : ""} del acuerdo "${d.agreementTitle}". La plata queda guardada hasta que apruebes cada hito.\n\nMirá el estado acá: ${d.link}`,
  }),
  milestone_delivered: (d) => ({
    subject: `Hay un hito para revisar: ${d.milestoneTitle ?? d.agreementTitle}`,
    body: `Hola ${d.recipientName}, entregaron ${milestoneOf(d)} del acuerdo "${d.agreementTitle}". Revisalo y, si está bien, aprobalo para que se pague.\n\nRevisalo acá: ${d.link}`,
  }),
  review_reminder: (d) => ({
    subject: `Te falta revisar ${milestoneOf(d)}`,
    body: `Hola ${d.recipientName}, todavía no revisaste ${milestoneOf(d)} del acuerdo "${d.agreementTitle}". Si no respondés en 3 días, lo liberamos solo y se le paga a quien lo entregó.\n\nRevisalo acá: ${d.link}`,
  }),
  milestone_approved: (d) => ({
    subject: `Aprobaron ${milestoneOf(d)}`,
    body: `Hola ${d.recipientName}, aprobaron ${milestoneOf(d)} del acuerdo "${d.agreementTitle}". En unos minutos te llega el pago${d.amount ? ` de ${d.amount}` : ""}.\n\nSeguilo acá: ${d.link}`,
  }),
  auto_release: (d) => ({
    subject: `Liberamos ${milestoneOf(d)} sin respuesta`,
    body: `Hola ${d.recipientName}, pasaron 6 días sin respuesta y liberamos ${milestoneOf(d)} del acuerdo "${d.agreementTitle}", como estaba acordado. Se paga en unos minutos.\n\nMirá el detalle: ${d.link}`,
  }),
  milestone_paid: (d) => ({
    subject: `Pago realizado: ${d.milestoneTitle ?? d.agreementTitle}`,
    body: `Hola ${d.recipientName}, se pagó ${milestoneOf(d)} del acuerdo "${d.agreementTitle}"${d.amount ? ` (${d.amount})` : ""}.\n\nAbrí el recibo: ${d.link}`,
  }),
};

export function buildMessage(event: NotifyEvent, data: MessageData): Message {
  return BUILDERS[event](data);
}
