import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { routes } from "@/lib/routes";

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Adónde lleva la flechita de volver. Por defecto, al inicio. */
  backHref?: string;
  backLabel?: string;
  /** Algo chico arriba del título, por ejemplo un chip. */
  eyebrow?: React.ReactNode;
};

/** Título de cada página, con la flechita para volver. */
export function PageHeader({
  title,
  description,
  backHref = routes.home,
  backLabel = "Volver al inicio",
  eyebrow,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {backLabel}
      </Link>
      {eyebrow}
      <h1 className="text-3xl leading-tight font-bold tracking-tight text-balance">{title}</h1>
      {description ? <p className="text-lg text-muted-foreground">{description}</p> : null}
    </div>
  );
}
