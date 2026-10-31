"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUnits } from "@/lib/amounts";
import {
  DEFAULT_REVIEW_DAYS,
  MAX_MILESTONES,
  totalUnits,
  type MilestoneErrors,
  type MilestoneRow,
} from "@/lib/agreement-form";

type Props = {
  rows: MilestoneRow[];
  rowErrors: MilestoneErrors[];
  listError?: string;
  currency: string; // moneda del cliente, para mostrar
  onChange: (rows: MilestoneRow[]) => void;
};

export function newMilestoneRow(): MilestoneRow {
  return {
    id: crypto.randomUUID(),
    title: "",
    amount: "",
    reviewDays: String(DEFAULT_REVIEW_DAYS),
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm font-medium text-destructive">
      {message}
    </p>
  );
}

export function MilestonesStep({ rows, rowErrors, listError, currency, onChange }: Props) {
  const update = (id: string, patch: Partial<MilestoneRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const total = totalUnits(rows);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Un hito es cada parte del trabajo que se entrega y se cobra por separado. Podés cargar hasta{" "}
        {MAX_MILESTONES}.
      </p>

      <ul className="flex flex-col gap-4">
        {rows.map((row, i) => {
          const errors = rowErrors[i] ?? {};
          return (
            <li key={row.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Hito {i + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Sacar el hito ${i + 1}`}
                  disabled={rows.length <= 1}
                  onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                >
                  <Trash2 />
                </Button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${row.id}-title`} className="text-sm font-medium">
                  Qué entregás
                </label>
                <Input
                  id={`${row.id}-title`}
                  value={row.title}
                  placeholder="Logo final"
                  aria-invalid={!!errors.title}
                  onChange={(e) => update(row.id, { title: e.target.value })}
                />
                <FieldError message={errors.title} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${row.id}-amount`} className="text-sm font-medium">
                    Monto ({currency || "moneda del cliente"})
                  </label>
                  <Input
                    id={`${row.id}-amount`}
                    inputMode="decimal"
                    value={row.amount}
                    placeholder="500"
                    aria-invalid={!!errors.amount}
                    onChange={(e) => update(row.id, { amount: e.target.value })}
                  />
                  <FieldError message={errors.amount} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${row.id}-days`} className="text-sm font-medium">
                    Días para revisar
                  </label>
                  <Input
                    id={`${row.id}-days`}
                    inputMode="numeric"
                    value={row.reviewDays}
                    aria-invalid={!!errors.reviewDays}
                    onChange={(e) => update(row.id, { reviewDays: e.target.value })}
                  />
                  <FieldError message={errors.reviewDays} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <FieldError message={listError} />

      <Button
        type="button"
        variant="outline"
        disabled={rows.length >= MAX_MILESTONES}
        onClick={() => onChange([...rows, newMilestoneRow()])}
      >
        <Plus /> Agregar hito
      </Button>

      <p className="text-lg font-semibold" aria-live="polite">
        Total: {formatUnits(total)} {currency}
      </p>
    </div>
  );
}
