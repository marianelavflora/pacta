// Conecta el bot de Telegram con la web (una sola vez, o cuando cambia la dirección).
// Le dice a Telegram que mande los mensajes del bot a `<web>/api/telegram/webhook`,
// con la clave TELEGRAM_WEBHOOK_SECRET en cada pedido.
//
// Uso:  npm run telegram:webhook -- https://pacta-dun.vercel.app
// Si no se pasa la dirección, usa NEXT_PUBLIC_APP_URL.
// Lee TELEGRAM_BOT_TOKEN y TELEGRAM_WEBHOOK_SECRET de `.env.local` (o del archivo que diga ENV_FILE).
// Nunca muestra el token ni la clave.

import { existsSync } from "node:fs";

const envFile = process.env.ENV_FILE ?? ".env.local";
if (existsSync(envFile)) process.loadEnvFile(envFile);

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const base = (process.argv[2] ?? process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");

  if (!token) throw new Error("Falta TELEGRAM_BOT_TOKEN en .env.local.");
  if (!secret || !/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    throw new Error("Falta TELEGRAM_WEBHOOK_SECRET o tiene caracteres no permitidos (solo letras, números, _ y -).");
  }
  if (!/^https:\/\/[^\s/]+/.test(base)) {
    throw new Error("Pasá la dirección pública de la web, por ejemplo: npm run telegram:webhook -- https://pacta-dun.vercel.app");
  }

  const url = `${base}/api/telegram/webhook`;
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secret,
      allowed_updates: ["message"],
      drop_pending_updates: true,
    }),
  });
  const body = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !body?.ok) {
    const reason = (body?.description ?? `HTTP ${response.status}`).split(token).join("***");
    throw new Error(`Telegram no aceptó el webhook: ${reason}`);
  }
  console.log(`✓ Bot conectado. Telegram va a mandar los mensajes a ${url}`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : "Falló la conexión del bot.";
  console.error(message);
  process.exitCode = 1;
});
