// Canal de avisos por Telegram (PAC-40). Solo servidor.
//
// Usa la Bot API oficial con un `fetch`, sin librerías. El token vive en
// `TELEGRAM_BOT_TOKEN` y nunca aparece en los errores.
//
// Un bot de Telegram no le escribe a un teléfono: solo a quien abrió el bot y
// tocó "Iniciar". Por eso recibe el `chat_id` de esa persona (ver docs/telegram.md).
// Nunca tira error: devuelve "sent", "skipped" o "failed", igual que el mail.
import type { SendResult } from "./email";
import type { Message } from "./messages";

const API = "https://api.telegram.org";
const TIMEOUT_MS = 8_000;

/** Un chat de Telegram es un número (negativo en grupos) o un @canal. */
export function normalizeChatId(chatId: string | number | null | undefined): string | null {
  if (chatId === null || chatId === undefined) return null;
  const value = String(chatId).trim();
  if (/^-?\d{1,20}$/.test(value)) return value;
  if (/^@[A-Za-z0-9_]{5,32}$/.test(value)) return value;
  return null;
}

export async function sendTelegram(
  chatId: string | number | null | undefined,
  message: Message,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  return sendTelegramText(chatId, `${message.subject}\n\n${message.body}`, fetchImpl);
}

/** Manda un texto suelto (por ejemplo, la respuesta del bot al "Iniciar"). */
export async function sendTelegramText(
  chatId: string | number | null | undefined,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return { status: "skipped", reason: "falta TELEGRAM_BOT_TOKEN" };
  const chat = normalizeChatId(chatId);
  if (!chat) return { status: "skipped", reason: "la persona no se suscribió al bot" };

  try {
    const response = await fetchImpl(`${API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => null)) as
      | { ok?: boolean; description?: unknown }
      | null;
    if (response.ok && body?.ok) return { status: "sent" };
    const reason = typeof body?.description === "string" ? body.description : `HTTP ${response.status}`;
    return { status: "failed", reason: `Telegram respondió: ${reason.split(token).join("***")}` };
  } catch {
    // El error de red puede incluir la URL, que lleva el token: no se muestra.
    return { status: "failed", reason: "no se pudo conectar con Telegram" };
  }
}
