// Suscripción a los avisos por Telegram: qué hace el bot cuando alguien le escribe.
// Lo llama el webhook (`app/api/telegram/webhook`). Recibe la base por parámetro
// para poder probarlo sin red.
//
// - "/start c-<publicId>": el cliente de ese acuerdo se suscribe.
// - "/start f-<publicId>": la freelancer de ese acuerdo se suscribe.
// - "/stop": esa cuenta de Telegram deja de recibir avisos (siguen por mail).
//
// Seguridad: el link del acuerdo es público, así que la primera cuenta que se
// suscribe queda fija y nadie puede pisarla. Para cambiarla, esa cuenta escribe /stop.
import type { SupabaseClient } from "@supabase/supabase-js";

import { parseTelegramStartCode } from "./telegram-links";

/** Lo mínimo del "Update" de Telegram que usamos. */
export type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number | string; type?: string };
  };
};

export type SubscribeOutcome =
  | "ignored"
  | "subscribed"
  | "already_subscribed"
  | "taken"
  | "not_found"
  | "invalid_code"
  | "unsubscribed"
  | "help"
  | "error";

export type Reply = (chatId: string, text: string) => Promise<unknown>;

const TEXTS = {
  subscribed: (title: string) =>
    `Listo. Vas a recibir por acá los avisos del acuerdo "${title}". Para dejar de recibirlos, escribí /stop.`,
  already: (title: string) => `Ya estás recibiendo por acá los avisos del acuerdo "${title}".`,
  taken:
    "Los avisos de este acuerdo ya están activados en otra cuenta de Telegram. Si es un error, escribinos desde la web de Pactá.",
  notFound: "No encontramos ese acuerdo. Volvé a abrir el botón desde la pantalla de tu acuerdo en Pactá.",
  invalid: "Ese link no es válido. Volvé a abrir el botón desde la pantalla de tu acuerdo en Pactá.",
  unsubscribed: "Listo, ya no vas a recibir avisos por Telegram. Te seguimos avisando por mail.",
  help: 'Hola, soy el bot de Pactá. Para recibir avisos, tocá "Recibir avisos por Telegram" en la pantalla de tu acuerdo.',
  error: "No pudimos activar los avisos en este momento. Probá de nuevo en unos minutos.",
};

type Row = Record<string, unknown>;

export async function handleTelegramUpdate(
  db: SupabaseClient,
  update: TelegramUpdate,
  reply: Reply,
): Promise<SubscribeOutcome> {
  const message = update.message;
  const chatId = message?.chat?.id;
  // Solo chats privados con el bot: los grupos no reciben avisos de un acuerdo.
  if (chatId === undefined || message?.chat?.type !== "private" || typeof message.text !== "string") {
    return "ignored";
  }
  const chat = String(chatId);
  const text = message.text.trim();

  try {
    if (/^\/stop(@\w+)?$/.test(text)) {
      await unsubscribe(db, chat);
      await reply(chat, TEXTS.unsubscribed);
      return "unsubscribed";
    }

    const start = /^\/start(?:@\w+)?(?:\s+(\S+))?$/.exec(text);
    if (!start || !start[1]) {
      await reply(chat, TEXTS.help);
      return "help";
    }

    const code = parseTelegramStartCode(start[1]);
    if (!code) {
      await reply(chat, TEXTS.invalid);
      return "invalid_code";
    }

    const found = await db
      .from("agreements")
      .select("id, title, freelancer_id, client_telegram_chat_id")
      .eq("public_id", code.publicId)
      .maybeSingle();
    if (found.error) throw new Error(found.error.message);
    const agreement = found.data as Row | null;
    if (!agreement) {
      await reply(chat, TEXTS.notFound);
      return "not_found";
    }
    const title = String(agreement.title);

    let current: unknown;
    if (code.role === "client") {
      current = agreement.client_telegram_chat_id;
    } else {
      const user = await db
        .from("users")
        .select("telegram_chat_id")
        .eq("id", agreement.freelancer_id)
        .maybeSingle();
      if (user.error) throw new Error(user.error.message);
      current = (user.data as Row | null)?.telegram_chat_id;
    }

    if (current === chat) {
      await reply(chat, TEXTS.already(title));
      return "already_subscribed";
    }
    if (typeof current === "string" && current !== "") {
      await reply(chat, TEXTS.taken);
      return "taken";
    }

    const saved =
      code.role === "client"
        ? await db.from("agreements").update({ client_telegram_chat_id: chat }).eq("id", agreement.id)
        : await db.from("users").update({ telegram_chat_id: chat }).eq("id", agreement.freelancer_id);
    if (saved.error) throw new Error(saved.error.message);

    await reply(chat, TEXTS.subscribed(title));
    return "subscribed";
  } catch (error) {
    console.error("[telegram] no se pudo procesar el mensaje", error instanceof Error ? error.message : error);
    await reply(chat, TEXTS.error).catch(() => undefined);
    return "error";
  }
}

async function unsubscribe(db: SupabaseClient, chat: string) {
  const client = await db
    .from("agreements")
    .update({ client_telegram_chat_id: null })
    .eq("client_telegram_chat_id", chat);
  if (client.error) throw new Error(client.error.message);
  const freelancer = await db.from("users").update({ telegram_chat_id: null }).eq("telegram_chat_id", chat);
  if (freelancer.error) throw new Error(freelancer.error.message);
}
