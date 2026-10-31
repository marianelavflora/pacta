"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";

const links = [
  { href: routes.home, label: "Inicio" },
  { href: routes.newAgreement, label: "Crear acuerdo" },
  { href: routes.howItWorks, label: "Cómo funciona" },
];

type NavListProps = { className?: string; activeHref?: string };

/** Los links del header, sin saber en qué página estás. */
export function NavList({ className, activeHref }: NavListProps) {
  return (
    <nav aria-label="Principal" className={className}>
      <ul className="flex items-center gap-1">
        {links.map((link) => {
          const active = activeHref === link.href;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active && "bg-chip text-chip-foreground hover:bg-chip hover:text-chip-foreground",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Los links del header marcando la página en la que estás.
 * Usa la dirección actual, así que en el Header va dentro de `<Suspense>`
 * con `NavList` como reemplazo mientras carga (Cache Components de Next 16).
 */
export function NavLinks({ className }: { className?: string }) {
  const pathname = usePathname();
  return <NavList className={className} activeHref={pathname} />;
}
