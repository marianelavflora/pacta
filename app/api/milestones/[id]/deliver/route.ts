// POST /api/milestones/[id]/deliver: la freelancer entrega un hito (PAC-22).
import { getDb } from "@/lib/db";
import { deliverMilestone } from "@/lib/milestones";
import { deliverMilestoneSchema, MILESTONE_ID_PATTERN } from "@/lib/validation/milestone";

export async function POST(request: Request, ctx: RouteContext<"/api/milestones/[id]/deliver">) {
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
  const parsed = deliverMilestoneSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json(
      {
        error: issue?.message ?? "Los datos de la entrega no son válidos",
        field: issue?.path.join("."),
      },
      { status: 400 },
    );
  }

  try {
    const result = await deliverMilestone(getDb(), id, parsed.data);
    switch (result.kind) {
      case "not_found":
        return Response.json({ error: "No encontramos este hito" }, { status: 404 });
      case "forbidden":
        return Response.json(
          { error: "Solo la freelancer del acuerdo puede entregar este hito" },
          { status: 403 },
        );
      case "wrong_status":
        return Response.json({ error: "Este hito todavía no se puede entregar" }, { status: 409 });
      default:
        return Response.json(result.milestone);
    }
  } catch (error) {
    console.error("POST /api/milestones/[id]/deliver", error);
    return Response.json(
      { error: "No pudimos registrar la entrega. Probá de nuevo en un rato." },
      { status: 500 },
    );
  }
}
