import { fromDataSuffix, toDataSuffix } from "@celo/attribution-tags";
import { custom, type Hex, recoverTransactionAddress, size, slice } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { parseTransaction } from "viem/celo";
import { describe, expect, it } from "vitest";

import { explorerUrl, getChain, getChainName, txUrl } from "@/lib/chain/chains";
import { createAgentWalletClient } from "@/lib/chain/wallet";

// Clave de PRUEBA, pública (la cuenta #0 de Hardhat/Anvil). No es la del agente.
const TEST_KEY: Hex = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const TAG = "celo_test123";
const chain = getChain("celo-sepolia");

// RPC falso: contesta lo mínimo para armar la transacción y guarda la tx firmada
// en vez de mandarla. Así el test no usa la red.
function fakeRpc() {
  const sent: Hex[] = [];
  const transport = custom({
    async request({ method, params }: { method: string; params?: unknown[] }) {
      switch (method) {
        case "eth_chainId":
          return `0x${chain.id.toString(16)}`;
        case "eth_sendRawTransaction":
          sent.push((params as Hex[])[0]);
          return `0x${"ab".repeat(32)}`;
        default:
          throw new Error(`RPC falso: método no esperado ${method}`);
      }
    },
  });
  return { transport, sent };
}

// Datos fijos de gas y nonce para que viem no tenga que preguntarle a la red.
const fixedFees = {
  nonce: 0,
  gas: 50_000n,
  maxFeePerGas: 30_000_000_000n,
  maxPriorityFeePerGas: 1_000_000_000n,
} as const;

function expectTagged(data: Hex | undefined) {
  expect(data).toBeDefined();
  const suffix = toDataSuffix(TAG);
  const tail = slice(data!, size(data!) - size(suffix));
  expect(tail).toBe(suffix);
  expect(fromDataSuffix(data!)?.codes).toEqual([TAG]);
}

describe("lib/chain/wallet", () => {
  const account = privateKeyToAccount(TEST_KEY);

  it("una transferencia de 0 CELO sale firmada y con el tag al final de los datos", async () => {
    const { transport, sent } = fakeRpc();
    const wallet = createAgentWalletClient({ privateKey: TEST_KEY, tag: TAG, chain, transport });

    await wallet.sendTransaction({ to: account.address, value: 0n, ...fixedFees });

    expect(sent).toHaveLength(1);
    const tx = parseTransaction(sent[0]);
    expectTagged(tx.data);
    expect(tx.chainId).toBe(chain.id);
    expect(await recoverTransactionAddress({ serializedTransaction: sent[0] as never })).toBe(
      account.address,
    );
  });

  it("una llamada a contrato conserva sus datos y agrega el tag al final", async () => {
    const { transport, sent } = fakeRpc();
    const wallet = createAgentWalletClient({ privateKey: TEST_KEY, tag: TAG, chain, transport });
    const callData: Hex = "0xa9059cbb"; // selector de transfer(address,uint256)

    await wallet.sendTransaction({ to: account.address, data: callData, ...fixedFees });

    const tx = parseTransaction(sent[0]);
    expect(tx.data?.startsWith(callData)).toBe(true);
    expectTagged(tx.data);
  });

  it("con feeCurrency (gas en otra moneda) también sale con el tag", async () => {
    const { transport, sent } = fakeRpc();
    const wallet = createAgentWalletClient({ privateKey: TEST_KEY, tag: TAG, chain, transport });
    const feeCurrency = "0x0000000000000000000000000000000000000001" as const;

    await wallet.sendTransaction({ to: account.address, value: 0n, feeCurrency, ...fixedFees });

    const tx = parseTransaction(sent[0]);
    expect(tx.type).toBe("cip64");
    expect((tx as { feeCurrency?: string }).feeCurrency).toBe(feeCurrency);
    expectTagged(tx.data);
  });

  it("rechaza una clave o un tag con formato inválido, sin mostrar la clave", () => {
    const badKey = "0x1234" as Hex;
    expect(() => createAgentWalletClient({ privateKey: badKey, tag: TAG, chain })).toThrow(
      /AGENT_PRIVATE_KEY/,
    );
    expect(() => createAgentWalletClient({ privateKey: TEST_KEY, tag: "Celo Tag", chain })).toThrow(
      /NEXT_PUBLIC_ATTRIBUTION_TAG/,
    );
    // Si no tirara error, el test tiene que fallar (no pasar en silencio).
    const almostKey = `${TEST_KEY.slice(0, -1)}z` as Hex;
    let message = "";
    expect(() => {
      try {
        createAgentWalletClient({ privateKey: almostKey, tag: TAG, chain });
      } catch (e) {
        message = (e as Error).message;
        throw e;
      }
    }).toThrow(/AGENT_PRIVATE_KEY/);
    expect(message).not.toContain(TEST_KEY.slice(2, 20));
  });
});

describe("lib/chain/chains", () => {
  it("elige la red según el nombre", () => {
    expect(getChain("celo-sepolia").id).toBe(11142220);
    expect(getChain("celo").id).toBe(42220);
  });

  it("falla claro si NEXT_PUBLIC_CHAIN falta o es inválida", () => {
    expect(() => getChainName("")).toThrow(/Falta NEXT_PUBLIC_CHAIN/);
    expect(() => getChainName("ethereum")).toThrow(/no es válida/);
  });

  it("arma links al explorador sin doble barra", () => {
    const hash = `0x${"12".repeat(32)}` as const;
    for (const name of ["celo-sepolia", "celo"] as const) {
      expect(explorerUrl(name).endsWith("/")).toBe(false);
      expect(txUrl(hash, name)).toBe(`${explorerUrl(name)}/tx/${hash}`);
      expect(txUrl(hash, name).replace("https://", "")).not.toContain("//");
    }
    expect(txUrl(hash, "celo-sepolia")).toBe(`https://celo-sepolia.blockscout.com/tx/${hash}`);
  });
});

// Se completa cuando exista `lib/chain/tokens.ts`.
describe("lib/chain/tokens", () => {
  it.todo("tokens.ts devuelve las direcciones de la red elegida");
});
