import { encodePacked, type Address, type Hex } from "viem";

import { getChainName, type ChainName } from "./chains";
import type { TokenSymbol } from "./tokens";

// Dónde se puede cambiar una moneda por otra en Celo. Es el único lugar con direcciones de DEX y de
// USDT (como tokens.ts lo es para los wFIAT). Ni Uniswap ni Textile existen en Celo Sepolia: allá no
// hay rutas reales y el cotizador cae al precio de referencia.
//
// Todas las rutas pasan por USDT: no hay pool directa wBRL/wARS ni corredor directo en Textile.
// Direcciones verificadas on-chain (solo lectura) el 2026-11-08: el Quoter y las pools tienen código
// y devuelven cotizaciones.

export type DexConfig = {
  /** Uniswap v3 QuoterV2: cotiza un cambio sin ejecutarlo. */
  quoter: Address;
  /** El dólar intermedio por el que pasa todo cambio. */
  usdt: { address: Address; decimals: 6 };
  /** Fee (en millonésimos) de la pool moneda/USDT. Una moneda sin pool no tiene ruta por Uniswap. */
  poolFee: Partial<Record<TokenSymbol, number>>;
  /**
   * Contratos de Textile con los que el agente puede operar (address book oficial, 2026-11-08):
   * el LimitOrderReactor (donde se liquida el swap) y el VaultOrderExecutor. La calldata de cada
   * swap la arma la API de Textile y se firma con la clave del agente: solo se acepta si apunta acá.
   */
  textileContracts: Address[];
};

const DEX: Partial<Record<ChainName, DexConfig>> = {
  celo: {
    quoter: "0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8",
    usdt: { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6 },
    // Solo wARS/USDT y wBRL/USDT (0,01 %). Para wMXN no hay pool.
    poolFee: { wARS: 100, wBRL: 100 },
    textileContracts: [
      "0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3", // LimitOrderReactor
      "0x01b006d5c687bde182aa36F542f1f014144742e2", // VaultOrderExecutor
    ],
  },
};

/** La configuración del DEX de la red, o null si esa red no tiene (testnet). */
export function getDexConfig(chain: ChainName = getChainName()): DexConfig | null {
  return DEX[chain] ?? null;
}

/** El camino de Uniswap `from → USDT → to`, codificado como lo pide el Quoter (token, fee, token, fee, token). */
export function encodeSwapPath(config: DexConfig, from: TokenSymbol, to: TokenSymbol, tokens: Record<TokenSymbol, Address>): Hex {
  const feeIn = config.poolFee[from];
  const feeOut = config.poolFee[to];
  if (feeIn === undefined) throw new Error(`Uniswap no tiene pool para ${from}.`);
  if (feeOut === undefined) throw new Error(`Uniswap no tiene pool para ${to}.`);
  return encodePacked(
    ["address", "uint24", "address", "uint24", "address"],
    [tokens[from], feeIn, config.usdt.address, feeOut, tokens[to]],
  );
}
