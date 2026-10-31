import { describe, expect, it } from "vitest";
import { verifyTypedData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { buildApprovalTypedData } from "@/lib/chain/approval";
import {
  APPROVAL_MESSAGES,
  canApprove,
  isUserRejection,
  messageForApproveStatus,
} from "@/lib/approval-ui";

// Clave pública de Hardhat (cuenta 0). No es la del agente ni tiene fondos reales.
const account = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);

const base = {
  chainId: 11142220,
  agreementPublicId: "abcd1234",
  milestoneId: "11111111-2222-3333-4444-555555555555",
  position: 2,
  amount: BigInt("500000000000000000000"),
  currency: "wBRL",
};

describe("firma del botón Aprobar", () => {
  it("lo que arma el helper, firmado en el navegador, verifica como lo hace la API", async () => {
    const typed = buildApprovalTypedData(base);
    const signature = await account.signTypedData(typed);
    expect(await verifyTypedData({ address: account.address, signature, ...typed })).toBe(true);

    const otherPosition = buildApprovalTypedData({ ...base, position: 3 });
    expect(
      await verifyTypedData({ address: account.address, signature, ...otherPosition }),
    ).toBe(false);
  });
});

describe("canApprove", () => {
  const w = account.address;
  it("solo en delivered o reminded y con la billetera del cliente", () => {
    expect(canApprove("delivered", w, w)).toBe(true);
    expect(canApprove("reminded", w, w)).toBe(true);
    for (const s of ["pending", "funded", "approved", "expired", "paused", "paid"]) {
      expect(canApprove(s, w, w)).toBe(false);
    }
  });
  it("compara sin importar mayúsculas y rechaza otra billetera o ninguna", () => {
    expect(canApprove("delivered", w.toLowerCase(), w)).toBe(true);
    expect(canApprove("delivered", "0x0000000000000000000000000000000000000001", w)).toBe(false);
    expect(canApprove("delivered", undefined, w)).toBe(false);
    expect(canApprove("delivered", w, null)).toBe(false);
  });
});

describe("mensajes de error", () => {
  it("traduce lo que responde la API", () => {
    expect(messageForApproveStatus(403)).toBe(APPROVAL_MESSAGES.wrongSigner);
    expect(messageForApproveStatus(409)).toBe(APPROVAL_MESSAGES.notApprovable);
    expect(messageForApproveStatus(404)).toBe(APPROVAL_MESSAGES.notApprovable);
    expect(messageForApproveStatus(500)).toBe(APPROVAL_MESSAGES.generic);
  });
  it("reconoce que la persona canceló la firma, también anidado", () => {
    expect(isUserRejection({ code: 4001 })).toBe(true);
    expect(isUserRejection({ name: "UserRejectedRequestError" })).toBe(true);
    expect(isUserRejection({ name: "X", cause: { code: 4001 } })).toBe(true);
    expect(isUserRejection(new Error("boom"))).toBe(false);
    expect(isUserRejection(null)).toBe(false);
  });
});
