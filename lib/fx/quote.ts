// Cotizador: de todas las rutas disponibles elige la que más le paga a la freelancer y la compara
// con el precio de referencia. Lógica pura sobre fuentes intercambiables (se prueba sin red).

import { diffBasisPoints, RATE_SCALE } from "./math";
import {
  defaultSources,
  type FxCurrency,
  type RateSource,
  type RouteName,
} from "./sources";

export type BestQuote = {
  route: RouteName;
  /** Rate de la ruta elegida (ver math.ts). */
  rate: bigint;
  /** El precio de referencia, o null si no se pudo consultar. */
  referenceRate: bigint | null;
  /** Qué tan por encima (+) o por debajo (-) de la referencia está la ruta, en puntos básicos. */
  diffBasisPoints: number | null;
};

export class NoQuoteError extends Error {
  constructor() {
    super("No pudimos obtener una cotización ahora.");
    this.name = "NoQuoteError";
  }
}

type Outcome = { source: RateSource; rate: bigint };

async function askEverySource(
  from: FxCurrency,
  to: FxCurrency,
  sources: readonly RateSource[],
): Promise<Outcome[]> {
  const settled = await Promise.allSettled(
    sources.map((source) => source.getRate(from, to)),
  );
  const outcomes: Outcome[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled")
      outcomes.push({ source: sources[index], rate: result.value });
  });
  return outcomes;
}

/** La mejor cotización para pasar de `from` a `to`. Si ninguna ruta contesta, lanza NoQuoteError. */
export async function getBestQuote(
  from: FxCurrency,
  to: FxCurrency,
  sources: readonly RateSource[] = defaultSources,
): Promise<BestQuote> {
  // Misma moneda de los dos lados: no hay nada que convertir.
  if (from === to) {
    return {
      route: "reference",
      rate: RATE_SCALE,
      referenceRate: RATE_SCALE,
      diffBasisPoints: 0,
    };
  }

  const outcomes = await askEverySource(from, to, sources);
  const reference = outcomes.find(
    (outcome) => outcome.source.name === "reference",
  );
  const realRoutes = outcomes.filter(
    (outcome) => outcome.source.name !== "reference",
  );

  // Entre las rutas reales gana la que más paga; si no hay ninguna, sirve la de referencia.
  const best = realRoutes.reduce<Outcome | undefined>(
    (winner, candidate) =>
      !winner || candidate.rate > winner.rate ? candidate : winner,
    undefined,
  );
  const chosen = best ?? reference;
  if (!chosen) throw new NoQuoteError();

  const referenceRate = reference?.rate ?? null;
  return {
    route: chosen.source.name,
    rate: chosen.rate,
    referenceRate,
    diffBasisPoints:
      referenceRate === null
        ? null
        : diffBasisPoints(chosen.rate, referenceRate),
  };
}

const ROUTE_LABELS: Record<RouteName, string> = {
  reference: "precio de referencia",
  textile: "Textile",
  dex: "DEX de Celo",
};

export function routeLabel(route: RouteName): string {
  return ROUTE_LABELS[route];
}
