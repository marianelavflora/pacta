import { concatHex, encodeFunctionData, getAddress, type Address, type Hex } from "viem";
import { toDataSuffix } from "@celo/attribution-tags";

import { erc20Abi } from "./tokens";
import { parseAmountToUnits } from "@/lib/amounts";

// Lógica pura del depósito del cliente (sin React ni red), para poder testearla.

/**
 * Wallet pública del agente (la bóveda). Es la misma en testnet y mainnet y es solo una
 * dirección: la clave privada vive únicamente en el servidor (AGENT_PRIVATE_KEY).
 */
export const AGENT_ADDRESS: Address = getAddress("0xab569A8d8A5b60CFfdf9B88EdE099c80d8328E73");

const TAG_PATTERN = /^[a-z0-9_]+$/;

/** El tag de atribución del navegador. Falla con mensaje claro si falta o es inválido. */
export function getAttributionTag(
  // Acceso estático a process.env para que Next.js lo inyecte en el navegador.
  value: string | undefined = process.env.NEXT_PUBLIC_ATTRIBUTION_TAG,
): string {
  if (!value) throw new Error("Falta NEXT_PUBLIC_ATTRIBUTION_TAG.");
  if (!TAG_PATTERN.test(value)) {
    throw new Error("NEXT_PUBLIC_ATTRIBUTION_TAG no es válido: solo minúsculas, números y guion bajo.");
  }
  return value;
}

/** Sufijo ERC-8021 que va en `dataSuffix` de cada `writeContract` del navegador. */
export function depositDataSuffix(tag: string): Hex {
  return toDataSuffix(tag);
}

/** Datos completos de la transacción (transfer + tag al final). Wagmi arma lo mismo por dentro. */
export function buildDepositCalldata(to: Address, amount: bigint, tag: string): Hex {
  const transfer = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, amount] });
  return concatHex([transfer, depositDataSuffix(tag)]);
}

export type AmountCheck = { ok: true; amount: bigint } | { ok: false; error: string };

/** Valida lo que escribió la persona: número entendible, mayor a 0. Todo en bigint. */
export function validateDepositAmount(input: string): AmountCheck {
  const amount = parseAmountToUnits(input);
  if (amount === null) return { ok: false, error: "Escribí un monto válido, por ejemplo 1500 o 1500,50." };
  if (amount <= BigInt(0)) return { ok: false, error: "El monto tiene que ser mayor a 0." };
  return { ok: true, amount };
}

/** Pasa el error técnico de la billetera a un mensaje amable. */
export function friendlyDepositError(error: unknown): string {
  const text = [
    (error as { shortMessage?: string })?.shortMessage,
    (error as { message?: string })?.message,
    String(error ?? ""),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (text.includes("user rejected") || text.includes("user denied") || text.includes("rejected the request")) {
    return "Cancelaste la firma en tu billetera. No se movió nada; podés intentar de nuevo.";
  }
  if (text.includes("insufficient") || text.includes("exceeds balance") || text.includes("transfer amount exceeds")) {
    return "No te alcanza el saldo para este monto (o para la comisión de la red). Revisá tu billetera.";
  }
  if (text.includes("chain") && (text.includes("mismatch") || text.includes("switch"))) {
    return "Tu billetera está en otra red. Cambiala a la red de Pactá e intentá de nuevo.";
  }
  return "No pudimos enviar el depósito. Revisá tu billetera e intentá de nuevo.";
}
