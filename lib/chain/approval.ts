// Mensaje que firma el cliente para aprobar un hito (PAC-25). Lo usan igual el navegador
// (botón de PAC-24) y la API: si cambia una coma, la firma deja de verificar.
// Es EIP-712: la billetera le muestra a la persona los campos en texto legible.
import { formatUnits } from "viem";

export const APPROVAL_DOMAIN_NAME = "Pactá";
export const APPROVAL_DOMAIN_VERSION = "1";

export const approvalTypes = {
  Approval: [
    { name: "mensaje", type: "string" },
    { name: "acuerdo", type: "string" },
    { name: "hito", type: "string" },
    { name: "posicion", type: "uint256" },
    { name: "monto", type: "string" },
    { name: "moneda", type: "string" },
  ],
} as const;

export type ApprovalInput = {
  chainId: number;
  /** `public_id` del acuerdo (el de la URL /a/<id>). */
  agreementPublicId: string;
  /** UUID del hito. */
  milestoneId: string;
  /** Posición del hito en el acuerdo (1, 2, 3...). */
  position: number;
  /** Monto en unidades mínimas (18 decimales). */
  amount: bigint;
  /** wARS, wBRL, wMXN... */
  currency: string;
};

/** Todo lo que firma la billetera: dominio (incluye la red), tipos y valores. */
export function buildApprovalTypedData(input: ApprovalInput) {
  const monto = formatUnits(input.amount, 18);
  return {
    domain: {
      name: APPROVAL_DOMAIN_NAME,
      version: APPROVAL_DOMAIN_VERSION,
      chainId: input.chainId,
    },
    types: approvalTypes,
    primaryType: "Approval" as const,
    message: {
      mensaje: `Apruebo el hito ${input.position} del acuerdo ${input.agreementPublicId} y autorizo liberar ${monto} ${input.currency} a la freelancer.`,
      acuerdo: input.agreementPublicId,
      hito: input.milestoneId.toLowerCase(),
      posicion: BigInt(input.position),
      monto,
      moneda: input.currency,
    },
  };
}

export type ApprovalTypedData = ReturnType<typeof buildApprovalTypedData>;
