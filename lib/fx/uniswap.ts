// Ruta del DEX de Celo: Uniswap v3. Cotiza con el Quoter (una lectura, no manda nada) un cambio
// `from → USDT → to` en un solo camino. Cada cotización es para un monto: las pools son chicas y el
// precio cambia con el tamaño.
import { createPublicClient, http, parseAbi, type Address, type Hex } from "viem";

import { CHAINS, getChainName, type ChainName } from "@/lib/chain/chains";
import { encodeSwapPath, getDexConfig } from "@/lib/chain/dex";
import { getToken, type TokenSymbol } from "@/lib/chain/tokens";
import { rateFromAmounts } from "./math";
import { probeAmount, type RateSource } from "./sources";

/** Cuántas unidades de salida da el camino por `amountIn` unidades de entrada. */
export type PathQuoter = (path: Hex, amountIn: bigint) => Promise<bigint>;

const quoterAbi = parseAbi([
  "function quoteExactInput(bytes path, uint256 amountIn) returns (uint256 amountOut, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)",
]);

/** El Quoter real, leído por el RPC público de la red. `simulateContract` porque el Quoter no es `view`. */
function onChainQuoter(chain: ChainName): PathQuoter {
  const dex = getDexConfig(chain);
  if (!dex) throw new Error(`dex: Uniswap no está disponible en ${chain}`);
  const client = createPublicClient({ chain: CHAINS[chain], transport: http() });
  return async (path, amountIn) => {
    const { result } = await client.simulateContract({
      address: dex.quoter,
      abi: quoterAbi,
      functionName: "quoteExactInput",
      args: [path, amountIn],
    });
    return result[0];
  };
}

function tokenAddresses(chain: ChainName): Record<TokenSymbol, Address> {
  return {
    wARS: getToken("wARS", chain).address,
    wBRL: getToken("wBRL", chain).address,
    wMXN: getToken("wMXN", chain).address,
  };
}

export type UniswapSourceOptions = {
  /** Por defecto, la red configurada. */
  chain?: ChainName;
  /** Por defecto, el Quoter on-chain. Los tests pasan uno falso. */
  quoter?: PathQuoter;
};

export function createUniswapSource(options: UniswapSourceOptions = {}): RateSource {
  return {
    name: "dex",
    async getRate(from, to, amountIn = probeAmount(from)) {
      const chain = options.chain ?? getChainName();
      const dex = getDexConfig(chain);
      if (!dex) throw new Error(`dex: Uniswap no está disponible en ${chain}`);
      const path = encodeSwapPath(dex, from, to, tokenAddresses(chain));
      const quoter = options.quoter ?? onChainQuoter(chain);
      return rateFromAmounts(amountIn, await quoter(path, amountIn));
    },
  };
}
