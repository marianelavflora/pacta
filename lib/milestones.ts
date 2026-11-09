// Entregar un hito (PAC-22). Recibe la base por parámetro para probarlo sin red.
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyTypedData, type Hex } from "viem";
import { buildDeliveryTypedData } from "@/lib/chain/delivery";
import { onMilestoneDelivered } from "@/lib/notify/events";
import type { DeliverMilestoneInput } from "@/lib/validation/milestone";

export type DeliveredMilestone = {
  id: string;
  status: string;
  amount: string;
  deliveryUrl: string | null;
  deliveryNote: string | null;
  deliveredAt: string | null;
};

export type DeliverResult =
  | { kind: "delivered"; milestone: DeliveredMilestone }
  // Ya estaba entregado: devolvemos lo guardado sin pisarlo.
  | { kind: "already_delivered"; milestone: DeliveredMilestone }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "wrong_status"; status: string };

// Columnas a mano (nunca "*"). El monto va ::text: PostgREST manda numeric como número JSON.
const COLUMNS = "id, agreement_id, position, status, amount::text, delivery_url, delivery_note, delivered_at";

type DbError = { message: string } | null;
function fail(step: string, error: NonNullable<DbError>): never {
  throw new Error(`No se pudo ${step}: ${error.message}`);
}

const textOrNull = (value: unknown) => (typeof value === "string" ? value : null);

function toPublic(row: Record<string, unknown>): DeliveredMilestone {
  return {
    id: row.id as string,
    status: row.status as string,
    amount: String(row.amount),
    deliveryUrl: textOrNull(row.delivery_url),
    deliveryNote: textOrNull(row.delivery_note),
    deliveredAt: textOrNull(row.delivered_at),
  };
}

export async function deliverMilestone(
  db: SupabaseClient,
  milestoneId: string,
  input: DeliverMilestoneInput,
  chainId: number,
): Promise<DeliverResult> {
  const found = await db.from("milestones").select(COLUMNS).eq("id", milestoneId).maybeSingle();
  if (found.error) fail("buscar el hito", found.error);
  if (!found.data) return { kind: "not_found" };
  const row = found.data as Record<string, unknown>;

  // Solo la freelancer del acuerdo puede entregar, y lo prueba con su firma (no con decir cuál es su wallet).
  const agreement = await db
    .from("agreements")
    .select("public_id, freelancer_id")
    .eq("id", row.agreement_id)
    .single();
  if (agreement.error) fail("buscar el acuerdo", agreement.error);
  const freelancer = await db
    .from("users")
    .select("wallet")
    .eq("id", agreement.data.freelancer_id)
    .single();
  if (freelancer.error) fail("buscar a la freelancer", freelancer.error);

  // Primero la firma: así nadie que no sea la freelancer se entera del estado del hito.
  const typed = buildDeliveryTypedData({
    chainId,
    agreementPublicId: agreement.data.public_id as string,
    milestoneId: row.id as string,
    position: Number(row.position),
    deliveryUrl: input.deliveryUrl,
  });
  let valid = false;
  try {
    valid = await verifyTypedData({
      address: freelancer.data.wallet as Hex,
      signature: input.signature as Hex,
      ...typed,
    });
  } catch {
    valid = false;
  }
  if (!valid) return { kind: "forbidden" };

  if (row.status === "delivered") return { kind: "already_delivered", milestone: toPublic(row) };
  if (row.status !== "funded") return { kind: "wrong_status", status: row.status as string };

  // Condicionamos el update a que siga en "funded": si otro pedido lo entregó justo
  // antes, no devuelve fila y no pisamos nada.
  const updated = await db
    .from("milestones")
    .update({
      status: "delivered",
      delivery_url: input.deliveryUrl,
      delivery_note: input.deliveryNote ?? null,
      delivered_at: new Date().toISOString(),
    })
    .eq("id", milestoneId)
    .eq("status", "funded")
    .select(COLUMNS)
    .maybeSingle();
  if (updated.error) fail("entregar el hito", updated.error);
  if (updated.data) {
    await onMilestoneDelivered(db, row.agreement_id as string, milestoneId); // nunca tira error
    return { kind: "delivered", milestone: toPublic(updated.data as Record<string, unknown>) };
  }

  const again = await db.from("milestones").select(COLUMNS).eq("id", milestoneId).maybeSingle();
  if (again.error) fail("buscar el hito", again.error);
  if (!again.data) return { kind: "not_found" };
  const current = again.data as Record<string, unknown>;
  if (current.status === "delivered") {
    return { kind: "already_delivered", milestone: toPublic(current) };
  }
  return { kind: "wrong_status", status: current.status as string };
}
