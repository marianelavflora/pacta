// Cotiza en MAINNET sin mandar nada (solo lecturas): mira cada ruta por separado y la mejor.
//   npm run fx:quote -- wBRL wARS 100
// No usa la clave del agente ni toca la base. Sirve para ver precios reales antes de pagar.
import { formatAmount, parseAmount } from "@/lib/chain/tokens";
import { formatBasisPoints, formatRate, convertUnits } from "@/lib/fx/math";
import { getBestQuote, routeLabel } from "@/lib/fx/quote";
import { isFxCurrency, probeAmount, referenceSource } from "@/lib/fx/sources";
import { createTextileSource } from "@/lib/fx/textile";
import { createUniswapSource } from "@/lib/fx/uniswap";

async function main() {
  const [from, to, amountText] = process.argv.slice(2);
  if (!isFxCurrency(from) || !isFxCurrency(to)) {
    throw new Error("Uso: npm run fx:quote -- <wARS|wBRL|wMXN> <wARS|wBRL|wMXN> [monto]");
  }
  const amountIn = amountText ? parseAmount(amountText) : probeAmount(from);
  const sources = [createTextileSource({ chain: "celo" }), createUniswapSource({ chain: "celo" }), referenceSource];

  console.log(`Cotizando ${formatAmount(amountIn)} ${from} → ${to} en Celo mainnet (solo lectura)\n`);
  for (const source of sources) {
    try {
      const rate = await source.getRate(from, to, amountIn);
      console.log(`  ${routeLabel(source.name).padEnd(22)} ${formatRate(rate).padStart(10)}  → ${formatAmount(convertUnits(amountIn, rate))} ${to}`);
    } catch (error) {
      console.log(`  ${routeLabel(source.name).padEnd(22)} sin precio: ${error instanceof Error ? error.message : error}`);
    }
  }

  const best = await getBestQuote(from, to, sources, amountIn);
  const diff = best.diffBasisPoints === null ? "" : ` (${formatBasisPoints(best.diffBasisPoints)} vs referencia)`;
  console.log(`\nGana: ${routeLabel(best.route)} a ${formatRate(best.rate)}${diff}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
