import type { Metadata } from "next";
import { PackageCheck } from "lucide-react";
import { IdBadge } from "@/components/IdBadge";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Tu panel",
  description: "Seguí tus hitos, avisá cuando entregás y mirá lo que ya cobraste.",
};

/**
 * Vista de la freelancer (boceto 07-08): `/f/<publicId>`.
 * Lo llenan:
 * - PAC-23 (#23): lista de hitos y botón para entregar (usa la API de PAC-22).
 * - PAC-27 (#27): link al recibo de cada hito pagado (`receiptUrl` en lib/routes.ts).
 */
export default function FreelancerAgreementPage({ params }: PageProps<"/f/[id]">) {
  const id = params.then((p) => p.id);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<IdBadge label="Acuerdo" id={id} />}
        title="Tu panel"
        description="Cuando terminás un hito, avisás desde acá. Apenas tu cliente lo aprueba, cobrás en tu moneda."
      />

      {/* PAC-23: acá van los hitos con su estado y el botón "Entregar". */}
      <EmptyState
        icon={PackageCheck}
        title="Todavía no hay hitos para mostrar"
        text="Acá vas a ver cada hito, si ya está depositado y cuándo se te paga."
      />
    </div>
  );
}
