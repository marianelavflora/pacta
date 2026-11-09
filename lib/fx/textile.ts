// Ruta de Textile FX: un mercado on-chain de cambio. Acá solo se pide el precio indicativo
// (`POST /v2/rfq/preview`): es gratis, anónimo, no reserva nada y no necesita clave.
// No hay corredor directo wBRL→wARS: se pide en dos tramos, `from → USDT → to`.
// La cotización en firme (con firma de la wallet) y el cambio real son del liberador, no de este archivo.
import { type Address } from "viem";

import { CHAINS, getChainName, type ChainName } from "@/lib/chain/chains";
import { getDexConfig } from "@/lib/chain/dex";
import { getToken } from "@/lib/chain/tokens";
import { rateFromAmounts } from "./math";
import { probeAmount, type RateSource } from "./sources";

const DEFAULT_BASE_URL = "https://api.textilecredit.com/v2";
const PREVIEW_TIMEOUT_MS = 8_000;

type Fetcher = typeof fetch;

/** Pide cuánto da Textile por `sellAmount` de `sellToken`, en unidades mínimas del `buyToken`. */
async function previewLeg(
  fetcher: Fetcher,
  baseUrl: string,
  chainId: number,
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
): Promise<bigint> {
  const response = await fetcher(`${baseUrl}/rfq/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chainId, sellToken, buyToken, sellAmount: sellAmount.toString() }),
    signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`textile: respondió ${response.status}`);

  const body = (await response.json()) as { data?: { status?: string; buyAmount?: string } };
  const buyAmount = body.data?.buyAmount;
  // Sin liquidez Textile contesta 200 con status "no_quote": no es un error de red pero tampoco hay precio.
  if (body.data?.status !== "preview" || typeof buyAmount !== "string" || !/^\d+$/.test(buyAmount)) {
    throw new Error(`textile: sin cotización (${body.data?.status ?? "respuesta inválida"})`);
  }
  return BigInt(buyAmount);
}

export type TextileSourceOptions = {
  /** Por defecto, la red configurada. Textile solo existe en mainnet. */
  chain?: ChainName;
  /** Por defecto `fetch`. Los tests pasan uno falso. */
  fetcher?: Fetcher;
  /** Por defecto `TEXTILE_API_URL` o la API pública de Textile. */
  baseUrl?: string;
};

export function createTextileSource(options: TextileSourceOptions = {}): RateSource {
  return {
    name: "textile",
    async getRate(from, to, amountIn = probeAmount(from)) {
      const chain = options.chain ?? getChainName();
      const dex = getDexConfig(chain);
      if (!dex) throw new Error(`textile: no está disponible en ${chain}`);

      const fetcher = options.fetcher ?? fetch;
      const baseUrl = options.baseUrl ?? process.env.TEXTILE_API_URL ?? DEFAULT_BASE_URL;
      const chainId = CHAINS[chain].id;
      const usdt = dex.usdt.address;

      // Tramo 1: la moneda de origen a USDT. Tramo 2: ese USDT a la moneda de destino.
      const usdtOut = await previewLeg(fetcher, baseUrl, chainId, getToken(from, chain).address, usdt, amountIn);
      const amountOut = await previewLeg(fetcher, baseUrl, chainId, usdt, getToken(to, chain).address, usdtOut);
      return rateFromAmounts(amountIn, amountOut);
    },
  };
}
