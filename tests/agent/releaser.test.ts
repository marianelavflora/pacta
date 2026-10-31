import { describe, it } from "vitest";

// Se completan cuando existan el liberador y los recordatorios en `agent/`.
describe("agente: liberador y recordatorios", () => {
  it.todo("paga un hito approved una sola vez aunque la tarea corra dos veces");
  it.todo("no paga hitos en paused");
  it.todo("manda el segundo aviso al día 3 sin respuesta (reminded)");
  it.todo("libera el hito solo al día 6 sin respuesta (expired)");
  it.todo("respeta el tope por acuerdo y el tope diario");
});
