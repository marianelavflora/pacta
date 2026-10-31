// Aviso del navegador a la bóveda (PAC-21): "esta transacción es mi depósito".
// La bóveda la verifica en la cadena; acá solo se llama a la API y se traduce el error.

export type NotifyResult = { ok: true } | { ok: false; message: string };

const GENERIC = "No pudimos registrar tu depósito todavía. Tu plata está a salvo: probá de nuevo.";

export async function notifyDeposit(
  publicId: string,
  txHash: string,
  fetchImpl: typeof fetch = fetch,
): Promise<NotifyResult> {
  try {
    const res = await fetchImpl(`/api/agreements/${encodeURIComponent(publicId)}/deposit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ txHash }),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
    return { ok: false, message: typeof body?.error === "string" ? body.error : GENERIC };
  } catch {
    return { ok: false, message: GENERIC };
  }
}
