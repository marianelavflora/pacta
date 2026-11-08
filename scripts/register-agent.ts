// Registro de la identidad del agente con ERC-8004 (PAC-45).
//
// Orden oficial (AGENTS.md): 1) la card está publicada SIN registrations (PAC-44);
// 2) register(agentURI); 3) se lee el agentId del evento Registered; 4) se suma a la card;
// 5) se vuelve a publicar la card y se llama a setAgentURI.
//
// Por defecto es un ENSAYO: simula la llamada contra el registro real y no manda nada.
//
//   npm run agent:register                          ensayo del paso 2
//   npm run agent:register -- --send                 registra (paso 2) y muestra el agentId
//   npm run agent:register -- --send --write-card    ... y además suma el agentId a public/agent-card.json
//   npm run agent:register -- --set-uri=<agentId> --send   paso 5: setAgentURI con la card ya publicada
//
// Seguridad:
//   - Sale por el cliente único del agente (lib/chain/wallet.ts): lleva el tag de atribución.
//   - Solo se registra una vez: si la wallet ya tiene una identidad, se frena (salvo --force).
//   - En mainnet (NEXT_PUBLIC_CHAIN=celo) se niega a enviar salvo que Mavi lo apruebe en ese
//     momento con APPROVED_MAINNET=yes. Un agente de IA no debe poner esa variable.
//   - Nunca imprime claves.

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { verifyTx } from "@celo/attribution-tags";
import { parseEventLogs } from "viem";

const envFile = process.env.ENV_FILE ?? ".env.local";
if (existsSync(envFile)) process.loadEnvFile(envFile);

const CARD_PATH = "public/agent-card.json";
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

