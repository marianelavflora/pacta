// Esquema del pedido para entregar un hito (PAC-22).
import { z } from "zod";

export const MILESTONE_ID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const deliverMilestoneSchema = z.object({
  freelancerWallet: z
    .string({ error: "Falta la wallet de la freelancer" })
    .trim()
    .regex(/^0x[0-9a-fA-F]{40}$/, "La wallet de la freelancer no es válida")
    .transform((wallet) => wallet.toLowerCase()),
  deliveryUrl: z
    .string({ error: "Falta el link de la entrega" })
    .trim()
    .max(2000, "El link de la entrega es demasiado largo")
    .refine((value) => {
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    }, "El link de la entrega tiene que empezar con https://"),
  deliveryNote: z
    .string({ error: "La nota tiene que ser texto" })
    .trim()
    .max(1000, "La nota es demasiado larga (máximo 1000 caracteres)")
    .optional(),
});
export type DeliverMilestoneInput = z.infer<typeof deliverMilestoneSchema>;
