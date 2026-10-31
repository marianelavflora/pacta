import type { Metadata } from "next";
import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Cómo funciona",
  description: "Cómo Pactá cobra trabajos por hitos entre países, sin pasar por el dólar.",
};

/**
 * Cómo funciona.
 * La llena Clau en PAC-48 (#48): explicación paso a paso para clientes y freelancers.
 */
export default function HowItWorksPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Cómo funciona"
        description="El cliente deposita al principio, vos entregás por partes y Pactá te paga cada hito en tu moneda."
      />

      {/* PAC-48: acá va la explicación completa, paso a paso. */}
      <EmptyState
        icon={Lightbulb}
        title="Estamos escribiendo esta página"
        text="Muy pronto vas a encontrar acá cómo se deposita, cómo se aprueba un hito y qué pasa si el cliente no responde."
      >
        <Button asChild className="mt-2">
          <Link href={routes.newAgreement}>Crear acuerdo</Link>
        </Button>
      </EmptyState>
    </div>
  );
}
