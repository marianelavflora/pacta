// POST /api/milestones/[id]/approve: el cliente aprueba un hito con su firma (PAC-25).
// No paga: solo deja el hito en "approved". El pago lo hace el liberador.
import { approveMilestone } from "@/lib/approvals";
import { getChain } from "@/lib/chain/chains";
import { getDb } from "@/lib/db";
import { approveMilestoneSchema, MILESTONE_ID_PATTERN } from "@/lib/validation/milestone";

export async function POST(request: Request, ctx: RouteContext<"/api/milestones/[id]/approve">) {
  const { id } = await ctx.params;
  if (!MILESTONE_ID_PATTERN.test(id)) {
    return Response.json({ error: "El hito no es válido" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "El pedido no es un JSON válido" }, { status: 400 });
  }
  const parsed = approveMilestoneSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "La firma no es válida", field: "signature" },
      { status: 400 },
    );
  }

  try {
    const result = await approveMilestone(getDb(), id, parsed.data.signature, getChain().id);
    switch (result.kind) {
      case "not_found":
        return Response.json({ error: "No encontramos este hito" }, { status: 404 });
      case "no_client_wallet":
        return Response.json(
          { error: "El cliente todavía no conectó su billetera a este acuerdo" },
          { status: 409 },
        );
      case "forbidden":
        return Response.json(
          { error: "La firma no es de la billetera del cliente de este acuerdo" },
          { status: 403 },
        );
      case "wrong_status":
        return Response.json({ error: "Este hito todavía no se puede aprobar" }, { status: 409 });
      default:
        return Response.json(result.milestone);
    }
  } catch (error) {
    console.error("POST /api/milestones/[id]/approve", error);
    return Response.json(
      { error: "No pudimos registrar la aprobación. Probá de nuevo en un rato." },
      { status: 500 },
    );
  }
}
