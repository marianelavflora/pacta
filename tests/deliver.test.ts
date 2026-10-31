import { describe, expect, it } from "vitest";
import { canDeliver, deliverErrorMessage, validateDeliveryUrl } from "@/lib/deliver";
import { milestoneStatusLabel } from "@/lib/ui/status-labels";

const WALLET = "0xAb569A8d8A5b60CFfdf9B88EdE099c80d8328E73";

describe("canDeliver", () => {
  it("solo para hitos funded y la billetera de la freelancer (sin importar mayúsculas)", () => {
    expect(canDeliver("funded", WALLET.toLowerCase(), WALLET)).toBe(true);
    expect(canDeliver("delivered", WALLET, WALLET)).toBe(false);
    expect(canDeliver("funded", "0x0000000000000000000000000000000000000001", WALLET)).toBe(false);
    expect(canDeliver("funded", undefined, WALLET)).toBe(false);
  });
});

describe("validateDeliveryUrl", () => {
  it("pide un link https", () => {
    expect(validateDeliveryUrl("  ")).toMatch(/Pegá/);
    expect(validateDeliveryUrl("http://x.com")).toMatch(/https/);
    expect(validateDeliveryUrl("hola")).toMatch(/https/);
    expect(validateDeliveryUrl("https://drive.google.com/x")).toBeUndefined();
  });
});

describe("deliverErrorMessage", () => {
  it("traduce los códigos de la API", () => {
    expect(deliverErrorMessage(403)).toMatch(/billetera/);
    expect(deliverErrorMessage(409)).toMatch(/todavía no se puede/);
    expect(deliverErrorMessage(500)).toMatch(/Probá de nuevo/);
  });
});

describe("milestoneStatusLabel", () => {
  it("textos de los estados", () => {
    expect(milestoneStatusLabel("funded")).toBe("Listo para entregar");
    expect(milestoneStatusLabel("paid")).toBe("Cobrado");
    expect(milestoneStatusLabel("raro")).toBe("En proceso");
  });
});
