import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  { title: "El cliente deposita", text: "Pone la plata al principio, en su moneda." },
  { title: "Vos entregás", text: "Cada hito aprobado se paga por separado." },
  { title: "Cobrás en tu moneda", text: "Sin pasar por el dólar, de un país a otro." },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-5">
        <Badge variant="highlight" className="w-fit">
          Cobros por hitos entre países
        </Badge>
        <h1 className="text-4xl leading-tight font-bold tracking-tight text-balance sm:text-5xl">
          Cobrá tus trabajos por hitos, sin pasar por el dólar.
        </h1>
        <p className="text-lg text-muted-foreground">
          El cliente deposita al principio y Pactá te paga cada parte apenas se aprueba,
          directo en tu moneda.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/nuevo">Quiero cobrar</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link href="/como-funciona">Tengo que pagar</Link>
          </Button>
        </div>
      </section>

      <Card>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