async function main() {
  const send = flag("send");
  const { getChain, getChainName, txUrl, addressUrl } = await import("../lib/chain/chains");
  const { getAgentWalletClient, getPublicClient } = await import("../lib/chain/wallet");
  const { agentRegistryId, getIdentityRegistry, identityRegistryAbi, withRegistration } = await import(
    "../lib/chain/identity"
  );

  const chainName = getChainName();
  const registry = getIdentityRegistry(chainName);
  const wallet = getAgentWalletClient();
  const publicClient = getPublicClient();
  const me = wallet.account.address;
  const tag = process.env.NEXT_PUBLIC_ATTRIBUTION_TAG!;

  if ((await publicClient.getChainId()) !== getChain().id) {
    throw new Error("El RPC responde otra red distinta a NEXT_PUBLIC_CHAIN. Corté por seguridad.");
  }
  if (send && chainName === "celo" && process.env.APPROVED_MAINNET !== "yes") {
    throw new Error(
      "Esto manda una transacción en MAINNET. Solo Mavi, en ese momento, puede aprobarlo: corré con APPROVED_MAINNET=yes.",
    );
  }

  const card = JSON.parse(readFileSync(CARD_PATH, "utf8")) as { services?: { endpoint?: string }[] };
  const origin = card.services?.[0]?.endpoint?.replace(/\/+$/, "");
  const uri = option("uri") ?? (origin ? `${origin}/agent-card.json` : undefined);
  if (!uri) throw new Error("No sé cuál es la URL de la card. Pasala con --uri=https://.../agent-card.json");

  console.log(`Red: ${chainName} · Registro: ${registry}`);
  console.log(`Wallet del agente: ${me}`);
  console.log(`agentURI: ${uri}`);
  console.log(`agentRegistry de la card: ${agentRegistryId(chainName)}`);

  // --- Paso 5: setAgentURI ---
  const setUriFor = option("set-uri");
  if (setUriFor) {
    const agentId = BigInt(setUriFor);
    const owner = await publicClient.readContract({ address: registry, abi: identityRegistryAbi, functionName: "ownerOf", args: [agentId] });
    if (owner.toLowerCase() !== me.toLowerCase()) throw new Error(`El agentId ${agentId} no es de la wallet del agente (dueña: ${owner}).`);
    await assertCardLive(uri, true);
    const { request } = await publicClient.simulateContract({ account: wallet.account, address: registry, abi: identityRegistryAbi, functionName: "setAgentURI", args: [agentId, uri] });
    console.log("Simulación de setAgentURI: OK");
    if (!send) return console.log("Ensayo terminado: no se mandó nada. Agregá --send para enviarla.");
    const hash = await wallet.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`setAgentURI falló: ${txUrl(hash)}`);
    await assertTag(hash, tag);
    console.log(`Listo: URI actualizado. ${txUrl(hash)}`);
    return;
  }

  // --- Paso 2: register(agentURI) ---
  const owned = await publicClient.readContract({ address: registry, abi: identityRegistryAbi, functionName: "balanceOf", args: [me] });
  if (owned > BigInt(0) && !flag("force")) {
    throw new Error(
      `La wallet del agente ya tiene ${owned} identidad(es) en este registro. Registrar de nuevo crearía un duplicado. Si es a propósito, usá --force.`,
    );
  }
  await assertCardLive(uri, send);

  const { request } = await publicClient.simulateContract({ account: wallet.account, address: registry, abi: identityRegistryAbi, functionName: "register", args: [uri] });
  console.log("Simulación de register: OK (el registro acepta la llamada)");
  if (!send) return console.log("Ensayo terminado: no se mandó nada. Agregá --send para registrar.");

  const hash = await wallet.writeContract(request);
  console.log(`Transacción enviada: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`register falló: ${txUrl(hash)}`);
  await assertTag(hash, tag);

  // El agentId sale del evento Registered del recibo, no de una simulación.
  const [event] = parseEventLogs({ abi: identityRegistryAbi, eventName: "Registered", logs: receipt.logs.filter((l) => l.address.toLowerCase() === registry.toLowerCase()) });
  if (!event) throw new Error(`La transacción salió bien pero no encontré el evento Registered: ${txUrl(hash)}`);
  const agentId = event.args.agentId;
  console.log(`\nAgente registrado. agentId = ${agentId}`);
  console.log(`Transacción: ${txUrl(hash)}`);
  console.log(`Identidad:   ${addressUrl(registry)}`);

  if (flag("write-card")) {
    const current = JSON.parse(readFileSync(CARD_PATH, "utf8"));
    writeFileSync(CARD_PATH, JSON.stringify(withRegistration(current, agentId, chainName), null, 2) + "\n");
    console.log(`\nSumé el agentId a ${CARD_PATH}. Siguiente: publicar la card y correr  npm run agent:register -- --set-uri=${agentId} --send`);
  } else {
    console.log(`\nSiguiente: sumá el agentId a la card (--write-card, o a mano), publicala y corré  npm run agent:register -- --set-uri=${agentId} --send`);
  }
  if (chainName !== "celo") {
    console.log("\nOJO: esto fue en testnet. NO subas este agentId a la card de producción: el que cuenta es el de mainnet.");
  }
}

async function assertTag(hash: `0x${string}`, expected: string) {
  const { getPublicClient } = await import("../lib/chain/wallet");
  const attribution = await verifyTx({ client: getPublicClient(), hash });
  if (!attribution?.codes.includes(expected)) {
    throw new Error("La transacción salió SIN el tag de atribución. Revisá antes de seguir.");
  }
  console.log(`Tag verificado: ${attribution.codes.join(", ")}`);
}

/** La card tiene que abrirse desde una URL pública antes de registrarla. */
async function assertCardLive(uri: string, required: boolean) {
  try {
    const res = await fetch(uri, { signal: AbortSignal.timeout(15000) });
    const json = (await res.json()) as { name?: string };
    if (!res.ok || json.name !== "Pactá") throw new Error(`respondió ${res.status}`);
    console.log("La card está publicada y se abre bien.");
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    if (required) throw new Error(`La card no se abre desde ${uri} (${why}). Publicala (deploy) antes de registrar.`);
    console.log(`AVISO: la card todavía no se abre desde ${uri} (${why}). Para enviar de verdad hay que publicarla primero.`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
