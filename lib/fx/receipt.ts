// Recibo v2 (PAC-34): el tipo de cambio de un pago, comparado con el precio de referencia.
// Lógica pura: la página le pasa los montos y la referencia y recibe lo que tiene que mostrar.

import { diffBasisPoints, RATE_SCALE } from "./math";

export type ReceiptFx = {
  /** Cuántas unidades de la moneda de cobro se pagaron por cada unidad de la del cliente. */
  paidRate: bigint;
  /** Contra la referencia de hoy (puntos básicos, con signo), o null si no hay referencia. */
  diffBasisPoints: number | null;
};

/**
 * Devuelve el tipo de cambio efectivo del pago, o null si no hubo cambio de moneda
 * (misma moneda de los dos lados) o si los montos no permiten calcularlo.
 */
export function describeReceiptFx(input: {
  clientCurrency: string;
  payoutCurrency: string;
  milestoneAmount: bigint;
  paidAmount: bigint;
  referenceRate: bigint | null;
}): ReceiptFx | null {
  const {
    clientCurrency,
    payoutCurrency,
    milestoneAmount,
    paidAmount,
    referenceRate,
  } = input;
  if (clientCurrency === payoutCurrency) return null;
  if (milestoneAmount <= BigInt(0) || paidAmount <= BigInt(0)) return null;

  const paidRate = (paidAmount * RATE_SCALE) / milestoneAmount;
  return {
    paidRate,
    diffBasisPoints:
      referenceRate === null ? null : diffBasisPoints(paidRate, referenceRate),
  };
}
