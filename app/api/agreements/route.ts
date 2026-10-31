// POST /api/agreements: la freelancer crea un acuerdo con sus hitos (PAC-14).
import { createAgreement } from "@/lib/agreements";
import { getDb } from "@/lib/db";
import { createAgreementSchema } from "@/lib/validation/agreement";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "El pedido no es un JSON válido" }, { status: 400 });
  }

  const parsed = createAgreementSchema.safeParse(body);
  if (!parsed.success) {
    // Devolvemos el primer problema, que es el que la persona tiene que arreglar.
    const issue = parsed.error.issues[0];
    return Response.json(
      { error: issue?.message ?? "Los datos del acuerdo no son válidos", field: issue?.path.join(".") },
      { status: 400 },
    );
  }

  try {
    const created = await createAgreement(getDb(), parsed.data);
    return Response.json(
      {
        id: created.id,
        publicId: created.publicId,
        clientUrl: created.clientUrl,
        // Por JSON los montos viajan como texto.
        totalAmount: created.totalAmount.toString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/agreements", error);
    return Response.json(
      { error: "No pudimos guardar el acuerdo. Probá de nuevo en un rato." },
      { status: 500 },
    );
  }
}
