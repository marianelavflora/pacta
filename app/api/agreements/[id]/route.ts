// GET /api/agreements/[id]: el acuerdo con sus hitos, para la vista del cliente
// y la de la freelancer (PAC-15). El [id] es el public_id del link.
import { getAgreementByPublicId, isValidPublicId } from "@/lib/agreements";
import { getDb } from "@/lib/db";

export async function GET(_request: Request, ctx: RouteContext<"/api/agreements/[id]">) {
  const { id } = await ctx.params;

  if (!isValidPublicId(id)) {
    return Response.json({ error: "El link del acuerdo no es válido" }, { status: 400 });
  }

  try {
    const agreement = await getAgreementByPublicId(getDb(), id);
    if (!agreement) {
      return Response.json({ error: "No encontramos este acuerdo" }, { status: 404 });
    }
    return Response.json(agreement);
  } catch (error) {
    console.error("GET /api/agreements/[id]", error);
    return Response.json(
      { error: "No pudimos leer el acuerdo. Probá de nuevo en un rato." },
      { status: 500 },
    );
  }
}
