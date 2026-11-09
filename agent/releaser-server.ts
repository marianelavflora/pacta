// Arma las dependencias reales del liberador (solo servidor). Toda transacción sale por el
// cliente único de lib/chain/wallet.ts, que le pone el tag de atribución (regla 1 de AGENTS.md).
import "server-only";

import type { Address, Hash } from "viem";

import { getDb } from "@/lib/db";
import { erc20Abi, getToken } from "@/lib/chain/tokens";
import { getChain } from "@/lib/chain/chains";
import { assertPayoutCapForMainnet } from "@/lib/chain/mainnet-guard";
import { parseMaxPayoutsByCurrency } from "@/lib/chain/payout-caps";
import {
  getAgentAddress,
  getAgentWalletClient,
  getPublicClient,
} from "@/lib/chain/wallet";
import { onMilestonePaid } from "@/lib/notify/events";
import type { ReleaserDeps } from "./releaser";

const RECEIPT_TIMEOUT_MS = 60_000;

export function getReleaserDeps(): ReleaserDeps {
  const maxPayoutByCurrency = parseMaxPayoutsByCurrency(process.env);
  // En mainnet el tope es obligatorio: sin tope no se paga.
  assertPayoutCapForMainnet(getChain().id, maxPayoutByCurrency);
  const wallet = getAgentWalletClient();
  const pub = getPublicClient();
  const db = getDb();
  return {
    db,
    onPaid: (agreementId, milestoneId) => onMilestonePaid(db, agreementId, milestoneId),
    agentAddress: getAgentAddress(),
    tokenAddress: (currency) => getToken(currency).address,
    // Tope opcional por pago y por moneda, en unidades enteras del token (ej. "500"). Vacío = sin tope.
    maxPayoutByCurrency,
    chain: {
      balanceOf: (token: Address, owner: Address) =>
        pub.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [owner],
        }),
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
        wallet.writeContract({
          address: token,
          abi: erc20Abi,
          functionName: "transfer",
          args: [to, amount],
        }),
      waitForReceipt: async (hash: Hash) => {
        const r = await pub.waitForTransactionReceipt({
          hash,
          timeout: RECEIPT_TIMEOUT_MS,
        });
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
