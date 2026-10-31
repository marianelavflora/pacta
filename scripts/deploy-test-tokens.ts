// Despliega tARS y tBRL (tokens de prueba) SOLO en Celo Sepolia y mintea saldo inicial al agente.
// Uso: npm run tokens:deploy   (lee .env.local o ENV_FILE). Imprime las direcciones para pegar en lib/chain/tokens.ts.

import { existsSync, readFileSync } from "node:fs";

import { verifyTx } from "@celo/attribution-tags";
import { encodeDeployData, parseUnits, type Abi, type Hex } from "viem";

const envFile = process.env.ENV_FILE ?? ".env.local";
if (existsSync(envFile)) process.loadEnvFile(envFile);

const INITIAL_SUPPLY = parseUnits("1000000", 18);

async function main() {
  const { getChainName, txUrl, addressUrl } = await import("../lib/chain/chains");
  const { getAgentWalletClient, getPublicClient } = await import("../lib/chain/wallet");

  if (getChainName() !== "celo-sepolia") {
    throw new Error("Este script solo corre en Celo Sepolia (testnet).");
  }
  const artifact = JSON.parse(readFileSync("lib/chain/artifacts/TestToken.json", "utf8")) as {
    abi: Abi;
    bytecode: Hex;
  };
  const wallet = getAgentWalletClient();
  const client = getPublicClient();
  if ((await client.getChainId()) !== wallet.chain.id) throw new Error("El RPC no es Celo Sepolia.");
  const me = wallet.account.address;

  const deployed: Record<string, string> = {};
  for (const [name, symbol] of [["Test ARS", "tARS"], ["Test BRL", "tBRL"]] as const) {
    // `deployContract` no pasa por el tag de atribución; `sendTransaction` sin `to` sí.
    const deployHash = await wallet.sendTransaction({
      data: encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode, args: [name, symbol, me] }),
    });
    const receipt = await client.waitForTransactionReceipt({ hash: deployHash });
    const address = receipt.contractAddress;
    if (receipt.status !== "success" || !address) throw new Error(`Falló el despliegue de ${symbol}`);

    const mintHash = await wallet.writeContract({
      address,
      abi: artifact.abi,
      functionName: "mint",
      args: [me, INITIAL_SUPPLY],
    });
    await client.waitForTransactionReceipt({ hash: mintHash });

    for (const hash of [deployHash, mintHash]) {
      const a = await verifyTx({ client, hash });
      if (!a?.codes.includes(process.env.NEXT_PUBLIC_ATTRIBUTION_TAG!)) {
        throw new Error(`La tx ${hash} no tiene el tag esperado.`);
      }
    }
    deployed[symbol] = address;
    console.log(`${symbol}: ${address}\n  contrato: ${addressUrl(address)}\n  despliegue: ${txUrl(deployHash)} (tag verificado)\n  mint: ${txUrl(mintHash)} (tag verificado)`);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
