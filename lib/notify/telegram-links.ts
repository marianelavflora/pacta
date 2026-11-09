// Links para suscribirse a los avisos de Telegram. Sin dependencias de servidor:
// lo usan las pantallas y el webhook.
//
// El botón abre `t.me/<bot>?start=<código>`. Telegram le manda al webhook
// "/start <código>", y con eso sabemos de qué acuerdo y de qué lado es la persona.
import { isValidPublicId } from "@/lib/agreements";

export type TelegramRole = "client" | "freelancer";

const PREFIX: Record<TelegramRole, string> = { client: "c", freelancer: "f" };

/** Código que va en el link: `c-<publicId>` (cliente) o `f-<publicId>` (freelancer). */
export function telegramStartCode(role: TelegramRole, publicId: string): string {
  return `${PREFIX[role]}-${publicId}`;
}

/** Lee el código del "/start". Devuelve null si no tiene la forma esperada. */
export function parseTelegramStartCode(
  code: string,
): { role: TelegramRole; publicId: string } | null {
  const match = /^([cf])-(.+)$/.exec(code.trim());
  if (!match || !isValidPublicId(match[2])) return null;
  return { role: match[1] === "c" ? "client" : "freelancer", publicId: match[2] };
}

/** Link para suscribirse. Devuelve null si no está configurado el nombre del bot. */
export function telegramSubscribeUrl(
  role: TelegramRole,
  publicId: string,
  botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME,
): string | null {
  const bot = botUsername?.trim().replace(/^@/, "");
  if (!bot || !/^[A-Za-z0-9_]{5,32}$/.test(bot)) return null;
  return `https://t.me/${bot}?start=${encodeURIComponent(telegramStartCode(role, publicId))}`;
}
