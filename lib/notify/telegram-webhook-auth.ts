// Verifica que un pedido al webhook venga de Telegram: trae la clave del webhook en el
// encabezado `X-Telegram-Bot-Api-Secret-Token` (TELEGRAM_WEBHOOK_SECRET).
import { timingSafeEqual } from "node:crypto";

export function isTelegramWebhookAuthorized(
  header: string | null,
  secret = process.env.TELEGRAM_WEBHOOK_SECRET,
): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(secret);
  const received = Buffer.from(header);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
