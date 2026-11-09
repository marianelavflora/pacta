// Rutas reales de cambio (PAC-32 y PAC-08): Uniswap y Textile cotizan sin red, con dobles.
import { describe, expect, it } from "vitest";

import { encodeSwapPath, getDexConfig } from "@/lib/chain/dex";
import { getToken } from "@/lib/chain/tokens";
import { parseRate, rateFromAmounts, RATE_SCALE } from "@/lib/fx/math";
import { getBestQuote } from "@/lib/fx/quote";
import { probeAmount, type RateSource, type RouteName } from "@/lib/fx/sources";
import { createTextileSource } from "@/lib/fx/textile";
import { createUniswapSource } from "@/lib/fx/uniswap";

const E18 = BigInt(10) ** BigInt(18);
const E6 = BigInt(10) ** BigInt(6);
const rate = (text: string) => parseRate(text)!;

describe("rateFromAmounts", () => {
  it("calcula el precio de un cambio", () => {
    expect(rateFromAmounts(BigInt(100) * E18, BigInt(29_500) * E18)).toBe(rate("295"));
  });
  it("rechaza montos en cero", () => {
    expect(() => rateFromAmounts(E18, BigInt(0))).toThrow();
    expect(() => rateFromAmounts(BigInt(0), E18)).toThrow();
  });
});

describe("dex: configuración", () => {
  it("existe en mainnet y no en testnet", () => {
    expect(getDexConfig("celo")?.usdt.decimals).toBe(6);
    expect(getDexConfig("celo-sepolia")).toBeNull();
  });
  it("arma el camino token, fee, USDT, fee, token (20+3+20+3+20 bytes)", () => {
    const dex = getDexConfig("celo")!;
    const tokens = {
      wARS: getToken("wARS", "celo").address,
      wBRL: getToken("wBRL", "celo").address,
      wMXN: getToken("wMXN", "celo").address,
    };
    const path = encodeSwapPath(dex, "wBRL", "wARS", tokens);
    expect((path.length - 2) / 2).toBe(66);
    expect(path.toLowerCase()).toContain(tokens.wBRL.slice(2).toLowerCase());
    expect(() => encodeSwapPath(dex, "wMXN", "wARS", tokens)).toThrow(/wMXN/);
  });
});

describe("fuente Uniswap", () => {
  it("convierte lo que dice el Quoter en un rate", async () => {
    const source = createUniswapSource({
      chain: "celo",
      quoter: async (_path, amountIn) => amountIn * BigInt(295),
    });
    expect(await source.getRate("wBRL", "wARS", BigInt(10) * E18)).toBe(rate("295"));
  });

  it("sin monto cotiza con el de referencia de la moneda", async () => {
    let asked = BigInt(0);
    const source = createUniswapSource({
      chain: "celo",
      quoter: async (_path, amountIn) => {
        asked = amountIn;
        return amountIn;
      },
    });
    await source.getRate("wARS", "wBRL");
    expect(asked).toBe(probeAmount("wARS"));
  });

  it("en testnet no está disponible", async () => {
    const source = createUniswapSource({ chain: "celo-sepolia", quoter: async () => E18 });
    await expect(source.getRate("wBRL", "wARS")).rejects.toThrow(/no está disponible/);
  });

  it("una moneda sin pool (wMXN) no tiene ruta", async () => {
    const source = createUniswapSource({ chain: "celo", quoter: async () => E18 });
    await expect(source.getRate("wMXN", "wARS")).rejects.toThrow(/wMXN/);
  });
});

