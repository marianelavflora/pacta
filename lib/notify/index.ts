// notify (PAC-42): manda un aviso por los canales disponibles, en orden de preferencia, y se
// queda con el primero que funciona. Hoy hay un canal (mail); WhatsApp (PAC-40) se suma como
// otro `Channel` delante, sin cambiar a quien llama.
import { sendEmail, type SendResult } from "./email";
import { buildMessage, type MessageData, type NotifyEvent } from "./messages";

export type Recipient = { name: string; email?: string | null };

export type Channel = {
  name: string;
  send: (recipient: Recipient, message: ReturnType<typeof buildMessage>) => Promise<SendResult>;
};

export const emailChannel: Channel = {
  name: "email",
  send: (recipient, message) => sendEmail(recipient.email, message),
};

export type NotifyOutcome = { delivered: boolean; channel: string | null; attempts: Record<string, string> };

/** Nunca tira error: un aviso que falla no puede frenar un pago ni un cambio de estado. */
export async function notify(
  event: NotifyEvent,
  recipient: Recipient,
  data: Omit<MessageData, "recipientName">,
  channels: readonly Channel[] = [emailChannel],
): Promise<NotifyOutcome> {
  const message = buildMessage(event, { ...data, recipientName: recipient.name });
  const attempts: Record<string, string> = {};
  for (const channel of channels) {
    let result: SendResult;
    try {
      result = await channel.send(recipient, message);
    } catch (error) {
      result = { status: "failed", reason: error instanceof Error ? error.message : "error" };
    }
    attempts[channel.name] = result.status === "sent" ? "sent" : `${result.status}: ${result.reason}`;
    if (result.status === "sent") return { delivered: true, channel: channel.name, attempts };
  }
  if (Object.values(attempts).some((a) => a.startsWith("failed"))) {
    console.error("[notify] no se pudo avisar", event, attempts);
  }
  return { delivered: false, channel: null, attempts };
}
