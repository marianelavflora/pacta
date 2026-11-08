import { describe, expect, it } from "vitest";
import { clientSteps, faqs, freelancerSteps, noReply } from "@/lib/ui/how-it-works";

const allText = [
  ...freelancerSteps,
  ...clientSteps,
  ...noReply,
].flatMap((s) => [s.title, s.text])
  .concat(faqs.flatMap((f) => [f.question, f.answer]))
  .join(" ")
  .toLowerCase();

describe("textos de Cómo funciona (PAC-48)", () => {
  it("no usa jerga técnica (AGENTS.md: sin gas, hash ni token)", () => {
    for (const word of ["gas", "hash", "token", "blockchain", "smart contract"]) {
      expect(allText, `aparece "${word}"`).not.toMatch(new RegExp(`\\b${word}\\b`));
    }
  });

  it("tiene 5 pasos para quien cobra y 5 para quien paga", () => {
    expect(freelancerSteps).toHaveLength(5);
    expect(clientSteps).toHaveLength(5);
  });

  it("explica los plazos de 3 y 6 días", () => {
    expect(noReply.map((s) => s.title)).toEqual(["A los 3 días", "A los 6 días"]);
  });

  it("responde las cinco preguntas del ticket", () => {
    expect(faqs.map((f) => f.question)).toEqual([
      "¿Qué es wARS?",
      "¿Qué billetera necesito?",
      "¿Qué pasa si no apruebo una entrega?",
      "¿Cuánto cuesta?",
      "¿Mi plata está segura?",
    ]);
    for (const faq of faqs) expect(faq.answer.length).toBeGreaterThan(20);
  });
});
