"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { IntakeDraftResponse } from "@/lib/intake/apply-draft";

const MAX_TEXT_LENGTH = 4000; // el mismo tope que la API
const FALLBACK_ERROR = "No pudimos armar los hitos, cargalos a mano.";

type Props = {
  /** Recibe la propuesta y el texto original. Devuelve cuántos hitos se cargaron. */
  onApply: (draft: IntakeDraftResponse, text: string) => number;
};

/** Caja de /nuevo donde la freelancer cuenta el trabajo y la IA le propone los hitos (PAC-37). */
export function IntakeBox({ onApply }: Props) {
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string>();
  const [loadedCount, setLoadedCount] = useState<number>();

  async function buildMilestones() {
    if (thinking) return;
    if (!text.trim()) {
      setError("Contanos primero qué trabajo vas a hacer.");
      return;
    }

    setThinking(true);
    setError(undefined);
    setLoadedCount(undefined);
    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = (await response.json().catch(() => null)) as
        | (IntakeDraftResponse & { error?: string })
        | null;

      if (!response.ok || !body?.milestones) {
        // El formulario queda como estaba: la persona puede seguir a mano.
        setError(body?.error ?? FALLBACK_ERROR);
        return;
      }
      setLoadedCount(onApply(body, text));
    } catch {
      setError(`${FALLBACK_ERROR} Revisá tu internet.`);
    } finally {
      setThinking(false);
    }
  }

  return (
    <section
      id="intake"
      aria-label="Armar el acuerdo con ayuda de la IA"
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="size-5" aria-hidden /> Contanos el trabajo
        </h2>
        <label htmlFor="intake-text" className="text-sm text-muted-foreground">
          Como se lo contarías a una amiga: qué hacés, en cuántas entregas y cuánto cobrás. Nosotros armamos
          los hitos y vos los revisás.
        </label>
      </div>

      <Textarea
        id="intake-text"
        value={text}
        maxLength={MAX_TEXT_LENGTH}
        disabled={thinking}
        placeholder="Logo y manual de marca, 3 entregas, 1500 reales en total."
        onChange={(event) => setText(event.target.value)}
      />

      <Button type="button" className="w-fit" disabled={thinking} onClick={buildMilestones}>
        {thinking ? "Pensando los hitos…" : "Armar hitos"}
      </Button>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {loadedCount !== undefined && (
        <p role="status" className="text-sm">
          Listo: cargamos {loadedCount} {loadedCount === 1 ? "hito" : "hitos"}. Revisá los datos del trabajo
          y después tus hitos en el paso 2: todo se puede editar.
        </p>
      )}
    </section>
  );
}
