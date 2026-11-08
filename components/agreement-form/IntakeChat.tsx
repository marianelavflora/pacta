"use client";

import { useRef, useState } from "react";
import { ArrowUp, Pencil, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MilestonesStep,
  newMilestoneRow,
} from "@/components/agreement-form/MilestonesStep";
import { CURRENCIES, type Currency } from "@/lib/validation/agreement";
import {
  MAX_MILESTONES,
  totalUnits,
  type DetailsValues,
  type MilestoneErrors,
  type MilestoneRow,
} from "@/lib/agreement-form";
import { formatUnits } from "@/lib/amounts";
import type { IntakeDraftResponse } from "@/lib/intake/apply-draft";
import {
  EXAMPLE_TEXT,
  explainAgreement,
  FAILURE_MESSAGE,
  joinUserMessages,
  WELCOME_MESSAGE,
  withReviewDays,
} from "@/lib/intake/chat";
import { currencySymbol, formatTypedAmount } from "@/lib/ui/currency";
import { cn } from "@/lib/utils";

const MAX_TEXT_LENGTH = 4000; // el mismo tope que la API
const NETWORK_ERROR =
  "No pude conectarme. Revisá tu internet y probá de nuevo.";

type ChatMessage = { id: number; from: "user" | "agent"; text: string };

type Props = {
  details: DetailsValues;
  rows: MilestoneRow[];
  rowErrors: MilestoneErrors[];
  listError?: string;
  currencyError?: string;
  /** Carga la propuesta de la IA en el formulario. Devuelve cuántos hitos cargó. */
  onApplyDraft: (draft: IntakeDraftResponse, text: string) => number;
  onRowsChange: (rows: MilestoneRow[]) => void;
  onDetailsChange: (details: DetailsValues) => void;
  /** "Está bien, seguir": pasa al paso 2. */
  onContinue: () => void;
};

function AgentBubble({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span
        aria-hidden
        className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
      >
        <Sparkles className="size-4" />
      </span>
      <div
        className={cn(
          "rounded-3xl rounded-tl-md border bg-card px-4 py-3 text-base text-card-foreground",
          wide ? "w-full" : "max-w-[85%]",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="ml-auto max-w-[85%] rounded-3xl rounded-tr-md bg-primary px-4 py-3 text-base whitespace-pre-line text-primary-foreground">
      {text}
    </div>
  );
}

function Chip({
  children,
  onClick,
  pressed,
}: {
  children: React.ReactNode;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="inline-flex h-10 items-center gap-1.5 rounded-full bg-chip px-4 text-sm font-semibold text-chip-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}

function CurrencySelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: Currency) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as Currency)}
        className="h-10 rounded-lg border border-input bg-card px-2.5 text-base focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <option value="" disabled>
          Elegí una
        </option>
        {CURRENCIES.map((currency) => (
          <option key={currency} value={currency}>
            {currency} ({currencySymbol(currency)})
          </option>
        ))}
      </select>
    </div>
  );
}

/** Tarjeta con los hitos que armó el agente: se actualiza sola cuando se edita algo. */
function MilestonesCard({
  rows,
  currency,
  editing,
  onToggleEdit,
  onAdd,
}: {
  rows: MilestoneRow[];
  currency: string;
  editing: boolean;
  onToggleEdit: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col divide-y divide-border">
        {rows.map((row, index) => (
          <li key={row.id} className="flex items-start gap-3 py-3 first:pt-0">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-highlight text-sm font-bold text-highlight-foreground"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold break-words">
                {row.title.trim() || "Hito sin título"}
              </p>
              <p className="text-sm text-muted-foreground">
                {row.reviewDays || "—"} días para revisar
              </p>
            </div>
            <p className="shrink-0 font-semibold">
              {formatTypedAmount(currency, row.amount)}
            </p>
          </li>
        ))}
      </ol>

      <div className="flex items-baseline justify-between border-t border-border pt-3">
        <span className="text-muted-foreground">Total</span>
        <span className="text-xl font-bold" aria-live="polite">
          {currency ? `${currencySymbol(currency)} ` : ""}
          {formatUnits(totalUnits(rows))}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip onClick={onToggleEdit} pressed={editing}>
          <Pencil className="size-4" aria-hidden />{" "}
          {editing ? "Listo, cerrar edición" : "Editar hitos"}
        </Chip>
        <Chip onClick={onAdd}>
          <Plus className="size-4" aria-hidden /> Agregar hito
        </Chip>
      </div>
    </div>
  );
}

