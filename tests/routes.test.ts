import { describe, expect, it } from "vitest";
import { clientUrl, freelancerUrl, receiptUrl, routes } from "@/lib/routes";

describe("direcciones de las páginas", () => {
  it("las fijas coinciden con el mapa del código", () => {
    expect(routes).toEqual({ home: "/", newAgreement: "/nuevo", howItWorks: "/como-funciona" });
  });

  it("arma la vista del cliente, la de la freelancer y el recibo", () => {
    expect(clientUrl("abc123")).toBe("/a/abc123");
    expect(freelancerUrl("abc123")).toBe("/f/abc123");
    expect(receiptUrl("m-42")).toBe("/recibo/m-42");
  });

  it("escapa caracteres raros y saca espacios de los costados", () => {
    expect(clientUrl(" a b/c ")).toBe("/a/a%20b%2Fc");
  });

  it("no arma una dirección sin id", () => {
    expect(() => clientUrl("")).toThrow();
    expect(() => receiptUrl("   ")).toThrow();
  });
});
