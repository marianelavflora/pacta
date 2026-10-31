"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Copia el link del recibo para compartirlo. */
export function ShareReceipt() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" onClick={share}>
        {state === "copied" ? "¡Link copiado!" : "Compartir"}
      </Button>
      {state === "failed" && (
        <p role="alert" className="text-sm text-destructive">
          No pudimos copiarlo solo. Copiá el link desde la barra del navegador.
        </p>
      )}
    </div>
  );
}
