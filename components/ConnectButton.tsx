"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useConnectors, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { shortAddress } from "@/lib/chain/address";

type EthereumWindow = Window & { ethereum?: { isMiniPay?: boolean } };

function connectErrorMessage(error: Error): string {
  console.error("[ConnectButton] connect error:", error);
  const text = `${error.name} ${error.message}`.toLowerCase();
  if (text.includes("providernotfound") || text.includes("provider not found")) {
    return "No encontramos una billetera en este navegador. Instalá MetaMask (o abrí Pactá desde MiniPay) e intentá de nuevo.";
  }
  if (text.includes("rejected") || text.includes("denied") || text.includes("user closed")) {
    return "Cancelaste la conexión. Tocá el botón y aceptá en tu billetera.";
  }
  if (text.includes("already pending") || text.includes("-32002")) {
    return "Ya hay un pedido abierto en tu billetera. Abrila y aceptalo.";
  }
  if (text.includes("chain") || text.includes("network")) {
    return "Tu billetera está en otra red. Cambiala a Celo e intentá de nuevo.";
  }
  return "No pudimos conectar. Abrí tu billetera e intentá de nuevo.";
}

/**
 * Botón de billetera. Dentro de MiniPay conecta sola y no muestra nada.
 * Solo lee la dirección: no maneja claves ni manda transacciones.
 */
export function ConnectButton() {
  const { address, isConnected, status } = useAccount();
  const { connect, isPending, error } = useConnect();
  const connectors = useConnectors();
  const { disconnect } = useDisconnect();
  const [isMiniPay, setIsMiniPay] = useState(false);

  useEffect(() => {
    // Detectar MiniPay solo se puede en el navegador.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if ((window as EthereumWindow).ethereum?.isMiniPay) setIsMiniPay(true);
  }, []);

  const connector = connectors[0];

  useEffect(() => {
    if (isMiniPay && connector && status === "disconnected") {
      connect({ connector });
    }
  }, [isMiniPay, connector, status, connect]);

  if (isMiniPay) return null;

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="rounded-lg bg-muted px-2.5 py-1.5 font-mono text-sm"
          title={address}
        >
          {shortAddress(address)}
        </span>
        <Button variant="outline" size="sm" onClick={() => disconnect()}>
          Desconectar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        disabled={!connector || isPending || status === "reconnecting"}
        onClick={() => connector && connect({ connector })}
      >
        {isPending ? "Conectando…" : "Conectar billetera"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {connectErrorMessage(error)}
        </p>
      )}
    </div>
  );
}
