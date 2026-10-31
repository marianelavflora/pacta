import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatUnits } from "@/lib/amounts";
import { milestoneStatusLabel } from "@/lib/ui/status";

type MilestoneCardProps = {
  position: number;
  title: string;
  /** Monto en unidades mínimas, como texto. */
  amount: string;
  currency: string;
  status: string;
  /** Entrega de la freelancer (se muestra si el hito está entregado o esperando respuesta). */
  deliveryUrl?: string | null;
  deliveryNote?: string | null;
  /** Acciones de la tarjeta (por ejemplo el botón de aprobar). */
  children?: ReactNode;
};

/** Un hito: número, título, monto y estado. Lo usan las vistas del cliente y de la freelancer. */
export function MilestoneCard({
  position,
  title,
  amount,
  currency,
  status,
  deliveryUrl,
  deliveryNote,
  children,
}: MilestoneCardProps) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <p className="font-medium">
            <span className="text-muted-foreground">Hito {position} · </span>
            {title}
          </p>
          <Badge variant="chip" className="shrink-0">
            {milestoneStatusLabel(status)}
          </Badge>
        </div>
        <p className="text-lg font-semibold">
          {formatUnits(BigInt(amount))} {currency}
        </p>
        {(status === "delivered" || status === "reminded") && (deliveryUrl || deliveryNote) && (
          <div className="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2 text-sm">
            {deliveryUrl && (
              <a
                href={deliveryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-medium underline underline-offset-2"
              >
                Ver la entrega
              </a>
            )}
            {deliveryNote && <p className="text-muted-foreground">{deliveryNote}</p>}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
