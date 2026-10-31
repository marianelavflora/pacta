"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useSignTypedData, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import {
  APPROVAL_MESSAGES,
  canApprove,
  isUserRejection,
  messageForApproveStatus,
} from "@/lib/approval-ui";
import { formatUnits } from "@/lib/amounts";
import { buildApprovalTypedData } from "@/lib/chain/approval";
import { getChain } from "@/lib/chain/chains";

type ApproveButtonProps = {
  milestoneId: string;
  agreementPublicId: string;
  position: number;
  title: string;
  /** Unidades mínimas, como texto. */
  amount: string;
  currency: string;
  status: string;
  clientWallet: string | null;
  freelancerName: string;
};

/**
 * Aprobar un hito con la firma del cliente. Firmar no cuesta nada ni mueve plata:
 * solo prueba que fue el cliente. El pago lo hace después el agente.
 */
export function ApproveButton(props: ApproveButtonProps) {
  const { address } = useAccount();
  const walletChainId = useChainId();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const { signTypedDataAsync, isPending: signing } = useSignTypedData();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canApprove(props.status, address, props.clientWallet)) return null;

  const chainId = getChain().id;
  const wrongNetwork = walletChainId !== chainId;
  const busy = signing || sending || switching;
  const amountText = `${formatUnits(BigInt(props.amount))} ${props.currency}`;

  async function approve() {
    setError(null);
    try {
      if (wrongNetwork) await switchChainAsync({ chainId });
      const signature = await signTypedDataAsync(
        buildApprovalTypedData({
          chainId,
          agreementPublicId: props.agreementPublicId,
          milestoneId: props.milestoneId,
          position: props.position,
          amount: BigInt(props.amount),
          currency: props.currency,
        }),
      );
      setSending(true);
      const res = await fetch(`/api/milestones/${props.milestoneId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signature }),
      });
      if (!res.ok) {
        setError(messageForApproveStatus(res.status));
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch (e) {
      setError(isUserRejection(e) ? APPROVAL_MESSAGES.rejected : APPROVAL_MESSAGES.generic);
    } finally {
      setSending(false);
    }
  }

  if (!confirming) {
    return (
      <Button size="lg" onClick={() => setConfirming(true)}>
        Aprobar y liberar el pago
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        Vas a aprobar «{props.title}». Se le van a pagar {amountText} a {props.freelancerName}.
        ¿Seguimos?
      </p>
      <p className="text-sm text-muted-foreground">
        Firmar no cuesta nada: solo prueba que fuiste vos.
      </p>
      {wrongNetwork && (
        <p className="text-sm text-muted-foreground">
          Tu billetera está en otra red. Te la vamos a pedir cambiar.
        </p>
      )}
      <div className="flex gap-2">
        <Button size="lg" disabled={busy} onClick={approve}>
          {busy ? "Esperando tu firma…" : "Sí, aprobar"}
        </Button>
        <Button size="lg" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
