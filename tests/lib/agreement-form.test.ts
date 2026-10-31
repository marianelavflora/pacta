import { describe, expect, it } from "vitest";
import { formatUnits, parseAmountToUnits } from "@/lib/amounts";
import {
  emptyDetails,
  toMilestonePayload,
  totalUnits,
  validateDetails,
  validateMilestones,
  type MilestoneRow,
} from "@/lib/agreement-form";

const row = (amount: string, title = "Logo", reviewDays = "3"): MilestoneRow => ({
  id: amount + title,
  title,
  amount,
  reviewDays,
});

describe("parseAmountToUnits", () => {
  it("convierte sin floats", () => {
    expect(parseAmountToUnits("1500,50")).toBe(BigInt("1500500000000000000000"));
    expect(parseAmountToUnits("1.500,50")).toBe(BigInt("1500500000000000000000"));
    expect(parseAmountToUnits("1.500")).toBe(BigInt("1500000000000000000000"));
    expect(parseAmountToUnits("0.1")).toBe(BigInt("100000000000000000"));
  });
  it("rechaza lo que no se entiende", () => {
    for (const bad of ["", "abc", "-5", "1,2,3", "0,1234567890123456789"]) {
      expect(parseAmountToUnits(bad)).toBeNull();
    }
  });
  it("formatUnits vuelve al texto", () => {
    expect(formatUnits(BigInt("1500500000000000000000"))).toBe("1.500,5");
    expect(formatUnits(BigInt("500000000000000000000"))).toBe("500");
  });
});

describe("validación del formulario", () => {
  it("avisa los campos vacíos de los datos", () => {
    const errors = validateDetails(emptyDetails);
    expect(errors.title).toBeDefined();
    expect(errors.clientContact).toBe("Necesitamos un WhatsApp o un mail");
    expect(errors.clientCurrency).toBeDefined();
    expect(errors.payoutCurrency).toBeUndefined();
  });
  it("acepta mail o WhatsApp", () => {
    const ok = { ...emptyDetails, title: "a", description: "b", clientCurrency: "wBRL" as const };
    expect(validateDetails({ ...ok, clientContact: "a@b.com" })).toEqual({});
    expect(validateDetails({ ...ok, clientContact: "+55 11 91234 5678" })).toEqual({});
    expect(validateDetails({ ...ok, clientContact: "hola" }).clientContact).toBeDefined();
  });
  it("no deja montos vacíos, en cero ni negativos", () => {
    const { rowErrors, valid } = validateMilestones([row(""), row("0"), row("-3"), row("500")]);
    expect(valid).toBe(false);
    expect(rowErrors.map((e) => !!e.amount)).toEqual([true, true, true, false]);
  });
  it("pide al menos 1 hito y no más de 10", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => row("1", `h${i}`));
    expect(validateMilestones([]).valid).toBe(false);
    expect(validateMilestones(many(11)).valid).toBe(false);
    expect(validateMilestones(many(10)).valid).toBe(true);
  });
  it("el total es la suma exacta y el payload sale en unidades mínimas", () => {
    const rows = [row("500"), row("0,1", "b"), row("1000", "c")];
    expect(totalUnits(rows)).toBe(BigInt("1500100000000000000000"));
    expect(toMilestonePayload(rows)[1]).toEqual({
      title: "b",
      amount: "100000000000000000",
      reviewDays: 3,
    });
  });
});
