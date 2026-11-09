// POST /api/telegram/webhook: Telegram avisa acá cuando alguien le escribe al bot.
// Solo acepta pedidos que traen la clave del webhook en el encabezado
// `X-Telegram-Bot-Api-Secret-Token` (TELEGRAM_WEBHOOK_SECRET, la misma que se le pasa a
// Telegram con `npm run telegram:webhook`). Ver docs/telegram.md.
import { getDb } from "@/lib/db";
import { sendTelegramText } from "@/lib/notify/telegram";
import { handleTelegramUpdate, type TelegramUpdate } from "@/lib/notify/telegram-subscribe";
import { isTelegramWebhookAuthorized } from "@/lib/notify/telegram-webhook-auth";

export async function POST(request: Request) {
  if (!isTelegramWebhookAuthorized(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return Response.json({ ok: true });
  }

  const outcome = await handleTelegramUpdate(getDb(), update, (chatId, text) =>
    sendTelegramText(chatId, text),
  );
  // Siempre 200: si respondemos error, Telegram reintenta el mismo mensaje una y otra vez.
  return Response.json({ ok: true, outcome });
}
