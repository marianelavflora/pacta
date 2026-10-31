import { describe, it } from "vitest";

// Se completan cuando existan `lib/chain/wallet.ts` (PAC-05) y `lib/chain/tokens.ts`.
describe("cadena: wallet y tokens", () => {
  it.todo("toda transacción del cliente del agente lleva el tag de atribución");
  it.todo("la red sale de NEXT_PUBLIC_CHAIN (celo-sepolia o celo)");
  it.todo("tokens.ts devuelve las direcciones de la red elegida");
});
