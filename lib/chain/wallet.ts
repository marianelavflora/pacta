import "server-only";

import { withAttribution } from "@celo/attribution-tags";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type Transport,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { getChain, type CeloChain } from "./chains";

// El ÚNICO cliente que manda transacciones del agente (regla 1 de AGENTS.md).
// Toda transacción que sale de acá lleva el tag de atribución al final de los
// datos, porque el cliente está extendido con `withAttribution(tag)`.
//
// - No crees otro wallet client de viem en el proyecto.
// - No le pases `dataSuffix` ni `data: "celo_..."` a mano: ya lo pone el cliente.
// - No uses `sendCalls` ni batch: `withAttribution` no los cubre.
//
// Gas en otra moneda (opcional): en Celo se puede pagar el gas con un token en vez
// de CELO pasando `feeCurrency` en cada transacción, por ejemplo
//   wallet.sendTransaction({ to, value, feeCurrency: "0x..." })
// Si no se pasa, el gas se paga en CELO (el caso por defecto).

const PRIVATE_KEY_RE = /^0x[0-9a-fA-F]{64}$/;
const TAG_RE = /^[a-z0-9_]+$/;

export type AgentWalletOptions = {
  privateKey: Hex;
  tag: string;
  chain: CeloChain;
  /** Por defecto el RPC público de la red. Los tests pasan uno falso para no usar la red. */
  transport?: Transport;
};

/** Arma el cliente del agente con el tag. Usá `getAgentWalletClient()` salvo en tests. */
export function createAgentWalletClient({
  privateKey,
  tag,
  chain,
  transport = http(),
}: AgentWalletOptions) {
  if (!PRIVATE_KEY_RE.test(privateKey)) {
    // Nunca incluir la clave en el mensaje de error.
    throw new Error(
      "AGENT_PRIVATE_KEY tiene un formato inválido: tiene que ser 0x seguido de 64 caracteres hexadecimales.",
    );
  }
  if (!TAG_RE.test(tag)) {
    throw new Error(
      `NEXT_PUBLIC_ATTRIBUTION_TAG="${tag}" no es válido: solo minúsculas, números y guion bajo (por ejemplo "celo_abc123").`,
    );
  }

  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain,
    transport,
  }).extend(withAttribution(tag));
}

export type AgentWalletClient = ReturnType<typeof createAgentWalletClient>;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Mirá la tabla de variables en AGENTS.md.`);
  }
  return value;
}

let walletClient: AgentWalletClient | undefined;

/** El cliente del agente, armado con AGENT_PRIVATE_KEY, NEXT_PUBLIC_ATTRIBUTION_TAG y NEXT_PUBLIC_CHAIN. */
export function getAgentWalletClient(): AgentWalletClient {
  walletClient ??= createAgentWalletClient({
    privateKey: requireEnv("AGENT_PRIVATE_KEY", process.env.AGENT_PRIVATE_KEY) as Hex,
    tag: requireEnv("NEXT_PUBLIC_ATTRIBUTION_TAG", process.env.NEXT_PUBLIC_ATTRIBUTION_TAG),
    chain: getChain(),
  });
  return walletClient;
}

/** Dirección pública de la wallet del agente (la bóveda). */
export function getAgentAddress() {
  return getAgentWalletClient().account.address;
}

/** Cliente de solo lectura (saldos, recibos, logs) de la red configurada. */
export function createChainPublicClient(chain: CeloChain = getChain(), transport: Transport = http()) {
  return createPublicClient({ chain, transport });
}

let publicClient: ReturnType<typeof createChainPublicClient> | undefined;

export function getPublicClient() {
  publicClient ??= createChainPublicClient();
  return publicClient;
}
