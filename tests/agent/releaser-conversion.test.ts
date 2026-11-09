// PAC-32 · El liberador cambia de moneda antes de pagar. Sin red: base en memoria, cadena y conversor falsos.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address, Hash } from "viem";

import {
  releaseMilestone,
  type Converter,
  type ReleaserChain,
  type ReleaserDeps,
} from "@/agent/releaser";
import { FakeDb } from "../helpers/fake-db";

const AGENT = "0xab569A8d8A5b60CFfdf9B88EdE099c80d8328E73" as Address;
const FREELANCER = "0x" + "f1".repeat(20);
const E18 = BigInt(10) ** BigInt(18);
const PAY_HASH = ("0x" + "ab".repeat(32)) as Hash;
const SWAP_HASH = ("0x" + "cd".repeat(32)) as Hash;

let db: FakeDb;
let chain: {
  balanceOf: ReturnType<typeof vi.fn>;
  simulateTransfer: ReturnType<typeof vi.fn>;
  transfer: ReturnType<typeof vi.fn>;
  waitForReceipt: ReturnType<typeof vi.fn>;
  getReceipt: ReturnType<typeof vi.fn>;
};
let converter: { estimate: ReturnType<typeof vi.fn>; convert: ReturnType<typeof vi.fn> };

// Cliente paga en wBRL (100) y la freelancera cobra en wARS: el cambio estimado es 500 y llegan 480.
function setup(status = "approved") {
  db = new FakeDb();
  db.tables.users.push({ id: "u1", wallet: FREELANCER });
  db.tables.agreements.push({
    id: "a1",
    freelancer_id: "u1",
    client_currency: "wBRL",
    payout_currency: "wARS",
  });
  db.tables.milestones.push({
    id: "m1",
    agreement_id: "a1",
    status,
    amount: (BigInt(100) * E18).toString(),
  });
  chain = {
    balanceOf: vi.fn(async () => BigInt(10_000) * E18),
    simulateTransfer: vi.fn(async () => undefined),
    transfer: vi.fn(async () => PAY_HASH),
    waitForReceipt: vi.fn(async () => ({ status: "success" as const })),
    getReceipt: vi.fn(async () => null),
  };
  converter = {
    estimate: vi.fn(async () => BigInt(500) * E18),
    convert: vi.fn(async (_request, onProgress: (legs: unknown[]) => Promise<void>) => {
      await onProgress([{ swapHash: SWAP_HASH }]);
      return { amountOut: BigInt(480) * E18, finalTxHash: SWAP_HASH, legs: [{ swapHash: SWAP_HASH }] };
    }),
  };
}

const deps = (extra: Partial<ReleaserDeps> = {}): ReleaserDeps => ({
  db: db.asClient(),
  chain: chain as unknown as ReleaserChain,
  converter: converter as unknown as Converter,
  agentAddress: AGENT,
  tokenAddress: (currency) => `0x${currency === "wARS" ? "aa" : "bb"}`.padEnd(42, "0") as Address,
  ...extra,
});
const milestone = () => db.tables.milestones[0];
const movement = (kind: string) => db.tables.movements.find((m) => m.kind === kind);

