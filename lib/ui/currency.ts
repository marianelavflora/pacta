// Cómo mostramos las monedas en pantalla: R$ para el cliente de Brasil, $ para pesos, etc.
// Los códigos (wARS, wBRL, wMXN) son los de las monedas de Ripio; el símbolo es solo para leer más fácil.

import { formatUnits, parseAmountToUnits } from "@/lib/amounts";

const SYMBOLS: Record<string, string> = {
  wARS: "$",
  wBRL: "R$",
  wMXN: "MX$",
};

const NAMES: Record<string, string> = {
  wARS: "pesos argentinos",
  wBRL: "reales",
  wMXN: "pesos mexicanos",
};

/** Símbolo de la moneda ("R$" para wBRL). Si no la conocemos, devuelve el código tal cual. */
export function currencySymbol(currency: string): string {
  return SYMBOLS[currency] ?? currency;
}

/** Nombre corriente de la moneda ("reales" para wBRL). */
export function currencyName(currency: string): string {
  return NAMES[currency] ?? currency;
}

/**
 * "R$ 450" a partir de lo que escribió la persona ("450" o "1500,50").
 * Si el monto está vacío o no se entiende devuelve "—" para no mostrar números inventados.
 */
export function formatTypedAmount(
  currency: string,
  typedAmount: string,
): string {
  const units = parseAmountToUnits(typedAmount);
  if (units === null) return "—";
  const symbol = currency ? `${currencySymbol(currency)} ` : "";
  return `${symbol}${formatUnits(units)}`;
}
