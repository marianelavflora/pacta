import { describe, expect, it } from "vitest";
import { MILESTONE_STATUS_LABELS, milestoneStatusLabel } from "@/lib/ui/status";
import { MILESTONE_STATUSES } from "@/lib/validation/statuses";

describe("milestoneStatusLabel", () => {
  it("tiene un texto para cada estado oficial", () => {
    for (const s of MILESTONE_STATUSES) expect(MILESTONE_STATUS_LABELS[s]).toBeTruthy();
  });
  it("traduce los más comunes", () => {
    expect(milestoneStatusLabel("funded")).toBe("Depositado");
    expect(milestoneStatusLabel("delivered")).toBe("Entregado");
  });
  it("no se rompe con un estado desconocido", () => {
    expect(milestoneStatusLabel("otro")).toBe("En proceso");
  });
});
