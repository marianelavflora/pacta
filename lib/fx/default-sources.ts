// Las fuentes de precio que usa el cotizador de verdad. Las rutas reales (Textile y el DEX de Celo)
// solo existen en mainnet: en testnet contestan "no disponible" y el cotizador sigue con la referencia.
import { createTextileSource } from "./textile";
import { createUniswapSource } from "./uniswap";
import { referenceSource, type RateSource } from "./sources";

export const defaultSources: readonly RateSource[] = [
  createTextileSource(),
  createUniswapSource(),
  referenceSource,
];
