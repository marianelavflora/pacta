// Prueba real del tag de atribución, SOLO en Celo Sepolia (testnet).
//
// Manda 0 CELO desde la wallet del agente a sí misma, espera el recibo y
// verifica con `verifyTx` que la transacción salió con el tag.
//
// Uso:  npm run tag:smoke
// Lee las variables de `.env.local` (o del archivo que diga ENV_FILE).
// Necesita AGENT_PRIVATE_KEY, NEXT_PUBLIC_ATTRIBUTION_TAG y NEXT_PUBLIC_CHAIN=celo-sepolia.

import { existsSync } from "node:fs";

import { verifyTx } from "@celo/attribution-tags";
import { formatEther } from "viem";

const envFile = process.env.ENV_FILE ?? ".env.local";
if (existsSync(envFile)) process.loadEnvFile(envFile);

async function main() {
  // Se importan después de cargar el .env para que lean las variables.
  const { getChainName, txUrl } = await import("../lib/chain/chains");
  const { getAgentWalletClient, getPublicClient } = await import("../lib/chain/wallet");

  const chainName = getChainName();
  if (chainName !== "celo-sepolia") {
    throw new Error(
      `Este script solo corre en Celo Sepolia (testnet). NEXT_PUBLIC_CHAIN="${chainName}".`,
    );
  }

  const wallet = getAgentWalletClient();
  const publicClient = getPublicClient();
  const me = wallet.account.address;

  // Doble chequeo: la red a la que apunta el RPC tiene que ser la de testnet.
  const rpcChainId = await publicClient.getChainId();
  if (rpcChainId !== wallet.chain.id) {
    throw new Error(`El RPC responde chain ${rpcChainId}, se esperaba ${wallet.chain.id}.`);
  }

  const balance = await publicClient.getBalance({ address: me });
  console.log(`Wallet del agente: ${me}`);
  console.log(`Saldo: ${formatEther(balance)} CELO (${chainName})`);

  const hash = await wallet.sendTransaction({ to: me, value: 0n });
  console.log(`Transacción enviada: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Estado: ${receipt.status} (bloque ${receipt.blockNumber})`);

  const attribution = await verifyTx({ client: publicClient, hash });
  if (!attribution) throw new Error("La transacción NO tiene tag de atribución.");

  const expected = process.env.NEXT_PUBLIC_ATTRIBUTION_TAG;
  if (!attribution.codes.includes(expected!)) {
    throw new Error(`Tag inesperado: ${attribution.codes.join(", ")}`);
  }
  console.log(`Tag verificado: ${attribution.codes.join(", ")}`);
  console.log(`Explorador: ${txUrl(hash)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
