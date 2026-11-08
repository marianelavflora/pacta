// Mail de respaldo con Resend (PAC-41). Sin RESEND_API_KEY no manda nada: devuelve "skipped".
// Se llama a la API por HTTP directo, así no sumamos una dependencia por un solo POST.
import type { Message } from "./messages";

const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 8_000;
// Resend deja probar con este remitente sin verificar un dominio propio.
const DEFAULT_FROM = "Pactá <onboarding@resend.dev>";

export type SendResult =
  | { status: "sent" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

export const looksLikeEmail = (value: string | null | undefined): value is string =>
  typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export async function sendEmail(
  to: string | null | undefined,
  message: Message,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { status: "skipped", reason: "falta RESEND_API_KEY" };
  if (!looksLikeEmail(to)) return { status: "skipped", reason: "no hay mail de la persona" };

  try {
    const response = await fetchImpl(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM?.trim() || DEFAULT_FROM,
        to: [to.trim()],
        subject: message.subject,
        text: message.body,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return { status: "failed", reason: `Resend respondió ${response.status}` };
    return { status: "sent" };
  } catch (error) {
    return { status: "failed", reason: error instanceof Error ? error.message : "error al enviar" };
  }
}
