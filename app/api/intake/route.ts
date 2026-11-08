// POST /api/intake: de un texto libre a un borrador de acuerdo (PAC-35).
// La IA solo propone hitos: no crea el acuerdo ni mueve plata. El formulario lo revisa.
import {
  MAX_INTAKE_TEXT_LENGTH,
  IntakeError,
  extractAgreementDraft,
} from "@/lib/intake/extract";
import { clientKey, isRateLimited, TOO_MANY_REQUESTS } from "@/lib/rate-limit";

// Cada pedido gasta cuota de la IA: pocos por minuto por IP.
const INTAKE_LIMIT = { max: 8, windowMs: 60_000 };

export async function POST(request: Request) {
  if (isRateLimited(`intake:${clientKey(request)}`, INTAKE_LIMIT)) {
    return Response.json(TOO_MANY_REQUESTS, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "El pedido no es un JSON válido" },
      { status: 400 },
    );
  }

  const text = (body as { text?: unknown } | null)?.text;
  if (typeof text !== "string" || !text.trim()) {
    return Response.json(
      { error: "Contanos qué trabajo vas a hacer" },
      { status: 400 },
    );
  }
  if (text.length > MAX_INTAKE_TEXT_LENGTH) {
    return Response.json(
      {
        error: `El texto es muy largo. Resumilo en menos de ${MAX_INTAKE_TEXT_LENGTH} caracteres.`,
      },
      { status: 400 },
    );
  }

  try {
    const draft = await extractAgreementDraft(text);
    return Response.json(draft);
  } catch (error) {
    if (error instanceof IntakeError && error.kind === "no_key") {
      return Response.json(
        {
          error:
            "La lectura con IA todavía no está disponible. Completá el formulario a mano.",
        },
        { status: 503 },
      );
    }
    if (error instanceof IntakeError && error.kind === "invalid_output") {
      return Response.json(
        {
          error:
            "No pudimos armar los hitos con ese texto. Probá contándolo con más detalle o completá el formulario a mano.",
        },
        { status: 422 },
      );
    }
    // Mostramos la causa real (por ejemplo "API key not valid") para poder diagnosticar en Vercel.
    // Solo el mensaje de la causa (por ejemplo "404 modelo no encontrado"): el objeto completo del
    // error del SDK puede traer cabeceras o la URL del pedido, y no queremos eso en los logs.
    const causeMessage =
      error instanceof Error && error.cause instanceof Error
        ? error.cause.message
        : undefined;
    console.error(
      "POST /api/intake",
      error instanceof Error ? error.message : "error",
      "causa:",
      causeMessage,
    );
    return Response.json(
      {
        error:
          "No pudimos leer el texto ahora. Probá de nuevo en un rato o completá el formulario a mano.",
      },
      { status: 502 },
    );
  }
}
