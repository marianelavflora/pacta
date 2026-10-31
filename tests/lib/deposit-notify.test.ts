import { describe, expect, it, vi } from "vitest";

import { notifyDeposit } from "@/lib/deposit-notify";

const HASH = `0x${"a".repeat(64)}`;
const reply = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("notifyDeposit", () => {
  it("hace POST con el hash y devuelve ok", async () => {
    const f = reply(200, { kind: "recorded" });
    expect(await notifyDeposit("abc123", HASH, f)).toEqual({ ok: true });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/agreements/abc123/deposit");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ txHash: HASH });
  });

  it("muestra el mensaje en castellano de la API", async () => {
    const r = await notifyDeposit("abc123", HASH, reply(404, { error: "Todavía no vemos esa transacción" }));
    expect(r).toEqual({ ok: false, message: "Todavía no vemos esa transacción" });
  });

  it("usa un mensaje amable si la respuesta no es JSON o falla la red", async () => {
    const bad = vi.fn().mockResolvedValue(new Response("boom", { status: 500 })) as unknown as typeof fetch;
    expect((await notifyDeposit("x", HASH, bad)).ok).toBe(false);
    const down = vi.fn().mockRejectedValue(new Error("net")) as unknown as typeof fetch;
    const r = await notifyDeposit("x", HASH, down);
    expect(r.ok === false && r.message).toMatch(/probá de nuevo/);
  });
});
