import { cn } from "@/lib/utils";

type LogoProps = {
  /** Muestra la palabra "pactá" al lado del ícono. */
  withWordmark?: boolean;
  className?: string;
};

/**
 * Logo de Pactá: el mismo dibujo de docs/brand/pacta-icono.svg.
 * El cuadrado y la "p" toman los colores de --logo-tile y --logo-mark,
 * que se invierten solos en modo oscuro (igual que pacta-logo-oscuro.svg).
 */
export function Logo({ withWordmark = true, className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 64 64"
        className="size-9 shrink-0"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="64" height="64" rx="15" fill="var(--logo-tile)" />
        <path
          d="M21 50 V17 H34 a11 11 0 0 1 0 22 H21"
          fill="none"
          stroke="var(--logo-mark)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="34" cy="17" r="4.6" fill="var(--brand-yellow)" stroke="var(--logo-tile)" strokeWidth="2.2" />
        <circle cx="45" cy="28" r="4.6" fill="var(--brand-yellow)" stroke="var(--logo-tile)" strokeWidth="2.2" />
        <circle cx="34" cy="39" r="4.6" fill="var(--brand-green)" stroke="var(--logo-tile)" strokeWidth="2.2" />
      </svg>
      {withWordmark ? (
        <span className="text-2xl leading-none font-bold tracking-tight">pactá</span>
      ) : (
        <span className="sr-only">Pactá</span>
      )}
    </span>
  );
}
