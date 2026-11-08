import { getAddress, type Address } from "viem";

import { CHAINS, getChainName, type ChainName } from "./chains";

// Identidad del agente con ERC-8004 (PAC-45). Acá están las direcciones de los registros por
// red (el Identity Registry de testnet es distinto al de mainnet), el pedacito de ABI que
// usamos y las funciones puras que arman la entrada `registrations` de la agent card.
// Es el único lugar con estas direcciones. Fuente: AGENTS.md → "Identidad del agente".

const IDENTITY_REGISTRY: Record<ChainName, Address> = {
  celo: getAddress("0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"),
  "celo-sepolia": getAddress("0x8004A818BFB912233c491871b3d84c89A494BD9e"),
};

const REPUTATION_REGISTRY: Record<ChainName, Address> = {
  celo: getAddress("0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"),
  "celo-sepolia": getAddress("0x8004B663056A597Dffe9eCcC1965A193B7388713"),
};

/** Identity Registry de la red configurada (o la indicada). */
export function getIdentityRegistry(chain: ChainName = getChainName()): Address {
  return IDENTITY_REGISTRY[chain];
}

/** Reputation Registry de la red configurada (o la indicada). */
export function getReputationRegistry(chain: ChainName = getChainName()): Address {
  return REPUTATION_REGISTRY[chain];
}

/** El `agentRegistry` de la agent card: `eip155:<chainId>:<dirección del registro>`. */
export function agentRegistryId(chain: ChainName = getChainName()): string {
  return `eip155:${CHAINS[chain].id}:${IDENTITY_REGISTRY[chain]}`;
}

/** Solo lo que usamos del Identity Registry: registrar, cambiar el URI y leer. */
export const identityRegistryAbi = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "setAgentURI",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newURI", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const;

export type CardRegistration = { agentId: number; agentRegistry: string };

export type AgentCard = {
  registrations?: CardRegistration[];
  [key: string]: unknown;
};

/**
 * Devuelve la card con la registración agregada. Si ya había una del mismo registro
 * (misma red), la reemplaza: así correr el paso dos veces no deja entradas repetidas.
 * No modifica la card original.
 */
export function withRegistration<T extends AgentCard>(card: T, agentId: bigint, chain: ChainName = getChainName()): T {
  if (agentId > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("El agentId es demasiado grande para el JSON.");
  const registry = agentRegistryId(chain);
  const others = (card.registrations ?? []).filter((r) => r.agentRegistry.toLowerCase() !== registry.toLowerCase());
  return { ...card, registrations: [...others, { agentId: Number(agentId), agentRegistry: registry }] };
}
