// Arma las dependencias reales de la bóveda (solo servidor). Solo lectura: no usa AGENT_PRIVATE_KEY
// para firmar nada; getAgentAddress() solo deriva la dirección pública.
import "server-only";

import { getDb } from "@/lib/db";
import { getAgentAddress, getPublicClient } from "@/lib/chain/wallet";
import { getToken } from "@/lib/chain/tokens";
import { getAttributionTag } from "@/lib/chain/deposit";
import type { VaultDeps } from "./vault";

export function getVaultDeps(): VaultDeps {
  return {
    db: getDb(),
    client: getPublicClient() as unknown as VaultDeps["client"],
    agentAddress: getAgentAddress(),
    tag: getAttributionTag(),
    tokenAddress: (currency) => getToken(currency).address,
  };
}
