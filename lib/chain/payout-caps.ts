// Topes de seguridad por pago (variables de entorno). Lógica pura, sin red.

import { parseAmount, type TokenSymbol } from "@/lib/chain/tokens";

const MAX_PAYOUT_VARIABLE = "MAX_PAYOUT_PER_MILESTONE";

/** Tope opcional: vacio = sin tope; si esta mal escrito o es 0, falla (no paga) en vez de ignorarlo. */
export function parseMaxPayout(
  raw: string | undefined,
  variableName: string = MAX_PAYOUT_VARIABLE,
): bigint | undefined {
  const text = raw?.trim();
  if (!text) return undefined;
  if (!/^\d+(\.\d+)?$/.test(text))
    throw new Error(
      `${variableName} invalida: usa un numero positivo, ej. 500`,
    );
  const value = parseAmount(text);
  if (value <= BigInt(0))
    throw new Error(`${variableName} tiene que ser mayor a 0`);
  return value;
}

/**
 * Tope de cada moneda: MAX_PAYOUT_PER_MILESTONE_WARS / _WBRL / _WMXN, o el general
 * MAX_PAYOUT_PER_MILESTONE si la moneda no tiene el suyo.
 */
export function parseMaxPayoutsByCurrency(
  env: Record<string, string | undefined>,
): Record<TokenSymbol, bigint | undefined> {
  const general = parseMaxPayout(env[MAX_PAYOUT_VARIABLE]);
  const forCurrency = (symbol: TokenSymbol) => {
    const name = `${MAX_PAYOUT_VARIABLE}_${symbol.slice(1)}`; // wARS -> _ARS
    return parseMaxPayout(env[name], name) ?? general;
  };
  return { wARS: forCurrency("wARS"), wBRL: forCurrency("wBRL"), wMXN: forCurrency("wMXN") };
}
