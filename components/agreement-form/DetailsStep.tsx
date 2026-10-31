"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES, type Currency } from "@/lib/validation/agreement";
import type { DetailsErrors, DetailsValues } from "@/lib/agreement-form";

type Props = {
  values: DetailsValues;
  errors: DetailsErrors;
  onChange: (values: DetailsValues) => void;
};

function Field({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  help: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      <p id={`${id}-help`} className="text-sm text-muted-foreground">
        {help}
      </p>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function describe(id: string, error?: string) {
  return error ? `${id}-help ${id}-error` : `${id}-help`;
}

export function DetailsStep({ values, errors, onChange }: Props) {
  const set = <K extends keyof DetailsValues>(key: K, value: DetailsValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <div className="flex flex-col gap-5">
      <Field id="title" label="Título" help="Un nombre corto para el trabajo." error={errors.title}>
        <Input
          id="title"
          value={values.title}
          placeholder="Logo para agencia"
          aria-invalid={!!errors.title}
          aria-describedby={describe("title", errors.title)}
          onChange={(e) => set("title", e.target.value)}
        />
      </Field>

      <Field
        id="description"
        label="Descripción del trabajo"
        help="Qué vas a hacer, para que el cliente sepa qué está pagando."
        error={errors.description}
      >
        <Textarea
          id="description"
          rows={5}
          value={values.description}
          aria-invalid={!!errors.description}
          aria-describedby={describe("description", errors.description)}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>

      <Field
        id="clientContact"
        label="WhatsApp o mail del cliente"
        help="Por acá le avisamos cuando haya algo para aprobar."
        error={errors.clientContact}
      >
        <Input
          id="clientContact"
          value={values.clientContact}
          placeholder="+55 11 91234 5678 o cliente@mail.com"
          autoComplete="off"
          aria-invalid={!!errors.clientContact}
          aria-describedby={describe("clientContact", errors.clientContact)}
          onChange={(e) => set("clientContact", e.target.value)}
        />
      </Field>

      <Field
        id="clientCurrency"
        label="Moneda del cliente"
        help="Es la moneda en la que te va a pagar. Si es de Brasil, elegí wBRL."
        error={errors.clientCurrency}
      >
        <CurrencySelect
          id="clientCurrency"
          value={values.clientCurrency}
          invalid={!!errors.clientCurrency}
          describedBy={describe("clientCurrency", errors.clientCurrency)}
          onChange={(v) => set("clientCurrency", v)}
        />
      </Field>

      <Field
        id="payoutCurrency"
        label="Moneda en la que cobrás"
        help="La moneda que querés recibir. Si cobrás en Argentina, wARS."
        error={errors.payoutCurrency}
      >
        <CurrencySelect
          id="payoutCurrency"
          value={values.payoutCurrency}
          invalid={!!errors.payoutCurrency}
          describedBy={describe("payoutCurrency", errors.payoutCurrency)}
          onChange={(v) => set("payoutCurrency", v)}
        />
      </Field>
    </div>
  );
}

function CurrencySelect({
  id,
  value,
  invalid,
  describedBy,
  onChange,
}: {
  id: string;
  value: Currency | "";
  invalid: boolean;
  describedBy: string;
  onChange: (value: Currency) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Currency)}>
      <SelectTrigger
        id={id}
        className="w-full"
        aria-invalid={invalid}
        aria-describedby={describedBy}
      >
        <SelectValue placeholder="Elegí una moneda" />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
