import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { IdBadge } from "@/components/IdBadge";
import { PageHeader } from "@/components/PageHeader";
import { ShareReceipt } from "@/components/ShareReceipt";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatUnits } from "@/lib/amounts";
import { shortAddress } from "@/lib/chain/address";
import { addressUrl, txUrl } from "@/lib/chain/chains";
import { getDb } from "@/lib/db";
import { getReceiptByMilestoneId } from "@/lib/receipts";
import { milestoneStatusLabel } from "@/lib/ui/status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Recibo",
  description: "El comprobante de un hito pagado: cuánto, en qué moneda y cuándo.",
};

/**
 * Recibo de un hito (boceto 09): `/recibo/<milestoneId>`.
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
      <Suspense fallback={<p className="text-muted-foreground">Cargando el recibo…</p>}>
        <Receipt id={id} />
      </Suspense>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(iso));
}

async function Receipt({ id }: { id: Promise<string> }) {
  // Datos en vivo: no se lee la base ni se arma la página en el build.
  await connection();
  const receipt = await getReceiptByMilestoneId(getDb(), await id);
  if (!receipt) notFound();

  const { payout } = receipt;

  if (!payout) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Todavía no se pagó</h2>
          <p className="text-muted-foreground">
            Hito {receipt.position}: {receipt.milestoneTitle} · {receipt.agreementTitle}
          </p>
          <Badge variant="chip" className="w-fit">
            {milestoneStatusLabel(receipt.milestoneStatus)}
          </Badge>
          <p className="text-sm text-muted-foreground">
            Cuando se pague, acá vas a ver el comprobante.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">Se pagaron</p>
          <p className="text-3xl font-semibold">
            {formatUnits(BigInt(payout.amount))} {payout.currency}
          </p>
          <Badge variant="chip" className="mt-1 w-fit">
            {milestoneStatusLabel(receipt.milestoneStatus)}
          </Badge>
        </div>

        <dl className="flex flex-col gap-3 text-sm">
          <Row label="Hito" value={`${receipt.position}. ${receipt.milestoneTitle}`} />
          <Row label="Acuerdo" value={receipt.agreementTitle} />
          <Row label="De" value={`Tu cliente (${receipt.clientCurrency})`} />
          <Row label="Para" value={receipt.freelancer.name} />
          <Row label="Fecha" value={formatDate(receipt.paidAt ?? payout.at)} />
          {/* TODO(PAC-34): acá va el tipo de cambio usado y lo que se ahorró (recibo v2). */}
        </dl>

        <ShareReceipt />

        <details className="rounded-2xl border border-border p-3 text-sm">
          <summary className="cursor-pointer font-medium">Detalles técnicos</summary>
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-muted-foreground">
              Billetera que recibió: {shortAddress(receipt.freelancer.wallet)}
            </p>
            {payout.txHash && (
              <p className="break-all text-muted-foreground">Transacción: {payout.txHash}</p>
            )}
            <div className="flex flex-col gap-2">
              {payout.txHash && (
                <a
                  href={txUrl(payout.txHash as `0x${string}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Ver en el explorador
                </a>
              )}
              <a
                href={addressUrl(receipt.freelancer.wallet as `0x${string}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Ver la billetera en el explorador
              </a>
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
