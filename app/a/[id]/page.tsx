import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { MilestoneCard } from "@/components/MilestoneCard";
import { IdBadge } from "@/components/IdBadge";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAgreementByPublicId } from "@/lib/agreements";
import { formatUnits } from "@/lib/amounts";
import { getDb } from "@/lib/db";

export const metadata: Metadata = {
  title: "Tu acuerdo",
  description: "Depositá el total del trabajo y aprobá cada hito cuando esté listo.",
};

/**
 * Vista del cliente (boceto 05): `/a/<publicId>`.
 * PAC-19: datos del acuerdo y sus hitos. Faltan: depositar (PAC-20), aprobar (PAC-24), cotización (PAC-33).
 */
export default function ClientAgreementPage({ params }: PageProps<"/a/[id]">) {
  const id = params.then((p) => p.id);

  return (
    <Suspense fallback={<LoadingAgreement />}>
      <AgreementView id={id} />
    </Suspense>
  );
}

function LoadingAgreement() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando el acuerdo">
      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-muted" />
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

async function AgreementView({ id }: { id: Promise<string> }) {
  const publicId = await id;
  const agreement = await getAgreementByPublicId(getDb(), publicId);
  if (!agreement) notFound();

  const currency = agreement.clientCurrency;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<IdBadge label="Acuerdo" id={id} />}
        title={agreement.title}
        description={`Trabajo de ${agreement.freelancer.name}${agreement.description ? `: ${agreement.description}` : ""}`}
      />

      <section aria-label="Hitos" className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Hitos</h2>
        {agreement.milestones.map((m) => (
          <MilestoneCard
            key={m.id}
            position={m.position}
            title={m.title}
            amount={m.amount}
            currency={currency}
            status={m.status}
          />
        ))}
      </section>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total del acuerdo</p>
            <p className="text-3xl font-bold">
              {formatUnits(BigInt(agreement.totalAmount))} {currency}
            </p>
          </div>
          <p className="flex gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            Tu plata queda guardada y se libera de a partes cuando aprobás cada entrega.
          </p>
          {/* TODO(PAC-20): depósito del cliente (se puede hacer en partes). */}
          <Button disabled size="lg">
            Depositar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
