import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ConnectButton } from "@/components/ConnectButton";
import { NavLinks, NavList } from "@/components/NavLinks";
import { routes } from "@/lib/routes";

const navClassName = "order-last -mx-3 w-full sm:order-none sm:mx-0 sm:w-auto";

/**
 * Barra de arriba, igual en todas las páginas.
 * Logo (vuelve al inicio), links principales y el lugar para el botón de
 * conectar la billetera (PAC-12).
 * En el celular los links bajan a una segunda fila para que entren.
 */
export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center gap-x-3 px-4 py-2 sm:h-16 sm:flex-nowrap sm:py-0">
        <Link
          href={routes.home}
          aria-label="Pactá, ir al inicio"
          className="flex h-12 items-center rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Logo />
        </Link>
        <Suspense fallback={<NavList className={navClassName} />}>
          <NavLinks className={navClassName} />
        </Suspense>
        <div id="wallet-slot" className="ml-auto flex min-w-0 items-center gap-2">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
