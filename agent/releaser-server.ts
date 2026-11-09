// Arma las dependencias reales del liberador (solo servidor). Toda transacción sale por el
// cliente único de lib/chain/wallet.ts, que le pone el tag de atribución (regla 1 de AGENTS.md).
import "server-only";

import type { Address, Hash } from "viem";

import { getDexConfig } from "@/lib/chain/dex";
import { convertUnits } from "@/lib/fx/math";
import { getBestQuote } from "@/lib/fx/quote";
import { referenceSource } from "@/lib/fx/sources";
import { createTextileSource } from "@/lib/fx/textile";
import { convertViaTextile, type TextileSwapDeps } from "@/lib/fx/textile-swap";

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
import type { Converter, ReleaserDeps } from "./releaser";

const RECEIPT_TIMEOUT_MS = 60_000;

/**
 * El cambio de moneda con Textile (PAC-32). Solo existe en mainnet: en testnet no hay Textile, no se arma
 * y un acuerdo con monedas distintas queda en `needs_conversion`. Toda transacción sale por el cliente
 * único del agente (con el tag del equipo).
 */
function buildConverter(
  wallet: ReturnType<typeof getAgentWalletClient>,
  pub: ReturnType<typeof getPublicClient>,
): Converter | undefined {
  const dex = getDexConfig();
  if (!dex) return undefined;
  const agent = getAgentAddress();

  const swapDeps: TextileSwapDeps = {
    chainId: getChain().id,
    agent,
    allowedContracts: dex.textileContracts,
    chain: {
      balanceOf: (token) =>
        pub.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [agent] }),
      allowance: (token, spender) =>
        pub.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [agent, spender] }),
      send: ({ to, data }) => wallet.sendTransaction({ to, data, value: BigInt(0) }),
      waitForReceipt: async (hash) => {
        const r = await pub.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS });
        return { status: r.status };
      },
      signTypedData: (typed) => wallet.signTypedData(typed),
    },
  };

  return {
    estimate: async (from, to, amountIn) => {
      // Solo se cambia si Textile es de verdad la mejor ruta y su precio es razonable frente a la referencia.
      const quote = await getBestQuote(from, to, [createTextileSource(), referenceSource], amountIn);
      return quote.route === "textile" ? convertUnits(amountIn, quote.rate) : null;
    },
    convert: async ({ from, to, amountIn, minAmountOut }, onProgress) => {
      const result = await convertViaTextile(
        swapDeps,
        {
          fromToken: getToken(from).address,
          toToken: getToken(to).address,
          usdt: dex.usdt.address,
          amountIn,
          minAmountOut,
        },
        onProgress,
      );
      return { amountOut: result.amountOut, finalTxHash: result.finalTxHash, legs: result.legs };
    },
  };
}

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
    converter: buildConverter(wallet, pub),
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
