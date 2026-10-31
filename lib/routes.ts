/**
 * Direcciones de las páginas de Pactá, en un solo lugar.
 * Usalas en vez de escribir "/a/..." a mano: si cambia una ruta,
 * se cambia acá y listo (mapa del código en AGENTS.md).
 */
export const routes = {
  home: "/",
  newAgreement: "/nuevo",
  howItWorks: "/como-funciona",
} as const;

function withId(prefix: string, id: string): string {
  const clean = id.trim();
  if (!clean) throw new Error(`Falta el id para armar la dirección ${prefix}/<id>`);
  return `${prefix}/${encodeURIComponent(clean)}`;
}

/** Vista del cliente de un acuerdo: `/a/<publicId>`. */
export function clientUrl(publicId: string): string {
  return withId("/a", publicId);
}

/** Vista de la freelancer de un acuerdo: `/f/<publicId>`. */
export function freelancerUrl(publicId: string): string {
  return withId("/f", publicId);
}

/** Recibo de un hito: `/recibo/<milestoneId>`. */
export function receiptUrl(milestoneId: string): string {
  return withId("/recibo", milestoneId);
}
