"use client";

import { useState } from "react";
import { useAccount, useChainId, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { formatUnits } from "@/lib/amounts";
import { getChain, getChainName, txUrl } from "@/lib/chain/chains";
import {
  AGENT_ADDRESS,
  depositDataSuffix,
  friendlyDepositError,
  getAttributionTag,
  validateDepositAmount,
} from "@/lib/chain/deposit";
import { erc20Abi, getToken, type TokenSymbol } from "@/lib/chain/tokens";

/**
 * Depósito del cliente: un `transfer` ERC-20 a la wallet del agente, firmado en su billetera
 * y con el tag de atribución (`dataSuffix`) en cada envío. Puede hacerse en partes.
 * No marca nada como "depositado": eso lo detecta la bóveda (PAC-21).
 */
export function DepositButton({
  currency,
  remaining,
}: {
  currency: TokenSymbol;
  /** Lo que falta depositar, en unidades mínimas (texto). */
  remaining: string;
}) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { writeContractAsync, isPending: signing, data: hash, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  const remainingUnits = BigInt(remaining);
  const [text, setText] = useState(() => formatUnits(remainingUnits).replace(/\./g, ""));
  const [error, setError] = useState<string | null>(null);

  const target = getChain();
  const token = getToken(currency);
  const wrongNetwork = isConnected && chainId !== target.id;
  const sending = !!hash && receipt.isLoading;
  const done = !!hash && receipt.isSuccess;

  async function deposit() {
    setError(null);
    const check = validateDepositAmount(text);
    if (!check.ok) return setError(check.error);
    try {
      await writeContractAsync({
        address: token.address,
        abi: erc20Abi,
        functionName: "transfer",
        args: [AGENT_ADDRESS, check.amount],
        chainId: target.id,
        // Tag de atribución: en el navegador va como dataSuffix (nunca withAttribution).
        dataSuffix: depositDataSuffix(getAttributionTag()),
      });
    } catch (e) {
      setError(friendlyDepositError(e));
    }
  }

  if (!isConnected) {
    return <p className="text-sm text-muted-foreground">Conectá tu billetera (arriba) para depositar.</p>;
  }

  if (wrongNetwork) {
    return (
      <div className="flex flex-col gap-2">
        <p role="alert" className="text-sm text-destructive">
          Tu billetera está en otra red. Cambiala a {target.name} para depositar.
        </p>
        <Button size="lg" disabled={switching} onClick={() => switchChain({ chainId: target.id })}>
          {switching ? "Cambiando…" : `Cambiar a ${target.name}`}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Monto a depositar ({token.symbol})
        <input
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={signing || sending}
          className="rounded-lg border bg-background px-3 py-2 text-base"
        />
        <span className="text-xs text-muted-foreground">
          Podés depositar todo junto o en partes. Falta depositar {formatUnits(remainingUnits)} {token.symbol}.
        </span>
      </label>

      <Button size="lg" disabled={signing || sending} onClick={deposit}>
        {signing ? "Confirmá en tu billetera…" : sending ? "Enviando…" : "Depositar"}
      </Button>

      {sending && <p className="text-sm text-muted-foreground">Enviando tu depósito a la red…</p>}
      {done && (
        <p role="status" className="text-sm">
          Listo, tu depósito salió. En unos instantes el agente lo registra.{" "}
          <a className="underline" href={txUrl(hash, getChainName())} target="_blank" rel="noreferrer">
            Ver en el explorador
          </a>{" "}
          ·{" "}
          <button type="button" className="underline" onClick={() => reset()}>
            Hacer otro depósito
          </button>
        </p>
      )}
      {hash && receipt.isError && (
        <p role="alert" className="text-sm text-destructive">
          No pudimos confirmar el depósito.{" "}
          <a className="underline" href={txUrl(hash, getChainName())} target="_blank" rel="noreferrer">
            Revisalo en el explorador
          </a>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
