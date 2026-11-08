"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { formatUnits } from "@/lib/amounts";
import { formatRate, parseRate } from "@/lib/fx/math";
import { currencySymbol } from "@/lib/ui/currency";

type QuoteData = {
  from: string;
  to: string;
  routeLabel: string;
  rate: string;
  amountOut?: string;
};

type QuoteState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: QuoteData };

/** Pide la cotización a /api/quote. Cambiar `reloadKey` la vuelve a pedir. */
function useQuote(
  from: string,
  to: string,
  amount?: string,
  reloadKey = 0,
): QuoteState {
  const [state, setState] = useState<QuoteState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      from,
      to,
      ...(amount ? { amount } : {}),
    });

    fetch(`/api/quote?${query}`, { signal: controller.signal })
      .then((response) =>
        response.ok
          ? (response.json() as Promise<QuoteData>)
          : Promise.reject(new Error("quote")),
      )
      .then((data) => setState({ status: "ready", data }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setState({ status: "error" });
      });

    return () => controller.abort();
  }, [from, to, amount, reloadKey]);

  return state;
}

/** "1 BRL = 280,84 ARS": el precio para leer en pantalla. */
function rateText(data: QuoteData): string {
  const rate = parseRate(data.rate);
  return `1 ${data.from.slice(1)} = ${rate === null ? "—" : formatRate(rate)} ${data.to.slice(1)}`;
}

/**
 * "≈ $ 168.504": lo que se cobraría aproximadamente. Si no hay cotización no muestra nada
 * inventado: avisa que no pudo traerla.
 */
export function ApproxAmount({
  from,
  to,
  amount,
}: {
  from: string;
  to: string;
  amount: string;
}) {
  const quote = useQuote(from, to, amount);

  if (quote.status === "loading")
    return <span className="text-muted-foreground">calculando…</span>;
  if (quote.status === "error" || !quote.data.amountOut) {
    return (
      <span className="text-muted-foreground">sin cotización por ahora</span>
    );
  }
  return (
    <span title={`${rateText(quote.data)} · ${quote.data.routeLabel}`}>
      ≈ {currencySymbol(to)} {formatUnits(BigInt(quote.data.amountOut))}
    </span>
  );
}

/** Línea para la vista del cliente: "Al aprobar, Lucía recibe R$ 600 → ≈ $ 147.180". */
export function ApproxPayout({
  from,
  to,
  amount,
  freelancerName,
}: {
  from: string;
  to: string;
  amount: string;
  freelancerName: string;
}) {
  const quote = useQuote(from, to, amount);

  return (
    <div className="flex flex-col gap-1 rounded-2xl border bg-card px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Al aprobar, {freelancerName} recibe
      </p>
      <p className="text-lg font-semibold">
        {currencySymbol(from)} {formatUnits(BigInt(amount))} →{" "}
        {quote.status === "ready" && quote.data.amountOut ? (
          <span>
            ≈ {currencySymbol(to)} {formatUnits(BigInt(quote.data.amountOut))}
          </span>
        ) : (
          <span className="text-base font-normal text-muted-foreground">
            {quote.status === "loading"
              ? "calculando…"
              : "sin cotización por ahora"}
          </span>
        )}
      </p>
      {quote.status === "ready" && (
        <p className="text-xs text-muted-foreground">
          {rateText(quote.data)} · {quote.data.routeLabel}
        </p>
      )}
    </div>
  );
}

/** Tarjeta "Cotización de hoy" de la freelancer, con botón para actualizar. */
export function TodayRateCard({ from, to }: { from: string; to: string }) {
  const [reloadKey, setReloadKey] = useState(0);
  const quote = useQuote(from, to, undefined, reloadKey);

  return (
    <section
      aria-label="Cotización de hoy"
      className="flex items-center justify-between gap-3 rounded-3xl border bg-card p-4"
    >
      <div className="min-w-0">
        <h2 className="font-semibold">Cotización de hoy</h2>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {quote.status === "ready"
            ? `${rateText(quote.data)} · ${quote.data.routeLabel}`
            : quote.status === "loading"
              ? "Consultando…"
              : "No pudimos traer la cotización ahora."}
        </p>
      </div>
      <button
        type="button"
        aria-label="Actualizar la cotización"
        onClick={() => setReloadKey((key) => key + 1)}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-chip text-chip-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <RefreshCw className="size-4" aria-hidden />
      </button>
    </section>
  );
}
