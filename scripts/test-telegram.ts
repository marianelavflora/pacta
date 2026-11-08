// Prueba real de los avisos por Telegram (PAC-40).
//
// Manda los 6 avisos, con datos de ejemplo, a un chat de prueba.
//
// Uso:  npx tsx scripts/test-telegram.ts <chat_id>
// Lee TELEGRAM_BOT_TOKEN de `.env.local` (o del archivo que diga ENV_FILE).
// Antes, la persona tiene que tocar "Iniciar" en el bot. Nunca muestra el token.

import { existsSync } from "node:fs";

const envFile = process.env.ENV_FILE ?? ".env.local";
if (existsSync(envFile)) process.loadEnvFile(envFile);

const EVENTS = [
  "deposit_received",
  "milestone_delivered",
  "review_reminder",
  "milestone_approved",
  "auto_release",
  "milestone_paid",
] as const;

async function main() {
  const chatId = process.argv[2];
  if (!chatId) throw new Error("Pasá el chat_id: npx tsx scripts/test-telegram.ts <chat_id>");

  const { buildMessage } = await import("../lib/notify/messages");
  const { sendTelegram } = await import("../lib/notify/telegram");

  let failed = 0;
  for (const event of EVENTS) {
    const message = buildMessage(event, {
      recipientName: "Sofía",
      agreementTitle: "Logo y manual de marca",
      milestoneTitle: "Entrega 1: bocetos del logo",
      amount: "R$ 500",
      link: "https://pacta-dun.vercel.app",
    });
    const result = await sendTelegram(chatId, message);
    const ok = result.status === "sent";
    console.log(`${ok ? "✓" : "✗"} ${event}${ok ? "" : ` (${result.status}: ${result.reason})`}`);
    if (!ok) failed++;
  }
  if (failed) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : "Falló la prueba.");
  process.exitCode = 1;
});
