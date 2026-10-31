"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { canDeliver, deliverErrorMessage, validateDeliveryUrl } from "@/lib/deliver";

type Props = {
  milestoneId: string;
  milestoneTitle: string;
  status: string;
  freelancerWallet: string;
};

/** Botón "Marcar como entregado" + hoja con link y nota. Usa el POST de PAC-22. */
export function DeliverDialog({ milestoneId, milestoneTitle, status, freelancerWallet }: Props) {
  const router = useRouter();
  const { address } = useAccount();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [urlError, setUrlError] = useState<string>();
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  if (!canDeliver(status, address, freelancerWallet)) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validateDeliveryUrl(url);
    setUrlError(invalid);
    setError(undefined);
    if (invalid) return;

    setSending(true);
    try {
      const response = await fetch(`/api/milestones/${milestoneId}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freelancerWallet: address,
          deliveryUrl: url.trim(),
          ...(note.trim() ? { deliveryNote: note.trim() } : {}),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(deliverErrorMessage(response.status, body.error));
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("No pudimos conectarnos. Revisá tu internet e intentá de nuevo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full sm:w-auto">
          Marcar como entregado
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Entregar: {milestoneTitle}</DialogTitle>
            <DialogDescription>
              Dejale a tu cliente el link para revisar el trabajo. Cuando lo apruebe, cobrás.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="delivery-url" className="text-sm font-medium">
              Link de la entrega
            </label>
            <Input
              id="delivery-url"
              type="url"
              inputMode="url"
              placeholder="https://drive.google.com/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={!!urlError}
            />
            {urlError && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {urlError}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="delivery-note" className="text-sm font-medium">
              Nota para el cliente (opcional)
            </label>
            <Textarea
              id="delivery-note"
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" size="lg" disabled={sending}>
              {sending ? "Enviando…" : "Confirmar entrega"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
