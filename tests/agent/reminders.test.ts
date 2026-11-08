// PAC-38 y PAC-39 · Recordatorio al día 3 y auto-liberación al día 6. Base en memoria, sin red.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runReminders, timeUnitMs } from "@/agent/reminders";

const notifications = vi.hoisted(() => ({
  reminder: vi.fn(async () => []),
  release: vi.fn(async () => []),
}));
vi.mock("@/lib/notify/events", () => ({
  onReviewReminder: notifications.reminder,
  onAutoRelease: notifications.release,
}));

type Row = Record<string, unknown>;
const DAY = 86_400_000;
const NOW = new Date("2026-11-10T12:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

class FakeQuery {
  private op: "select" | "update" = "select";
  private patch: Row = {};
  private filters: ((r: Row) => boolean)[] = [];
  constructor(private rows: Row[]) {}
  select() {
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.patch = patch;
    return this;
  }
  eq(c: string, v: unknown) {
    this.filters.push((r) => r[c] === v);
    return this;
  }
  lte(c: string, v: string) {
    this.filters.push((r) => typeof r[c] === "string" && (r[c] as string) <= v);
    return this;
  }
  then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
    const matched = this.rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === "update") matched.forEach((r) => Object.assign(r, this.patch));
    return Promise.resolve({ data: matched.map((r) => ({ ...r })), error: null }).then(resolve, reject);
  }
}

let milestones: Row[];
const db = () => ({ from: () => new FakeQuery(milestones) }) as unknown as SupabaseClient;
const byId = (id: string) => milestones.find((m) => m.id === id)!;

beforeEach(() => {
  vi.clearAllMocks();
  milestones = [];
});

describe("recordatorio al día 3", () => {
  it("pasa a reminded un hito entregado hace 3 días y avisa al cliente", async () => {
    milestones.push({ id: "m1", agreement_id: "a1", status: "delivered", delivered_at: daysAgo(3) });
    const summary = await runReminders(db(), NOW, DAY);
    expect(summary).toEqual({ reminded: 1, expired: 0 });
    expect(byId("m1")).toMatchObject({ status: "reminded", reminded_at: NOW.toISOString() });
    expect(notifications.reminder).toHaveBeenCalledWith(expect.anything(), "a1", "m1");
  });

  it("no toca un hito entregado hace menos de 3 días", async () => {
    milestones.push({ id: "m1", agreement_id: "a1", status: "delivered", delivered_at: daysAgo(2) });
    expect(await runReminders(db(), NOW, DAY)).toEqual({ reminded: 0, expired: 0 });
    expect(byId("m1").status).toBe("delivered");
    expect(notifications.reminder).not.toHaveBeenCalled();
  });

  it("si corre dos veces, avisa una sola vez", async () => {
    milestones.push({ id: "m1", agreement_id: "a1", status: "delivered", delivered_at: daysAgo(4) });
    await runReminders(db(), NOW, DAY);
    await runReminders(db(), NOW, DAY);
    expect(notifications.reminder).toHaveBeenCalledTimes(1);
  });
});

describe("auto-liberación al día 6", () => {
  it("pasa a expired un hito recordado hace 3 días y avisa", async () => {
    milestones.push({ id: "m1", agreement_id: "a1", status: "reminded", reminded_at: daysAgo(3) });
    expect(await runReminders(db(), NOW, DAY)).toEqual({ reminded: 0, expired: 1 });
    expect(byId("m1").status).toBe("expired");
    expect(notifications.release).toHaveBeenCalledWith(expect.anything(), "a1", "m1");
  });

  it("no libera un hito recordado hace menos de 3 días", async () => {
    milestones.push({ id: "m1", agreement_id: "a1", status: "reminded", reminded_at: daysAgo(1) });
    expect(await runReminders(db(), NOW, DAY)).toEqual({ reminded: 0, expired: 0 });
    expect(byId("m1").status).toBe("reminded");
  });

  it("un hito muy atrasado no recibe recordatorio y liberación en la misma corrida", async () => {
    milestones.push({ id: "m1", agreement_id: "a1", status: "delivered", delivered_at: daysAgo(10) });
    await runReminders(db(), NOW, DAY);
    expect(byId("m1").status).toBe("reminded");
    await runReminders(db(), new Date(NOW.getTime() + 3 * DAY), DAY);
    expect(byId("m1").status).toBe("expired");
  });

  it("no toca hitos aprobados, pausados ni pagados", async () => {
    for (const status of ["approved", "paused", "paid", "funded"]) {
      milestones.push({ id: status, agreement_id: "a", status, delivered_at: daysAgo(30), reminded_at: daysAgo(30) });
    }
    expect(await runReminders(db(), NOW, DAY)).toEqual({ reminded: 0, expired: 0 });
  });
});

describe("TIME_UNIT", () => {
  it("minutes acorta los plazos; cualquier otro valor son días", () => {
    expect(timeUnitMs("minutes")).toBe(60_000);
    expect(timeUnitMs("days")).toBe(DAY);
    expect(timeUnitMs(undefined)).toBe(DAY);
  });
});
