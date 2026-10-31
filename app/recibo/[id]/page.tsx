import type { Metadata } from "next";
import { ReceiptText } from "lucide-react";
import { IdBadge } from "@/components/IdBadge";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Recibo",
  description: "El comprobante de un hito pagado: cuánto, en qué moneda y cuándo.",
};

/**
 * Recibo de un hito (boceto 09): `/recibo/<milestoneId>`.
 * Lo llenan:
 * - PAC-27 (#27): recibo v1 con monto, fecha y link a la transacción.
 * - PAC-34 (#34): recibo v2 con el tipo de cambio.
 */
export default function ReceiptPage({ params }: PageProps<"/recibo/[id]">) {
  const id = params.then((p) => p.id);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<IdBadge label="Hito" id={id} />}
        title="Recibo"
        description="El comprobante de un hito pagado: cuánto se pagó, en qué moneda y cuándo."
      />

      {/* PAC-27: acá va el detalle del pago del hito. */}
      <EmptyState
        icon={ReceiptText}
        title="Este recibo todavía no tiene datos"
        text="Cuando el hito se pague, acá vas a ver el monto, el tipo de cambio y la fecha."
      />
    </div>
  );
}
