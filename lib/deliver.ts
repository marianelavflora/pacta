// Lógica pura de la pantalla "Entregar hito" (PAC-23). El POST es el de PAC-22.

/** El botón "Entregar" solo se muestra en un hito depositado y a la freelancer del acuerdo. */
export function canDeliver(
  status: string,
  connectedWallet: string | undefined,
  freelancerWallet: string,
): boolean {
  return (
    status === "funded" &&
    !!connectedWallet &&
    connectedWallet.toLowerCase() === freelancerWallet.toLowerCase()
  );
}

/** Revisa el link antes de mandarlo. Devuelve un aviso en castellano o undefined. */
export function validateDeliveryUrl(value: string): string | undefined {
  const text = value.trim();
  if (!text) return "Pegá el link de tu entrega.";
  try {
    if (new URL(text).protocol !== "https:") throw new Error("no https");
  } catch {
    return "El link tiene que empezar con https://";
  }
  return undefined;
}

/** Mensaje amable según lo que respondió la API de entregar. */
export function deliverErrorMessage(status: number, apiError?: string): string {
  if (status === 403) return "Esta billetera no es la de la freelancer de este acuerdo.";
  if (status === 404) return "No encontramos este hito. Recargá la página.";
  if (status === 409) return "Este hito todavía no se puede entregar. Recargá la página.";
  if (status === 400 && apiError) return apiError;
  return "No pudimos registrar la entrega. Probá de nuevo en un rato.";
}
