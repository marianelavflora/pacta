// Prueba punta a punta del sprint 1 (PAC-28), SOLO en Celo Sepolia (testnet).
//
// Hace el recorrido completo con billeteras de prueba que se crean al vuelo:
//   freelancer crea el acuerdo → cliente deposita (con tag) → la bóveda lo detecta →
//   freelancer entrega → cliente aprueba con su firma → el liberador paga → recibo.
// Además prueba que lo que no debe pasar no pase (firma ajena, entrega ajena, cron sin
// contraseña, pagar dos veces) y escribe el resultado en docs/pruebas/sprint-1.md.
//
// Uso (con el servidor andando y el mismo CRON_SECRET):
//   CRON_SECRET=... npm run dev          (en una terminal)
//   CRON_SECRET=... npm run e2e:sprint1  (en otra)
//
// Las billeteras de cliente y freelancer son descartables (clave al azar, no se guarda).
// El cliente simula al navegador: manda el depósito con `buildDepositCalldata` (el mismo
// tag que pone DepositButton). Los pagos del agente salen por el cliente único de lib/chain.
// Nunca imprime claves ni variables secretas.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import { verifyTx } from "@celo/attribution-tags";
import { createWalletClient, formatUnits, http, parseEther, parseUnits, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const envFile = process.env.ENV_FILE ?? ".env.local";
if (existsSync(envFile)) process.loadEnvFile(envFile);

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const REPORT = "docs/pruebas/sprint-1.md";

type Row = { step: string; ok: boolean; detail: string };
const rows: Row[] = [];

function record(step: string, ok: boolean, detail = "") {
  rows.push({ step, ok, detail });
  console.log(`${ok ? "OK  " : "FALLO"} ${step}${detail ? ` — ${detail}` : ""}`);
}

async function api(path: string, init?: RequestInit & { json?: unknown; secret?: boolean }) {
  const headers: Record<string, string> = {};
  if (init?.json !== undefined) headers["content-type"] = "application/json";
  if (init?.secret) headers.authorization = `Bearer ${process.env.CRON_SECRET}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: init?.method ?? (init?.json !== undefined ? "POST" : "GET"),
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
  });
  // `any` a propósito: es un script de prueba que lee respuestas JSON de forma suelta.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (await res.json().catch(() => null)) as Record<string, any> | null;
  return { status: res.status, body };
}

function writeReport(extra: string[]) {
  const failed = rows.filter((r) => !r.ok).length;
  const lines = [
    "# Prueba punta a punta · Sprint 1 (PAC-28)",
    "",
    `Corrida automática en Celo Sepolia (testnet), ${new Date().toISOString()}. Script: \`scripts/e2e-sprint1.ts\` (\`npm run e2e:sprint1\`).`,
    "",
    failed === 0 ? "**Resultado: todo anduvo.**" : `**Resultado: ${failed} paso(s) fallaron.**`,
    "",
    "| # | Paso | ¿Anduvo? | Detalle |",
    "|---|---|---|---|",
    ...rows.map((r, i) => `| ${i + 1} | ${r.step} | ${r.ok ? "Sí" : "No"} | ${r.detail.replace(/\|/g, "/")} |`),
    "",
    ...extra,
  ];
  mkdirSync("docs/pruebas", { recursive: true });
  writeFileSync(REPORT, lines.join("\n") + "\n");
  console.log(`\nInforme: ${REPORT}`);
}

