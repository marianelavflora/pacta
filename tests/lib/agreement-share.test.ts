import { describe, expect, it } from "vitest";
import { buildAgreementPayload, buildTelegramShareUrl, emptyDetails } from "@/lib/agreement-form";

const details = {
  ...emptyDetails,
  title: " Logo ",
  description: "Diseño",
  clientContact: "a@b.com",
  clientCurrency: "wBRL" as const,
};

describe("buildAgreementPayload", () => {
  it("arma el pedido con montos en unidades mínimas como texto", () => {
    const p = buildAgreementPayload(
      details,
      [{ id: "1", title: "Boceto", amount: "1500,50", reviewDays: "3" }],
      "0xabc",
    );
    expect(p.title).toBe("Logo");
    expect(p.freelancerWallet).toBe("0xabc");
    expect(p.payoutCurrency).toBe("wARS");
    expect(p.milestones).toEqual([{ title: "Boceto", amount: "1500500000000000000000", reviewDays: 3 }]);
  });
});

describe("buildTelegramShareUrl", () => {
  it("codifica el link y el mensaje para compartir por Telegram", () => {
    const url = new URL(buildTelegramShareUrl("Logo", "https://x.app/cliente/abc?x=1"));
    expect(url.origin + url.pathname).toBe("https://t.me/share/url");
    expect(url.searchParams.get("url")).toBe("https://x.app/cliente/abc?x=1");
    expect(url.searchParams.get("text")).toContain('"Logo"');
  });
});
