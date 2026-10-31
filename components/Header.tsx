import Link from "next/link";
import { Logo } from "@/components/Logo";

/**
 * Barra de arriba, igual en todas las páginas.
 * A la izquierda el logo (vuelve al inicio); a la derecha queda el lugar
 * para el botón de conectar la billetera, que suma PAC-12 (#12).
 */
export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between gap-3 px-4">
        <Link
          href="/"
          aria-label="Pactá, ir al inicio"
          className="rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Logo />
        </Link>
        {/* Acá va el botón de billetera (PAC-12). */}
        <div id="wallet-slot" className="flex min-w-0 items-center gap-2" />
      </div>
    </header>
  );
}
