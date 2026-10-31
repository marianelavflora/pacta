import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { IdBadge } from "@/components/IdBadge";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Tu acuerdo",
  description: "Depositá el total del trabajo y aprobá cada hito cuando esté listo.",
};

/**
 * Vista del cliente (boceto 05-06): `/a/<publicId>`.
 * Lo llenan:
 * - PAC-19 (#19): datos del acuerdo y sus hitos (lee la API de PAC-15).
 * - PAC-20 (#20): botón para depositar.
 * - PAC-24 (#24): botón para aprobar cada hito.
 * - PAC-33 (#33): cotización.
 */
export default function ClientAgreementPage({ params }: PageProps<"/a/[id]">) {
  const id = params.then((p) => p.id);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<IdBadge label="Acuerdo" id={id} />}
        title="Tu acuerdo"
        description="Depositás el total al principio y aprobás cada hito cuando lo recibís. Pactá le paga a la freelancer en su moneda."
      />

      {/* PAC-19: acá van el resumen del acuerdo, los hitos, depositar y aprobar. */}
      <EmptyState
        icon={Wallet}
        title="Todavía no hay datos de este acuerdo"
        text="Acá vas a ver el trabajo, cuánto depositar y el estado de cada hito."
      />
    </div>
  );
}
