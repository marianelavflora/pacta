import { describe, expect, it } from "vitest";

import artifact from "../../lib/chain/artifacts/TestToken.json";
import { erc20Abi, formatAmount, getToken, parseAmount } from "../../lib/chain/tokens";

describe("tokens por red", () => {
  it("mainnet usa los wFIAT de Ripio", () => {
    expect(getToken("wARS", "celo").address).toBe("0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d");
    expect(getToken("wBRL", "celo").address).toBe("0xd76f5faf6888e24d9f04bf92a0c8b921fe4390e0");
    expect(getToken("wMXN", "celo").address).toBe("0x337e7456b420bd3481e7fa61fa9850343d610d34");
  });

  it("en testnet wARS es tARS y wBRL es tBRL", () => {
    expect(getToken("wARS", "celo-sepolia").symbol).toBe("tARS");
    expect(getToken("wBRL", "celo-sepolia").symbol).toBe("tBRL");
    expect(getToken("wARS", "celo-sepolia").address).not.toBe(getToken("wARS", "celo").address);
  });

  it("wMXN no existe en testnet", () => {
    expect(() => getToken("wMXN", "celo-sepolia")).toThrow(/no está disponible/);
  });

  it("toma la red de NEXT_PUBLIC_CHAIN", () => {
    const prev = process.env.NEXT_PUBLIC_CHAIN;
    process.env.NEXT_PUBLIC_CHAIN = "celo-sepolia";
    try {
      expect(getToken("wARS").symbol).toBe("tARS");
    } finally {
      process.env.NEXT_PUBLIC_CHAIN = prev;
    }
  });
});

describe("montos", () => {
  it("ida y vuelta con 18 decimales sin perder precisión", () => {
    expect(parseAmount("1500.5")).toBe(1500500000000000000000n);
    expect(formatAmount(1500500000000000000000n)).toBe("1500.5");
    expect(formatAmount(parseAmount("0.000000000000000001"))).toBe("0.000000000000000001");
  });
});

describe("contrato de prueba", () => {
  it("el artefacto compilado tiene mint, y la ABI mínima también", () => {
    const names = (artifact.abi as { name?: string }[]).map((x) => x.name);
    expect(names).toContain("mint");
    expect(artifact.bytecode).toMatch(/^0x[0-9a-f]+$/);
    expect(erc20Abi.map((x) => x.name)).toContain("balanceOf");
  });
});
