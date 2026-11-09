// Crons de Vercel (vercel.json). El plan Hobby solo permite crons que corran una vez por día.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type VercelConfig = { crons?: { path: string; schedule: string }[] };
const config = JSON.parse(readFileSync("vercel.json", "utf8")) as VercelConfig;

describe("vercel.json", () => {
  it("agenda el liberador (recordatorios + pagos) y el barrido de depósitos", () => {
    const paths = (config.crons ?? []).map((cron) => cron.path);
    expect(paths).toContain("/api/cron/releaser");
    expect(paths).toContain("/api/cron/vault");
  });

  it("cada cron corre a lo sumo una vez por día (Hobby rechaza un deploy con uno más frecuente)", () => {
    for (const cron of config.crons ?? []) {
      const [minute, hour, dayOfMonth, month, dayOfWeek] = cron.schedule.split(" ");
      // Minuto y hora fijos: si fueran "*" o "*/5" correría más de una vez por día.
      expect(minute, cron.path).toMatch(/^\d+$/);
      expect(hour, cron.path).toMatch(/^\d+$/);
      expect([dayOfMonth, month, dayOfWeek]).toHaveLength(3);
    }
  });

  it("no hay más de 2 crons (el tope de Hobby)", () => {
    expect((config.crons ?? []).length).toBeLessThanOrEqual(2);
  });

  it("los dos crons son rutas que existen y exigen CRON_SECRET (Vercel lo manda como Bearer)", () => {
    for (const cron of config.crons ?? []) {
      const file = `app${cron.path}/route.ts`;
      const source = readFileSync(file, "utf8");
      expect(source, file).toMatch(/CRON_SECRET/);
      expect(source, file).toMatch(/export async function GET/);
    }
  });
});