describe("liberador: cambia de moneda y paga lo que llegó", () => {
  beforeEach(() => setup());

  it("sin conversor, las monedas distintas siguen sin pagarse", async () => {
    const result = await releaseMilestone(deps({ converter: undefined }), "m1");
    expect(result.kind).toBe("needs_conversion");
    expect(milestone().status).toBe("approved");
    expect(db.tables.movements).toHaveLength(0);
  });

  it("cambia, guarda el cambio y paga el monto convertido", async () => {
    const result = await releaseMilestone(deps(), "m1");

    expect(result).toMatchObject({ kind: "paid", amount: (BigInt(480) * E18).toString() });
    expect(milestone().status).toBe("paid");

    const conversion = movement("conversion")!;
    expect(conversion).toMatchObject({
      status: "confirmed",
      from_currency: "wBRL",
      to_currency: "wARS",
      amount_in: (BigInt(100) * E18).toString(),
      amount_out: (BigInt(480) * E18).toString(),
      fx_rate: "4.800000000000",
      tx_hash: SWAP_HASH,
    });
    expect(conversion.details).toMatchObject({ provider: "textile", legs: [{ swapHash: SWAP_HASH }] });

    expect(movement("payout")).toMatchObject({ status: "confirmed", amount_out: (BigInt(480) * E18).toString() });
    expect(chain.transfer).toHaveBeenCalledTimes(1);
    expect(chain.transfer.mock.calls[0][2]).toBe(BigInt(480) * E18);
  });

  it("pide al conversor aceptar hasta un 10 % menos de lo estimado", async () => {
    await releaseMilestone(deps(), "m1");
    expect(converter.convert.mock.calls[0][0]).toMatchObject({
      from: "wBRL",
      to: "wARS",
      amountIn: BigInt(100) * E18,
      minAmountOut: BigInt(450) * E18,
    });
  });

  it("correrlo dos veces no cambia ni paga dos veces", async () => {
    await releaseMilestone(deps(), "m1");
    const second = await releaseMilestone(deps(), "m1");
    expect(second.kind).toBe("already_paid");
    expect(converter.convert).toHaveBeenCalledTimes(1);
    expect(chain.transfer).toHaveBeenCalledTimes(1);
  });

  it("sin ruta real hoy, no cambia ni toca nada", async () => {
    converter.estimate.mockResolvedValue(null);
    const result = await releaseMilestone(deps(), "m1");
    expect(result.kind).toBe("needs_conversion");
    expect(converter.convert).not.toHaveBeenCalled();
    expect(db.tables.movements).toHaveLength(0);
    expect(milestone().status).toBe("approved");
  });

  it("frena antes de cambiar si lo estimado supera el tope de la moneda de cobro", async () => {
    const result = await releaseMilestone(deps({ maxPayoutByCurrency: { wARS: BigInt(100) * E18 } }), "m1");
    expect(result.kind).toBe("over_cap");
    expect(converter.convert).not.toHaveBeenCalled();
    expect(db.tables.movements).toHaveLength(0);
  });

  it("sin saldo de la moneda de origen no cambia", async () => {
    chain.balanceOf.mockResolvedValue(BigInt(1) * E18);
    const result = await releaseMilestone(deps(), "m1");
    expect(result.kind).toBe("insufficient_balance");
    expect(converter.convert).not.toHaveBeenCalled();
  });
});

describe("liberador: si el cambio falla", () => {
  beforeEach(() => setup());

  it("seguro que no salió plata: libera el índice, reabre el hito y se puede reintentar", async () => {
    converter.convert.mockRejectedValueOnce(Object.assign(new Error("sin liquidez"), { moneyMayHaveMoved: false }));
    const first = await releaseMilestone(deps(), "m1");
    expect(first).toMatchObject({ kind: "tx_failed", reason: "sin liquidez" });
    expect(movement("conversion")!.status).toBe("failed");
    expect(milestone().status).toBe("approved");
    expect(chain.transfer).not.toHaveBeenCalled();

    const retry = await releaseMilestone(deps(), "m1");
    expect(retry.kind).toBe("paid");
  });

  it("pudo haber salido plata: queda a revisión manual y NO se reintenta solo", async () => {
    converter.convert.mockRejectedValueOnce(Object.assign(new Error("tramo 2 falló"), { moneyMayHaveMoved: true }));
    const first = await releaseMilestone(deps(), "m1");
    expect(first.kind).toBe("needs_review");
    expect(milestone().status).toBe("converting");
    expect(movement("conversion")!.status).toBe("pending");

    const second = await releaseMilestone(deps(), "m1");
    expect(second.kind).toBe("needs_review");
    expect(converter.convert).toHaveBeenCalledTimes(1);
    expect(chain.transfer).not.toHaveBeenCalled();
  });

  it("un error sin información sobre la plata se trata como que pudo haber salido", async () => {
    converter.convert.mockRejectedValueOnce(new Error("timeout"));
    const result = await releaseMilestone(deps(), "m1");
    expect(result.kind).toBe("needs_review");
    expect(milestone().status).toBe("converting");
  });
});

