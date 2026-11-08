// Manda un aviso por Telegram (PAC-40), solo desde el servidor.
//
// Usa la Bot API oficial de Telegram con un `fetch` simple: no hace falta
// ninguna librería. El token del bot vive en `TELEGRAM_BOT_TOKEN` y nunca
// aparece en los errores ni en los logs.
//
// Importante: un bot de Telegram NO puede escribirle a un número de teléfono.
// Solo le escribe a quien abrió el bot y tocó "Iniciar". Por eso se le pasa
// el `chatId` de esa persona, no su teléfono (ver docs/telegram.md).
//
// Nunca tira un error: si un aviso falla, el pago tiene que seguir igual.

import { renderMessage, type TemplateName } from "./messages";

export type SendResult = { ok: true } | { ok: false; error: string };

type Options = {
  /** Token del bot. Por defecto, `process.env.TELEGRAM_BOT_TOKEN`. */
  token?: string;
  /** Para los tests: un `fetch` falso. */
  fetchImpl?: typeof fetch;
};

const API = "https://api.telegram.org";

/** El chat de Telegram es un número (puede ser negativo en grupos) o un @canal. */
export function normalizeChatId(chatId: string | number): string | null {
  const value = String(chatId).trim();
  if (/^-?\d{1,20}$/.test(value)) return value;
  if (/^@[A-Za-z0-9_]{5,32}$/.test(value)) return value;
  return null;
}

export async function sendTelegram(
  chatId: string | number,
  template: TemplateName,
  data: Record<string, string>,
  { token = process.env.TELEGRAM_BOT_TOKEN, fetchImpl = fetch }: Options = {},
): Promise<SendResult> {
  if (!token) return { ok: false, error: "Falta TELEGRAM_BOT_TOKEN." };

  const chat = normalizeChatId(chatId);
  if (!chat) return { ok: false, error: "El chat de Telegram no es válido." };

  const text = renderMessage(template, data);
  if (!text) return { ok: false, error: `Faltan datos para la plantilla ${template}.` };

  try {
    const res = await fetchImpl(`${API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text }),
    });
    const body = (await res.json().catch(() => null)) as
      | { ok?: boolean; description?: unknown }
      | null;
    if (res.ok && body?.ok) return { ok: true };
    const reason = typeof body?.description === "string" ? body.description : `HTTP ${res.status}`;
    return { ok: false, error: `Telegram no mandó el mensaje: ${redact(reason, token)}` };
  } catch {
    // El mensaje del error de red puede incluir la URL (con el token): no se muestra.
    return { ok: false, error: "No pudimos conectarnos con Telegram." };
  }
}

function redact(text: string, token: string): string {
  return text.split(token).join("***");
}
