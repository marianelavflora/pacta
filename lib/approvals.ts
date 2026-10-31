// Aprobar un hito con la firma del cliente (PAC-25). No mueve plata: eso lo hace el liberador.
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyTypedData, type Hex } from "viem";
import { buildApprovalTypedData } from "@/lib/chain/approval";

export type ApprovedMilestone = {
  id: string;
  status: string;
  amount: string;
  approvedAt: string | null;
};

export type ApproveResult =
  | { kind: "approved"; milestone: ApprovedMilestone }
  // Ya estaba aprobado (o más adelante): devolvemos lo guardado sin pisarlo.
  | { kind: "already_approved"; milestone: ApprovedMilestone }
  | { kind: "not_found" }
  | { kind: "no_client_wallet" }
  | { kind: "forbidden" }
  | { kind: "wrong_status"; status: string };

const COLUMNS = "id, agreement_id, position, status, amount::text, approved_at";
// Estados en los que el cliente todavía puede aprobar, y los que ya pasaron por la aprobación.
const APPROVABLE = ["delivered", "reminded"];
const ALREADY = ["approved", "converting", "paid"];

type DbError = { message: string } | null;
function fail(step: string, error: NonNullable<DbError>): never {
  throw new Error(`No se pudo ${step}: ${error.message}`);
}

function toPublic(row: Record<string, unknown>): ApprovedMilestone {
  return {
    id: row.id as string,
    status: row.status as string,
    amount: String(row.amount),
    approvedAt: typeof row.approved_at === "string" ? row.approved_at : null,
  };
}

export async function approveMilestone(
  db: SupabaseClient,
  milestoneId: string,
  signature: string,
  chainId: number,
): Promise<ApproveResult> {
  const found = await db.from("milestones").select(COLUMNS).eq("id", milestoneId).maybeSingle();
  if (found.error) fail("buscar el hito", found.error);
  if (!found.data) return { kind: "not_found" };
  const row = found.data as Record<string, unknown>;

  const agreement = await db
    .from("agreements")
    .select("public_id, client_wallet, client_currency")
    .eq("id", row.agreement_id)
    .single();
  if (agreement.error) fail("buscar el acuerdo", agreement.error);
  const clientWallet = agreement.data.client_wallet as string | null;
  if (!clientWallet) return { kind: "no_client_wallet" };

  // Primero la firma: así nadie que no sea el cliente se entera del estado del hito.
  const typed = buildApprovalTypedData({
    chainId,
    agreementPublicId: agreement.data.public_id as string,
    milestoneId: row.id as string,
    position: Number(row.position),
    amount: BigInt(String(row.amount)),
    currency: agreement.data.client_currency as string,
  });
  let valid = false;
  try {
    valid = await verifyTypedData({
      address: clientWallet as Hex,
      signature: signature as Hex,
      ...typed,
    });
  } catch {
    valid = false;
  }
  if (!valid) return { kind: "forbidden" };

  const status = row.status as string;
  if (ALREADY.includes(status)) return { kind: "already_approved", milestone: toPublic(row) };
  if (!APPROVABLE.includes(status)) return { kind: "wrong_status", status };

  // Update condicional por estado: si otro pedido cambió el hito justo antes, no pisamos nada.
  const updated = await db
    .from("milestones")
    .update({
      status: "approved",
      approval_signature: signature,
      approved_at: new Date().toISOString(),
    })
    .eq("id", milestoneId)
    .in("status", APPROVABLE)
    .select(COLUMNS)
    .maybeSingle();
  if (updated.error) fail("aprobar el hito", updated.error);
  if (updated.data) {
    return { kind: "approved", milestone: toPublic(updated.data as Record<string, unknown>) };
  }

  const again = await db.from("milestones").select(COLUMNS).eq("id", milestoneId).maybeSingle();
  if (again.error) fail("buscar el hito", again.error);
  if (!again.data) return { kind: "not_found" };
  const current = again.data as Record<string, unknown>;
  if (ALREADY.includes(current.status as string)) {
    return { kind: "already_approved", milestone: toPublic(current) };
  }
  return { kind: "wrong_status", status: current.status as string };
}
