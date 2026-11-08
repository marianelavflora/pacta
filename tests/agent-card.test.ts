import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// La agent card (PAC-44) es el JSON público al que apunta el agentURI de ERC-8004.
// Estos tests cuidan el formato; el registro on-chain es PAC-45.

const root = process.cwd();
const card = JSON.parse(readFileSync(join(root, "public", "agent-card.json"), "utf8")) as Record<string, unknown>;

describe("agent card (PAC-44)", () => {
  it("tiene los campos que pide ERC-8004", () => {
    expect(card.type).toBe("https://eips.ethereum.org/EIPS/eip-8004#registration-v1");
    expect(card.name).toBe("Pactá");
    expect(typeof card.description).toBe("string");
    expect((card.description as string).length).toBeGreaterThan(50);
    expect(card.active).toBe(true);
    expect(card.x402Support).toBe(false);
    expect(card.supportedTrust).toEqual(["reputation"]);
  });

  it("tiene el servicio web con una URL https", () => {
    const services = card.services as { name: string; endpoint: string }[];
    expect(services).toEqual([{ name: "web", endpoint: expect.stringMatching(/^https:\/\//) }]);
  });

  it("la imagen es una URL pública https y el archivo existe en public/", () => {
    const image = new URL(card.image as string);
    expect(image.protocol).toBe("https:");
    expect(existsSync(join(root, "public", image.pathname))).toBe(true);
  });

  it("usa el mismo dominio para la imagen y el servicio web", () => {
    const [web] = card.services as { endpoint: string }[];
    expect(new URL(card.image as string).origin).toBe(new URL(web.endpoint).origin);
  });

  it("registrations está vacío hasta que se registre el agente (PAC-45)", () => {
    expect(card.registrations).toEqual([]);
  });

  it("no incluye claves ni datos privados", () => {
    expect(JSON.stringify(card)).not.toMatch(/private|secret|mnemonic|0x[0-9a-fA-F]{64}/i);
  });
});
