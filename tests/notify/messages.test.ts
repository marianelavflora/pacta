import { describe, expect, it, vi } from "vitest";

import { MILESTONE_STATUSES } from "@/lib/validation/statuses";
import {
  TEMPLATES,
  TEMPLATE_NAMES,
  renderMessage,
  templateFields,
} from "@/lib/notify/messages";
import { normalizeChatId, sendTelegram } from "@/lib/notify/telegram";

const DATA = {
  freelancer: "Sofía",
  client: "Agencia Sol",
  agreement: "Logo y manual de marca",
  milestone: "Entrega 1",
  amount: "500 wBRL",
  rate: "1 BRL = 240 ARS",
  link: "https://pacta.app/a/abc123",
};

const TOKEN = "000000:token-falso-de-prueba";

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("textos de los avisos (lib/notify/messages.ts)", () => {
  it("hay un texto para cada cambio de estado que avisa", () => {
    const statuses = TEMPLATE_NAMES.map((n) => TEMPLATES[n].status).sort();
    expect(statuses).toEqual(["approved", "delivered", "expired", "funded", "paid", "reminded"]);
    for (const s of statuses) expect(MILESTONE_STATUSES).toContain(s);
  });

  it("completa todos los huecos", () => {
    for (const name of TEMPLATE_NAMES) {
      const text = renderMessage(name, DATA);
      expect(text).not.toBeNull();
      expect(text).not.toMatch(/[{}]/);
    }
    expect(renderMessage("deposit_received", DATA)).toBe(
      'Hola Sofía, Agencia Sol depositó 500 wBRL para el acuerdo "Logo y manual de marca". La plata ya está asegurada y podés arrancar. Ver el acuerdo: https://pacta.app/a/abc123',
    );
  });

  it("si falta un dato no arma el mensaje", () => {
    expect(renderMessage("milestone_paid", { ...DATA, rate: "" })).toBeNull();
    const sinLink: Record<string, string> = { ...DATA };
    delete sinLink.link;
    expect(renderMessage("milestone_delivered", sinLink)).toBeNull();
  });

  it("lista los huecos de cada plantilla", () => {
    expect(templateFields("milestone_approved")).toEqual(["freelancer", "client", "milestone", "amount"]);
  });

  it.todo("si Telegram falla, manda el mail de respaldo (PAC-41/PAC-42)");
  it.todo("no manda Telegram si la persona no se suscribió al bot (PAC-42)");
});

describe("enviar por Telegram (lib/notify/telegram.ts)", () => {
  it("acepta chats numéricos y @canales, rechaza teléfonos con + y basura", () => {
    expect(normalizeChatId(" 123456789 ")).toBe("123456789");
    expect(normalizeChatId(-100123)).toBe("-100123");
    expect(normalizeChatId("@pacta_avisos")).toBe("@pacta_avisos");
    expect(normalizeChatId("+5493511234567")).toBeNull();
    expect(normalizeChatId("hola")).toBeNull();
  });

  it("manda el texto completo al chat", async () => {
    const fetchImpl = fakeFetch(200, { ok: true, result: {} });
    const res = await sendTelegram("123", "review_reminder", DATA, { token: TOKEN, fetchImpl });
    expect(res).toEqual({ ok: true });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.chat_id).toBe("123");
    expect(body.text).toContain("hace 3 días");
  });

  it("sin token, con chat inválido o con datos faltantes devuelve ok: false sin llamar a Telegram", async () => {
    const fetchImpl = fakeFetch(200, { ok: true });
    expect((await sendTelegram("123", "auto_release", DATA, { token: "", fetchImpl })).ok).toBe(false);
    expect((await sendTelegram("+549351", "auto_release", DATA, { token: TOKEN, fetchImpl })).ok).toBe(false);
    expect((await sendTelegram("123", "auto_release", {}, { token: TOKEN, fetchImpl })).ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("si Telegram rechaza, devuelve el motivo sin mostrar el token", async () => {
    const fetchImpl = fakeFetch(403, { ok: false, description: `Forbidden: bot was blocked by the user ${TOKEN}` });
    const res = await sendTelegram("123", "milestone_paid", DATA, { token: TOKEN, fetchImpl });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("blocked");
      expect(res.error).not.toContain(TOKEN);
    }
  });

  it("si se cae la red no tira error ni muestra el token", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error(`fetch failed https://api.telegram.org/bot${TOKEN}/sendMessage`);
    }) as unknown as typeof fetch;
    const res = await sendTelegram("123", "deposit_received", DATA, { token: TOKEN, fetchImpl });
    expect(res).toEqual({ ok: false, error: "No pudimos conectarnos con Telegram." });
  });
});
