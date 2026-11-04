// Arma las dependencias reales del liberador (solo servidor). Toda transacción sale por el
// cliente único de lib/chain/wallet.ts, que le pone el tag de atribución (regla 1 de AGENTS.md).
import "server-only";

import type { Address, Hash } from "viem";

import { getDb } from "@/lib/db";
import { erc20Abi, getToken, parseAmount } from "@/lib/chain/tokens";
import { getAgentAddress, getAgentWalletClient, getPublicClient } from "@/lib/chain/wallet";
import type { ReleaserDeps } from "./releaser";

const RECEIPT_TIMEOUT_MS = 60_000;

/** Tope opcional: vacio = sin tope; si esta mal escrito o es 0, falla (no paga) en vez de ignorarlo. */
export function parseMaxPayout(raw: string | undefined): bigint | undefined {
  const text = raw?.trim();
  if (!text) return undefined;
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error("MAX_PAYOUT_PER_MILESTONE invalida: usa un numero positivo, ej. 500");
  const value = parseAmount(text);
  if (value <= BigInt(0)) throw new Error("MAX_PAYOUT_PER_MILESTONE tiene que ser mayor a 0");
  return value;
}

export function getReleaserDeps(): ReleaserDeps {
  const wallet = getAgentWalletClient();
  const pub = getPublicClient();
  return {
    db: getDb(),
    agentAddress: getAgentAddress(),
    tokenAddress: (currency) => getToken(currency).address,
    // Tope opcional por pago, en unidades enteras del token (ej. "500"). Vacío = sin tope.
    maxPayoutPerMilestone: parseMaxPayout(process.env.MAX_PAYOUT_PER_MILESTONE),
    chain: {
      balanceOf: (token: Address, owner: Address) =>
        pub.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] }),
      simulateTransfer: async (token: Address, to: Address, amount: bigint) => {
        await pub.simulateContract({
          account: wallet.account,
          address: token,
          abi: erc20Abi,
          functionName: "transfer",
          args: [to, amount],
        });
      },
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