describe("liberador: retomar un cambio ya confirmado", () => {
  it("si el cambio salió pero el pago no, la próxima corrida paga sin cambiar de nuevo", async () => {
    setup("converting");
    db.tables.movements.push({
      id: "mvC",
      agreement_id: "a1",
      milestone_id: "m1",
      kind: "conversion",
      status: "confirmed",
      amount_out: (BigInt(480) * E18).toString(),
      tx_hash: SWAP_HASH,
    });
    const result = await releaseMilestone(deps(), "m1");
    expect(result).toMatchObject({ kind: "paid", amount: (BigInt(480) * E18).toString() });
    expect(converter.convert).not.toHaveBeenCalled();
    expect(chain.transfer).toHaveBeenCalledTimes(1);
  });

  it("si el pago se revirtió después del cambio, el reintento paga sin cambiar de nuevo", async () => {
    setup();
    chain.waitForReceipt.mockResolvedValueOnce({ status: "reverted" as const });
    const first = await releaseMilestone(deps(), "m1");
    expect(first.kind).toBe("tx_failed");
    expect(milestone().status).toBe("approved");
    expect(movement("conversion")!.status).toBe("confirmed");

    const retry = await releaseMilestone(deps(), "m1");
    expect(retry).toMatchObject({ kind: "paid", amount: (BigInt(480) * E18).toString() });
    expect(converter.convert).toHaveBeenCalledTimes(1);
  });

  it("un cambio pendiente sin confirmar nunca se reanuda solo", async () => {
    setup("converting");
    db.tables.movements.push({
      id: "mvC",
      agreement_id: "a1",
      milestone_id: "m1",
      kind: "conversion",
      status: "pending",
      amount_out: null,
      tx_hash: null,
    });
    const result = await releaseMilestone(deps(), "m1");
    expect(result.kind).toBe("needs_review");
    expect(converter.convert).not.toHaveBeenCalled();
    expect(chain.transfer).not.toHaveBeenCalled();
  });
});

describe("liberador: retoma solo un cambio a medias (resumePending)", () => {
  function pendingConversion() {
    setup("converting");
    db.tables.movements.push({ id: "mvC", agreement_id: "a1", milestone_id: "m1", kind: "conversion", status: "pending", amount_out: null, tx_hash: null });
  }

  it("si el conversor lo completa, el liberador paga lo que llegó sin cambiar de nuevo", async () => {
    pendingConversion();
    const resumePending = vi.fn(async () => {
      Object.assign(db.tables.movements[0], { status: "confirmed", amount_out: (BigInt(480) * E18).toString() });
      return { kind: "completed" as const, amountOut: BigInt(480) * E18 };
    });
    const result = await releaseMilestone(deps({ converter: { ...converter, resumePending } as unknown as Converter }), "m1");
    expect(result).toMatchObject({ kind: "paid", amount: (BigInt(480) * E18).toString() });
    expect(resumePending).toHaveBeenCalledTimes(1);
    expect(converter.convert).not.toHaveBeenCalled();
    expect(chain.transfer).toHaveBeenCalledTimes(1);
  });

  it("si el conversor pide esperar, no paga ni cambia nada", async () => {
    pendingConversion();
    const resumePending = vi.fn(async () => ({ kind: "wait" as const, reason: "sin recibo todavía" }));
    const result = await releaseMilestone(deps({ converter: { ...converter, resumePending } as unknown as Converter }), "m1");
    expect(result.kind).toBe("in_progress");
    expect(chain.transfer).not.toHaveBeenCalled();
  });

  it("si no se puede retomar, queda a revisión manual con el motivo", async () => {
    pendingConversion();
    const resumePending = vi.fn(async () => ({ kind: "needs_review" as const, reason: "Ya se intentó 5 veces" }));
    const result = await releaseMilestone(deps({ converter: { ...converter, resumePending } as unknown as Converter }), "m1");
    expect(result).toEqual({ kind: "needs_review", reason: "Ya se intentó 5 veces" });
    expect(milestone().status).toBe("converting");
    expect(chain.transfer).not.toHaveBeenCalled();
  });

  it("un cambio que se cortó a la mitad en esta corrida se retoma en el próximo barrido", async () => {
    setup();
    converter.convert.mockRejectedValueOnce(Object.assign(new Error("tramo 2 falló"), { moneyMayHaveMoved: true }));
    expect((await releaseMilestone(deps(), "m1")).kind).toBe("needs_review");

    const resumePending = vi.fn(async () => {
      Object.assign(db.tables.movements[0], { status: "confirmed", amount_out: (BigInt(480) * E18).toString() });
      return { kind: "completed" as const, amountOut: BigInt(480) * E18 };
    });
    const retry = await releaseMilestone(deps({ converter: { ...converter, resumePending } as unknown as Converter }), "m1");
    expect(retry.kind).toBe("paid");
    expect(converter.convert).toHaveBeenCalledTimes(1);
  });
});
