// GET /api/quote?from=wBRL&to=wARS&amount=<unidades mínimas, opcional>
// Cotización para mostrar en pantalla ("Vos cobrás aprox."). No mueve plata ni guarda nada.
import { clientKey, isRateLimited, TOO_MANY_REQUESTS } from "@/lib/rate-limit";
import { convertUnits, rateToString } from "@/lib/fx/math";
import { getBestQuote, routeLabel } from "@/lib/fx/quote";
import { isFxCurrency } from "@/lib/fx/sources";

const QUOTE_LIMIT = { max: 40, windowMs: 60_000 };
const MAX_AMOUNT_DIGITS = 78; // lo que entra en un uint256, como en la base

export async function GET(request: Request) {
  if (isRateLimited(`quote:${clientKey(request)}`, QUOTE_LIMIT)) {
    return Response.json(TOO_MANY_REQUESTS, { status: 429 });
  }

  const params = new URL(request.url).searchParams;
  const from = params.get("from");
  const to = params.get("to");
  const amount = params.get("amount");

  if (!isFxCurrency(from) || !isFxCurrency(to)) {
    return Response.json(
      { error: "Monedas no válidas. Usá wARS, wBRL o wMXN." },
      { status: 400 },
    );
  }
  if (
    amount !== null &&
    !new RegExp(`^\\d{1,${MAX_AMOUNT_DIGITS}}$`).test(amount)
  ) {
    return Response.json(
      { error: "El monto tiene que ser un entero en unidades mínimas." },
      { status: 400 },
    );
  }

  try {
    const amountIn = amount === null ? undefined : BigInt(amount);
    const quote = await getBestQuote(from, to, undefined, amountIn);
    return Response.json(
      {
        from,
        to,
        route: quote.route,
        routeLabel: routeLabel(quote.route),
        rate: rateToString(quote.rate),
        referenceRate:
          quote.referenceRate === null
            ? null
            : rateToString(quote.referenceRate),
        diffBasisPoints: quote.diffBasisPoints,
        ...(amount === null
          ? {}
          : { amountOut: convertUnits(amountIn!, quote.rate).toString() }),
        updatedAt: new Date().toISOString(),
      },
      // Un minuto en la red de Vercel alcanza: el precio de referencia ya se guarda cinco.
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error(
      "GET /api/quote",
      error instanceof Error ? error.message : "error",
    );
    return Response.json(
      { error: "No pudimos obtener la cotización ahora." },
      { status: 502 },
    );
  }
}