async function main() {
  if (!process.env.CRON_SECRET) throw new Error("Falta CRON_SECRET (el mismo con el que arrancó el servidor).");

  // Se importan después de cargar el .env para que lean las variables.
  const { getChain, getChainName, txUrl } = await import("../lib/chain/chains");
  const { getAgentWalletClient, getPublicClient } = await import("../lib/chain/wallet");
  const { erc20Abi, getToken } = await import("../lib/chain/tokens");
  const { AGENT_ADDRESS, buildDepositCalldata } = await import("../lib/chain/deposit");
  const { buildApprovalTypedData } = await import("../lib/chain/approval");

  if (getChainName() !== "celo-sepolia") {
    throw new Error(`Este script solo corre en Celo Sepolia (testnet). NEXT_PUBLIC_CHAIN="${getChainName()}".`);
  }
  const tag = process.env.NEXT_PUBLIC_ATTRIBUTION_TAG!;
  const chain = getChain();
  const publicClient = getPublicClient();
  const agent = getAgentWalletClient();
  const token = getToken("wARS"); // tARS en testnet

  const health = await fetch(BASE_URL).catch(() => null);
  if (!health) throw new Error(`No responde el servidor en ${BASE_URL}. Arrancalo con npm run dev.`);

  // --- Billeteras descartables ---
  const clientAccount = privateKeyToAccount(generatePrivateKey());
  const freelancerAccount = privateKeyToAccount(generatePrivateKey());
  const strangerAccount = privateKeyToAccount(generatePrivateKey());
  const client = createWalletClient({ account: clientAccount, chain, transport: http() });
  console.log(`Cliente de prueba: ${clientAccount.address}`);
  console.log(`Freelancer de prueba: ${freelancerAccount.address}`);

  const agentCelo = await publicClient.getBalance({ address: agent.account.address });
  if (agentCelo < parseEther("0.05")) {
    throw new Error(
      `La wallet del agente tiene ${formatUnits(agentCelo, 18)} CELO de testnet. Pedí más en el faucet de Celo Sepolia.`,
    );
  }

  // 1. Fondos de prueba para el cliente: CELO para el gas y tARS (mint, solo existe en testnet).
  const m1 = parseUnits("100", 18);
  const m2 = parseUnits("50", 18);
  const total = m1 + m2;
  const gasHash = await agent.sendTransaction({ to: clientAccount.address, value: parseEther("0.02") });
  const gasReceipt = await publicClient.waitForTransactionReceipt({ hash: gasHash });
  if (gasReceipt.status !== "success") throw new Error(`Falló el envío de CELO al cliente de prueba: ${txUrl(gasHash)}`);
  const mintHash = await agent.writeContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "mint",
    args: [clientAccount.address, total],
  });
  const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });
  if (mintReceipt.status !== "success") {
    throw new Error(`Falló el mint de ${token.symbol} (¿la wallet del agente es dueña del token?): ${txUrl(mintHash)}`);
  }
  // El RPC público a veces devuelve el saldo viejo justo después de una transacción:
  // se vuelve a leer hasta que cambie (o se acaba el tiempo) para no dar falsos fallos.
  const balanceOf = async (who: Address, until?: (balance: bigint) => boolean) => {
    let balance = BigInt(0);
    for (let i = 0; i < 12; i++) {
      balance = (await publicClient.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [who],
      })) as bigint;
      if (!until || until(balance)) break;
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    return balance;
  };
  const clientBal = await balanceOf(clientAccount.address, (b) => b === total);
  record("Cliente de prueba con CELO y tARS", clientBal === total, `${formatUnits(clientBal, 18)} ${token.symbol}`);

  // 2. La freelancer crea un acuerdo de 2 hitos.
  const created = await api("/api/agreements", {
    json: {
      freelancerWallet: freelancerAccount.address,
      freelancerName: "Freelancer de prueba",
      title: "Prueba punta a punta",
      description: "Acuerdo creado por scripts/e2e-sprint1.ts",
      clientContact: "prueba@example.com",
      clientCurrency: "wARS",
      payoutCurrency: "wARS",
      milestones: [
        { title: "Hito 1", amount: m1.toString(), reviewDays: 3 },
        { title: "Hito 2", amount: m2.toString(), reviewDays: 3 },
      ],
    },
  });
  const publicId = created.body?.publicId as string | undefined;
  record("Crear acuerdo de 2 hitos", created.status === 201 && !!publicId, `status ${created.status}, link /a/${publicId}`);
  if (!publicId) throw new Error("Sin acuerdo no se puede seguir.");

  const read1 = await api(`/api/agreements/${publicId}`);
  const milestones = (read1.body?.milestones ?? []) as { id: string; position: number; amount: string; status: string }[];
  record(
    "Leer el acuerdo: 2 hitos, total correcto, todo pending",
    milestones.length === 2 && read1.body?.totalAmount === total.toString() && milestones.every((m) => m.status === "pending"),
    `estado ${read1.body?.status}`,
  );

  // 3. El cliente deposita el total, con tag, y avisa el hash.
  const depositHash = await client.sendTransaction({
    to: token.address,
    data: buildDepositCalldata(AGENT_ADDRESS, total, tag),
  });
  await publicClient.waitForTransactionReceipt({ hash: depositHash });
  const depositTag = await verifyTx({ client: publicClient, hash: depositHash });
  record("Depósito del cliente sale con el tag", !!depositTag?.codes.includes(tag), txUrl(depositHash));

  let deposit = await api(`/api/agreements/${publicId}/deposit`, { json: { txHash: depositHash } });
  for (let i = 0; i < 5 && deposit.status === 404; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    deposit = await api(`/api/agreements/${publicId}/deposit`, { json: { txHash: depositHash } });
  }
  record("La bóveda registra el depósito", deposit.status === 200 && deposit.body?.kind === "recorded", `status ${deposit.status}, ${deposit.body?.kind ?? deposit.body?.error}`);

  const again = await api(`/api/agreements/${publicId}/deposit`, { json: { txHash: depositHash } });
  record("Avisar dos veces el mismo depósito no lo duplica", again.body?.kind === "already_recorded", String(again.body?.kind));

  const read2 = await api(`/api/agreements/${publicId}`);
  const funded = (read2.body?.milestones as { status: string }[] | undefined) ?? [];
  record("Acuerdo y hitos pasan a financiado", funded.length === 2 && funded.every((m) => m.status === "funded"), `acuerdo ${read2.body?.status}, hitos ${funded.map((m) => m.status).join("/")}`);

  const sweep = await api("/api/cron/vault", { secret: true });
  record("Barrido de la bóveda (cron) responde", sweep.status === 200, `status ${sweep.status}`);

  // 4. Seguridad del cron y de la entrega.
  const noSecret = await api("/api/cron/releaser", { method: "POST", json: {} });
  record("El liberador rechaza pedidos sin contraseña", noSecret.status === 401, `status ${noSecret.status}`);

  const first = milestones.find((m) => m.position === 1)!;
  const strangerDeliver = await api(`/api/milestones/${first.id}/deliver`, {
    json: { freelancerWallet: strangerAccount.address, deliveryUrl: "https://example.com/entrega" },
  });
  record("Otra billetera no puede entregar el hito", strangerDeliver.status === 403, `status ${strangerDeliver.status}`);

  // 5. La freelancer entrega el hito 1.
  const deliver = await api(`/api/milestones/${first.id}/deliver`, {
    json: { freelancerWallet: freelancerAccount.address, deliveryUrl: "https://example.com/entrega-1", deliveryNote: "Primera entrega" },
  });
  record("Freelancer entrega el hito 1", deliver.status === 200 && deliver.body?.status === "delivered", `status ${deliver.status}, ${deliver.body?.status ?? deliver.body?.error}`);

  // 6. Aprobación: primero con una firma ajena, después con la del cliente.
  const typed = buildApprovalTypedData({
    chainId: chain.id,
    agreementPublicId: publicId,
    milestoneId: first.id,
    position: first.position,
    amount: BigInt(first.amount),
    currency: "wARS",
  });
  const strangerSig = await createWalletClient({ account: strangerAccount, chain, transport: http() }).signTypedData(typed);
  const badApprove = await api(`/api/milestones/${first.id}/approve`, { json: { signature: strangerSig } });
  record("Una firma ajena no aprueba el hito", badApprove.status === 403, `status ${badApprove.status}`);

  const signature: Hex = await client.signTypedData(typed);
  const approve = await api(`/api/milestones/${first.id}/approve`, { json: { signature } });
  record("Cliente aprueba el hito 1 con su firma", approve.status === 200 && approve.body?.status === "approved", `status ${approve.status}, ${approve.body?.status ?? approve.body?.error}`);

  // 7. El liberador paga una sola vez.
  const freelancerBefore = await balanceOf(freelancerAccount.address);
  const pay = await api("/api/cron/releaser", { method: "POST", json: { milestoneId: first.id }, secret: true });
  record("El liberador paga el hito 1", pay.status === 200 && pay.body?.kind === "paid", `${pay.body?.kind}${pay.body?.reason ? `: ${pay.body.reason}` : ""}`);

  const payHash = pay.body?.txHash as Hex | undefined;
  if (payHash) {
    await publicClient.waitForTransactionReceipt({ hash: payHash });
    const payTag = await verifyTx({ client: publicClient, hash: payHash });
    record("El pago sale con el tag", !!payTag?.codes.includes(tag), txUrl(payHash));
  }
  const freelancerAfter = await balanceOf(freelancerAccount.address, (b) => b - freelancerBefore === m1);
  record("La freelancer recibió exactamente el monto del hito", freelancerAfter - freelancerBefore === m1, `+${formatUnits(freelancerAfter - freelancerBefore, 18)} ${token.symbol}`);

  const payAgain = await api("/api/cron/releaser", { method: "POST", json: { milestoneId: first.id }, secret: true });
  const freelancerFinal = await balanceOf(freelancerAccount.address);
  record("Pagar de nuevo no paga dos veces", payAgain.body?.kind === "already_paid" && freelancerFinal === freelancerAfter, String(payAgain.body?.kind));

  // 8. Recibo.
  const receipt = await api(`/api/receipts/${first.id}`);
  const rb = receipt.body;
  record(
    "Recibo del hito pagado",
    receipt.status === 200 && rb?.milestoneStatus === "paid" && rb?.payout?.amount === m1.toString() && rb?.payout?.txHash === payHash,
    `status ${receipt.status}, hito ${rb?.milestoneStatus}`,
  );
  const leaked = JSON.stringify(rb ?? {}).includes("prueba@example.com") || JSON.stringify(rb ?? {}).includes(signature);
  record("El recibo público no filtra contacto ni firma", !leaked);

  writeReport([
    "## Datos de la corrida",
    "",
    `- Acuerdo: ${BASE_URL}/a/${publicId}`,
    `- Recibo del hito 1: ${BASE_URL}/recibo/${first.id}`,
    `- Depósito: ${txUrl(depositHash)}`,
    payHash ? `- Pago: ${txUrl(payHash)}` : "- Pago: no salió",
    "- Billeteras de cliente y freelancer: descartables, creadas por el script.",
  ]);
  if (rows.some((r) => !r.ok)) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  if (rows.length) writeReport([`Se cortó con un error: ${error instanceof Error ? error.message : String(error)}`]);
  process.exit(1);
});
