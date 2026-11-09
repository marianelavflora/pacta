// PAC-32 · Recuperar un cambio que quedó a medias (agent/resume-conversion.ts). Sin red.
import { describe, expect, it, vi } from "vitest";
import { decodeFunctionData, encodeFunctionData, type Address, type Hash, type Hex } from "viem";

import {
  MAX_RECOVERY_ATTEMPTS,
  planResume,
  recoverConversion,
  resumeConversion,
  type ResumeDeps,
} from "@/agent/resume-conversion";
import { erc20Abi } from "@/lib/chain/tokens";
import type { SwapChain, TextileSwapDeps } from "@/lib/fx/textile-swap";
import { FakeDb } from "../helpers/fake-db";

const AGENT = "0xab569A8d8A5b60CFfdf9B88EdE099c80d8328E73" as Address;
const REACTOR = "0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3" as Address;
const USDT = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as Address;
const WARS = "0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d" as Address;
const WBRL = "0xd76f5faf6888e24d9f04bf92a0c8b921fe4390e0" as Address;
const E18 = BigInt(10) ** BigInt(18);
const USDT_RECEIVED = BigInt(1_807_300);
const NOW = Date.parse("2026-11-09T03:00:00Z");
const LEG1_HASH = ("0x" + "11".repeat(32)) as Hash;
const LEG2_HASH = ("0x" + "22".repeat(32)) as Hash;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

function secondLegQuote() {
  return json({
    data: {
      status: "quoted",
      rfqId: "rfq_2",
      claimToken: "claim_2",
      quote: {
        takerPays: USDT_RECEIVED.toString(),
        buyAmount: (BigInt(10) * E18).toString(),
        expiresAt: new Date(NOW + 50_000).toISOString(),
        spender: REACTOR,
      },
      transactions: {
        approval: {
          to: USDT,
          data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [REACTOR, USDT_RECEIVED] }),
          value: "0",
          chainId: 42220,
        },
        swap: { to: REACTOR, data: "0xdeadbeef", value: "0", chainId: 42220 },
      },
    },
  });
}

function setup(opts: { status?: string; legs?: unknown[]; movementStatus?: string } = {}) {
  const db = new FakeDb();
  db.tables.milestones.push({ id: "m1", agreement_id: "a1", status: opts.status ?? "converting", amount: "3000" });
  db.tables.movements.push({
    id: "mvC",
    agreement_id: "a1",
    milestone_id: "m1",
    kind: "conversion",
    status: opts.movementStatus ?? "pending",
    from_currency: "wARS",
    to_currency: "wBRL",
    amount_in: (BigInt(3000) * E18).toString(),
    details: {
      provider: "textile",
      legs: opts.legs ?? [{ sellToken: WARS, buyToken: USDT, sellAmount: "3000", swapHash: LEG1_HASH, approvalHash: "0xaa" }],
    },
  });

  // El tramo 1 dejó el USDT en el bloque 100. Un swap nuevo manda ese USDT y sube el wBRL.
  const balances: Record<string, bigint> = { [USDT.toLowerCase()]: USDT_RECEIVED, [WBRL.toLowerCase()]: BigInt(0) };
  const sent: { to: Address; data: Hex }[] = [];
  const chain: SwapChain = {
    balanceOf: vi.fn(async (token: Address, block?: bigint) => {
      if (token.toLowerCase() === USDT.toLowerCase() && block !== undefined) {
        return block >= BigInt(100) && block < BigInt(200) ? USDT_RECEIVED : BigInt(0);
      }
      // El swap del tramo 2 se mina en el bloque 200 y ahí llegan los wBRL.
      if (token.toLowerCase() === WBRL.toLowerCase() && block !== undefined) {
        return block >= BigInt(200) ? BigInt(10) * E18 : BigInt(0);
      }
      return balances[token.toLowerCase()] ?? BigInt(0);
    }),
    allowance: vi.fn(async () => BigInt(0)),
    send: vi.fn(async (tx) => {
      sent.push(tx);
      const isApproval = tx.data.startsWith("0x095ea7b3");
      if (!isApproval) {
        balances[WBRL.toLowerCase()] = BigInt(10) * E18;
        balances[USDT.toLowerCase()] = BigInt(0);
      }
      return (isApproval ? "0x" + "bb".repeat(32) : LEG2_HASH) as Hash;
    }),
    waitForReceipt: vi.fn(async (hash: Hash) => ({
      status: "success" as const,
      blockNumber: hash === LEG1_HASH ? BigInt(100) : BigInt(200),
    })),
    signTypedData: vi.fn(async () => "0xsigned" as Hex),
  };
  const fetcher = vi.fn(async (...args: [string | URL | Request, RequestInit?]) =>
    String(args[0]).includes("/submit") ? json({}) : secondLegQuote(),
  );
  const swap: TextileSwapDeps = {
    chainId: 42220,
    agent: AGENT,
    allowedContracts: [REACTOR],
    chain,
    fetcher: fetcher as unknown as typeof fetch,
    baseUrl: "https://textile.test/v2",
    now: () => NOW,
    sleep: async () => undefined,
  };
  const deps: ResumeDeps = {
    db: db.asClient(),
    swap,
    usdt: USDT,
    tokenAddress: (currency) => (currency === "wBRL" ? WBRL : WARS),
    estimate: vi.fn(async () => BigInt(10) * E18),
  };
  return { db, deps, sent, chain };
}

