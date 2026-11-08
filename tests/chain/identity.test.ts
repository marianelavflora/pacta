import { describe, expect, it } from "vitest";

import {
  agentRegistryId,
  getIdentityRegistry,
  getReputationRegistry,
  identityRegistryAbi,
  withRegistration,
} from "@/lib/chain/identity";

// Identidad ERC-8004 (PAC-45). Direcciones sacadas de AGENTS.md → "Identidad del agente".

describe("registros ERC-8004 por red", () => {
  it("mainnet usa los registros de Celo mainnet", () => {
    expect(getIdentityRegistry("celo")).toBe("0x8004A169FB4a3325136EB29fA0ceB6D2e539a432");
    expect(getReputationRegistry("celo")).toBe("0x8004BAa17C55a88189AE136b182e5fdA19dE9b63");
  });

  it("testnet usa los registros de Celo Sepolia (distintos a los de mainnet)", () => {
    expect(getIdentityRegistry("celo-sepolia")).toBe("0x8004A818BFB912233c491871b3d84c89A494BD9e");
    expect(getReputationRegistry("celo-sepolia")).toBe("0x8004B663056A597Dffe9eCcC1965A193B7388713");
    expect(getIdentityRegistry("celo-sepolia")).not.toBe(getIdentityRegistry("celo"));
  });

  it("el agentRegistry de la card es eip155:<chainId>:<registro>", () => {
    expect(agentRegistryId("celo")).toBe("eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432");
    expect(agentRegistryId("celo-sepolia")).toBe("eip155:11142220:0x8004A818BFB912233c491871b3d84c89A494BD9e");
  });

  it("la ABI trae lo que usa el script: register, setAgentURI y el evento Registered", () => {
    const names = identityRegistryAbi.map((item) => item.name);
    expect(names).toEqual(expect.arrayContaining(["register", "setAgentURI", "Registered", "ownerOf", "balanceOf"]));
  });
});

describe("withRegistration (suma el agentId a la card)", () => {
  const card = { name: "Pactá", registrations: [] };

  it("agrega la registración con el formato de ERC-8004", () => {
    expect(withRegistration(card, BigInt(7), "celo").registrations).toEqual([
      { agentId: 7, agentRegistry: "eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" },
    ]);
  });

  it("no modifica la card original", () => {
    withRegistration(card, BigInt(7), "celo");
    expect(card.registrations).toEqual([]);
  });

  it("correrlo dos veces en la misma red no repite la entrada, la reemplaza", () => {
    const once = withRegistration(card, BigInt(7), "celo");
    const twice = withRegistration(once, BigInt(9), "celo");
    expect(twice.registrations).toEqual([
      { agentId: 9, agentRegistry: "eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" },
    ]);
  });

  it("conserva la entrada de otra red", () => {
    const testnet = withRegistration(card, BigInt(3), "celo-sepolia");
    const both = withRegistration(testnet, BigInt(7), "celo");
    expect(both.registrations).toHaveLength(2);
  });

  it("falla si el agentId no entra en un número de JSON", () => {
    expect(() => withRegistration(card, BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1), "celo")).toThrow();
  });
});