/**
 * Paso 1 de /nuevo: la persona le cuenta el trabajo al agente en un chat y él arma los hitos.
 * Todo queda editable: el agente propone y la persona decide (PAC-37).
 */
export function IntakeChat({
  details,
  rows,
  rowErrors,
  listError,
  currencyError,
  onApplyDraft,
  onRowsChange,
  onDetailsChange,
  onContinue,
}: Props) {
  const nextId = useRef(1);
  const newMessage = (
    from: ChatMessage["from"],
    text: string,
  ): ChatMessage => ({ id: nextId.current++, from, text });

  // El primer mensaje tiene id fijo: el contador (ref) solo se usa dentro de los eventos, no al renderizar.
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, from: "agent", text: WELCOME_MESSAGE },
  ]);
  const [userTexts, setUserTexts] = useState<string[]>([]);
  const [draftText, setDraftText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [hasMilestones, setHasMilestones] = useState(false);
  const [agentNotes, setAgentNotes] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showCurrencies, setShowCurrencies] = useState(false);
  const [showDays, setShowDays] = useState(false);
  const [days, setDays] = useState("3");

  const hasErrors =
    rowErrors.some((errors) => Object.keys(errors).length > 0) || !!listError;
  const editorOpen = editing || hasErrors;
  const currenciesOpen = showCurrencies || !!currencyError;

  function addMessage(from: ChatMessage["from"], text: string) {
    setMessages((current) => [...current, newMessage(from, text)]);
  }

  async function send() {
    const text = draftText.trim();
    if (!text || thinking) return;

    const allTexts = [...userTexts, text];
    setUserTexts(allTexts);
    setDraftText("");
    setFailed(false);
    addMessage("user", text);
    setThinking(true);

    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: joinUserMessages(allTexts) }),
      });
      const body = (await response.json().catch(() => null)) as
        (IntakeDraftResponse & { error?: string }) | null;

      if (!response.ok || !body?.milestones) {
        // El formulario queda como estaba: la persona puede seguir a mano.
        addMessage("agent", body?.error ?? FAILURE_MESSAGE);
        setFailed(true);
        return;
      }
      const loaded = onApplyDraft(body, joinUserMessages(allTexts));
      setAgentNotes(body.notes);
      setHasMilestones(loaded > 0);
      setEditing(false);
      addMessage(
        "agent",
        loaded > 0
          ? `¡Listo! Lo armé en ${loaded} ${loaded === 1 ? "hito" : "hitos"}. Revisalo y cambiá lo que quieras:`
          : FAILURE_MESSAGE,
      );
    } catch {
      addMessage("agent", NETWORK_ERROR);
      setFailed(true);
    } finally {
      setThinking(false);
    }
  }

  function startByHand() {
    setHasMilestones(true);
    setEditing(true);
    if (rows.length === 0) onRowsChange([newMilestoneRow()]);
    addMessage(
      "agent",
      "Dale, cargalos vos. Completá cada hito y después seguimos.",
    );
  }

  function addMilestone() {
    if (rows.length >= MAX_MILESTONES) return;
    onRowsChange([...rows, newMilestoneRow()]);
    setEditing(true);
  }

  return (
    <section
      aria-label="Contale el trabajo al agente"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-4" aria-live="polite">
        {messages.map((message) =>
          message.from === "user" ? (
            <UserBubble key={message.id} text={message.text} />
          ) : (
            <AgentBubble key={message.id}>{message.text}</AgentBubble>
          ),
        )}

        {thinking && (
          <AgentBubble>
            <span role="status">Pensando los hitos…</span>
          </AgentBubble>
        )}
      </div>

      {hasMilestones && (
        <>
          <AgentBubble wide>
            <MilestonesCard
              rows={rows}
              currency={details.clientCurrency}
              editing={editorOpen}
              onToggleEdit={() => setEditing(!editing)}
              onAdd={addMilestone}
            />
          </AgentBubble>

          {editorOpen && (
            <div className="rounded-3xl border bg-card p-4">
              <MilestonesStep
                rows={rows}
                rowErrors={rowErrors}
                listError={listError}
                currency={details.clientCurrency}
                onChange={onRowsChange}
              />
            </div>
          )}

          {agentNotes.length > 0 && (
            <AgentBubble>
              <ul className="flex flex-col gap-1">
                {agentNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </AgentBubble>
          )}

          <AgentBubble>{explainAgreement(details)}</AgentBubble>

          <div className="flex flex-wrap gap-2">
            <Chip
              onClick={() => setShowCurrencies(!showCurrencies)}
              pressed={currenciesOpen}
            >
              Cambiar monedas
            </Chip>
            <Chip onClick={() => setShowDays(!showDays)} pressed={showDays}>
              Cambiar plazos
            </Chip>
          </div>

          {currenciesOpen && (
            <div className="grid gap-3 rounded-3xl border bg-card p-4 sm:grid-cols-2">
              <CurrencySelect
                id="chat-client-currency"
                label="Tu cliente paga en"
                value={details.clientCurrency}
                onChange={(clientCurrency) =>
                  onDetailsChange({ ...details, clientCurrency })
                }
              />
              <CurrencySelect
                id="chat-payout-currency"
                label="Vos cobrás en"
                value={details.payoutCurrency}
                onChange={(payoutCurrency) =>
                  onDetailsChange({ ...details, payoutCurrency })
                }
              />
              {currencyError && (
                <p
                  role="alert"
                  className="text-sm font-medium text-destructive sm:col-span-2"
                >
                  {currencyError}
                </p>
              )}
            </div>
          )}

          {showDays && (
            <div className="flex flex-wrap items-end gap-3 rounded-3xl border bg-card p-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="chat-days" className="text-sm font-medium">
                  Días que tiene tu cliente para revisar cada entrega
                </label>
                <Input
                  id="chat-days"
                  inputMode="numeric"
                  className="w-24"
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => onRowsChange(withReviewDays(rows, days))}
              >
                Aplicar a todos los hitos
              </Button>
            </div>
          )}
        </>
      )}

      {!hasMilestones && (
        <div className="flex flex-wrap gap-2">
          {userTexts.length === 0 && (
            <Chip onClick={() => setDraftText(EXAMPLE_TEXT)}>
              Ver un ejemplo
            </Chip>
          )}
          {(failed || userTexts.length === 0) && (
            <Chip onClick={startByHand}>Prefiero cargar los hitos a mano</Chip>
          )}
        </div>
      )}

      <form
        className="flex items-center gap-2 rounded-full border bg-card py-1.5 pr-1.5 pl-4"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          Escribile al agente
        </label>
        <input
          id="chat-input"
          value={draftText}
          maxLength={MAX_TEXT_LENGTH}
          disabled={thinking}
          onChange={(event) => setDraftText(event.target.value)}
          placeholder={
            hasMilestones
              ? "Pedile un cambio, por ejemplo: el logo final cuesta 700"
              : "Escribile al agente…"
          }
          className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />
        <Button
          type="submit"
          size="icon"
          className="rounded-full"
          disabled={thinking || !draftText.trim()}
          aria-label="Enviar"
        >
          <ArrowUp />
        </Button>
      </form>

      {hasMilestones && (
        <Button
          type="button"
          size="lg"
          className="bg-highlight text-highlight-foreground hover:bg-highlight/90"
          onClick={onContinue}
        >
          Está bien, seguir
        </Button>
      )}
    </section>
  );
}
