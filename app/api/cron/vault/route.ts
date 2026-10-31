// GET /api/cron/vault: barrido de depósitos hacia la bóveda (PAC-21). Solo lectura.
// Protegido con CRON_SECRET: Authorization: Bearer <CRON_SECRET>.
import { timingSafeEqual } from "node:crypto";

import { scanDeposits } from "@/agent/vault";
import { getVaultDeps } from "@/agent/vault-server";

// ~2000 bloques son unos 30 minutos en Celo: cubre de sobra el intervalo del cron.
const DEFAULT_LOOKBACK_BLOCKS = BigInt(2000);

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const lookback = /^\d+$/.test(process.env.VAULT_LOOKBACK_BLOCKS ?? "")
      ? BigInt(process.env.VAULT_LOOKBACK_BLOCKS as string)
      : DEFAULT_LOOKBACK_BLOCKS;
    return Response.json(await scanDeposits(getVaultDeps(), lookback));
  } catch (error) {
    console.error("GET /api/cron/vault", error);
    return Response.json({ error: "No pudimos revisar los depósitos" }, { status: 500 });
  }
}
