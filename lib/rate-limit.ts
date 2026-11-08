// Limitador de pedidos por IP, simple y en memoria.
//
// Por qué en memoria: es un parche rápido contra abuso (gastar la cuota de la IA o llenar la base
// de acuerdos falsos). En Vercel cada instancia tiene su propia memoria, así que no es perfecto:
// el límite real y global es el Firewall de Vercel. Esto frena lo más burdo sin depender de nada.

export type RateLimit = { max: number; windowMs: number };

const hitsByKey = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 5000; // para que la memoria no crezca sin límite

/** Devuelve true si esta clave ya llegó al máximo de pedidos dentro de la ventana. */
export function isRateLimited(
  key: string,
  limit: RateLimit,
  now: number = Date.now(),
): boolean {
  const recentHits = (hitsByKey.get(key) ?? []).filter(
    (time) => now - time < limit.windowMs,
  );

  if (recentHits.length >= limit.max) {
    hitsByKey.set(key, recentHits);
    return true;
  }

  recentHits.push(now);
  hitsByKey.set(key, recentHits);
  if (hitsByKey.size > MAX_TRACKED_KEYS) forgetExpiredKeys(limit.windowMs, now);
  return false;
}

function forgetExpiredKeys(windowMs: number, now: number): void {
  for (const [key, hits] of hitsByKey) {
    if (hits.every((time) => now - time >= windowMs)) hitsByKey.delete(key);
  }
}

/** Quién está pidiendo: la primera IP de x-forwarded-for (la que pone Vercel), o "desconocido". */
export function clientKey(request: Request): string {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return forwarded || request.headers.get("x-real-ip") || "desconocido";
}

/** Para los tests: vacía la memoria. */
export function resetRateLimits(): void {
  hitsByKey.clear();
}

export const TOO_MANY_REQUESTS = {
  error: "Demasiados pedidos seguidos. Probá de nuevo en un minuto.",
};
