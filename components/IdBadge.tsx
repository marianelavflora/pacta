import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";

type IdBadgeProps = {
  /** Lo que va antes del id, por ejemplo "Acuerdo" o "Hito". */
  label: string;
  /** El id de la dirección. Llega como promesa porque en Next 16 los `params` son async. */
  id: Promise<string>;
};

async function IdBadgeValue({ label, id }: IdBadgeProps) {
  return <BadgeShell>{`${label} ${await id}`}</BadgeShell>;
}

function BadgeShell({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="chip" className="max-w-full">
      <span className="truncate">{children}</span>
    </Badge>
  );
}

/**
 * Chip con el id que viene en la dirección (por ejemplo `/a/abc123` → "Acuerdo abc123").
 * Va dentro de `<Suspense>` para que el resto de la página se pueda armar antes
 * de saber el id (Cache Components de Next 16).
 */
export function IdBadge({ label, id }: IdBadgeProps) {
  return (
    <Suspense fallback={<BadgeShell>{label}</BadgeShell>}>
      <IdBadgeValue label={label} id={id} />
    </Suspense>
  );
}
