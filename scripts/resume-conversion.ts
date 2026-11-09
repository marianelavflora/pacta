// Retoma un cambio de moneda que quedó a medias (tramo 1 hecho, USDT en la wallet del agente).
//
//   npm run conversion:resume -- <milestoneId>            ENSAYO: revisa todo y muestra el plan, no manda nada
//   npm run conversion:resume -- <milestoneId> --send     hace el tramo 2 (USDT -> moneda de cobro)
//
// Después, el pago lo hace el liberador de siempre (GET /api/cron/releaser): ve el cambio confirmado y paga
// lo que llegó sin cambiar de nuevo.
//
// Seguridad:
//   - Sale por el cliente único del agente (lib/chain/wallet.ts): lleva el tag de atribución.
//   - En mainnet se niega a operar salvo que Mavi lo apruebe en ese momento con APPROVED_MAINNET=yes.
//     Un agente de IA no debe poner esa variable por su cuenta.
//   - Nunca imprime claves.
import { existsSync } from "node:fs";

import { formatUnits } from "viem";

const envFile = process.env.ENV_FILE ?? ".env.local";
if (existsSync(envFile)) process.loadEnvFile(envFile);

async function main() {
  const milestoneId = process.argv[2];
  const send = process.argv.includes("--send");
  if (!milestoneId || milestoneId.startsWith("--")) {
    throw new Error("Uso: npm run conversion:resume -- <milestoneId> [--send]");
  }

  const { getTextileSwapDeps } = await import("../agent/releaser-server");
  const { planResume, resumeConversion } = await import("../agent/resume-conversion");
  const { getDb } = await import("../lib/db");
  const { getDexConfig } = await import("../lib/chain/dex");
  const { getToken } = await import("../lib/chain/tokens");
  const { getBestQuote } = await import("../lib/fx/quote");
  const { convertUnits } = await import("../lib/fx/math");
  const { referenceSource } = await import("../lib/fx/sources");
  const { createTextileSource } = await import("../lib/fx/textile");
  const { txUrl } = await import("../lib/chain/chains");

  const swap = getTextileSwapDeps();
  const dex = getDexConfig();
  if (!swap || !dex) throw new Error("Esta red no tiene Textile (solo mainnet).");

  const deps = {
    db: getDb(),
    swap,
    usdt: dex.usdt.address,
    tokenAddress: (currency: Parameters<typeof getToken>[0]) => getToken(currency).address,
    estimate: async (from: Parameters<typeof getToken>[0], to: Parameters<typeof getToken>[0], amountIn: bigint) => {
      const quote = await getBestQuote(from, to, [createTextileSource(), referenceSource], amountIn);
      return quote.route === "textile" ? convertUnits(amountIn, quote.rate) : null;
    },
  };

  const plan = await planResume(deps, milestoneId);
  console.log(`Hito: ${plan.milestoneId}`);
  console.log(`Cambio: ${plan.from} -> ${plan.to} (se vendieron ${formatUnits(plan.amountIn, 18)} ${plan.from})`);
  console.log(`USDT que llegó del tramo 1: ${formatUnits(plan.usdtAmount, 6)}`);
  console.log(`Se espera recibir ~${formatUnits(plan.estimate, 18)} ${plan.to}; mínimo aceptado: ${formatUnits(plan.minAmountOut, 18)}`);

  if (!send) {
    console.log("\nEnsayo terminado: no se mandó nada. Agregá --send para hacer el tramo 2.");
    return;
  }

  const result = await resumeConversion(deps, plan);
  console.log(`\nTramo 2 hecho. Llegaron ${formatUnits(result.amountOut, 18)} ${plan.to}.`);
  console.log(`Transacción: ${txUrl(result.finalTxHash)}`);
  console.log("Ahora corré el liberador para que pague: GET /api/cron/releaser.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
