// Verifica que una transacción ya enviada lleve el tag de atribución del equipo.
// SOLO LEE: no manda nada ni necesita la clave del agente. Sirve en testnet y en mainnet.
//
// Uso:  NEXT_PUBLIC_CHAIN=celo npm run tag:verify -- 0x<hash de la transacción>
// La red sale de NEXT_PUBLIC_CHAIN (o de .env.local, o del archivo que diga ENV_FILE).

import { existsSync } from "node:fs";

import { verifyTx } from "@celo/attribution-tags";
import { createPublicClient, http, isHash } from "viem";

const envFile = process.env.ENV_FILE ?? ".env.local";
if (existsSync(envFile)) process.loadEnvFile(envFile);

async function main() {
  const hash = process.argv[2];
  if (!hash || !isHash(hash)) {
    throw new Error("Pasá el hash de la transacción: npm run tag:verify -- 0x...");
  }

  const { getChain, getChainName, txUrl } = await import("../lib/chain/chains");
  const chain = getChain();
  const client = createPublicClient({ chain, transport: http() });

  console.log(`Red: ${getChainName()} (chain ${chain.id})`);
  const attribution = await verifyTx({ client, hash });
  if (!attribution) throw new Error("La transacción NO tiene tag de atribución.");

  const expected = process.env.NEXT_PUBLIC_ATTRIBUTION_TAG;
  console.log(`Tags encontrados: ${attribution.codes.join(", ")}`);
  if (expected && !attribution.codes.includes(expected)) {
    throw new Error(`No está el tag del equipo (${expected}).`);
  }
  console.log("Tag del equipo verificado.");
  console.log(`Explorador: ${txUrl(hash)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
