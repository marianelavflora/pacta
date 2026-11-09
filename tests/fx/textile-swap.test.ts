// PAC-32 · Cambio real con Textile (lib/fx/textile-swap.ts). Sin red: Textile y la cadena son falsos.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeFunctionData, encodeFunctionData, type Address, type Hash, type Hex } from "viem";

import { erc20Abi } from "@/lib/chain/tokens";
import {
  convertViaTextile,
  executeLeg,
  TextileSwapError,
  type LegRecord,
  type SwapChain,
  type TextileSwapDeps,
} from "@/lib/fx/textile-swap";

const AGENT = "0xab569A8d8A5b60CFfdf9B88EdE099c80d8328E73" as Address;
const REACTOR = "0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3" as Address;
const STRANGER = "0x1111111111111111111111111111111111111111" as Address;
const FROM = "0xd76f5faf6888e24d9f04bf92a0c8b921fe4390e0" as Address; // wBRL
const USDT = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as Address;
const TO = "0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d" as Address; // wARS
const E18 = BigInt(10) ** BigInt(18);
const E6 = BigInt(10) ** BigInt(6);
const NOW = Date.parse("2026-11-09T02:00:00Z");

const approveData = (spender: Address, amount: bigint): Hex =>
  encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] });

type QuoteOptions = {
  takerPays: bigint;
  buyAmount: bigint;
  swapTo?: Address;
  spender?: Address;
  approvalTo?: Address;
  approvalSpender?: Address;
  approvalAmount?: bigint;
  sellToken: Address;
  expiresInMs?: number;
};

