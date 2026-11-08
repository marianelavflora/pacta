import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { routes } from "@/lib/routes";
import {
  clientSteps,
  faqs,
  freelancerSteps,
  noReply,
  type Step,
} from "@/lib/ui/how-it-works";

export const metadata: Metadata = {
  title: "Cómo funciona",
  description: "Cómo Pactá cobra trabajos por hitos entre países, sin pasar por el dólar.",
};

function StepList({ steps }: { steps: readonly Step[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {steps.map((step, i) => (
        <li key={step.title} className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-chip text-sm font-semibold text-chip-foreground">
            {i + 1}
          </span>
          <div>
            <p className="text-base font-semibold">{step.title}</p>
            <p className="text-muted-foreground">{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Cómo funciona (PAC-48): qué es Pactá, cómo se cobra, cómo se paga y qué pasa si el cliente no responde. */
export default function HowItWorksPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Cómo funciona"
        description="El cliente deposita al principio, vos entregás por partes y Pactá te paga cada hito en tu moneda."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Si cobrás</CardTitle>
          </CardHeader>
          <CardContent>
            <StepList steps={freelancerSteps} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Si pagás</CardTitle>
          </CardHeader>
          <CardContent>
            <StepList steps={clientSteps} />
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="sin-respuesta">
        <h2 id="sin-respuesta" className="text-2xl font-bold tracking-tight">
          Si el cliente no responde
        </h2>
        <p className="text-muted-foreground">
          Nadie se queda esperando para siempre. Pactá se ocupa de avisar y, si hace falta, de liberar el pago.
        </p>
        <Card>
          <CardContent>
            <StepList steps={noReply} />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="preguntas">
        <h2 id="preguntas" className="text-2xl font-bold tracking-tight">
          Preguntas frecuentes
        </h2>
        <div className="flex flex-col gap-2">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-2xl border border-border bg-card px-4 py-3 open:pb-4"
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-base font-semibold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                {faq.question}
                <ChevronDown
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="mt-1 text-muted-foreground">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href={routes.newAgreement}>Quiero cobrar</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
          <Link href={routes.home}>Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
