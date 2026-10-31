import { describe, it } from "vitest";

// Se completan cuando existan los esquemas de zod en `lib/validation/`.
describe("validación de acuerdos", () => {
  it.todo("acepta montos positivos en unidades mínimas (bigint)");
  it.todo("rechaza montos en cero o negativos");
  it.todo("rechaza monedas que no sean wARS, wBRL o wMXN");
  it.todo("la suma de los hitos coincide con el total del acuerdo");
});
