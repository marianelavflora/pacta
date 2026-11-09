// POST /api/cron/releaser: paga los hitos aprobados (PAC-26). MANDA FONDOS, por eso solo con
// CRON_SECRET: Authorization: Bearer <CRON_SECRET>. Body opcional: { "milestoneId": "<uuid>" }
// para pagar uno solo (por ejemplo justo después de aprobar). GET hace el barrido (Vercel Cron).
import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { releaseApproved, releaseMilestone } from "@/agent/releaser";
import { runReminders } from "@/agent/reminders";
import { getReleaserDeps } from "@/agent/releaser-server";

// Un cambio de moneda con Textile son 4 transacciones y esperas de hasta ~70 s por cotización: más que el tope por defecto.
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

const bodySchema = z.object({ milestoneId: z.string().uuid().optional() });

async function handle(milestoneId?: string) {
  try {
    const deps = getReleaserDeps();
    if (milestoneId) return Response.json(await releaseMilestone(deps, milestoneId));
    // Barrido completo: primero los recordatorios (los hitos que pasan a `expired` se pagan en
    // este mismo barrido), después los pagos.
    const reminders = await runReminders(deps.db);
    return Response.json({ reminders, ...(await releaseApproved(deps)) });
  } catch (error) {
    console.error("/api/cron/releaser", error);
    return Response.json(
      { error: "No pudimos procesar los pagos" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request))
    return Response.json({ error: "No autorizado" }, { status: 401 });
  return handle();
}

export async function POST(request: Request) {
  if (!isAuthorized(request))
    return Response.json({ error: "No autorizado" }, { status: 401 });
  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw ?? {});
  if (!parsed.success)
    return Response.json({ error: "milestoneId invalido" }, { status: 400 });
  return handle(parsed.data.milestoneId);
}
