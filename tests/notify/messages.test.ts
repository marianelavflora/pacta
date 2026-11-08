// PAC-41 y PAC-42 · Textos, mail de respaldo y avisos. Sin red: fetch y canales son dobles.
import { afterEach, describe, expect, it, vi } from "vitest";

import { looksLikeEmail, sendEmail } from "@/lib/notify/email";
import { siteUrl } from "@/lib/notify/events";
import { notify, type Channel } from "@/lib/notify";
import { buildMessage, type NotifyEvent } from "@/lib/notify/messages";

const DATA = {
  recipientName: "Lucía",
  agreementTitle: "Logo y sitio",
  milestoneTitle: "Primer borrador",
  amount: "R$ 600",
  link: "https://pacta.example/cliente/abc",
};
const EVENTS: NotifyEvent[] = [
  "deposit_received",
  "milestone_delivered",
  "review_reminder",
  "milestone_approved",
  "auto_release",
  "milestone_paid",
];

afterEach(() => vi.unstubAllEnvs());

describe("textos de los avisos", () => {
  it.each(EVENTS)("%s tiene asunto, saludo y link", (event) => {
    const message = buildMessage(event, DATA);
    expect(message.subject.length).toBeGreaterThan(5);
    expect(message.body).toContain("Hola Lucía");
    expect(message.body).toContain(DATA.link);
  });

  it("el recordatorio avisa que se libera solo a los 3 días", () => {
    expect(buildMessage("review_reminder", DATA).body).toContain("3 días");
  });

  it("funciona sin título de hito ni monto", () => {
    const message = buildMessage("milestone_delivered", {
      recipientName: "Lucía",
      agreementTitle: "Logo y sitio",
      link: "https://pacta.example/x",
    });
    expect(message.body).toContain("un hito");
  });
});

describe("mail de respaldo (Resend)", () => {
  const message = { subject: "Asunto", body: "Cuerpo" };

  it("sin RESEND_API_KEY no manda nada", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchSpy = vi.fn();
    const result = await sendEmail("a@b.com", message, fetchSpy as unknown as typeof fetch);
    expect(result.status).toBe("skipped");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("con clave y mail válido hace un POST a Resend", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    const result = await sendEmail("a@b.com", message, fetchSpy as unknown as typeof fetch);
    expect(result.status).toBe("sent");
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(String(init.body))).toMatchObject({ to: ["a@b.com"], subject: "Asunto", text: "Cuerpo" });
  });

  it("sin mail válido de la persona no manda", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const fetchSpy = vi.fn();
    expect((await sendEmail("+54911", message, fetchSpy as unknown as typeof fetch)).status).toBe("skipped");
    expect((await sendEmail(null, message, fetchSpy as unknown as typeof fetch)).status).toBe("skipped");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("si Resend falla devuelve failed y no tira error", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const rejected = vi.fn(async () => new Response("", { status: 500 }));
    expect((await sendEmail("a@b.com", message, rejected as unknown as typeof fetch)).status).toBe("failed");
    const broken = vi.fn(async () => {
      throw new Error("sin red");
    });
    expect((await sendEmail("a@b.com", message, broken as unknown as typeof fetch)).status).toBe("failed");
  });

  it("reconoce mails y no teléfonos", () => {
    expect(looksLikeEmail("lucia@correo.com")).toBe(true);
    expect(looksLikeEmail("+54 9 11 1234")).toBe(false);
  });
});

describe("notify: canales en orden", () => {
  const channel = (name: string, status: "sent" | "failed" | "skipped"): Channel => ({
    name,
    send: vi.fn(async () =>
      status === "sent" ? { status } : { status, reason: "motivo" },
    ) as Channel["send"],
  });
  const data = { agreementTitle: "A", link: "https://x" };

  it("si WhatsApp falla, manda el mail de respaldo", async () => {
    const whatsapp = channel("whatsapp", "failed");
    const email = channel("email", "sent");
    const outcome = await notify("milestone_paid", { name: "Lu" }, data, [whatsapp, email]);
    expect(outcome).toMatchObject({ delivered: true, channel: "email" });
    expect(whatsapp.send).toHaveBeenCalledTimes(1);
  });

  it("si el primer canal funciona, no usa el segundo", async () => {
    const first = channel("whatsapp", "sent");
    const second = channel("email", "sent");
    await notify("milestone_paid", { name: "Lu" }, data, [first, second]);
    expect(second.send).not.toHaveBeenCalled();
  });

  it("si ningún canal puede, devuelve delivered=false sin tirar error", async () => {
    const outcome = await notify("milestone_paid", { name: "Lu" }, data, [channel("email", "skipped")]);
    expect(outcome.delivered).toBe(false);
    expect(outcome.attempts.email).toContain("skipped");
  });

  it("un canal que explota no frena el aviso", async () => {
    const broken: Channel = {
      name: "whatsapp",
      send: async () => {
        throw new Error("boom");
      },
    };
    const outcome = await notify("milestone_paid", { name: "Lu" }, data, [broken, channel("email", "sent")]);
    expect(outcome.channel).toBe("email");
  });
});

describe("siteUrl", () => {
  it("usa la variable pública, o el dominio de Vercel, o localhost", () => {
    expect(siteUrl({ NEXT_PUBLIC_APP_URL: "https://pacta.app/" } as unknown as NodeJS.ProcessEnv)).toBe("https://pacta.app");
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "pacta.vercel.app" } as unknown as NodeJS.ProcessEnv)).toBe(
      "https://pacta.vercel.app",
    );
    expect(siteUrl({} as unknown as NodeJS.ProcessEnv)).toBe("http://localhost:3000");
  });
});
