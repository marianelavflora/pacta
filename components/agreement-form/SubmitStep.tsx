"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { CopyLink } from "@/components/CopyLink";
import { ApproxAmount } from "@/components/Quote";
import { Button, buttonVariants } from "@/components/ui/button";
import { buildTelegramShareUrl } from "@/lib/agreement-form";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  clientContact: string;
  link: string;
  milestoneCount: number;
  /** Total ya formateado para mostrar, por ejemplo "R$ 1.500". */
  total: string;
  clientCurrency: string;
  /** Total en unidades mínimas y moneda de cobro, para estimar lo que va a cobrar. */
  totalUnits: string;
  payoutCurrency: string;
};

/** Paso 3: "Tu acuerdo está listo" (pantalla 04 de docs/pantallas.md). */
export function SubmitStep({
  title,
  clientContact,
  link,
  milestoneCount,
  total,
  clientCurrency,
  totalUnits,
  payoutCurrency,
}: Props) {
  const [shareMessage, setShareMessage] = useState<string>();

  // En el celular abre el menú de compartir del sistema; si no existe, copia el link.
  async function shareOtherWay() {
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: `Mirá el acuerdo "${title}" en Pactá`,
          url: link,
        });
        return;
      }
      await navigator.clipboard.writeText(link);
      setShareMessage("Copiamos el link: pegalo donde quieras.");
    } catch {
      // La persona cerró el menú de compartir: no es un error.
    }
  }

  return (
    <section className="flex flex-col gap-6" aria-live="polite">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold tracking-tight">
          ¡Tu acuerdo está listo!
        </h2>
        <p className="text-muted-foreground">
          Mandale este link a tu cliente para que lo revise y deposite.
        </p>
      </div>

      <div className="flex flex-col gap-5 rounded-3xl bg-brand-ink p-5 text-brand-paper">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 font-medium break-words">{title}</p>
          <span className="shrink-0 rounded-full bg-chip px-3 py-1 text-xs font-semibold text-chip-foreground">
            Esperando depósito
          </span>
        </div>
        <div>
          <p className="text-sm opacity-70">
            Tu cliente paga ({clientCurrency})
          </p>
          <p className="text-4xl font-bold tracking-tight">{total}</p>
        </div>
        <div>
          <p className="text-sm opacity-70">Vos cobrás aprox.</p>
          <p className="text-2xl font-bold text-highlight">
            <ApproxAmount
              from={clientCurrency}
              to={payoutCurrency}
              amount={totalUnits}
            />
          </p>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: milestoneCount }, (_, index) => (
            <span key={index} className="h-2 flex-1 rounded-full bg-white/15" />
          ))}
        </div>
        <p className="text-sm opacity-70">
          {milestoneCount} {milestoneCount === 1 ? "hito" : "hitos"}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          Link para tu cliente
        </p>
        <CopyLink link={link} />
      </div>

      <div className="flex flex-col gap-3">
        <a
          href={buildTelegramShareUrl(title, link)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ size: "lg" }),
            "bg-success text-success-foreground hover:bg-success/90",
          )}
        >
          Mandar por Telegram
        </a>
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={shareOtherWay}
        >
          <Share2 aria-hidden /> Compartir de otra forma
        </Button>
        {shareMessage && (
          <p role="status" className="text-sm text-muted-foreground">
            {shareMessage}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-5">
        <h3 className="text-lg font-semibold">Avisos para tu cliente</h3>
        <p className="text-sm text-muted-foreground">
          Usamos este contacto solo para avisarle de entregas y pagos:
        </p>
        <p className="rounded-2xl border bg-card px-4 py-3 font-medium break-all">
          {clientContact}
        </p>
      </div>

      <p className="rounded-2xl bg-highlight/20 px-4 py-3 text-sm">
        Tu cliente no necesita cuenta en Pactá: solo su billetera (MetaMask o
        MiniPay).
      </p>
    </section>
  );
}
