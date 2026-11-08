import Link from "next/link";
import {
  Check,
  Clock,
  FileText,
  Lock,
  MessageCircle,
  Receipt,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

// Contenido de la landing en un solo lugar para poder cambiarlo sin tocar el diseño.

const audience = [
  "Diseñadoras",
  "Programadores",
  "Traductoras",
  "Redactores",
  "Editores de video",
  "Consultoras",
];

const pains = [
  {
    title: "Cobrar de afuera es lento y caro",
    text: "Transferencias internacionales, bancos en el medio y el dólar como intermediario: pasan los días y una parte de lo que ganaste se queda en el camino.",
  },
  {
    title: "Trabajás primero y rezás después",
    text: "Entregás el trabajo y esperás a que tu cliente se acuerde de pagar. Si algo sale mal, ya no hay vuelta atrás.",
  },
  {
    title: "Si tu cliente no responde, quedás colgada",
    text: "Una aprobación que no llega puede frenar tu cobro semanas. Y perseguir pagos también es trabajo (y sin cobrar).",
  },
];

const benefits = [
  {
    icon: Lock,
    title: "La plata ya está guardada",
    text: "Tu cliente deposita al principio. Vos entregás tranquila porque el pago está asegurado desde el día 1.",
  },
  {
    icon: Wallet,
    title: "Cobrás en tu moneda, sin pasar por el dólar",
    text: "El agente cambia directo de la moneda de tu cliente a pesos y te paga cada tramo apenas se aprueba.",
  },
  {
    icon: Clock,
    title: "Si no responde, igual cobrás",
    text: "A los 3 días le avisamos de nuevo. A los 6, si sigue sin responder, el agente te paga igual.",
  },
  {
    icon: Receipt,
    title: "Cada pago, con recibo claro",
    text: "Ves cuánto entró, el tipo de cambio que se usó y cómo se compara con el precio de referencia.",
  },
  {
    icon: MessageCircle,
    title: "Sin formularios eternos",
    text: "Contás el trabajo con tus palabras y un agente de IA arma los hitos, los montos y los plazos. Vos revisás.",
  },
  {
    icon: FileText,
    title: "Sin cuentas ni datos bancarios",
    text: "Alcanza con una billetera (MetaMask o MiniPay). Tu cliente tampoco necesita crear una cuenta.",
  },
];

const steps = [
  {
    title: "Contale el trabajo al agente",
    text: "Escribís qué vas a hacer y él lo arma en hitos con montos y fechas.",
  },
  {
    title: "Tu cliente deposita",
    text: "Paga todo al principio en su moneda. La plata queda guardada: no la toca nadie.",
  },
  {
    title: "Entregás y aprueba",
    text: "Subís cada entrega. Tu cliente la aprueba con un toque (una firma, sin costo).",
  },
  {
    title: "Cobrás en pesos",
    text: "El agente cambia al mejor precio del día y te paga ese tramo. Te llega el recibo.",
  },
];

const comparison = [
  {
    question: "¿Cuándo está asegurado el pago?",
    pacta: "Desde el día 1, antes de que trabajes",
    usual: "Cuando tu cliente se acuerda de pagar",
  },
  {
    question: "¿Cómo se cambia la moneda?",
    pacta: "Directo, con recibo del tipo de cambio",
    usual: "Pasando por el dólar y por bancos",
  },
  {
    question: "Si tu cliente no responde",
    pacta: "Se libera solo a los 6 días",
    usual: "Quedás esperando",
  },
  {
    question: "¿Qué necesitás?",
    pacta: "Solo tu billetera",
    usual: "Datos bancarios y trámites",
  },
];

const questions = [
  {
    question: "¿Tengo que saber de cripto?",
    answer:
      "No. Usás una billetera (MetaMask o MiniPay) como si fuera una app de pagos. Nosotros te explicamos cada paso en palabras simples.",
  },
  {
    question: "¿Y si mi cliente no está conforme con una entrega?",
    answer:
      "Puede pausar el hito y hablar con vos. Mientras tanto la plata sigue guardada y nadie la mueve.",
  },
  {
    question: "¿En qué monedas funciona?",
    answer:
      "Tu cliente puede pagar en reales (wBRL), pesos mexicanos (wMXN) o pesos argentinos (wARS), y vos cobrás en pesos argentinos (wARS).",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-14">
      {/* Qué es y para quién, en lo primero que se ve */}
      <section className="flex flex-col gap-5">
        <Badge variant="highlight" className="w-fit">
          Para freelancers que cobran de otros países
        </Badge>
        <h1 className="text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl">
          Cobrá por hitos.{" "}
          <span className="bg-[linear-gradient(transparent_62%,var(--highlight)_62%)] text-foreground dark:bg-none dark:text-highlight">
            Entre países.
          </span>{" "}
          Sin vueltas.
        </h1>
        <p className="text-lg text-muted-foreground">
          Tu cliente del exterior deposita al principio en su moneda. Cada vez
          que aprueba una entrega, el agente de Pactá te paga ese tramo en
          pesos: sin bancos de por medio, sin dólar y sin perseguir pagos.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={routes.newAgreement}
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-highlight text-highlight-foreground hover:bg-highlight/90 sm:w-auto",
            )}
          >
            Crear un acuerdo
          </Link>
          <Link
            href={routes.howItWorks}
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "sm:w-auto",
            )}
          >
            Tengo un link para pagar
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Necesitás una billetera para crear, depositar y aprobar:{" "}
          <strong className="text-foreground">MetaMask o MiniPay</strong>.
        </p>
      </section>

      {/* Ejemplo concreto */}
      <section
        aria-label="Ejemplo de un acuerdo"
        className="rounded-3xl bg-brand-ink p-5 text-brand-paper"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm opacity-70">Ejemplo (valores inventados)</p>
          <span className="rounded-full bg-highlight/90 px-3 py-1 text-xs font-semibold text-highlight-foreground">
            En curso
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm opacity-70">Cliente en São Paulo depositó</p>
            <p className="text-3xl font-bold">R$ 1.500</p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-70">Vos cobrás aprox.</p>
            <p className="text-3xl font-bold text-highlight">$ 367.950</p>
          </div>
        </div>
        <div
          className="mt-5 h-2 overflow-hidden rounded-full bg-white/15"
          aria-hidden
        >
          <div className="h-full w-2/3 rounded-full bg-success" />
        </div>
        <p className="mt-3 text-sm opacity-70">
          2 de 3 hitos cobrados · el tercero se libera cuando lo aprueben
        </p>
      </section>

      {/* A quién apunta */}
      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold tracking-tight">¿Es para vos?</h2>
        <p className="text-muted-foreground">
          Si trabajás por proyecto para clientes de otro país y cobrar te cuesta
          plata, tiempo o nervios, Pactá es para vos.
        </p>
        <ul
          className="flex flex-wrap gap-2"
          aria-label="Oficios a los que apunta Pactá"
        >
          {audience.map((job) => (
            <li
              key={job}
              className="rounded-full bg-chip px-4 py-1.5 text-sm font-semibold text-chip-foreground"
            >
              {job}
            </li>
          ))}
        </ul>
      </section>

      {/* El dolor */}
      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold tracking-tight">
          Lo que hoy te duele de cobrar
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {pains.map((pain) => (
            <li
              key={pain.title}
              className="flex flex-col gap-2 rounded-3xl border bg-card p-4"
            >
              <h3 className="font-semibold">{pain.title}</h3>
              <p className="text-sm text-muted-foreground">{pain.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* La solución */}
      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold tracking-tight">
          Por qué Pactá lo resuelve mejor
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {benefits.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="flex gap-3 rounded-3xl border bg-card p-4"
            >
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-highlight text-highlight-foreground"
              >
                <Icon className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Cómo funciona */}
      <section className="flex flex-col gap-5">
        <h2 className="text-2xl font-bold tracking-tight">Cómo funciona</h2>
        <ol className="flex flex-col gap-5">
          {steps.map((step, index) => (
            <li key={step.title} className="flex items-start gap-4">
              <span
                aria-hidden
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full text-lg font-bold",
                  index === steps.length - 1
                    ? "bg-success text-success-foreground"
                    : "bg-highlight text-highlight-foreground",
                )}
              >
                {index + 1}
              </span>
              <div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="text-muted-foreground">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="rounded-3xl border bg-card p-4">
          <h3 className="font-semibold text-foreground">
            ¿Y si no me responde?
          </h3>
          <p className="text-sm text-muted-foreground">
            A los 3 días le mandamos otro aviso. Si a los 6 días sigue sin
            responder, el agente te paga igual.
          </p>
        </div>
      </section>

      {/* Comparación simple */}
      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold tracking-tight">
          Pactá frente a cobrar como siempre
        </h2>
        <ul className="flex flex-col gap-3">
          {comparison.map((row) => (
            <li
              key={row.question}
              className="flex flex-col gap-2 rounded-3xl border bg-card p-4"
            >
              <h3 className="font-semibold">{row.question}</h3>
              <p className="flex items-start gap-2 text-sm">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-success"
                  aria-hidden
                />
                <span>
                  <strong>Pactá:</strong> {row.pacta}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Como siempre:</strong> {row.usual}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Preguntas frecuentes */}
      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold tracking-tight">
          Preguntas que nos hacen
        </h2>
        {questions.map((item) => (
          <details
            key={item.question}
            className="group rounded-3xl border bg-card p-4"
          >
            <summary className="cursor-pointer list-none font-semibold marker:content-none focus-visible:outline-none">
              {item.question}
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
          </details>
        ))}
      </section>

      {/* Cierre */}
      <section className="flex flex-col items-start gap-4 rounded-3xl bg-highlight p-6 text-highlight-foreground">
        <h2 className="text-2xl font-bold tracking-tight text-balance">
          Tu próximo cobro, sin vueltas.
        </h2>
        <p>
          Contale el trabajo al agente y en un minuto tenés el link para
          mandarle a tu cliente.
        </p>
        <Link
          href={routes.newAgreement}
          className={cn(buttonVariants({ size: "lg" }))}
        >
          Crear un acuerdo
        </Link>
      </section>
    </div>
  );
}
