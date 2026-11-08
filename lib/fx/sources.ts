// De dónde sale el precio. Cada fuente sabe contestar "¿cuánto vale 1 de A en B?".
// El cotizador (quote.ts) elige la mejor para la freelancer y compara con la de referencia.

import { parseRate } from "./math";

export const FX_CURRENCIES = ["wARS", "wBRL", "wMXN"] as const;
export type FxCurrency = (typeof FX_CURRENCIES)[number];

export type RouteName = "reference" | "textile" | "dex";

export type RateSource = {
  name: RouteName;
  /** Cuántas unidades de `to` valen 1 unidad de `from`, como rate (ver math.ts). */
  getRate: (from: FxCurrency, to: FxCurrency) => Promise<bigint>;
};

export function isFxCurrency(value: unknown): value is FxCurrency {
  return (
    typeof value === "string" &&
    (FX_CURRENCIES as readonly string[]).includes(value)
  );
}

/** "wBRL" → "BRL": el código de la moneda real detrás del token. */
export function fiatCode(currency: FxCurrency): string {
  return currency.slice(1);
}

// ---------- Precio de referencia: una API pública, sin clave ----------

const REFERENCE_URL = "https://open.er-api.com/v6/latest";
const REFERENCE_TTL_MS = 5 * 60_000;
const REFERENCE_TIMEOUT_MS = 5_000;

type ReferenceTable = { fetchedAt: number; rates: Record<string, number> };
const referenceCache = new Map<string, ReferenceTable>();

async function loadReferenceTable(
  base: string,
  now: number,
): Promise<ReferenceTable> {
  const cached = referenceCache.get(base);
  if (cached && now - cached.fetchedAt < REFERENCE_TTL_MS) return cached;

  const response = await fetch(`${REFERENCE_URL}/${base}`, {
    signal: AbortSignal.timeout(REFERENCE_TIMEOUT_MS),
  });
  if (!response.ok)
    throw new Error(`El precio de referencia respondió ${response.status}`);
  const body = (await response.json()) as {
    result?: string;
    rates?: Record<string, number>;
  };
  if (body.result !== "success" || !body.rates)
    throw new Error("El precio de referencia no devolvió datos");

  const table = { fetchedAt: now, rates: body.rates };
  referenceCache.set(base, table);
  return table;
}

export const referenceSource: RateSource = {
  name: "reference",
  async getRate(from, to) {
    const table = await loadReferenceTable(fiatCode(from), Date.now());
    const rate = parseRate(table.rates[fiatCode(to)] ?? Number.NaN);
    if (rate === null)
      throw new Error(
        `El precio de referencia no tiene ${fiatCode(from)}→${fiatCode(to)}`,
      );
    return rate;
  },
};

// ---------- Rutas reales de conversión ----------
// Todavía no están conectadas: Textile necesita credenciales que no tenemos y el DEX de Celo no
// tiene pools para los tokens de prueba. Quedan declaradas para enchufarlas sin tocar el cotizador:
// cuando haya una implementación, se reemplaza `getRate` y la ruta empieza a competir sola.

function notConnected(
  name: Exclude<RouteName, "reference">,
  reason: string,
): RateSource {
  return {
    name,
    async getRate() {
      throw new Error(`${name}: ${reason}`);
    },
  };
}

export const textileSource = notConnected(
  "textile",
  "falta la integración (credenciales de Textile)",
);
export const dexSource = notConnected(
  "dex",
  "falta la integración con el DEX de Celo",
);

export const defaultSources: readonly RateSource[] = [
  textileSource,
  dexSource,
  referenceSource,
];
