// Cuentas de tipo de cambio con bigint (nunca con números con coma). Lógica pura.
//
// Un "rate" es cuántas unidades de la moneda de destino valen 1 unidad de la moneda de origen,
// guardado como entero multiplicado por RATE_SCALE (12 decimales). Así 1 BRL = 280,84 ARS
// es 280.842296 * 10^12 y no se pierde precisión al multiplicar por montos de 18 decimales.

export const RATE_SCALE = BigInt(10) ** BigInt(12);
const RATE_DECIMALS = 12;

/** Convierte un precio ("280.842296" o 280.842296) a rate. Devuelve null si no es positivo o no se entiende. */
export function parseRate(value: string | number): bigint | null {
  const text =
    typeof value === "number"
      ? Number.isFinite(value)
        ? value.toFixed(RATE_DECIMALS)
        : ""
      : value.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return null;

  const [, whole, fraction = ""] = match;
  const rate = BigInt(
    whole + fraction.slice(0, RATE_DECIMALS).padEnd(RATE_DECIMALS, "0"),
  );
  return rate > BigInt(0) ? rate : null;
}

/** Cuánto vale `amount` (unidades mínimas de la moneda de origen) en la moneda de destino. */
export function convertUnits(amount: bigint, rate: bigint): bigint {
  return (amount * rate) / RATE_SCALE;
}

/** El rate como texto con punto decimal, para mandarlo por JSON ("280.842296"). */
export function rateToString(rate: bigint, decimals = 6): string {
  const scaled = (rate * BigInt(10) ** BigInt(decimals)) / RATE_SCALE;
  const text = scaled.toString().padStart(decimals + 1, "0");
  const whole = text.slice(0, text.length - decimals);
  return decimals === 0
    ? whole
    : `${whole}.${text.slice(text.length - decimals)}`;
}

/** Cuántos decimales mostrar: pocos para precios grandes, más para los chicos (0,003563). */
function displayDecimals(rate: bigint): number {
  if (rate >= RATE_SCALE) return 2;
  if (rate >= RATE_SCALE / BigInt(100)) return 4;
  return 6;
}

/** El rate para leer en pantalla, al estilo argentino: "280,84". */
export function formatRate(rate: bigint): string {
  const decimals = displayDecimals(rate);
  const factor = BigInt(10) ** BigInt(decimals);
  const rounded = (rate * factor + RATE_SCALE / BigInt(2)) / RATE_SCALE;
  const text = rounded.toString().padStart(decimals + 1, "0");
  const whole = text
    .slice(0, text.length - decimals)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${whole},${text.slice(text.length - decimals)}`;
}

/** Diferencia de `rate` contra `reference` en puntos básicos (100 = 1 %). Con signo. */
export function diffBasisPoints(rate: bigint, reference: bigint): number {
  return Number(((rate - reference) * BigInt(10000)) / reference);
}

/** "+0,4 %" o "-1,2 %" a partir de puntos básicos. */
export function formatBasisPoints(basisPoints: number): string {
  const sign = basisPoints > 0 ? "+" : basisPoints < 0 ? "-" : "";
  const percent = (Math.abs(basisPoints) / 100).toFixed(1).replace(".", ",");
  return `${sign}${percent} %`;
}
