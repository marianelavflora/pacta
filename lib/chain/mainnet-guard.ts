// Freno de seguridad para mainnet (chain 42220). Lógica pura, sin red.
//
// Regla de AGENTS.md: nunca se manda una transacción en mainnet sin que Mavi lo apruebe
// explícitamente. Estas dos funciones hacen que, si falta la aprobación o el tope, el agente
// directamente no pueda operar (falla cerrado) en vez de seguir sin límites.

import { celo } from "viem/chains";

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

/** En mainnet el tope por pago es obligatorio: sin MAX_PAYOUT_PER_MILESTONE no se paga. */
export function assertPayoutCapForMainnet(
  chainId: number,
  maxPayout: bigint | undefined,
): void {
  if (!isMainnet(chainId) || maxPayout !== undefined) return;
  throw new Error(
    "Falta MAX_PAYOUT_PER_MILESTONE: en mainnet el tope por pago es obligatorio.",
  );
}
