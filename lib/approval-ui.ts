// Lógica pura del botón "Aprobar" (PAC-24): cuándo se muestra y qué texto va en cada error.

const APPROVABLE = ["delivered", "reminded"];

/** El botón solo aparece en hitos entregados y si la billetera conectada es la del cliente. */
export function canApprove(
  status: string,
  connected: string | undefined,
  clientWallet: string | null,
): boolean {
  if (!APPROVABLE.includes(status) || !connected || !clientWallet) return false;
  return connected.toLowerCase() === clientWallet.toLowerCase();
}

export const APPROVAL_MESSAGES = {
  rejected: "No se aprobó, podés intentarlo cuando quieras.",
  wrongSigner: "Firmaste con otra billetera. Usá la que usaste para este acuerdo.",
  notApprovable: "Este hito ya no se puede aprobar.",
  generic: "No pudimos registrar la aprobación. Probá de nuevo en un rato.",
} as const;

/** Texto amable según lo que respondió la API. */
export function messageForApproveStatus(httpStatus: number): string {
  if (httpStatus === 403) return APPROVAL_MESSAGES.wrongSigner;
  if (httpStatus === 404 || httpStatus === 409) return APPROVAL_MESSAGES.notApprovable;
  return APPROVAL_MESSAGES.generic;
}

/** ¿La persona canceló la firma en su billetera? (EIP-1193 usa el código 4001). */
export function isUserRejection(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: unknown; name?: unknown; cause?: unknown };
  if (e.code === 4001 || e.name === "UserRejectedRequestError") return true;
  return e.cause !== undefined && e.cause !== error && isUserRejection(e.cause);
}
