// Montos del formulario: de lo que escribe la persona ("1500,50") a unidades mínimas
// (18 decimales) y de vuelta a texto para mostrar. Todo con bigint: nunca number.

export const DECIMALS = 18;

/**
 * Convierte lo que escribe la persona en unidades mínimas.
 * Acepta "1500", "1500,50", "1.500,50" y "1500.50". Devuelve null si no se entiende
 * (vacío, letras, negativo, más de 18 decimales).
 */
export function parseAmountToUnits(input: string): bigint | null {
  let text = input.trim().replace(/\s/g, "");
  if (!text) return null;

  if (text.includes(",")) {
    // Con coma: la coma es el decimal y los puntos separan miles.
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    // "1.500" o "1.500.000": puntos de miles.
    text = text.replace(/\./g, "");
  }

  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  if (fraction.length > DECIMALS) return null;

  return BigInt(whole + fraction.padEnd(DECIMALS, "0"));
}

/** Unidades mínimas a texto para mostrar: 1500500000000000000000n -> "1.500,5". */
export function formatUnits(units: bigint): string {
  const base = BigInt(10) ** BigInt(DECIMALS);
  const whole = (units / base).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = (units % base).toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  return fraction ? `${whole},${fraction}` : whole;
}
