import { BellRing } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { telegramSubscribeUrl, type TelegramRole } from "@/lib/notify/telegram-links";
import { cn } from "@/lib/utils";

const COPY: Record<TelegramRole, string> = {
  client: "Te avisamos cuando haya una entrega para revisar y antes de que se libere un pago.",
  freelancer: "Te avisamos cuando el cliente deposita, cuando aprueba y cuando te llega el pago.",
};

/**
 * Botón "Recibir avisos por Telegram": abre el bot de Pactá con el código del acuerdo.
 * Si el bot no está configurado (NEXT_PUBLIC_TELEGRAM_BOT_USERNAME), no se muestra.
 */
export function TelegramSubscribe({ role, publicId }: { role: TelegramRole; publicId: string }) {
  const href = telegramSubscribeUrl(role, publicId);
  if (!href) return null;

  return (
    <section
      aria-label="Avisos por Telegram"
      className="flex flex-col gap-3 rounded-3xl border bg-card p-4"
    >
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">Avisos por Telegram</h2>
          <p className="text-sm text-muted-foreground">
            {COPY[role]} Abrí el bot de Pactá y tocá <strong>Iniciar</strong>.
          </p>
        </div>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
      >
        Recibir avisos por Telegram
      </a>
    </section>
  );
}
