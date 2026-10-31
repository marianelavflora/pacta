"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DetailsStep } from "@/components/agreement-form/DetailsStep";
import { MilestonesStep, newMilestoneRow } from "@/components/agreement-form/MilestonesStep";
import {
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

  function next() {
    const errors = validateDetails(details);
    setDetailsErrors(errors);
    if (Object.keys(errors).length === 0) setStep(2);
  }

  function submit() {
    const result = validateMilestones(rows);
    setRowErrors(result.rowErrors);
    setListError(result.listError);
    if (!result.valid) return;
    // TODO(PAC-18): armar el pedido con toMilestonePayload(rows) + los datos del trabajo,
    // llamar a POST /api/agreements (falta la wallet de la freelancer) y mostrar el link
    // para compartir con el cliente.
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

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {step === 2 && (
          <Button type="button" variant="outline" onClick={() => setStep(1)}>
            Volver
          </Button>
        )}
        <Button type="submit" className="sm:ml-auto">
          {step === 1 ? "Siguiente" : "Revisar acuerdo"}
        </Button>
      </div>
    </form>
  );
}