function quotedResponse(o: QuoteOptions) {
  return {
    data: {
      status: "quoted",
      rfqId: "rfq_1",
      claimToken: "claim_1",
      quote: {
        takerPays: o.takerPays.toString(),
        buyAmount: o.buyAmount.toString(),
        expiresAt: new Date(NOW + (o.expiresInMs ?? 50_000)).toISOString(),
        spender: o.spender ?? REACTOR,
      },
      transactions: {
        approval: {
          to: o.approvalTo ?? o.sellToken,
          data: approveData(o.approvalSpender ?? REACTOR, o.approvalAmount ?? o.takerPays),
          value: "0",
          chainId: 42220,
        },
        swap: { to: o.swapTo ?? REACTOR, data: "0xdeadbeef", value: "0", chainId: 42220 },
      },
    },
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type FakeChain = SwapChain & {
  sent: { to: Address; data: Hex }[];
  signed: unknown[];
};

/** Cadena falsa: cada swap enviado suma `swapGives` del token de destino a los saldos. */
function fakeChain(balances: Record<string, bigint>, swapGives: Record<string, bigint>) {
  const sent: { to: Address; data: Hex }[] = [];
  let swaps = 0;
  const chain: FakeChain = {
    sent,
    signed: [],
    balanceOf: vi.fn(async (token: Address) => balances[token.toLowerCase()] ?? BigInt(0)),
    allowance: vi.fn(async () => BigInt(0)),
    send: vi.fn(async (tx) => {
      sent.push(tx);
      const isApproval = tx.data.startsWith("0x095ea7b3");
      if (!isApproval) {
        // El swap: baja lo vendido y sube lo comprado (según el tramo).
        const gives = Object.entries(swapGives)[swaps++];
        if (gives) balances[gives[0].toLowerCase()] = (balances[gives[0].toLowerCase()] ?? BigInt(0)) + gives[1];
      }
      return `0x${(sent.length).toString(16).padStart(64, "0")}` as Hash;
    }),
    waitForReceipt: vi.fn(async () => ({ status: "success" as const })),
    signTypedData: vi.fn(async (typed) => {
      chain.signed.push(typed);
      return "0xsigned" as Hex;
    }),
  };
  return chain;
}

function makeDeps(chain: SwapChain, responses: Response[], extra: Partial<TextileSwapDeps> = {}) {
  const queue = [...responses];
  const fetcher = vi.fn(async (...args: [string | URL | Request, RequestInit?]) => {
    const url = args[0];
    if (String(url).includes("/submit")) return json({ ok: true });
    const next = queue.shift();
    if (!next) throw new Error("no quedan respuestas de Textile");
    return next;
  });
  const deps: TextileSwapDeps = {
    chainId: 42220,
    agent: AGENT,
    allowedContracts: [REACTOR],
    chain,
    fetcher: fetcher as unknown as typeof fetch,
    baseUrl: "https://textile.test/v2",
    now: () => NOW,
    sleep: async () => undefined,
    ...extra,
  };
  return { deps, fetcher };
}

const noRecord = async () => undefined;
const leg = { sellToken: FROM, buyToken: USDT, sellAmount: BigInt(100) * E18 };

describe("un tramo con Textile", () => {
  let chain: FakeChain;
  beforeEach(() => {
    chain = fakeChain({ [FROM.toLowerCase()]: BigInt(100) * E18 }, { [USDT]: BigInt(20) * E6 });
  });

  it("aprueba, manda el swap y devuelve lo que llegó", async () => {
    const ok = quotedResponse({ sellToken: FROM, takerPays: BigInt(100) * E18, buyAmount: BigInt(20) * E6 });
    const { deps } = makeDeps(chain, [json(ok)]);
    const records: LegRecord[] = [];

    const result = await executeLeg(deps, leg, async (r) => void records.push({ ...r }));

    expect(result.received).toBe(BigInt(20) * E6);
    expect(chain.sent).toHaveLength(2);
    expect(chain.sent[0].to.toLowerCase()).toBe(FROM.toLowerCase()); // la aprobación va al token
    expect(chain.sent[1].to).toBe(REACTOR); // el swap, al contrato de Textile
    expect(result.record).toMatchObject({ rfqId: "rfq_1", sellAmount: (BigInt(100) * E18).toString() });
    // El hash de cada transacción se guarda apenas existe, antes de esperar el recibo.
    expect(records.some((r) => r.approvalHash && !r.swapHash)).toBe(true);
    expect(records.some((r) => r.swapHash)).toBe(true);
  });

  it("si Textile pide prueba de control, firma el EIP-712 con el dominio de Textile y reintenta", async () => {
    const ok = quotedResponse({ sellToken: FROM, takerPays: BigInt(100) * E18, buyAmount: BigInt(20) * E6 });
    const { deps, fetcher } = makeDeps(chain, [
      json({ error: { details: { reason: "proof_of_control_required" } } }, 401),
      json(ok),
    ]);

    await executeLeg(deps, leg, noRecord);

    expect(chain.signed).toHaveLength(1);
    expect(chain.signed[0]).toMatchObject({
      domain: { name: "Textile Taker Control", version: "1", chainId: 42220 },
      primaryType: "TakerControl",
      message: { taker: AGENT, chainId: BigInt(42220) },
    });
    const secondBody = JSON.parse((fetcher.mock.calls[1][1] as RequestInit).body as string);
    expect(secondBody.takerProof).toMatchObject({ signature: "0xsigned", issuedAt: NOW });
    expect(secondBody.taker).toBe(AGENT);
  });

  it("no manda la aprobación si el permiso actual ya alcanza", async () => {
    (chain.allowance as ReturnType<typeof vi.fn>).mockResolvedValue(BigInt(100) * E18);
    const ok = quotedResponse({ sellToken: FROM, takerPays: BigInt(100) * E18, buyAmount: BigInt(20) * E6 });
    const { deps } = makeDeps(chain, [json(ok)]);
    await executeLeg(deps, leg, noRecord);
    expect(chain.sent).toHaveLength(1);
    expect(chain.sent[0].to).toBe(REACTOR);
  });

  describe("rechaza lo sospechoso ANTES de mandar nada", () => {
    const cases: [string, Partial<QuoteOptions>][] = [
      ["un swap hacia un contrato que no es de Textile", { swapTo: STRANGER }],
      ["una aprobación a otro contrato", { approvalSpender: STRANGER }],
      ["una aprobación de otro token", { approvalTo: USDT }],
      ["una aprobación por más de lo que se gasta", { approvalAmount: BigInt(100) * E18 + BigInt(1) }],
      ["gastar más de lo pedido", { takerPays: BigInt(101) * E18, approvalAmount: BigInt(100) * E18 }],
    ];
    it.each(cases)("%s", async (_name, override) => {
      const body = quotedResponse({
        sellToken: FROM,
        takerPays: BigInt(100) * E18,
        buyAmount: BigInt(20) * E6,
        ...override,
      });
      const { deps } = makeDeps(chain, [json(body)]);
      const error = await executeLeg(deps, leg, noRecord).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(TextileSwapError);
      expect((error as TextileSwapError).moneyMayHaveMoved).toBe(false);
      expect(chain.sent).toHaveLength(0);
    });
  });

  it("sin liquidez (no_quote) falla sin haber mandado nada", async () => {
    const { deps } = makeDeps(chain, [json({ data: { status: "no_quote", reason: "no_makers_online" } })]);
    const error = (await executeLeg(deps, leg, noRecord).catch((e: unknown) => e)) as TextileSwapError;
    expect(error.message).toMatch(/no_makers_online/);
    expect(error.moneyMayHaveMoved).toBe(false);
    expect(chain.sent).toHaveLength(0);
  });

  it("si la cotización vence enseguida, pide otra en vez de mandar tarde", async () => {
    const stale = quotedResponse({ sellToken: FROM, takerPays: BigInt(100) * E18, buyAmount: BigInt(20) * E6, expiresInMs: 5_000 });
    const fresh = quotedResponse({ sellToken: FROM, takerPays: BigInt(100) * E18, buyAmount: BigInt(20) * E6 });
    const { deps, fetcher } = makeDeps(chain, [json(stale), json(fresh)]);
    await executeLeg(deps, leg, noRecord);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/rfq/request"))).toHaveLength(2);
    expect(chain.sent).toHaveLength(2);
  });

  it("frena una cotización que paga menos del mínimo aceptable", async () => {
    const body = quotedResponse({ sellToken: FROM, takerPays: BigInt(100) * E18, buyAmount: BigInt(20) * E6 });
    const { deps } = makeDeps(chain, [json(body)]);
    const error = (await executeLeg(deps, { ...leg, minBuyAmount: BigInt(30) * E6 }, noRecord).catch((e: unknown) => e)) as TextileSwapError;
    expect(error.message).toMatch(/menos de lo aceptable/);
    expect(chain.sent).toHaveLength(0);
  });

  it("un swap revertido no mueve plata: se puede reintentar", async () => {
    const body = quotedResponse({ sellToken: FROM, takerPays: BigInt(100) * E18, buyAmount: BigInt(20) * E6 });
    const { deps } = makeDeps(chain, [json(body)]);
    (chain.waitForReceipt as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ status: "success" }) // aprobación
      .mockResolvedValueOnce({ status: "reverted" }); // swap
    const error = (await executeLeg(deps, leg, noRecord).catch((e: unknown) => e)) as TextileSwapError;
    expect(error.moneyMayHaveMoved).toBe(false);
  });

  it("si llegó menos de lo prometido, avisa para revisar a mano", async () => {
    const lowChain = fakeChain({ [FROM.toLowerCase()]: BigInt(100) * E18 }, { [USDT]: BigInt(19) * E6 });
    const body = quotedResponse({ sellToken: FROM, takerPays: BigInt(100) * E18, buyAmount: BigInt(20) * E6 });
    const { deps } = makeDeps(lowChain, [json(body)]);
    const error = (await executeLeg(deps, leg, noRecord).catch((e: unknown) => e)) as TextileSwapError;
    expect(error.moneyMayHaveMoved).toBe(true);
  });

  it("el swap sale por la cadena con valor 0 (el tag lo pone el cliente de la wallet)", async () => {
    const ok = quotedResponse({ sellToken: FROM, takerPays: BigInt(100) * E18, buyAmount: BigInt(20) * E6 });
    const { deps } = makeDeps(chain, [json(ok)]);
    await executeLeg(deps, leg, noRecord);
    const approval = decodeFunctionData({ abi: erc20Abi, data: chain.sent[0].data });
    expect(approval.functionName).toBe("approve");
    expect(Object.keys(chain.sent[1]).sort()).toEqual(["data", "to"]);
  });
});

describe("cambio completo: moneda → USDT → moneda", () => {
  it("hace los dos tramos y devuelve lo que llegó al final", async () => {
    const chain = fakeChain(
      { [FROM.toLowerCase()]: BigInt(100) * E18 },
      { [USDT]: BigInt(20) * E6, [TO]: BigInt(480) * E18 },
    );
    const leg1 = quotedResponse({ sellToken: FROM, takerPays: BigInt(100) * E18, buyAmount: BigInt(20) * E6 });
    const leg2 = quotedResponse({ sellToken: USDT, takerPays: BigInt(20) * E6, buyAmount: BigInt(480) * E18 });
    const { deps } = makeDeps(chain, [json(leg1), json(leg2)]);
    const progress: number[] = [];

    const result = await convertViaTextile(
      deps,
      { fromToken: FROM, toToken: TO, usdt: USDT, amountIn: BigInt(100) * E18, minAmountOut: BigInt(450) * E18 },
      async (legs) => void progress.push(legs.length),
    );

    expect(result.amountOut).toBe(BigInt(480) * E18);
    expect(result.legs).toHaveLength(2);
    expect(result.finalTxHash).toBe(result.legs[1].swapHash);
    expect(chain.sent).toHaveLength(4); // 2 aprobaciones + 2 swaps
    expect(progress.length).toBeGreaterThan(2);
    // El tramo 2 vende exactamente el USDT que llegó del tramo 1.
    expect(result.legs[1].sellAmount).toBe((BigInt(20) * E6).toString());
  });

  it("si falla el tramo 1 con seguridad, no hay plata en juego", async () => {
    const chain = fakeChain({ [FROM.toLowerCase()]: BigInt(100) * E18 }, {});
    const { deps } = makeDeps(chain, [json({ data: { status: "no_quote", reason: "no_valid_quote" } })]);
    const error = (await convertViaTextile(
      deps,
      { fromToken: FROM, toToken: TO, usdt: USDT, amountIn: BigInt(100) * E18, minAmountOut: BigInt(1) },
      async () => undefined,
    ).catch((e: unknown) => e)) as TextileSwapError;
    expect(error.moneyMayHaveMoved).toBe(false);
    expect(chain.sent).toHaveLength(0);
  });

  it("si el tramo 2 no consigue liquidez, reintenta y avisa que quedó USDT del agente", async () => {
    const chain = fakeChain({ [FROM.toLowerCase()]: BigInt(100) * E18 }, { [USDT]: BigInt(20) * E6 });
    const leg1 = quotedResponse({ sellToken: FROM, takerPays: BigInt(100) * E18, buyAmount: BigInt(20) * E6 });
    const noLiquidity = () => json({ data: { status: "no_quote", reason: "no_makers_online" } });
    const { deps, fetcher } = makeDeps(chain, [json(leg1), noLiquidity(), noLiquidity(), noLiquidity()]);

    const error = (await convertViaTextile(
      deps,
      { fromToken: FROM, toToken: TO, usdt: USDT, amountIn: BigInt(100) * E18, minAmountOut: BigInt(1) },
      async () => undefined,
    ).catch((e: unknown) => e)) as TextileSwapError;

    expect(error.moneyMayHaveMoved).toBe(true);
    expect(error.message).toMatch(/USDT/);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/rfq/request"))).toHaveLength(4); // 1 + 3 intentos
  });

  it("no pierde el cambio si falla guardar el avance", async () => {
    const chain = fakeChain(
      { [FROM.toLowerCase()]: BigInt(100) * E18 },
      { [USDT]: BigInt(20) * E6, [TO]: BigInt(480) * E18 },
    );
    const leg1 = quotedResponse({ sellToken: FROM, takerPays: BigInt(100) * E18, buyAmount: BigInt(20) * E6 });
    const leg2 = quotedResponse({ sellToken: USDT, takerPays: BigInt(20) * E6, buyAmount: BigInt(480) * E18 });
    const { deps } = makeDeps(chain, [json(leg1), json(leg2)]);
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await convertViaTextile(
      deps,
      { fromToken: FROM, toToken: TO, usdt: USDT, amountIn: BigInt(100) * E18, minAmountOut: BigInt(450) * E18 },
      async () => {
        throw new Error("la base no contesta");
      },
    );
    expect(result.amountOut).toBe(BigInt(480) * E18);
    spy.mockRestore();
  });
});
