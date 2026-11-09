// Cambio real de una moneda por otra con Textile (PAC-32): el agente actúa de "taker".
// Para cada tramo: pide una cotización en firme, aprueba el token, manda el swap y espera el recibo.
// No hay corredor directo wBRL→wARS, así que son dos tramos: `moneda → USDT → moneda`.
//
// Este archivo no usa claves ni viem para mandar nada: la cadena llega por parámetro (`chain`), que en
// producción arma agent/releaser-server.ts con el cliente único de lib/chain/wallet.ts (el que pone el
// tag del equipo en cada transacción). Así se prueba entera con un Textile y una cadena falsos.
//
// Seguridad: la calldata de las transacciones la arma la API de Textile y se firma con la clave del
// agente. Antes de mandar cualquier cosa se verifica que apunte SOLO a los contratos oficiales de Textile
// (lib/chain/dex.ts), que el valor sea 0 y que la aprobación sea justo por lo que se va a gastar.
import { decodeFunctionData, getAddress, type Address, type Hash, type Hex } from "viem";

import { erc20Abi } from "@/lib/chain/tokens";

const DEFAULT_BASE_URL = "https://api.textilecredit.com/v2";
// La cotización en firme puede tardar hasta ~70 s en una ruta fría (doc de Textile): 75 s de espera.
const REQUEST_TIMEOUT_MS = 75_000;
// La cotización en firme vive 60 s como mucho: si queda poco, mejor pedir otra que mandar tarde.
const MIN_REMAINING_MS = 15_000;
const MAX_QUOTE_ATTEMPTS = 2;
const LEG_TWO_ATTEMPTS = 3;
const LEG_TWO_WAIT_MS = 3_000;

/**
 * `moneyMayHaveMoved`: false = seguro que no salió plata (se puede reintentar); true = alguna
 * transacción salió o puede haber salido (NO se reintenta solo: lo mira una persona).
 */
export class TextileSwapError extends Error {
  constructor(
    message: string,
    readonly moneyMayHaveMoved: boolean,
  ) {
    super(message);
    this.name = "TextileSwapError";
  }
}

export type SwapChain = {
  balanceOf(token: Address): Promise<bigint>;
  allowance(token: Address, spender: Address): Promise<bigint>;
  /** Manda una transacción desde la wallet del agente (por el cliente con tag). Valor siempre 0. */
  send(tx: { to: Address; data: Hex }): Promise<Hash>;
  waitForReceipt(hash: Hash): Promise<{ status: "success" | "reverted" }>;
  signTypedData(typed: TakerControlTypedData): Promise<Hex>;
};

