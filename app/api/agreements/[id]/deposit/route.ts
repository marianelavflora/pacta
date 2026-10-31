// POST /api/agreements/[id]/deposit: el navegador avisa el hash del depósito y la bóveda lo
// verifica en la cadena (PAC-21). Es seguro que sea público: todo se comprueba on-chain.
import { confirmDeposit } from "@/agent/vault";
import { getVaultDeps } from "@/agent/vault-server";
import { PUBLIC_ID_PATTERN } from "@/lib/agreements";

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

const MESSAGES: Record<string, [number, string]> = {
  agreement_not_found: [404, "No encontramos este acuerdo"],
  tx_not_found: [404, "Todavía no vemos esa transacción en la red. Probá de nuevo en un momento."],
  tx_failed: [422, "La transacción falló en la red, no se movió plata."],
  wrong_transfer: [422, "La transacción no es un depósito de la moneda del acuerdo hacia Pactá."],
  no_tag: [422, "La transacción no salió de Pactá, así que no la podemos tomar."],
  wrong_sender: [409, "Este acuerdo ya se está pagando desde otra billetera."],
  tx_used_elsewhere: [409, "Esa transacción ya está asignada a otro acuerdo."],
};

export async function POST(request: Request, ctx: RouteContext<"/api/agreements/[id]/deposit">) {
  const { id } = await ctx.params;
  if (!PUBLIC_ID_PATTERN.test(id)) {
    return Response.json({ error: "El acuerdo no es válido" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "El pedido no es un JSON válido" }, { status: 400 });
  }
  const txHash = (body as { txHash?: unknown } | null)?.txHash;
  if (typeof txHash !== "string" || !TX_HASH.test(txHash)) {
    return Response.json({ error: "Falta el identificador de la transacción" }, { status: 400 });
  }

  try {
    const result = await confirmDeposit(getVaultDeps(), id, txHash as `0x${string}`);
    if (result.kind === "recorded" || result.kind === "already_recorded") return Response.json(result);
    const [status, error] = MESSAGES[result.kind];
    return Response.json({ error }, { status });
  } catch (error) {
    console.error("POST /api/agreements/[id]/deposit", error);
    return Response.json(
      { error: "No pudimos registrar el depósito. Probá de nuevo en un rato." },
      { status: 500 },
    );
  }
}
