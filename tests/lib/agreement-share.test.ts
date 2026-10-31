import { describe, expect, it } from "vitest";
import { buildAgreementPayload, buildWhatsAppShareUrl, emptyDetails } from "@/lib/agreement-form";

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

describe("buildWhatsAppShareUrl", () => {
  it("codifica el mensaje y trae el link", () => {
    const url = buildWhatsAppShareUrl("Logo", "https://x.app/a/abc?x=1");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1])).toContain("https://x.app/a/abc?x=1");
  });
});
