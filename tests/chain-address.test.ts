import { describe, expect, it } from "vitest";
import { shortAddress } from "@/lib/chain/address";

describe("shortAddress", () => {
  it("abrevia una dirección larga", () => {
    expect(shortAddress("0xab569A8d8A5b60CFfdf9B88EdE099c80d8328E73")).toBe("0xab56…8E73");
  });
  it("deja igual una corta", () => {
    expect(shortAddress("0x1234")).toBe("0x1234");
  });
});
