"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@/components/ConnectButton";
import { SubmitStep } from "@/components/agreement-form/SubmitStep";
import { Button } from "@/components/ui/button";
import { DetailsStep } from "@/components/agreement-form/DetailsStep";
import { IntakeChat } from "@/components/agreement-form/IntakeChat";
import { newMilestoneRow } from "@/components/agreement-form/MilestonesStep";
import { formatUnits } from "@/lib/amounts";
import {
  applyIntakeDraft,
  type IntakeDraftResponse,
} from "@/lib/intake/apply-draft";
import { clientUrl } from "@/lib/routes";
import { currencySymbol } from "@/lib/ui/currency";
import {
  buildAgreementPayload,
  emptyDetails,
  totalUnits,
  validateDetails,
  validateMilestones,
  type DetailsErrors,
  type DetailsValues,
  type MilestoneErrors,
  type MilestoneRow,
} from "@/lib/agreement-form";

const TOTAL_STEPS = 3;
const MISSING_CLIENT_CURRENCY = "Elegí la moneda en la que paga tu cliente.";

type CreatedAgreement = {
  link: string;
  title: string;
  clientContact: string;
  milestoneCount: number;
  total: string;
  totalUnits: string;
};

/**
 * Crear acuerdo en tres pasos (diseño de docs/pantallas.md):
 * 1) contarle el trabajo al agente (chat), 2) revisar los datos, 3) compartir el link.
 */
export function AgreementForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [details, setDetails] = useState<DetailsValues>(emptyDetails);
  const [detailsErrors, setDetailsErrors] = useState<DetailsErrors>({});
  const [rows, setRows] = useState<MilestoneRow[]>(() => [newMilestoneRow()]);
  const [rowErrors, setRowErrors] = useState<MilestoneErrors[]>([]);
  const [listError, setListError] = useState<string>();
  const [currencyError, setCurrencyError] = useState<string>();

  const { address, isConnected } = useAccount();
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [created, setCreated] = useState<CreatedAgreement>();

  function changeRows(updated: MilestoneRow[]) {
    setRows(updated);
    setRowErrors([]);
    setListError(undefined);
  }

  function changeDetails(updated: DetailsValues) {
    setDetails(updated);
    if (updated.clientCurrency) setCurrencyError(undefined);
  }

  // Carga lo que propuso el agente sin pisar lo que la persona ya escribió.
  // Devuelve cómo quedó el formulario, para que el chat sepa qué preguntar después.
  function applyDraft(draft: IntakeDraftResponse, text: string) {
    const applied = applyIntakeDraft(draft, text, details, newMilestoneRow);
    const rowsToKeep =
      applied.rows.length > 0 ? applied.rows : [newMilestoneRow()];
    changeDetails(applied.details);
    changeRows(rowsToKeep);
    setDetailsErrors({});
    return { details: applied.details, rows: rowsToKeep, count: applied.rows.length };
  }

  function continueToDetails() {
    const result = validateMilestones(rows);
    setRowErrors(result.rowErrors);
    setListError(result.listError);
    if (!details.clientCurrency) setCurrencyError(MISSING_CLIENT_CURRENCY);
    if (result.valid && details.clientCurrency) setStep(2);
  }

  // Valida y manda el acuerdo a la API. Devuelve el error para mostrar, o undefined si salió bien.
  // "wallet" significa que falta conectar la billetera.
  async function createAgreement(): Promise<string | undefined> {
    const errors = validateDetails(details);
    setDetailsErrors(errors);
    setSubmitError(undefined);
    if (Object.keys(errors).length > 0 || sending) return "Faltan datos";
    if (!isConnected || !address) {
      setSubmitError("wallet");
      return "wallet";
    }

    setSending(true);
    try {
      const res = await fetch("/api/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAgreementPayload(details, rows, address)),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        publicId?: string;
      };
      if (!res.ok || !data.publicId) {
        const message =
          data.error ??
          "No pudimos guardar el acuerdo. Probá de nuevo en un rato.";
        setSubmitError(message);
        return message;
      }
      setCreated({
        link: window.location.origin + clientUrl(data.publicId),
        title: details.title,
        clientContact: details.clientContact,
        milestoneCount: rows.length,
        total: `${currencySymbol(details.clientCurrency)} ${formatUnits(totalUnits(rows))}`,
        totalUnits: totalUnits(rows).toString(),
      });
      return undefined;
    } catch {
      const message =
        "No pudimos conectarnos. Revisá tu internet y probá de nuevo. Lo que cargaste sigue acá.";
      setSubmitError(message);
      return message;
    } finally {
      setSending(false);
    }
  }

  function submit() {
    void createAgreement();
  }

  if (created) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Paso 3 de {TOTAL_STEPS}
        </p>
        <SubmitStep
          {...created}
          clientCurrency={details.clientCurrency}
          payoutCurrency={details.payoutCurrency || "wARS"}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Paso {step} de {TOTAL_STEPS}
      </p>

      {step === 1 ? (
        <>
          <h2 className="text-3xl font-bold tracking-tight">
            Contame el trabajo
          </h2>
          <IntakeChat
            details={details}
            rows={rows}
            rowErrors={rowErrors}
            listError={listError}
            currencyError={currencyError}
            onApplyDraft={applyDraft}
            onRowsChange={changeRows}
            onDetailsChange={changeDetails}
            onContinue={continueToDetails}
            onGenerate={createAgreement}
            generating={sending}
          />
        </>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <h2 className="text-3xl font-bold tracking-tight">
            Los datos del trabajo
          </h2>
          <DetailsStep
            values={details}
            errors={detailsErrors}
            onChange={changeDetails}
          />

          {submitError === "wallet" ? (
            <div
              role="alert"
              className="flex flex-col items-start gap-2 rounded-md border border-destructive/50 p-3 text-sm"
            >
              <p>
                Para crear el acuerdo conectá tu billetera (MetaMask o MiniPay):
                ahí vas a cobrar.
              </p>
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
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Volver a los hitos
            </Button>
            <Button type="submit" className="sm:ml-auto" disabled={sending}>
              {sending ? "Creando…" : "Crear acuerdo"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
