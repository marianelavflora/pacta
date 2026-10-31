import type { Address, Chain, Hash } from "viem";
import { celo, celoSepolia } from "viem/chains";

// Única fuente de verdad de la red. La elige NEXT_PUBLIC_CHAIN:
//   - "celo-sepolia" → Celo Sepolia (testnet, para desarrollar)
//   - "celo"         → Celo mainnet (chain 42220, la que suma en la hackathon)
// Ningún otro archivo tiene que importar `celo` o `celoSepolia` de viem:
// todos piden la red acá.

export const CHAINS = {
  "celo-sepolia": celoSepolia,
  celo: celo,
} as const satisfies Record<string, Chain>;

export type ChainName = keyof typeof CHAINS;

export function isChainName(value: unknown): value is ChainName {
  return typeof value === "string" && Object.hasOwn(CHAINS, value);
}

/** Nombre de la red configurada. Falla con un mensaje claro si falta o es inválida. */
export function getChainName(
  // Acceso estático a process.env para que Next.js lo pueda inyectar en el navegador.
  value: string | undefined = process.env.NEXT_PUBLIC_CHAIN,
): ChainName {
  if (!value) {
    throw new Error(
      'Falta NEXT_PUBLIC_CHAIN. Usá "celo-sepolia" (testnet) o "celo" (mainnet).',
    );
  }
  if (!isChainName(value)) {
    throw new Error(
      `NEXT_PUBLIC_CHAIN="${value}" no es válida. Usá "celo-sepolia" (testnet) o "celo" (mainnet).`,
    );
  }
  return value;
}

/** Tipo de las redes que soportamos (las dos comparten los formatos de Celo, como `feeCurrency`). */
export type CeloChain = (typeof CHAINS)[ChainName];

/** La red de viem que corresponde a NEXT_PUBLIC_CHAIN. */
export function getChain(name: ChainName = getChainName()): CeloChain {
  return CHAINS[name];
}

/** URL base del explorador de la red, sin barra al final. */
export function explorerUrl(name: ChainName = getChainName()): string {
  return CHAINS[name].blockExplorers.default.url.replace(/\/+$/, "");
}

/** Link al explorador de una transacción. */
export function txUrl(hash: Hash, name: ChainName = getChainName()): string {
  return `${explorerUrl(name)}/tx/${hash}`;
}

/** Link al explorador de una dirección (wallet o contrato). */
export function addressUrl(address: Address, name: ChainName = getChainName()): string {
  return `${explorerUrl(name)}/address/${address}`;
}
