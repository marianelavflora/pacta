import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { notify, emailChannel, telegramChannel } from "@/lib/notify";
import { buildMessage } from "@/lib/notify/messages";
import { normalizeChatId, sendTelegram } from "@/lib/notify/telegram";

const TOKEN = "000000:token-falso-de-prueba";
const message = buildMessage("review_reminder", {
  recipientName: "Agencia Sol",
  agreementTitle: "Logo y manual de marca",
  milestoneTitle: "Entrega 1",
  link: "https://pacta.app/cliente/abc123",
});

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

beforeEach(() => vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN));
afterEach(() => vi.unstubAllEnvs());

describe("canal de Telegram (lib/notify/telegram.ts)", () => {
  it("acepta chats numéricos y @canales, rechaza teléfonos y vacíos", () => {
    expect(normalizeChatId(" 123456789 ")).toBe("123456789");
    expect(normalizeChatId(-100123)).toBe("-100123");
    expect(normalizeChatId("@pacta_avisos")).toBe("@pacta_avisos");
    expect(normalizeChatId("+5493511234567")).toBeNull();
    expect(normalizeChatId(null)).toBeNull();
  });

  it("manda asunto y texto al chat correcto", async () => {
    const fetchImpl = fakeFetch(200, { ok: true, result: {} });
    expect(await sendTelegram("123", message, fetchImpl)).toEqual({ status: "sent" });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.chat_id).toBe("123");
    expect(body.text).toContain(message.subject);
    expect(body.text).toContain("Agencia Sol");
  });

  it("sin token o sin chat válido no llama a Telegram", async () => {
    const fetchImpl = fakeFetch(200, { ok: true });
    expect((await sendTelegram("+549351", message, fetchImpl)).status).toBe("skipped");
    expect((await sendTelegram(null, message, fetchImpl)).status).toBe("skipped");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    expect((await sendTelegram("123", message, fetchImpl)).status).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("si Telegram rechaza, devuelve el motivo sin mostrar el token", async () => {
    const fetchImpl = fakeFetch(403, { ok: false, description: `Forbidden: bot was blocked ${TOKEN}` });
    const res = await sendTelegram("123", message, fetchImpl);
    expect(res.status).toBe("failed");
    if (res.status === "failed") {
      expect(res.reason).toContain("blocked");
      expect(res.reason).not.toContain(TOKEN);
    }
  });

  it("si se cae la red no tira error ni muestra el token", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error(`fetch failed https://api.telegram.org/bot${TOKEN}/sendMessage`);
    }) as unknown as typeof fetch;
    expect(await sendTelegram("123", message, fetchImpl)).toEqual({
      status: "failed",
      reason: "no se pudo conectar con Telegram",
    });
  });

  it("notify prueba Telegram primero y, si la persona no se suscribió, sigue con el mail", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const outcome = await notify(
      "milestone_paid",
      { name: "Sofía", email: null, telegramChatId: null },
      { agreementTitle: "Logo", link: "https://pacta.app/recibo/1" },
      [telegramChannel, emailChannel],
    );
    expect(outcome.delivered).toBe(false);
    expect(Object.keys(outcome.attempts)).toEqual(["telegram", "email"]);
    expect(outcome.attempts.telegram).toContain("skipped");
  });
});
