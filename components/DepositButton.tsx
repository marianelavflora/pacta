"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import { notifyDeposit } from "@/lib/deposit-notify";
import { erc20Abi, getToken, type TokenSymbol } from "@/lib/chain/tokens";

/**
 * Depósito del cliente: un `transfer` ERC-20 a la wallet del agente, firmado en su billetera
 * y con el tag de atribución (`dataSuffix`) en cada envío. Puede hacerse en partes.
 * Al confirmarse la transacción avisa a la bóveda (PAC-21), que la verifica en la cadena.
 */
export function DepositButton({
  publicId,
  currency,
  remaining,
}: {
  /** Id público del acuerdo (para avisar a la bóveda). */
  publicId: string;
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
  const router = useRouter();
  const [notified, setNotified] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [notifying, setNotifying] = useState(false);
  const notifyStarted = useRef<string | null>(null); // hash ya avisado (evita avisar dos veces)
  const busy = useRef(false); // evita dos envíos por doble clic antes de que React re-renderice

  const target = getChain();
  const token = getToken(currency);
  const wrongNetwork = isConnected && chainId !== target.id;
  const sending = !!hash && receipt.isLoading;
  const done = !!hash && receipt.isSuccess;

  async function notify(txHash: string) {
    setNotifying(true);
    setNotifyError(null);
    const result = await notifyDeposit(publicId, txHash);
    setNotifying(false);
    if (result.ok) {
      setNotified(true);
      router.refresh();
    } else {
      notifyStarted.current = null; // permite reintentar a mano
      setNotifyError(result.message);
    }
  }

  useEffect(() => {
    if (!hash || !receipt.isSuccess || notifyStarted.current === hash) return;
    notifyStarted.current = hash;
    setNotified(false);
    void notify(hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, receipt.isSuccess]);

  async function deposit() {
    if (busy.current) return;
    setError(null);
    const check = validateDepositAmount(text);
    if (!check.ok) return setError(check.error);
    busy.current = true;
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
    } finally {
      busy.current = false;
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
          {notified
            ? "Listo, el agente ya registró tu depósito."
            : notifying
              ? "Tu depósito salió. Lo estamos registrando…"
              : "Tu depósito salió."}{" "}
          <a className="underline" href={txUrl(hash, getChainName())} target="_blank" rel="noreferrer">
            Ver en el explorador
          </a>{" "}
          ·{" "}
          <button type="button" className="underline" onClick={() => reset()}>
            Hacer otro depósito
          </button>
        </p>
      )}
      {done && notifyError && (
        <p role="alert" className="text-sm text-destructive">
          {notifyError}{" "}
          <button type="button" className="underline" disabled={notifying} onClick={() => hash && notify(hash)}>
            Reintentar
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