describe("fuente Textile", () => {
  type Call = { sellToken: string; buyToken: string; sellAmount: string };

  /** Textile falso: 1 wBRL = 0,18 USDT y 1 USDT = 1.650 wARS. Anota qué se le pidió. */
  function fakeTextile(calls: Call[], reply?: unknown, status = 200): typeof fetch {
    const usdt = getDexConfig("celo")!.usdt.address.toLowerCase();
    return (async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Call & { chainId: number };
      calls.push(body);
      expect(body.chainId).toBe(42220);
      if (reply !== undefined) return new Response(JSON.stringify(reply), { status });
      const sell = BigInt(body.sellAmount);
      const buyAmount = body.buyToken.toLowerCase() === usdt ? (sell * BigInt(18) * E6) / (BigInt(100) * E18) : sell * BigInt(1650) * E18 / E6;
      return Response.json({ data: { status: "preview", buyAmount: buyAmount.toString() } });
    }) as typeof fetch;
  }

  it("cotiza en dos tramos (moneda → USDT → moneda) y arma el rate", async () => {
    const calls: Call[] = [];
    const source = createTextileSource({ chain: "celo", fetcher: fakeTextile(calls) });
    const result = await source.getRate("wBRL", "wARS", BigInt(100) * E18);

    expect(calls).toHaveLength(2);
    expect(calls[0].sellToken.toLowerCase()).toBe(getToken("wBRL", "celo").address.toLowerCase());
    expect(calls[1].buyToken.toLowerCase()).toBe(getToken("wARS", "celo").address.toLowerCase());
    // 100 wBRL → 18 USDT → 29.700 wARS: 297 wARS por wBRL.
    expect(result).toBe(rate("297"));
  });

  it("sin liquidez (no_quote) no es una cotización", async () => {
    const source = createTextileSource({
      chain: "celo",
      fetcher: fakeTextile([], { data: { status: "no_quote", reason: "no_makers_online" } }),
    });
    await expect(source.getRate("wBRL", "wARS")).rejects.toThrow(/sin cotización/);
  });

  it("un error de Textile (corredor no disponible) hace fallar la ruta", async () => {
    const source = createTextileSource({
      chain: "celo",
      fetcher: fakeTextile([], { error: "corridor_unavailable" }, 400),
    });
    await expect(source.getRate("wMXN", "wARS")).rejects.toThrow(/400/);
  });

  it("en testnet no está disponible y no llama a nadie", async () => {
    const calls: Call[] = [];
    const source = createTextileSource({ chain: "celo-sepolia", fetcher: fakeTextile(calls) });
    await expect(source.getRate("wBRL", "wARS")).rejects.toThrow(/no está disponible/);
    expect(calls).toHaveLength(0);
  });
});

describe("cotizador: guarda contra precios absurdos", () => {
  const fixed = (name: RouteName, value: string): RateSource => ({
    name,
    async getRate() {
      return rate(value);
    },
  });

  it("descarta una ruta real que paga muchísimo menos que la referencia (pool rota)", async () => {
    // El caso real del 8 nov: la pool wBRL/USDT de Uniswap devolvía ~0,001 por wBRL vendido.
    const quote = await getBestQuote("wBRL", "wARS", [
      fixed("reference", "280"),
      fixed("dex", "0.001"),
      fixed("textile", "295"),
    ]);
    expect(quote.route).toBe("textile");
  });

  it("descarta una ruta que paga sospechosamente de más", async () => {
    const quote = await getBestQuote("wBRL", "wARS", [
      fixed("reference", "280"),
      fixed("dex", "900"),
      fixed("textile", "290"),
    ]);
    expect(quote.route).toBe("textile");
  });

  it("si todas las rutas reales son absurdas, usa la referencia", async () => {
    const quote = await getBestQuote("wBRL", "wARS", [fixed("reference", "280"), fixed("dex", "0.001")]);
    expect(quote).toMatchObject({ route: "reference", rate: rate("280") });
  });

  it("acepta que el mercado pague más que el oficial (hoy ARS cripto ~ +5 %)", async () => {
    const quote = await getBestQuote("wBRL", "wARS", [fixed("reference", "280.84"), fixed("textile", "295.2")]);
    expect(quote.route).toBe("textile");
    expect(quote.diffBasisPoints).toBeGreaterThan(400);
  });

  it("acepta el mercado por debajo del oficial al vender pesos (caso real: Textile 101,3 vs referencia 106,8 wBRL)", async () => {
    const quote = await getBestQuote("wARS", "wBRL", [fixed("reference", "0.003561"), fixed("textile", "0.003377")]);
    expect(quote.route).toBe("textile");
    expect(quote.diffBasisPoints).toBeLessThan(-400);
  });

  it("el monto llega a las fuentes", async () => {
    let seen: bigint | undefined;
    const spy: RateSource = {
      name: "textile",
      async getRate(_from, _to, amountIn) {
        seen = amountIn;
        return RATE_SCALE;
      },
    };
    await getBestQuote("wBRL", "wARS", [spy], BigInt(5) * E18);
    expect(seen).toBe(BigInt(5) * E18);
  });
});
