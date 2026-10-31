// Datos de ejemplo para los tests. Nada de esto toca la base ni la blockchain.
// Los nombres de campos siguen las tablas de `supabase/migrations/`.
// `Milestone` toma solo algunos campos de la tabla `milestones` (0002).

import { MILESTONE_STATUSES, type MilestoneStatus } from "@/lib/validation/statuses";

// Los estados del hito vienen de la lista oficial (la misma que usa la base).
export { MILESTONE_STATUSES, type MilestoneStatus };

export type Currency = "wARS" | "wBRL" | "wMXN";

/** Las monedas de Ripio tienen 18 decimales. */
export const DECIMALS = 18;

/**
 * Pasa un monto escrito como texto ("1500" o "12.5") a unidades mínimas en bigint.
 * Solo para armar datos de test: no redondea, falla si hay más de 18 decimales.
 */
export function units(amount: string): bigint {
  const [whole, fraction = ""] = amount.split(".");
  if (fraction.length > DECIMALS) {
    throw new Error(`Más de ${DECIMALS} decimales: ${amount}`);
  }
  return BigInt(whole + fraction.padEnd(DECIMALS, "0"));
}

export const freelancer = {
  id: "00000000-0000-4000-8000-000000000001",
  wallet: "0x1111111111111111111111111111111111111111",
  name: "Flor Freelancer",
  whatsapp: "+5491100000000",
  whatsapp_opt_in: true,
  email: "flor@example.com",
};

export const client = {
  wallet: "0x2222222222222222222222222222222222222222",
  contact: "cliente@example.com",
};

export type Milestone = {
  id: string;
  agreement_id: string;
  position: number;
  title: string;
  amount: bigint;
  status: MilestoneStatus;
};

export type Agreement = {
  id: string;
  public_id: string;
  freelancer_id: string;
  client_wallet: string;
  client_contact: string;
  title: string;
  description: string;
  client_currency: Currency;
  payout_currency: Currency;
  total_amount: bigint;
  status: "pending" | "funded" | "completed" | "cancelled";
  milestones: Milestone[];
};

const AGREEMENT_ID = "00000000-0000-4000-8000-0000000000a1";

/** Un acuerdo en wBRL con 3 hitos. Devuelve una copia nueva cada vez, así los tests no se pisan. */
export function makeAgreement(overrides: Partial<Agreement> = {}): Agreement {
  const milestones: Milestone[] = [
    { title: "Diseño", amount: units("500") },
    { title: "Desarrollo", amount: units("1000") },
    { title: "Entrega final", amount: units("500") },
  ].map((m, i) => ({
    id: `00000000-0000-4000-8000-0000000000b${i + 1}`,
    agreement_id: AGREEMENT_ID,
    position: i + 1,
    title: m.title,
    amount: m.amount,
    status: "pending",
  }));

  return {
    id: AGREEMENT_ID,
    public_id: "demo123",
    freelancer_id: freelancer.id,
    client_wallet: client.wallet,
    client_contact: client.contact,
    title: "Landing para una tienda",
    description: "Diseño y desarrollo de una landing en tres entregas.",
    client_currency: "wBRL",
    payout_currency: "wARS",
    total_amount: milestones.reduce((sum, m) => sum + m.amount, 0n),
    status: "pending",
    milestones,
    ...overrides,
  };
}

/** Un hito en el estado que pidas, con monto de 100 unidades. */
export function makeMilestone(
  status: MilestoneStatus,
  overrides: Partial<Milestone> = {},
): Milestone {
  return {
    id: `00000000-0000-4000-8000-0000000000c${MILESTONE_STATUSES.indexOf(status)}`,
    agreement_id: AGREEMENT_ID,
    position: 1,
    title: `Hito ${status}`,
    amount: units("100"),
    status,
    ...overrides,
  };
}

/** Un hito por cada estado posible, para recorrerlos en los tests. */
export const milestonesByStatus = Object.fromEntries(
  MILESTONE_STATUSES.map((s) => [s, makeMilestone(s)]),
) as Record<MilestoneStatus, Milestone>;