export type TextileSwapDeps = {
  chainId: number;
  agent: Address;
  /** Los únicos contratos que se aceptan como destino de un swap o de una aprobación. */
  allowedContracts: readonly Address[];
  chain: SwapChain;
  fetcher?: typeof fetch;
  baseUrl?: string;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export type LegRecord = {
  sellToken: Address;
  buyToken: Address;
  sellAmount: string;
  receivedAmount?: string;
  rfqId?: string;
  approvalHash?: string;
  swapHash?: string;
};

type Tx = { to: Address; data: Hex; value: string; chainId: number };
type FirmQuote = {
  rfqId: string;
  claimToken: string;
  takerPays: bigint;
  buyAmount: bigint;
  expiresAt: number;
  spender: Address;
  approval: Tx;
  swap: Tx;
};

// ---------- Prueba de control (takerProof) ----------

export type TakerControlTypedData = ReturnType<typeof takerControlTypedData>;

/** EIP-712 que Textile pide para probar que quien pide la cotización controla la wallet (taker). */
export function takerControlTypedData(taker: Address, chainId: number, nonce: Hex, issuedAt: number) {
  return {
    domain: { name: "Textile Taker Control", version: "1", chainId },
    types: {
      TakerControl: [
        { name: "taker", type: "address" },
        { name: "chainId", type: "uint256" },
        { name: "nonce", type: "bytes32" },
        { name: "issuedAt", type: "uint256" },
      ],
    },
    primaryType: "TakerControl" as const,
    message: { taker, chainId: BigInt(chainId), nonce, issuedAt: BigInt(issuedAt) },
  };
}

function randomNonce(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

// ---------- Cotización en firme ----------

const sameAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const isDigits = (value: unknown): value is string => typeof value === "string" && /^\d+$/.test(value);

type RawTx = { to?: string; data?: string; value?: string; chainId?: number } | undefined;

function parseTx(raw: RawTx, name: string, chainId: number): Tx {
  if (!raw?.to || !raw.data || raw.value !== "0" || raw.chainId !== chainId) {
    throw new TextileSwapError(`textile: la transacción de ${name} no es válida`, false);
  }
  return { to: getAddress(raw.to), data: raw.data as Hex, value: "0", chainId };
}

/** Pide la cotización en firme y comprueba que todo lo que vamos a firmar es lo esperado. */
async function requestFirmQuote(
  deps: TextileSwapDeps,
  leg: { sellToken: Address; buyToken: Address; sellAmount: bigint },
): Promise<FirmQuote> {
  const fetcher = deps.fetcher ?? fetch;
  const baseUrl = deps.baseUrl ?? process.env.TEXTILE_API_URL ?? DEFAULT_BASE_URL;
  const now = deps.now ?? Date.now;

  const send = (extra: object = {}) =>
    fetcher(`${baseUrl}/rfq/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chainId: deps.chainId,
        sellToken: leg.sellToken,
        buyToken: leg.buyToken,
        sellAmount: leg.sellAmount.toString(),
        taker: deps.agent,
        ...extra,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

  let response = await send();
  if (response.status === 401) {
    const body = (await response.clone().json().catch(() => null)) as {
      error?: { details?: { reason?: string } };
    } | null;
    if (body?.error?.details?.reason === "proof_of_control_required") {
      const nonce = randomNonce();
      const issuedAt = now();
      const signature = await deps.chain.signTypedData(takerControlTypedData(deps.agent, deps.chainId, nonce, issuedAt));
      response = await send({ takerProof: { nonce, issuedAt, signature } });
    }
  }
  if (!response.ok) throw new TextileSwapError(`textile: respondió ${response.status}`, false);

  const body = (await response.json()) as {
    data?: {
      status?: string;
      reason?: string;
      rfqId?: string;
      claimToken?: string;
      quote?: { takerPays?: string; buyAmount?: string; expiresAt?: string; spender?: string };
      transactions?: { approval?: RawTx; swap?: RawTx };
    };
  };
  const data = body.data;
  if (data?.status === "no_quote") {
    throw new TextileSwapError(`textile: sin liquidez (${data.reason ?? "no_quote"})`, false);
  }
  const quote = data?.quote;
  if (
    data?.status !== "quoted" ||
    !data.rfqId ||
    !data.claimToken ||
    !isDigits(quote?.takerPays) ||
    !isDigits(quote?.buyAmount) ||
    !quote?.expiresAt ||
    !quote.spender
  ) {
    throw new TextileSwapError("textile: la cotización en firme vino incompleta", false);
  }

  const takerPays = BigInt(quote.takerPays);
  const spender = getAddress(quote.spender);
  const approval = parseTx(data.transactions?.approval, "aprobación", deps.chainId);
  const swap = parseTx(data.transactions?.swap, "swap", deps.chainId);

  // 1) Nunca gastar más de lo pedido.
  if (takerPays <= BigInt(0) || takerPays > leg.sellAmount) {
    throw new TextileSwapError("textile: la cotización pide gastar más de lo permitido", false);
  }
  // 2) Solo contratos oficiales de Textile: el swap y a quién se le aprueba.
  const allowed = (address: string) => deps.allowedContracts.some((contract) => sameAddress(contract, address));
  if (!allowed(swap.to) || !allowed(spender)) {
    throw new TextileSwapError("textile: la cotización apunta a un contrato que no es de Textile", false);
  }
  // 3) La aprobación es del token que vendemos, a ese contrato y por lo que se va a gastar.
  if (!sameAddress(approval.to, leg.sellToken)) {
    throw new TextileSwapError("textile: la aprobación no es del token que se vende", false);
  }
  const decoded = decodeApprove(approval.data);
  if (!decoded || !sameAddress(decoded.spender, spender) || decoded.amount < takerPays || decoded.amount > leg.sellAmount) {
    throw new TextileSwapError("textile: la aprobación no coincide con la cotización", false);
  }

  return {
    rfqId: data.rfqId,
    claimToken: data.claimToken,
    takerPays,
    buyAmount: BigInt(quote.buyAmount),
    expiresAt: Date.parse(quote.expiresAt),
    spender,
    approval,
    swap,
  };
}

function decodeApprove(data: Hex): { spender: Address; amount: bigint } | null {
  try {
    const decoded = decodeFunctionData({ abi: erc20Abi, data });
    if (decoded.functionName !== "approve") return null;
    const [spender, amount] = decoded.args as readonly [Address, bigint];
    return { spender, amount };
  } catch {
    return null;
  }
}

// ---------- Un tramo ----------

export type LegResult = { record: LegRecord; received: bigint };

/**
 * Cambia `sellAmount` de `sellToken` por `buyToken`. `onRecord` se llama cada vez que hay un hash nuevo
 * para guardarlo antes de seguir. `minBuyAmount` (opcional) frena la cotización si paga menos que eso.
 */
export async function executeLeg(
  deps: TextileSwapDeps,
  leg: { sellToken: Address; buyToken: Address; sellAmount: bigint; minBuyAmount?: bigint },
  onRecord: (record: LegRecord) => Promise<void>,
): Promise<LegResult> {
  const now = deps.now ?? Date.now;
  const record: LegRecord = { sellToken: leg.sellToken, buyToken: leg.buyToken, sellAmount: leg.sellAmount.toString() };
  let moneyMayHaveMoved = false;

  try {
    for (let attempt = 1; attempt <= MAX_QUOTE_ATTEMPTS; attempt++) {
      const firm = await requestFirmQuote(deps, leg);
      record.rfqId = firm.rfqId;

      if (leg.minBuyAmount !== undefined && firm.buyAmount < leg.minBuyAmount) {
        throw new TextileSwapError("textile: la cotización en firme paga menos de lo aceptable", false);
      }
      if ((await deps.chain.balanceOf(leg.sellToken)) < firm.takerPays) {
        throw new TextileSwapError("el agente no tiene saldo suficiente para el cambio", false);
      }
      if (firm.expiresAt - now() < MIN_REMAINING_MS) continue; // quedó poco tiempo: se pide otra

      // Aprobación (solo si el permiso actual no alcanza). Se manda lo que armó Textile, ya verificado.
      const allowance = await deps.chain.allowance(leg.sellToken, firm.spender);
      if (allowance < firm.takerPays) {
        moneyMayHaveMoved = true; // una aprobación no mueve plata, pero ya hay una tx en camino
        const approvalHash = await deps.chain.send({ to: firm.approval.to, data: firm.approval.data });
        record.approvalHash = approvalHash;
        await onRecord({ ...record });
        const approvalReceipt = await deps.chain.waitForReceipt(approvalHash);
        if (approvalReceipt.status !== "success") {
          throw new TextileSwapError("la aprobación se revirtió", false);
        }
        moneyMayHaveMoved = false;
        if (firm.expiresAt - now() < MIN_REMAINING_MS) continue; // la aprobación tardó: nueva cotización
      }

      const before = await deps.chain.balanceOf(leg.buyToken);
      moneyMayHaveMoved = true;
      const swapHash = await deps.chain.send({ to: firm.swap.to, data: firm.swap.data });
      record.swapHash = swapHash;
      await onRecord({ ...record });

      const receipt = await deps.chain.waitForReceipt(swapHash);
      if (receipt.status !== "success") {
        // Una tx revertida no mueve plata (solo gasta comisión): se puede reintentar.
        moneyMayHaveMoved = false;
        throw new TextileSwapError("el swap se revirtió", false);
      }

      const received = (await deps.chain.balanceOf(leg.buyToken)) - before;
      record.receivedAmount = received.toString();
      if (received < firm.buyAmount) {
        throw new TextileSwapError(
          `el swap entregó ${received} y la cotización prometía ${firm.buyAmount}: revisar a mano`,
          true,
        );
      }
      await submitBestEffort(deps, firm, swapHash);
      return { record, received };
    }
    throw new TextileSwapError("textile: no se pudo mandar el swap a tiempo (la cotización vencía)", false);
  } catch (error) {
    if (error instanceof TextileSwapError) throw error;
    // Error sin diagnóstico (RPC, timeout): si ya había un envío en juego, puede haber salido.
    const reason = error instanceof Error ? error.message : "error desconocido";
    throw new TextileSwapError(reason, moneyMayHaveMoved);
  }
}

/** Avisa a Textile del hash del swap. Es opcional: si falla no cambia nada (la liquidación se concilia on-chain). */
async function submitBestEffort(deps: TextileSwapDeps, firm: FirmQuote, txHash: Hash) {
  try {
    const fetcher = deps.fetcher ?? fetch;
    const baseUrl = deps.baseUrl ?? process.env.TEXTILE_API_URL ?? DEFAULT_BASE_URL;
    await fetcher(`${baseUrl}/rfq/${firm.rfqId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Rfq-Claim": firm.claimToken },
      body: JSON.stringify({ txHash }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Nada: es solo informativo.
  }
}

// ---------- Cambio completo: moneda → USDT → moneda ----------

export type ConversionResult = {
  legs: LegRecord[];
  amountOut: bigint;
  /** Hash del último swap: es el que se guarda como `tx_hash` de la conversión. */
  finalTxHash: Hash;
};

export type ConversionRequest = {
  fromToken: Address;
  toToken: Address;
  usdt: Address;
  amountIn: bigint;
  /** Lo mínimo aceptable de la moneda de destino (de la cotización estimada, con margen). */
  minAmountOut: bigint;
};

export async function convertViaTextile(
  deps: TextileSwapDeps,
  request: ConversionRequest,
  onProgress: (legs: LegRecord[]) => Promise<void>,
): Promise<ConversionResult> {
  const legs: LegRecord[] = [];
  const report = async (index: number, record: LegRecord) => {
    legs[index] = record;
    try {
      await onProgress([...legs]);
    } catch (error) {
      // Guardar el avance es importante pero no puede frenar un cambio en marcha: queda en el log.
      console.error("[textile-swap] no se pudo guardar el avance", error instanceof Error ? error.message : error);
    }
  };

  const first = await executeLeg(
    deps,
    { sellToken: request.fromToken, buyToken: request.usdt, sellAmount: request.amountIn },
    (record) => report(0, record),
  );
  await report(0, first.record);

  // Tramo 2: se vende exactamente el USDT que llegó. Si falla acá la plata ya está en USDT en la
  // wallet del agente: se reintenta unas veces y, si no, se avisa que hay que revisar a mano.
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;
  for (let attempt = 1; attempt <= LEG_TWO_ATTEMPTS; attempt++) {
    try {
      const second = await executeLeg(
        deps,
        { sellToken: request.usdt, buyToken: request.toToken, sellAmount: first.received, minBuyAmount: request.minAmountOut },
        (record) => report(1, record),
      );
      await report(1, second.record);
      return { legs: [...legs], amountOut: second.received, finalTxHash: second.record.swapHash as Hash };
    } catch (error) {
      lastError = error;
      // Si la segunda cotización fue válida pero el swap quedó en duda, no se vuelve a intentar.
      if (error instanceof TextileSwapError && error.moneyMayHaveMoved) break;
      if (attempt < LEG_TWO_ATTEMPTS) await sleep(LEG_TWO_WAIT_MS);
    }
  }
  const reason = lastError instanceof Error ? lastError.message : "error desconocido";
  // El tramo 1 ya salió: haya fallado como haya fallado el 2, hay USDT del agente en el medio.
  throw new TextileSwapError(`el tramo 2 falló y quedó USDT en la wallet del agente: ${reason}`, true);
}
