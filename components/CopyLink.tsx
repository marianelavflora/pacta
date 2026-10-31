"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Muestra un link y un botón para copiarlo. */
export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="break-all rounded-md border bg-muted px-3 py-2 text-sm">{link}</p>
      <Button type="button" variant="outline" onClick={copy}>
        {copied ? "¡Copiado!" : "Copiar link"}
      </Button>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          No pudimos copiarlo solo. Mantené apretado el link y copialo a mano.
        </p>
      )}
    </div>
  );
}
