// Seguridad: con una sola base compartida entre testnet y mainnet, el liberador solo paga acuerdos cuyo
// depósito existe en la red actual. Sin red: base en memoria y cadena falsa.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address, Hash } from "viem";

import { releaseApproved, releaseMilestone, type ReleaserChain, type ReleaserDeps } from "@/agent/releaser";
import { FakeDb } from "../helpers/fake-db";

const AGENT = "0xab569A8d8A5b60CFfdf9B88EdE099c80d8328E73" as Address;
const TOKEN = "0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d" as Address;
const FREELANCER = "0x" + "f1".repeat(20);
const E18 = BigInt(10) ** BigInt(18);
const MAINNET_DEPOSIT = ("0x" + "aa".repeat(32)) as Hash;
const TESTNET_DEPOSIT = ("0x" + "bb".repeat(32)) as Hash;
const PAY_HASH = ("0x" + "cc".repeat(32)) as Hash;

let db: FakeDb;
let chain: {
  balanceOf: ReturnType<typeof vi.fn>;
  simulateTransfer: ReturnType<typeof vi.fn>;
  transfer: ReturnType<typeof vi.fn>;
  waitForReceipt: ReturnType<typeof vi.fn>;
  getReceipt: ReturnType<typeof vi.fn>;
};

/** Un acuerdo con un hito aprobado y, si se pide, un depósito confirmado con ese hash. */
function addAgreement(id: string, depositHash: Hash | null) {
  db.tables.agreements.push({ id: `a${id}`, freelancer_id: "u1", client_currency: "wARS", payout_currency: "wARS" });
  db.tables.milestones.push({ id: `m${id}`, agreement_id: `a${id}`, status: "approved", amount: (BigInt(100) * E18).toString() });
  if (depositHash) {
    db.tables.movements.push({
      id: `dep${id}`,
      agreement_id: `a${id}`,
      milestone_id: null,
      kind: "deposit",
      status: "confirmed",
      tx_hash: depositHash,
    });
  }
}

beforeEach(() => {
  db = new FakeDb();
  db.tables.users.push({ id: "u1", wallet: FREELANCER });
  chain = {
    balanceOf: vi.fn(async () => BigInt(10_000) * E18),
    simulateTransfer: vi.fn(async () => undefined),
    transfer: vi.fn(async () => PAY_HASH),
    waitForReceipt: vi.fn(async () => ({ status: "success" as const })),
    // Esta red (mainnet) conoce el depósito de mainnet y NO el de testnet.
    getReceipt: vi.fn(async (hash: Hash) => (hash === MAINNET_DEPOSIT ? { status: "success" as const } : null)),
  };
});

const deps = (extra: Partial<ReleaserDeps> = {}): ReleaserDeps => ({
  db: db.asClient(),
  chain: chain as unknown as ReleaserChain,
  agentAddress: AGENT,
  tokenAddress: () => TOKEN,
  onlyThisNetwork: true,
  ...extra,
});
const status = (id: string) => db.tables.milestones.find((m) => m.id === `m${id}`)!.status;

describe("el liberador solo paga acuerdos de esta red", () => {
  it("paga un acuerdo cuyo depósito existe en esta red", async () => {
    addAgreement("1", MAINNET_DEPOSIT);
    const result = await releaseMilestone(deps(), "m1");
    expect(result.kind).toBe("paid");
    expect(chain.transfer).toHaveBeenCalledTimes(1);
  });

  it("NO paga un acuerdo de testnet: su depósito no existe en esta red", async () => {
    addAgreement("1", TESTNET_DEPOSIT);
    const result = await releaseMilestone(deps(), "m1");
    expect(result.kind).toBe("wrong_network");
    expect(chain.transfer).not.toHaveBeenCalled();
    expect(status("1")).toBe("approved"); // queda tal cual, sin tocar
    expect(db.tables.movements.filter((m) => m.kind === "payout")).toHaveLength(0);
  });

  it("NO paga un acuerdo sin ningún depósito registrado", async () => {
    addAgreement("1", null);
    expect((await releaseMilestone(deps(), "m1")).kind).toBe("wrong_network");
    expect(chain.transfer).not.toHaveBeenCalled();
  });

  it("NO paga si el depósito existe pero se revirtió", async () => {
    addAgreement("1", MAINNET_DEPOSIT);
    chain.getReceipt.mockResolvedValue({ status: "reverted" });
    expect((await releaseMilestone(deps(), "m1")).kind).toBe("wrong_network");
    expect(chain.transfer).not.toHaveBeenCalled();
  });

  it("si el RPC falla al buscar el recibo, no paga (falla cerrado)", async () => {
    addAgreement("1", MAINNET_DEPOSIT);
    chain.getReceipt.mockRejectedValue(new Error("RPC caído"));
    expect((await releaseMilestone(deps(), "m1")).kind).toBe("wrong_network");
    expect(chain.transfer).not.toHaveBeenCalled();
  });

  it("alcanza con que UNO de los depósitos esté en esta red (depósito en partes)", async () => {
    addAgreement("1", TESTNET_DEPOSIT);
    db.tables.movements.push({ id: "dep1b", agreement_id: "a1", milestone_id: null, kind: "deposit", status: "confirmed", tx_hash: MAINNET_DEPOSIT });
    expect((await releaseMilestone(deps(), "m1")).kind).toBe("paid");
  });

  it("sin la guarda (tests, o una base propia) se comporta como siempre", async () => {
    addAgreement("1", null);
    expect((await releaseMilestone(deps({ onlyThisNetwork: false }), "m1")).kind).toBe("paid");
  });

  it("el barrido del cron paga lo de esta red y deja pasar lo de testnet sin marcarlo como error", async () => {
    addAgreement("1", TESTNET_DEPOSIT);
    addAgreement("2", MAINNET_DEPOSIT);

    const summary = await releaseApproved(deps());

    expect(summary.results).toMatchObject({ m1: "wrong_network", m2: "paid" });
    expect(summary.paid).toBe(1);
    expect(status("1")).toBe("approved");
    expect(status("2")).toBe("paid");
    expect(chain.transfer).toHaveBeenCalledTimes(1);
  });

  it("un hito que ya está en converting se reconcilia sin pedir de nuevo el depósito", async () => {
    addAgreement("1", MAINNET_DEPOSIT);
    db.tables.milestones[0].status = "converting";
    chain.getReceipt.mockClear();
    await releaseMilestone(deps(), "m1");
    // reconcile mira el recibo del pago, no el del depósito.
    expect(chain.getReceipt).not.toHaveBeenCalledWith(MAINNET_DEPOSIT);
  });
});
