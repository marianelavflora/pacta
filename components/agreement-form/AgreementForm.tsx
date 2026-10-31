"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@/components/ConnectButton";
import { SubmitStep } from "@/components/agreement-form/SubmitStep";
import { clientUrl } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { DetailsStep } from "@/components/agreement-form/DetailsStep";
import { MilestonesStep, newMilestoneRow } from "@/components/agreement-form/MilestonesStep";
import {
  buildAgreementPayload,
  emptyDetails,
  validateDetails,
  validateMilestones,
  type DetailsErrors,
  type DetailsValues,
  type MilestoneErrors,
  type MilestoneRow,
} from "@/lib/agreement-form";

/** Formulario de /nuevo en dos pasos: datos del trabajo (PAC-16) y hitos (PAC-17). */
export function AgreementForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [details, setDetails] = useState<DetailsValues>(emptyDetails);
  const [detailsErrors, setDetailsErrors] = useState<DetailsErrors>({});
  const [rows, setRows] = useState<MilestoneRow[]>(() => [newMilestoneRow()]);
  const [rowErrors, setRowErrors] = useState<MilestoneErrors[]>([]);
  const [listError, setListError] = useState<string>();

  const { address, isConnected } = useAccount();
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [link, setLink] = useState<string>();

  function next() {
    const errors = validateDetails(details);
    setDetailsErrors(errors);
    if (Object.keys(errors).length === 0) setStep(2);
  }

  async function submit() {
    const result = validateMilestones(rows);
    setRowErrors(result.rowErrors);
    setListError(result.listError);
    setSubmitError(undefined);
    if (!result.valid || sending) return;
    if (!isConnected || !address) {
      setSubmitError("wallet");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAgreementPayload(details, rows, address)),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; publicId?: string };
      if (!res.ok || !data.publicId) {
        setSubmitError(data.error ?? "No pudimos guardar el acuerdo. Probá de nuevo en un rato.");
        return;
      }
      setLink(window.location.origin + clientUrl(data.publicId));
    } catch {
      setSubmitError("No pudimos conectarnos. Revisá tu internet y probá de nuevo. Lo que cargaste sigue acá.");
    } finally {
      setSending(false);
    }
  }

  if (link) {
    return <SubmitStep title={details.title} clientContact={details.clientContact} link={link} />;
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === 1) next();
        else submit();
      }}
    >
      <p className="text-sm text-muted-foreground">Paso {step} de 2</p>

      {step === 1 ? (
        <DetailsStep values={details} errors={detailsErrors} onChange={setDetails} />
      ) : (
        <MilestonesStep
          rows={rows}
          rowErrors={rowErrors}
          listError={listError}
          currency={details.clientCurrency}
          onChange={(updated) => {
            setRows(updated);
            setRowErrors([]);
            setListError(undefined);
          }}
        />
      )}

      {submitError === "wallet" ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-md border border-destructive/50 p-3 text-sm">
          <p>Para crear el acuerdo conectá tu billetera: ahí vas a cobrar.</p>
          <ConnectButton />
        </div>
      ) : (
        submitError && (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        )
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {step === 2 && (
          <Button type="button" variant="outline" onClick={() => setStep(1)}>
            Volver
          </Button>
        )}
        <Button type="submit" className="sm:ml-auto" disabled={sending}>
          {step === 1 ? "Siguiente" : sending ? "Creando…" : "Crear acuerdo"}
        </Button>
      </div>
    </form>
  );
}
