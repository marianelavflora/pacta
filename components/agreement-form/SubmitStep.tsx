"use client";

import { CopyLink } from "@/components/CopyLink";
import { buttonVariants } from "@/components/ui/button";
import { buildWhatsAppShareUrl } from "@/lib/agreement-form";
import { cn } from "@/lib/utils";

/** Pantalla de "Acuerdo listo para compartir" (boceto 04). */
export function SubmitStep({
  title,
  clientContact,
  link,
}: {
  title: string;
  clientContact: string;
  link: string;
}) {
  return (
    <section className="flex flex-col gap-6" aria-live="polite">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">¡Acuerdo listo!</h2>
        <p className="text-sm text-muted-foreground">
          Guardamos &ldquo;{title}&rdquo;. Pasale este link a tu cliente para que lo revise y deposite.
        </p>
      </div>

      {/* El contacto ya se guarda en el acuerdo (clientContact); los avisos reales salen con la parte de notificaciones. */}
      <p className="text-sm">
        Los avisos le van a llegar a tu cliente a: <strong className="break-all">{clientContact}</strong>
      </p>

      <CopyLink link={link} />

      <a
        href={buildWhatsAppShareUrl(title, link)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants())}
      >
        Compartir por WhatsApp
      </a>
    </section>
  );
}
