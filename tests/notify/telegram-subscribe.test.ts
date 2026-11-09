import { describe, expect, it, vi } from "vitest";

import { loadTelegramChats } from "@/lib/notify/events";
import {
  parseTelegramStartCode,
  telegramStartCode,
  telegramSubscribeUrl,
} from "@/lib/notify/telegram-links";
import { handleTelegramUpdate, type TelegramUpdate } from "@/lib/notify/telegram-subscribe";
import { isTelegramWebhookAuthorized } from "@/lib/notify/telegram-webhook-auth";
import { FakeDb } from "../helpers/fake-db";

function setup() {
  const db = new FakeDb();
  db.tables.users.push({ id: "u1", name: "Sofía", telegram_chat_id: null });
  db.tables.agreements.push({
    id: "a1",
    public_id: "Ab3dEf7h",
    title: "Logo y manual",
    freelancer_id: "u1",
    client_telegram_chat_id: null,
  });
  const reply = vi.fn(async () => undefined);
  return { db, reply };
}

const msg = (text: string, chatId: number | string = 111, type = "private"): TelegramUpdate => ({
  message: { text, chat: { id: chatId, type } },
});

describe("links de suscripción (lib/notify/telegram-links.ts)", () => {
  it("arma y lee el código del /start para cada lado", () => {
    expect(telegramStartCode("client", "Ab3dEf7h")).toBe("c-Ab3dEf7h");
    expect(parseTelegramStartCode("f-Ab3dEf7h")).toEqual({ role: "freelancer", publicId: "Ab3dEf7h" });
    expect(parseTelegramStartCode("x-Ab3dEf7h")).toBeNull();
    expect(parseTelegramStartCode("c-a!b")).toBeNull();
  });

  it("arma el link al bot y no lo muestra si falta el nombre del bot", () => {
    expect(telegramSubscribeUrl("client", "Ab3dEf7h", "@pacta_test_bot")).toBe(
      "https://t.me/pacta_test_bot?start=c-Ab3dEf7h",
    );
    expect(telegramSubscribeUrl("client", "Ab3dEf7h", "")).toBeNull();
    expect(telegramSubscribeUrl("client", "Ab3dEf7h", "mal nombre")).toBeNull();
  });
});

describe("bot: suscripción (lib/notify/telegram-subscribe.ts)", () => {
  it("el cliente se suscribe con /start c-<id> y queda guardado en el acuerdo", async () => {
    const { db, reply } = setup();
    expect(await handleTelegramUpdate(db.asClient(), msg("/start c-Ab3dEf7h"), reply)).toBe("subscribed");
    expect(db.tables.agreements[0].client_telegram_chat_id).toBe("111");
    expect(reply).toHaveBeenCalledWith("111", expect.stringContaining('"Logo y manual"'));
  });

  it("la freelancer se suscribe con /start f-<id> y queda guardada en su usuario", async () => {
    const { db, reply } = setup();
    expect(await handleTelegramUpdate(db.asClient(), msg("/start f-Ab3dEf7h", 222), reply)).toBe("subscribed");
    expect(db.tables.users[0].telegram_chat_id).toBe("222");
    expect(db.tables.agreements[0].client_telegram_chat_id).toBeNull();
  });

  it("la primera cuenta queda fija: otra cuenta no la pisa", async () => {
    const { db, reply } = setup();
    await handleTelegramUpdate(db.asClient(), msg("/start c-Ab3dEf7h", 111), reply);
    expect(await handleTelegramUpdate(db.asClient(), msg("/start c-Ab3dEf7h", 999), reply)).toBe("taken");
    expect(db.tables.agreements[0].client_telegram_chat_id).toBe("111");
    expect(await handleTelegramUpdate(db.asClient(), msg("/start c-Ab3dEf7h", 111), reply)).toBe(
      "already_subscribed",
    );
  });

  it("/stop da de baja esa cuenta en los dos lados", async () => {
    const { db, reply } = setup();
    await handleTelegramUpdate(db.asClient(), msg("/start c-Ab3dEf7h", 111), reply);
    await handleTelegramUpdate(db.asClient(), msg("/start f-Ab3dEf7h", 111), reply);
    expect(await handleTelegramUpdate(db.asClient(), msg("/stop", 111), reply)).toBe("unsubscribed");
    expect(db.tables.agreements[0].client_telegram_chat_id).toBeNull();
    expect(db.tables.users[0].telegram_chat_id).toBeNull();
  });

  it("acuerdo inexistente, código inválido o mensaje suelto: responde sin guardar nada", async () => {
    const { db, reply } = setup();
    expect(await handleTelegramUpdate(db.asClient(), msg("/start c-NoExiste9"), reply)).toBe("not_found");
    expect(await handleTelegramUpdate(db.asClient(), msg("/start cualquiera"), reply)).toBe("invalid_code");
    expect(await handleTelegramUpdate(db.asClient(), msg("hola"), reply)).toBe("help");
    expect(db.tables.agreements[0].client_telegram_chat_id).toBeNull();
    expect(reply).toHaveBeenCalledTimes(3);
  });

  it("ignora grupos y mensajes sin texto", async () => {
    const { db, reply } = setup();
    expect(await handleTelegramUpdate(db.asClient(), msg("/start c-Ab3dEf7h", -100, "group"), reply)).toBe(
      "ignored",
    );
    expect(await handleTelegramUpdate(db.asClient(), {}, reply)).toBe("ignored");
    expect(reply).not.toHaveBeenCalled();
  });

  it("si la base falla, avisa en el chat y no tira error", async () => {
    const { db, reply } = setup();
    const broken = {
      from: () => {
        throw new Error("sin conexión");
      },
    } as unknown as ReturnType<FakeDb["asClient"]>;
    expect(await handleTelegramUpdate(broken, msg("/start c-Ab3dEf7h"), reply)).toBe("error");
    expect(reply).toHaveBeenCalledTimes(1);
    expect(db.tables.agreements[0].client_telegram_chat_id).toBeNull();
  });
});

describe("webhook y avisos", () => {
  it("solo acepta pedidos con la clave del webhook", () => {
    expect(isTelegramWebhookAuthorized("clave-123", "clave-123")).toBe(true);
    expect(isTelegramWebhookAuthorized("otra", "clave-123")).toBe(false);
    expect(isTelegramWebhookAuthorized(null, "clave-123")).toBe(false);
    expect(isTelegramWebhookAuthorized("clave-123", "")).toBe(false);
  });

  it("los avisos leen el chat de cada lado, y sin columna siguen por mail", async () => {
    const { db } = setup();
    db.tables.agreements[0].client_telegram_chat_id = "111";
    db.tables.users[0].telegram_chat_id = "222";
    expect(await loadTelegramChats(db.asClient(), "a1", "u1")).toEqual({ client: "111", freelancer: "222" });

    const noColumn = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "column does not exist" } }) }) }),
      }),
    } as unknown as ReturnType<FakeDb["asClient"]>;
    expect(await loadTelegramChats(noColumn, "a1", "u1")).toEqual({ client: null, freelancer: null });
  });
});
