import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PackageCheck } from "lucide-react";
import { IdBadge } from "@/components/IdBadge";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { DeliverDialog } from "@/components/DeliverDialog";
import { TodayRateCard } from "@/components/Quote";
import { Badge } from "@/components/ui/badge";
import { getAgreementByPublicId } from "@/lib/agreements";
import { formatUnits } from "@/lib/amounts";
import { getDb } from "@/lib/db";
import { receiptUrl } from "@/lib/routes";
import { milestoneStatusLabel } from "@/lib/ui/status-labels";

export const metadata: Metadata = {
  title: "Tu panel",
  description:
    "Seguí tus hitos, avisá cuando entregás y mirá lo que ya cobraste.",
};

/**
 * Vista de la freelancer (boceto 07-08): `/freelancer/<publicId>`.
 * - PAC-23 (#23): lista de hitos y botón para entregar (usa la API de PAC-22).
 * - PAC-27 (#27): link al recibo de cada hito pagado (`receiptUrl` en lib/routes.ts).
 */
export default function FreelancerAgreementPage({ params }: PageProps<"/freelancer/[id]">) {
  const id = params.then((p) => p.id);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<IdBadge label="Acuerdo" id={id} />}
        title="Tu panel"
        description="Cuando terminás un hito, avisás desde acá. Apenas tu cliente lo aprueba, cobrás en tu moneda."
      />
      <Suspense
        fallback={<p className="text-muted-foreground">Cargando tus hitos…</p>}
      >
        <Milestones id={id} />
      </Suspense>
    </div>
  );
}

// Estados en los que la plata ya está depositada y todavía no se pagó a la freelancer.
const SAVED_STATUSES = [
  "funded",
  "delivered",
  "reminded",
  "approved",
  "converting",
  "paused",
];

/** Resumen oscuro de arriba: cuánto está guardado para la freelancer y cuántos hitos ya cobró. */
function SummaryCard({
  paid,
  total,
  savedUnits,
  currency,
}: {
  paid: number;
  total: number;
  savedUnits: bigint;
  currency: string;
}) {
  return (
    <section
      aria-label="Resumen"
      className="flex flex-col gap-4 rounded-3xl bg-brand-ink p-5 text-brand-paper"
    >
      <div>
        <p className="text-sm opacity-70">Guardado para vos</p>
        <p className="text-4xl font-bold tracking-tight text-highlight">
          {formatUnits(savedUnits)}{" "}
          <span className="text-lg font-semibold opacity-70">{currency}</span>
        </p>
      </div>
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={
              index < paid
                ? "h-2 flex-1 rounded-full bg-success"
                : "h-2 flex-1 rounded-full bg-white/15"
            }
          />
        ))}
      </div>
      <p className="text-sm opacity-70">
        {paid} de {total} {total === 1 ? "hito cobrado" : "hitos cobrados"}
      </p>
    </section>
  );
}

async function Milestones({ id }: { id: Promise<string> }) {
  // Datos en vivo: no se leen la base ni se arma la página en el build.
  await connection();
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

  const paidCount = agreement.milestones.filter(
    (m) => m.status === "paid",
  ).length;
  const savedUnits = agreement.milestones
    .filter((m) => SAVED_STATUSES.includes(m.status))
    .reduce((sum, m) => sum + BigInt(m.amount), BigInt(0));

  return (
    <section className="flex flex-col gap-4" aria-label={agreement.title}>
      <SummaryCard
        paid={paidCount}
        total={agreement.milestones.length}
        savedUnits={savedUnits}
        currency={agreement.clientCurrency}
      />
      <h2 className="text-xl font-semibold">{agreement.title}</h2>
      <ul className="flex flex-col gap-3">
        {agreement.milestones.map((m) => (
          <li
            key={m.id}
            className="flex flex-col gap-3 rounded-3xl border border-border p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  Hito {m.position}
                </p>
                <p className="font-semibold">{m.title}</p>
              </div>
              <p className="shrink-0 font-semibold">
                {formatUnits(BigInt(m.amount))} {agreement.clientCurrency}
              </p>
            </div>
            <Badge variant="chip" className="w-fit">
              {milestoneStatusLabel(m.status)}
            </Badge>
            {m.status === "paid" && (
              <Link
                href={receiptUrl(m.id)}
                className="w-fit text-sm font-medium underline"
              >
                Ver recibo
              </Link>
            )}
            <DeliverDialog
              milestoneId={m.id}
              milestoneTitle={m.title}
              status={m.status}
              freelancerWallet={agreement.freelancer.wallet}
            />
          </li>
        ))}
      </ul>
      <TodayRateCard
        from={agreement.clientCurrency}
        to={agreement.payoutCurrency}
      />
    </section>
  );
}
