import { describe, it } from "vitest";

// Se completan cuando exista `lib/notify/`.
describe("avisos", () => {
  it.todo("hay un texto de aviso para cada cambio de estado del hito");
  it.todo("si WhatsApp falla, manda el mail de respaldo");
  it.todo("no manda WhatsApp si la persona no dio su consentimiento");
});
