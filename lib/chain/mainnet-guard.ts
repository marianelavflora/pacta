// Freno de seguridad para mainnet (chain 42220). Lógica pura, sin red.
//
// Regla de AGENTS.md: nunca se manda una transacción en mainnet sin que Mavi lo apruebe
// explícitamente. Estas dos funciones hacen que, si falta la aprobación o el tope, el agente
// directamente no pueda operar (falla cerrado) en vez de seguir sin límites.

import { celo } from "viem/chains";

import type { TokenSymbol } from "@/lib/chain/tokens";

const TOKEN_SYMBOLS: TokenSymbol[] = ["wARS", "wBRL", "wMXN"];

const APPROVED_VALUES = ["yes", "true", "1"];

export function isMainnet(chainId: number): boolean {
  return chainId === celo.id;
}

/** En mainnet exige APPROVED_MAINNET=yes (o true/1). En testnet no hace falta nada. */
export function assertMainnetApproved(
  chainId: number,
  approvedValue: string | undefined,
): void {
  if (!isMainnet(chainId)) return;
  if (APPROVED_VALUES.includes((approvedValue ?? "").trim().toLowerCase()))
    return;
  throw new Error(
    "Mainnet no aprobada: poné APPROVED_MAINNET=yes cuando Mavi lo autorice. Hasta entonces el agente no opera en mainnet.",
  );
}

/**
 * En mainnet cada moneda tiene que tener su tope por pago: sin tope no se paga en esa moneda.
 * El tope sale de MAX_PAYOUT_PER_MILESTONE_<MONEDA> o, si no está, de MAX_PAYOUT_PER_MILESTONE.
 */
export function assertPayoutCapForMainnet(
  chainId: number,
  capsByCurrency: Partial<Record<TokenSymbol, bigint>>,
): void {
  if (!isMainnet(chainId)) return;
  const missing = TOKEN_SYMBOLS.filter(
    (symbol) => capsByCurrency[symbol] === undefined,
  );
  if (missing.length === 0) return;
  throw new Error(
    `Falta el tope por pago para ${missing.join(", ")}: en mainnet es obligatorio. Poné MAX_PAYOUT_PER_MILESTONE (para todas) o MAX_PAYOUT_PER_MILESTONE_<MONEDA> (por ejemplo MAX_PAYOUT_PER_MILESTONE_WARS).`,
  );
}
