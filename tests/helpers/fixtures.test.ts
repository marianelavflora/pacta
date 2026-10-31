import { describe, expect, it } from "vitest";
import {
  MILESTONE_STATUSES,
  makeAgreement,
  makeMilestone,
  milestonesByStatus,
  units,
} from "./fixtures";

describe("datos de ejemplo", () => {
  it("units pasa texto a bigint con 18 decimales", () => {
    expect(units("1")).toBe(10n ** 18n);
    expect(units("12.5")).toBe(125n * 10n ** 17n);
    expect(units("0.000000000000000001")).toBe(1n);
    expect(() => units("1.0000000000000000001")).toThrow();
  });

  it("el acuerdo tiene 3 hitos y el total es la suma", () => {
    const a = makeAgreement();
    expect(a.milestones).toHaveLength(3);
    expect(a.milestones.reduce((s, m) => s + m.amount, 0n)).toBe(a.total_amount);
    expect(a.total_amount).toBe(units("2000"));
  });

  it("cada llamada devuelve una copia nueva", () => {
    const a = makeAgreement();
    a.milestones[0].status = "paid";
    expect(makeAgreement().milestones[0].status).toBe("pending");
  });

  it("hay un hito para cada estado", () => {
    expect(Object.keys(milestonesByStatus)).toEqual([...MILESTONE_STATUSES]);
    for (const status of MILESTONE_STATUSES) {
      expect(milestonesByStatus[status].status).toBe(status);
    }
    expect(makeMilestone("paused", { amount: 5n }).amount).toBe(5n);
  });
});
