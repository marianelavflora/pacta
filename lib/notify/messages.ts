// Textos de los avisos de Pactá (PAC-09 y PAC-40).
//
// Un texto por cambio de estado del hito. Los usa Telegram (`telegram.ts`) y
// después el mail de respaldo (PAC-41), así los dos dicen lo mismo.
// Los huecos van entre llaves: `{freelancer}` se reemplaza por el nombre, etc.

export const TEMPLATE_NAMES = [
  "deposit_received",
  "milestone_delivered",
  "review_reminder",
  "milestone_approved",
  "auto_release",
  "milestone_paid",
] as const;

export type TemplateName = (typeof TEMPLATE_NAMES)[number];

type Template = {
  /** A quién le llega. */
  to: "freelancer" | "client";
  /** Estado del hito que dispara el aviso. */
  status: "funded" | "delivered" | "reminded" | "approved" | "expired" | "paid";
  /** Texto con huecos `{nombre}`. */
  text: string;
};

export const TEMPLATES: Record<TemplateName, Template> = {
  deposit_received: {
    to: "freelancer",
    status: "funded",
    text: 'Hola {freelancer}, {client} depositó {amount} para el acuerdo "{agreement}". La plata ya está asegurada y podés arrancar. Ver el acuerdo: {link}',
  },
  milestone_delivered: {
    to: "client",
    status: "delivered",
    text: 'Hola {client}, {freelancer} entregó "{milestone}". Revisalo y aprobalo acá: {link}. Si no respondés en 6 días, el pago se libera solo.',
  },
  review_reminder: {
    to: "client",
    status: "reminded",
    text: 'Hola {client}, {freelancer} te entregó "{milestone}" hace 3 días. Revisalo y aprobalo acá: {link}. Si no respondés en 3 días, el pago se libera solo.',
  },
  milestone_approved: {
    to: "freelancer",
    status: "approved",
    text: 'Hola {freelancer}, {client} aprobó "{milestone}". Estamos preparando tu pago de {amount} y te avisamos cuando llegue.',
  },
  auto_release: {
    to: "client",
    status: "expired",
    text: 'Hola {client}, como no hubo respuesta, liberamos el pago de "{milestone}" a {freelancer}. Ver el recibo: {link}',
  },
  milestone_paid: {
    to: "freelancer",
    status: "paid",
    text: 'Hola {freelancer}, te pagamos "{milestone}": recibiste {amount} con un tipo de cambio de {rate}. Ver el recibo: {link}',
  },
};

/** Huecos que pide una plantilla, en el orden en que aparecen. */
export function templateFields(name: TemplateName): string[] {
  return [...TEMPLATES[name].text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

/**
 * Completa una plantilla con los datos. Si falta un dato devuelve `null`
 * en vez de mandar un mensaje con `{huecos}` sin llenar.
 */
export function renderMessage(name: TemplateName, data: Record<string, string>): string | null {
  const template = TEMPLATES[name];
  if (!template) return null;
  let missing = false;
  const text = template.text.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = data[key];
    if (typeof value !== "string" || value.trim() === "") {
      missing = true;
      return "";
    }
    return value.trim();
  });
  return missing ? null : text;
}
