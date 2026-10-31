// Recibo de un hito (PAC-27): lo que se muestra en /recibo/<milestoneId>.
// Recibe el cliente de la base por parámetro para poder probarlo sin red.
// No devuelve contactos, firmas ni datos privados: el link del recibo es público.
import type { SupabaseClient } from "@supabase/supabase-js";

export type ReceiptPayout = {
  /** Lo que recibió la freelancer, en unidades mínimas (texto para no perder precisión). */
  amount: string;
  currency: string;
  txHash: string | null;
  at: string;
};

export type Receipt = {
  milestoneId: string;
  position: number;
  milestoneTitle: string;
  milestoneStatus: string;
  paidAt: string | null;
  agreementTitle: string;
  /** Moneda en que depositó el cliente. */
  clientCurrency: string;
  /** Monto del hito en la moneda del cliente (unidades mínimas, texto). */
  milestoneAmount: string;
  freelancer: { name: string; wallet: string };
  /** El pago confirmado; null si todavía no se pagó. */
  payout: ReceiptPayout | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidReceiptId(value: string): boolean {
  return UUID.test(value);
}

type DbError = { message: string } | null;

function fail(step: string, error: NonNullable<DbError>): never {
  throw new Error(`No se pudo ${step}: ${error.message}`);
}

// Los montos se piden con ::text (PostgREST manda numeric como número JSON y perdería precisión).
function amountText(value: unknown, what: string): string {
  if (typeof value === "string" && /^\d{1,78}$/.test(value)) return BigInt(value).toString();
  throw new Error(`El monto ${what} no es válido`);
}

const textOrNull = (value: unknown) => (typeof value === "string" ? value : null);

/** Devuelve el recibo del hito, o null si el hito no existe. */
export async function getReceiptByMilestoneId(
  db: SupabaseClient,
  milestoneId: string,
): Promise<Receipt | null> {
  if (!isValidReceiptId(milestoneId)) return null;

  const milestone = await db
    .from("milestones")
    .select("id, agreement_id, position, title, amount::text, status, paid_at")
    .eq("id", milestoneId)
    .maybeSingle();
  if (milestone.error) fail("buscar el hito", milestone.error);
  if (!milestone.data) return null;
  const m = milestone.data as Record<string, unknown>;

  const agreement = await db
    .from("agreements")
    .select("title, client_currency, payout_currency, freelancer_id")
    .eq("id", m.agreement_id)
    .single();
  if (agreement.error) fail("buscar el acuerdo", agreement.error);
  const a = agreement.data as Record<string, unknown>;

  const freelancer = await db
    .from("users")
    .select("name, wallet")
    .eq("id", a.freelancer_id)
    .single();
  if (freelancer.error) fail("buscar a la freelancer", freelancer.error);

  const movement = await db
    .from("movements")
    .select("amount_out::text, to_currency, tx_hash, created_at")
    .eq("milestone_id", milestoneId)
    .eq("kind", "payout")
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (movement.error) fail("buscar el pago", movement.error);
  const p = movement.data as Record<string, unknown> | null;

  return {
    milestoneId: m.id as string,
    position: Number(m.position),
    milestoneTitle: m.title as string,
    milestoneStatus: m.status as string,
    paidAt: textOrNull(m.paid_at),
    agreementTitle: a.title as string,
    clientCurrency: a.client_currency as string,
    milestoneAmount: amountText(m.amount, `del hito ${m.position}`),
    freelancer: {
      name: freelancer.data.name as string,
      wallet: freelancer.data.wallet as string,
    },
    payout: p
      ? {
          amount: amountText(p.amount_out, "pagado"),
          currency: textOrNull(p.to_currency) ?? (a.payout_currency as string),
          txHash: textOrNull(p.tx_hash),
          at: p.created_at as string,
        }
      : null,
  };
}
