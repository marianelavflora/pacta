import { describe, expect, it } from "vitest";
import { decodeFunctionData } from "viem";
import { fromDataSuffix } from "@celo/attribution-tags";
import {
  AGENT_ADDRESS,
  buildDepositCalldata,
  depositDataSuffix,
  friendlyDepositError,
  getAttributionTag,
  validateDepositAmount,
} from "@/lib/chain/deposit";
import { erc20Abi } from "@/lib/chain/tokens";

const TAG = "celo_dc3ce5f39b37";

describe("depósito con tag", () => {
  it("el calldata es un transfer al agente y termina con el sufijo del tag", () => {
    const amount = BigInt("1500500000000000000000");
    const data = buildDepositCalldata(AGENT_ADDRESS, amount, TAG);
    const suffix = depositDataSuffix(TAG);
    expect(data.endsWith(suffix.slice(2))).toBe(true);
    expect(fromDataSuffix(suffix)?.codes).toContain(TAG);
    const decoded = decodeFunctionData({ abi: erc20Abi, data: data.slice(0, 2 + (4 + 64) * 2) as `0x${string}` });
    expect(decoded.functionName).toBe("transfer");
    expect(decoded.args).toEqual([AGENT_ADDRESS, amount]);
  });

  it("rechaza tags inválidos o ausentes", () => {
    expect(() => getAttributionTag("")).toThrow();
    expect(() => getAttributionTag("Celo ABC")).toThrow();
    expect(getAttributionTag(TAG)).toBe(TAG);
  });

  it("valida montos en bigint", () => {
    expect(validateDepositAmount("1500,50")).toEqual({ ok: true, amount: BigInt("1500500000000000000000") });
    expect(validateDepositAmount("0").ok).toBe(false);
    expect(validateDepositAmount("-3").ok).toBe(false);
    expect(validateDepositAmount("abc").ok).toBe(false);
    expect(validateDepositAmount("").ok).toBe(false);
  });

  it("traduce errores de la billetera", () => {
    expect(friendlyDepositError({ shortMessage: "User rejected the request." })).toMatch(/Cancelaste/);
    expect(friendlyDepositError(new Error("transfer amount exceeds balance"))).toMatch(/saldo/);
    expect(friendlyDepositError(new Error("boom"))).toMatch(/No pudimos/);
  });
});
