import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { IdBadge } from "@/components/IdBadge";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { DeliverDialog } from "@/components/DeliverDialog";
import { Badge } from "@/components/ui/badge";
import { getAgreementByPublicId } from "@/lib/agreements";
import { formatUnits } from "@/lib/amounts";
import { getDb } from "@/lib/db";
import { milestoneStatusLabel } from "@/lib/ui/status-labels";

export const metadata: Metadata = {
  title: "Tu panel",
  description: "Seguí tus hitos, avisá cuando entregás y mirá lo que ya cobraste.",
};

/**
 * Vista de la freelancer (boceto 07-08): `/f/<publicId>`.
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
      <Suspense fallback={<p className="text-muted-foreground">Cargando tus hitos…</p>}>
        <Milestones id={id} />
      </Suspense>
    </div>
  );
}

async function Milestones({ id }: { id: Promise<string> }) {
  const agreement = await getAgreementByPublicId(getDb(), await id);
  if (!agreement) notFound();

  if (agreement.milestones.length === 0) {
    return (
      <EmptyState
        icon={PackageCheck}
        title="Todavía no hay hitos para mostrar"
        text="Acá vas a ver cada hito, si ya está depositado y cuándo se te paga."
      />
    );
  }

  return (
    <section className="flex flex-col gap-4" aria-label={agreement.title}>
      <h2 className="text-xl font-semibold">{agreement.title}</h2>
      <ul className="flex flex-col gap-3">
        {agreement.milestones.map((m) => (
          <li
            key={m.id}
            className="flex flex-col gap-3 rounded-3xl border border-border p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Hito {m.position}</p>
                <p className="font-semibold">{m.title}</p>
              </div>
              <p className="shrink-0 font-semibold">
                {formatUnits(BigInt(m.amount))} {agreement.clientCurrency}
              </p>
            </div>
            <Badge variant="chip" className="w-fit">
              {milestoneStatusLabel(m.status)}
            </Badge>
            <DeliverDialog
              milestoneId={m.id}
              milestoneTitle={m.title}
              status={m.status}
              freelancerWallet={agreement.freelancer.wallet}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