describe("recuperar un cambio a medias", () => {
  it("arma el plan leyendo cuánto USDT llegó del tramo 1 en el bloque de su recibo", async () => {
    const { deps } = setup();
    const plan = await planResume(deps, "m1");
    expect(plan).toMatchObject({
      from: "wARS",
      to: "wBRL",
      usdtAmount: USDT_RECEIVED,
      estimate: BigInt(10) * E18,
      minAmountOut: BigInt(9) * E18,
    });
    expect(plan.firstLeg.receivedAmount).toBe("1807300");
  });

  it("el ensayo no manda nada ni escribe en la base", async () => {
    const { deps, sent, db } = setup();
    await planResume(deps, "m1");
    expect(sent).toHaveLength(0);
    expect(db.tables.movements[0].status).toBe("pending");
  });

  it("hace el tramo 2, deja el cambio confirmado con los dos tramos y no toca el hito", async () => {
    const { deps, sent, db } = setup();
    const plan = await planResume(deps, "m1");

    const result = await resumeConversion(deps, plan);

    expect(result).toEqual({ amountOut: BigInt(10) * E18, finalTxHash: LEG2_HASH });
    expect(sent).toHaveLength(2); // aprobación + swap, solo del tramo 2
    expect(decodeFunctionData({ abi: erc20Abi, data: sent[0].data }).functionName).toBe("approve");
    const conversion = db.tables.movements[0];
    expect(conversion).toMatchObject({
      status: "confirmed",
      amount_out: (BigInt(10) * E18).toString(),
      fx_rate: "0.003333333333",
      tx_hash: LEG2_HASH,
    });
    const legs = (conversion.details as { legs: { swapHash?: string; receivedAmount?: string }[] }).legs;
    expect(legs).toHaveLength(2);
    expect(legs[0]).toMatchObject({ swapHash: LEG1_HASH, receivedAmount: "1807300" });
    expect(legs[1].swapHash).toBe(LEG2_HASH);
    // El pago lo hace el liberador de siempre: acá el hito sigue `converting`.
    expect(db.tables.milestones[0].status).toBe("converting");
  });

  describe("se niega si no es un caso retomable", () => {
    it("hito que no está en converting", async () => {
      const { deps } = setup({ status: "approved" });
      await expect(planResume(deps, "m1")).rejects.toThrow(/converting/);
    });
    it("cambio que ya está confirmado", async () => {
      const { deps } = setup({ movementStatus: "confirmed" });
      await expect(planResume(deps, "m1")).rejects.toThrow(/pending/);
    });
    it("sin tramo 1 guardado", async () => {
      const { deps } = setup({ legs: [] });
      await expect(planResume(deps, "m1")).rejects.toThrow(/tramos guardados/);
    });
    it("tramo 1 sin hash de swap: no se sabe si salió", async () => {
      const { deps } = setup({ legs: [{ sellToken: WARS, buyToken: USDT, sellAmount: "3000" }] });
      await expect(planResume(deps, "m1")).rejects.toThrow(/no se sabe si salió/);
    });
    it("el tramo 1 se revirtió", async () => {
      const { deps, chain } = setup();
      (chain.waitForReceipt as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "reverted", blockNumber: BigInt(100) });
      await expect(planResume(deps, "m1")).rejects.toThrow(/se revirtió/);
    });
    it("el agente ya no tiene el USDT", async () => {
      const { deps, chain } = setup();
      (chain.balanceOf as ReturnType<typeof vi.fn>).mockImplementation(async (_token: Address, block?: bigint) =>
        block === undefined ? BigInt(0) : block >= BigInt(100) ? USDT_RECEIVED : BigInt(0),
      );
      await expect(planResume(deps, "m1")).rejects.toThrow(/necesita/);
    });
    it("Textile no tiene ruta hoy", async () => {
      const { deps } = setup();
      (deps.estimate as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      await expect(planResume(deps, "m1")).rejects.toThrow(/ruta real/);
    });
  });
});

