// Prueba real de los avisos por Telegram (PAC-40).
//
// Manda las 6 plantillas, con datos de ejemplo, a un chat de prueba.
//
// Uso:  npx tsx scripts/test-telegram.ts <chat_id>
// Lee TELEGRAM_BOT_TOKEN de `.env.local` (o del archivo que diga ENV_FILE).
// El chat_id se saca como explica docs/telegram.md ("Cómo saber mi chat_id").
// Nunca muestra el token.

import { existsSync } from "node:fs";

const envFile = process.env.ENV_FILE ?? ".env.local";
if (existsSync(envFile)) process.loadEnvFile(envFile);

const SAMPLE: Record<string, string> = {
  freelancer: "Sofía",
  client: "Agencia Sol",
  agreement: "Logo y manual de marca",
  milestone: "Entrega 1: bocetos del logo",
  amount: "500 wBRL",
  rate: "1 BRL = 240 ARS",
  link: "https://pacta.app/a/abc123",
};

async function main() {
  const chatId = process.argv[2];
  if (!chatId) throw new Error("Pasá el chat_id: npx tsx scripts/test-telegram.ts <chat_id>");

  const { TEMPLATE_NAMES } = await import("../lib/notify/messages");
  const { sendTelegram } = await import("../lib/notify/telegram");

  let failed = 0;
  for (const name of TEMPLATE_NAMES) {
    const result = await sendTelegram(chatId, name, SAMPLE);
    console.log(`${result.ok ? "✓" : "✗"} ${name}${result.ok ? "" : `: ${result.error}`}`);
    if (!result.ok) failed++;
  }
  if (failed) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : "Falló la prueba.");
  process.exitCode = 1;
});
