// Mensaje que firma la freelancer para entregar un hito (A1 de la auditoría de seguridad). Lo usan igual el
// navegador (DeliverDialog) y la API: si cambia una coma, la firma deja de verificar.
// Es EIP-712, como la aprobación del cliente (approval.ts): la billetera muestra los campos en texto legible.
// Sin esto, cualquiera que conociera la wallet de la freelancer (es pública en la vista del acuerdo) podía
// marcar una entrega y poner el link que quisiera frente al cliente.
import { APPROVAL_DOMAIN_NAME, APPROVAL_DOMAIN_VERSION } from "./approval";

export const deliveryTypes = {
  Delivery: [
    { name: "mensaje", type: "string" },
    { name: "acuerdo", type: "string" },
    { name: "hito", type: "string" },
    { name: "posicion", type: "uint256" },
    { name: "enlace", type: "string" },
  ],
} as const;

export type DeliveryInput = {
  chainId: number;
  /** `public_id` del acuerdo (el de la URL /freelancer/<id>). */
  agreementPublicId: string;
  /** UUID del hito. */
  milestoneId: string;
  /** Posición del hito en el acuerdo (1, 2, 3...). */
  position: number;
  /** El link de la entrega, tal cual lo ve el cliente (queda firmado: no se puede cambiar después). */
  deliveryUrl: string;
};

/** Todo lo que firma la billetera: dominio (incluye la red), tipos y valores. */
export function buildDeliveryTypedData(input: DeliveryInput) {
  const enlace = input.deliveryUrl.trim();
  return {
    domain: {
      name: APPROVAL_DOMAIN_NAME,
      version: APPROVAL_DOMAIN_VERSION,
      chainId: input.chainId,
    },
    types: deliveryTypes,
    primaryType: "Delivery" as const,
    message: {
      mensaje: `Entrego el hito ${input.position} del acuerdo ${input.agreementPublicId}. Mi trabajo está en ${enlace}`,
      acuerdo: input.agreementPublicId,
      hito: input.milestoneId.toLowerCase(),
      posicion: BigInt(input.position),
      enlace,
    },
  };
}

export type DeliveryTypedData = ReturnType<typeof buildDeliveryTypedData>;