describe("recoverConversion: el liberador retoma solo lo que falta", () => {
  const LEG1 = { sellToken: WARS, buyToken: USDT, sellAmount: "3000", swapHash: LEG1_HASH, approvalHash: "0xaa" };
  const noQuote = () => json({ data: { status: "no_quote", reason: "no_makers_online" } });

  it("estado 1: con solo el tramo 1 hecho, hace el tramo 2 y deja el cambio confirmado", async () => {
    const { deps, db, sent } = setup();
    const outcome = await recoverConversion(deps, "m1");
    expect(outcome).toEqual({ kind: "completed", amountOut: BigInt(10) * E18 });
    expect(sent).toHaveLength(2); // solo aprobación + swap del tramo 2: el tramo 1 NO se repite
    expect(db.tables.movements[0]).toMatchObject({ status: "confirmed", tx_hash: LEG2_HASH });
  });

  it("estado 2: el tramo 2 se cortó antes de swapear (sin hash de swap): lo rehace con una cotización nueva", async () => {
    const { deps, sent } = setup({ legs: [LEG1, { sellToken: USDT, buyToken: WBRL, sellAmount: "1807300", approvalHash: "0xbb" }] });
    expect(await recoverConversion(deps, "m1")).toMatchObject({ kind: "completed" });
    expect(sent.length).toBeGreaterThan(0);
  });

  it("estado 3: el tramo 2 ya salió con recibo exitoso: cierra el cambio SIN mandar nada", async () => {
    const { deps, db, sent } = setup({ legs: [LEG1, { sellToken: USDT, buyToken: WBRL, sellAmount: "1807300", swapHash: LEG2_HASH }] });
    deps.getReceipt = vi.fn(async () => ({ status: "success" as const, blockNumber: BigInt(200) }));

    const outcome = await recoverConversion(deps, "m1");

    expect(outcome).toEqual({ kind: "completed", amountOut: BigInt(10) * E18 });
    expect(sent).toHaveLength(0);
    expect(db.tables.movements[0]).toMatchObject({ status: "confirmed", amount_out: (BigInt(10) * E18).toString() });
  });

  it("estado 4: el swap del tramo 2 se revirtió: lo reintenta (revertir no mueve plata)", async () => {
    const { deps, sent } = setup({ legs: [LEG1, { sellToken: USDT, buyToken: WBRL, sellAmount: "1807300", swapHash: LEG2_HASH }] });
    deps.getReceipt = vi.fn(async () => ({ status: "reverted" as const, blockNumber: BigInt(150) }));
    expect(await recoverConversion(deps, "m1")).toMatchObject({ kind: "completed" });
    expect(sent.length).toBeGreaterThan(0);
  });

  it("estado 5: el swap del tramo 2 todavía no tiene recibo: espera y no manda nada", async () => {
    const { deps, sent } = setup({ legs: [LEG1, { sellToken: USDT, buyToken: WBRL, sellAmount: "1807300", swapHash: LEG2_HASH }] });
    deps.getReceipt = vi.fn(async () => null);
    expect(await recoverConversion(deps, "m1")).toMatchObject({ kind: "wait" });
    expect(sent).toHaveLength(0);
  });

  it("sin forma de mirar el recibo del tramo 2, prefiere esperar a arriesgarse a swapear dos veces", async () => {
    const { deps, sent } = setup({ legs: [LEG1, { sellToken: USDT, buyToken: WBRL, sellAmount: "1807300", swapHash: LEG2_HASH }] });
    expect(await recoverConversion(deps, "m1")).toMatchObject({ kind: "wait" });
    expect(sent).toHaveLength(0);
  });

  it("si el tramo 2 vuelve a fallar, anota el intento y queda a revisión (el próximo barrido lo vuelve a probar)", async () => {
    const { deps, db, sent } = setup();
    deps.swap.fetcher = vi.fn(async () => noQuote()) as unknown as typeof fetch;

    const outcome = await recoverConversion(deps, "m1");

    expect(outcome.kind).toBe("needs_review");
    expect(sent).toHaveLength(0); // sin cotización no se mandó nada
    expect((db.tables.movements[0].details as { recoveryAttempts: number }).recoveryAttempts).toBe(1);
    expect(db.tables.movements[0].status).toBe("pending");
  });

  it(`pasado el tope de ${MAX_RECOVERY_ATTEMPTS} intentos no manda nada más: revisión manual`, async () => {
    const { deps, db, sent } = setup();
    (db.tables.movements[0].details as Record<string, unknown>).recoveryAttempts = MAX_RECOVERY_ATTEMPTS;
    const outcome = await recoverConversion(deps, "m1");
    expect(outcome).toMatchObject({ kind: "needs_review", reason: expect.stringMatching(/revisar a mano/) });
    expect(sent).toHaveLength(0);
  });

  it("nunca tira error: un caso que no es retomable da needs_review", async () => {
    const { deps } = setup({ status: "approved" });
    await expect(recoverConversion(deps, "m1")).resolves.toMatchObject({ kind: "needs_review" });
  });
});
