// Arma las dependencias reales del liberador (solo servidor). Toda transacción sale por el
// cliente único de lib/chain/wallet.ts, que le pone el tag de atribución (regla 1 de AGENTS.md).
import "server-only";

import type { Address, Hash } from "viem";

import { getDb } from "@/lib/db";
import { erc20Abi, getToken, parseAmount } from "@/lib/chain/tokens";
import { getAgentAddress, getAgentWalletClient, getPublicClient } from "@/lib/chain/wallet";
import type { ReleaserDeps } from "./releaser";

const RECEIPT_TIMEOUT_MS = 60_000;

export function getReleaserDeps(): ReleaserDeps {
  const wallet = getAgentWalletClient();
  const pub = getPublicClient();
  const cap = process.env.MAX_PAYOUT_PER_MILESTONE;
  return {
    db: getDb(),
    agentAddress: getAgentAddress(),
    tokenAddress: (currency) => getToken(currency).address,
    // Tope opcional por pago, en unidades enteras del token (ej. "500"). Vacío = sin tope.
    maxPayoutPerMilestone: cap ? parseAmount(cap) : undefined,
    chain: {
      balanceOf: (token: Address, owner: Address) =>
        pub.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] }),
      transfer: (token: Address, to: Address, amount: bigint) =>
        wallet.writeContract({ address: token, abi: erc20Abi, functionName: "transfer", args: [to, amount] }),
      waitForReceipt: async (hash: Hash) => {
        const r = await pub.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS });
        return { status: r.status };
      },
      getReceipt: async (hash: Hash) => {
        try {
          const r = await pub.getTransactionReceipt({ hash });
          return { status: r.status };
        } catch {
          return null;
        }
      },
    },
  };
}
