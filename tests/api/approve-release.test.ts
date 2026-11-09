// Pagar apenas se aprueba (workaround del cron diario del plan Hobby). Sin red: todo lo de afuera es un doble.
import { beforeEach, describe, expect, it, vi } from "vitest";

const MILESTONE = "11111111-1111-1111-1111-111111111111";

const mocks = vi.hoisted(() => ({
  approveMilestone: vi.fn(),
  releaseMilestone: vi.fn(),
  getReleaserDeps: vi.fn(() => ({ fake: "deps" })),
  afterCallbacks: [] as (() => Promise<void> | void)[],
}));

vi.mock("next/server", () => ({
  // `after` real corre el trabajo cuando ya se respondió: acá lo guardamos y lo corremos a mano.
  after: (callback: () => Promise<void> | void) => {
    mocks.afterCallbacks.push(callback);
  },
}));
vi.mock("@/lib/approvals", () => ({ approveMilestone: mocks.approveMilestone }));
vi.mock("@/agent/releaser", () => ({ releaseMilestone: mocks.releaseMilestone }));
vi.mock("@/agent/releaser-server", () => ({ getReleaserDeps: mocks.getReleaserDeps }));
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/chain/chains", () => ({ getChain: () => ({ id: 42220 }) }));

import { POST } from "@/app/api/milestones/[id]/approve/route";

const SIGNATURE = "0x" + "ab".repeat(65);
const milestone = { id: MILESTONE, status: "approved", amount: "1", approvedAt: "2026-11-09T00:00:00Z" };

function call() {
  const request = new Request(`https://pacta.test/api/milestones/${MILESTONE}/approve`, {
    method: "POST",
    body: JSON.stringify({ signature: SIGNATURE }),
  });
  return POST(request, { params: Promise.resolve({ id: MILESTONE }) } as never);
}
const runAfter = async () => {
  for (const callback of mocks.afterCallbacks.splice(0)) await callback();
};

beforeEach(() => {
  mocks.approveMilestone.mockReset();
  mocks.releaseMilestone.mockReset().mockResolvedValue({ kind: "paid", txHash: "0x1", amount: "1" });
  mocks.afterCallbacks.length = 0;
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("aprobar un hito paga apenas se responde", () => {
  it("una aprobación nueva responde y después manda a pagar ese hito", async () => {
    mocks.approveMilestone.mockResolvedValue({ kind: "approved", milestone });

    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: MILESTONE, status: "approved" });
    // Todavía no se pagó: el pago corre DESPUÉS de responder, sin hacer esperar a la persona.
    expect(mocks.releaseMilestone).not.toHaveBeenCalled();

    await runAfter();
    expect(mocks.releaseMilestone).toHaveBeenCalledTimes(1);
    expect(mocks.releaseMilestone).toHaveBeenCalledWith({ fake: "deps" }, MILESTONE);
  });

  it("una aprobación repetida no vuelve a mandar a pagar", async () => {
    mocks.approveMilestone.mockResolvedValue({ kind: "already_approved", milestone });
    const response = await call();
    expect(response.status).toBe(200);
    await runAfter();
    expect(mocks.releaseMilestone).not.toHaveBeenCalled();
  });

  it.each(["forbidden", "not_found", "no_client_wallet", "wrong_status"])(
    "si la aprobación es %s no se paga nada",
    async (kind) => {
      mocks.approveMilestone.mockResolvedValue({ kind, status: "paid" });
      await call();
      await runAfter();
      expect(mocks.releaseMilestone).not.toHaveBeenCalled();
    },
  );

  it("si el liberador falla, la aprobación igual quedó bien y el hito queda para el cron diario", async () => {
    mocks.approveMilestone.mockResolvedValue({ kind: "approved", milestone });
    mocks.releaseMilestone.mockRejectedValue(new Error("RPC caído"));

    const response = await call();
    expect(response.status).toBe(200);
    await expect(runAfter()).resolves.toBeUndefined(); // el error se anota, no se propaga
    expect(console.error).toHaveBeenCalled();
  });

  it("si ni siquiera se pueden armar las dependencias (por ejemplo, falta un tope), tampoco rompe la aprobación", async () => {
    mocks.approveMilestone.mockResolvedValue({ kind: "approved", milestone });
    mocks.getReleaserDeps.mockImplementationOnce(() => {
      throw new Error("Falta el tope por pago");
    });
    const response = await call();
    expect(response.status).toBe(200);
    await expect(runAfter()).resolves.toBeUndefined();
    expect(mocks.releaseMilestone).not.toHaveBeenCalled();
  });
});
