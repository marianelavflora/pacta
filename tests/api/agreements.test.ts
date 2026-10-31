import { describe, it } from "vitest";

// Se completan cuando existan las rutas de `app/api/agreements/` y `app/api/milestones/`.
describe("API de acuerdos", () => {
  it.todo("POST /api/agreements crea un acuerdo con sus hitos");
  it.todo("POST /api/agreements rechaza datos inválidos con un error amigable");
  it.todo("GET /api/agreements/[id] devuelve el acuerdo por publicId");
  it.todo("GET /api/agreements/[id] devuelve 404 si no existe");
  it.todo("deliver pasa un hito de funded a delivered");
  it.todo("approve pasa un hito de delivered o reminded a approved");
});
