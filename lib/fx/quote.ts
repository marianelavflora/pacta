// Cotizador: de todas las rutas disponibles elige la que más le paga a la freelancer y la compara
// con el precio de referencia. Lógica pura sobre fuentes intercambiables (se prueba sin red).

import { defaultSources } from "./default-sources";
import { diffBasisPoints, RATE_SCALE } from "./math";
import {
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

// Guarda contra precios absurdos (pool desbalanceada, dato roto): una ruta real que se aleja más de
// 15 % de la referencia, para un lado o para el otro, no es una oferta y se descarta. El margen es
// amplio y simétrico a propósito: el mercado cripto de pesos cotiza ~5 a 7 % distinto del oficial
// (la referencia es el oficial), así que al comprar o al vender pesos la brecha cae de cada lado.
const MAX_DISTANCE_FROM_REFERENCE_BP = 1500;

async function askEverySource(
  from: FxCurrency,
  to: FxCurrency,
  sources: readonly RateSource[],
  amountIn?: bigint,
): Promise<Outcome[]> {
  const settled = await Promise.allSettled(
    sources.map((source) => source.getRate(from, to, amountIn)),
  );
  const outcomes: Outcome[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled")
      outcomes.push({ source: sources[index], rate: result.value });
  });
  return outcomes;
}

function isPlausible(rate: bigint, reference: bigint): boolean {
  const diff = diffBasisPoints(rate, reference);
  return Math.abs(diff) <= MAX_DISTANCE_FROM_REFERENCE_BP;
}

/** La mejor cotización para pasar de `from` a `to` (por `amountIn` unidades mínimas, si se sabe). Si ninguna ruta contesta, lanza NoQuoteError. */
export async function getBestQuote(
  from: FxCurrency,
  to: FxCurrency,
  sources: readonly RateSource[] = defaultSources,
  amountIn?: bigint,
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

  const outcomes = await askEverySource(from, to, sources, amountIn);
  const reference = outcomes.find(
    (outcome) => outcome.source.name === "reference",
  );
  // Sin referencia no hay con qué contrastar: la ruta real se acepta (solo para mostrar).
  const realRoutes = outcomes.filter(
    (outcome) =>
      outcome.source.name !== "reference" &&
      (!reference || isPlausible(outcome.rate, reference.rate)),
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
