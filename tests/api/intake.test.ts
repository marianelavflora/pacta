// PAC-35 · POST /api/intake. La IA es un doble: no hay llamadas a la red.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const extract = vi.fn();
vi.mock("@/lib/intake/extract", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/intake/extract")>();
  return { ...real, extractAgreementDraft: (...args: unknown[]) => extract(...args) };
});

import { POST } from "@/app/api/intake/route";
import { IntakeError } from "@/lib/intake/extract";

const call = (body: unknown) =>
  POST(new Request("http://localhost/api/intake", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

describe("POST /api/intake", () => {
  beforeEach(() => extract.mockReset());

  it("devuelve el borrador", async () => {
    const draft = { milestones: [{ title: "Logo", amount: "300", reviewDays: 3 }], notes: [] };
    extract.mockResolvedValue(draft);
    const res = await call({ text: "Hago un logo por 300" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(draft);
  });

  it("400 si el cuerpo no es JSON, falta el texto o es muy largo", async () => {
    expect((await call("no json")).status).toBe(400);
    expect((await call({})).status).toBe(400);
    expect((await call({ text: "   " })).status).toBe(400);
    expect((await call({ text: "a".repeat(5000) })).status).toBe(400);
    expect(extract).not.toHaveBeenCalled();
  });

  it("503 si falta la clave de la IA, con un mensaje que manda al formulario", async () => {
    extract.mockRejectedValueOnce(new IntakeError("Falta GEMINI_API_KEY.", "no_key"));
    const res = await call({ text: "algo" });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/formulario a mano/);
  });

  it("422 si la IA no arma hitos válidos y 502 si no responde", async () => {
    extract.mockRejectedValueOnce(new IntakeError("x", "invalid_output"));
    expect((await call({ text: "algo" })).status).toBe(422);
    vi.spyOn(console, "error").mockImplementation(() => {});
    extract.mockRejectedValueOnce(new IntakeError("x", "unavailable"));
    expect((await call({ text: "algo" })).status).toBe(502);
  });
});
