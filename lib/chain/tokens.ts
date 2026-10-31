import { formatUnits, parseUnits, type Address } from "viem";

import { getChainName, type ChainName } from "./chains";

// Direcciones de las monedas por red. Es el único lugar con direcciones de tokens.
// En mainnet son los wFIAT de Ripio. En Celo Sepolia no existen, así que usamos
// tokens de prueba propios (contracts/TestToken.sol, scripts/deploy-test-tokens.ts):
// wARS → tARS y wBRL → tBRL. El resto del código pide siempre wARS / wBRL / wMXN.

export const TOKEN_DECIMALS = 18;

export type TokenSymbol = "wARS" | "wBRL" | "wMXN";

export type Token = {
  /** Lo que se muestra en pantalla en esta red (wARS en mainnet, tARS en testnet). */
  symbol: string;
  address: Address;
  decimals: typeof TOKEN_DECIMALS;
};

const TOKENS: Record<ChainName, Partial<Record<TokenSymbol, Token>>> = {
  celo: {
    wARS: { symbol: "wARS", address: "0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d", decimals: 18 },
    wBRL: { symbol: "wBRL", address: "0xd76f5faf6888e24d9f04bf92a0c8b921fe4390e0", decimals: 18 },
    wMXN: { symbol: "wMXN", address: "0x337e7456b420bd3481e7fa61fa9850343d610d34", decimals: 18 },
  },
  "celo-sepolia": {
    wARS: { symbol: "tARS", address: "0x7d0f189d248bffe3888903d071bacd5f8c435845", decimals: 18 },
    wBRL: { symbol: "tBRL", address: "0xb02ecb85c1f37c42bf8c7aea4d13748c36a7e905", decimals: 18 },
  },
};

/** El token de la red configurada (o la indicada). Falla si no existe en esa red. */
export function getToken(symbol: TokenSymbol, chain: ChainName = getChainName()): Token {
  const token = TOKENS[chain][symbol];
  if (!token) throw new Error(`${symbol} no está disponible en la red ${chain}.`);
  return token;
}

/** ABI mínima de un ERC-20 (más `mint`, que solo existe en los tokens de prueba). */
export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "transferFrom", stateMutability: "nonpayable", inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
] as const;

/** "1500.5" → 1500500000000000000000n. Solo para entrada de usuario; los montos viajan como bigint. */
export function parseAmount(text: string): bigint {
  return parseUnits(text, TOKEN_DECIMALS);
}

/** 1500500000000000000000n → "1500.5". Solo para mostrar. */
export function formatAmount(amount: bigint): string {
  return formatUnits(amount, TOKEN_DECIMALS);
}
