# Avisos por Telegram

Pactá avisa a la freelancer y al cliente cada vez que cambia el estado de un hito. Los avisos salen por **Telegram**, a través de un bot, y por **mail** como respaldo.

## Por qué Telegram

- **Sin costo** por mensaje.
- **Sin plantillas que aprobar:** el bot manda el texto directamente.
- **Activación inmediata:** el bot se crea con `@BotFather` y queda listo para usar.
- **API oficial:** se usa la Bot API de Telegram con un `fetch`, sin librerías de terceros.

## Cómo funciona

1. La persona abre el link del bot y toca **Iniciar**.
2. Telegram le asigna un `chat_id` a esa conversación, y Pactá lo guarda.
3. Cuando cambia el estado de un hito, `notify` prueba los canales en orden: primero **Telegram** y, si no sale (la persona no se suscribió o Telegram falla), el **mail**.

Un bot de Telegram no puede escribirle a un número de teléfono: solo le escribe a quien tocó **Iniciar**. Por eso se guarda el `chat_id`, no el teléfono.

## Qué aporta

- La freelancer se entera al momento de que el cliente depositó, aprobó o de que le llegó el pago.
- El cliente recibe la entrega para revisar y un recordatorio al día 3, antes de que el pago se libere solo al día 6.
- Si un aviso no sale, el pago sigue su curso igual: `sendTelegram` nunca corta el proceso.

## Código

| Archivo | Qué hace |
|---|---|
| `lib/notify/messages.ts` | Texto de cada aviso (asunto y cuerpo). Telegram y el mail usan los mismos. |
| `lib/notify/telegram.ts` | `sendTelegram`: manda el aviso por la Bot API. Devuelve `sent`, `skipped` o `failed`, igual que el mail. |
| `lib/notify/index.ts` | `notify` y los canales: `telegramChannel` primero, `emailChannel` de respaldo. |
| `scripts/test-telegram.ts` | Manda los 6 avisos a un chat de prueba. |
| `tests/notify/telegram.test.ts` | Tests sin red, con un Telegram simulado. |

## Variable de entorno

| Variable | Qué es |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token del bot, generado por `@BotFather`. Va en `.env.local` y en Vercel, nunca en el repo. |

## Los avisos

| Aviso | Cuándo (estado del hito) | A quién |
|---|---|---|
| `deposit_received` | El cliente depositó (`funded`) | Cliente y freelancer |
| `milestone_delivered` | La freelancer entregó (`delivered`) | Cliente |
| `review_reminder` | Día 3 sin respuesta (`reminded`) | Cliente |
| `milestone_approved` | El cliente aprobó (`approved`) | Freelancer |
| `auto_release` | Día 6 sin respuesta, se libera solo (`expired`) | Cliente y freelancer |
| `milestone_paid` | Se pagó el hito (`paid`) | Freelancer |

Ejemplo (`review_reminder`):

> Hola Agencia Sol, todavía no revisaste el hito "Entrega 1: bocetos del logo" del acuerdo "Logo y manual de marca". Si no respondés en 3 días, lo liberamos solo y se le paga a quien lo entregó.

## Cómo probarlo

1. Cargá `TELEGRAM_BOT_TOKEN` en tu `.env.local`.
2. Abrí el bot en Telegram, tocá **Iniciar** y mandale un mensaje.
3. Buscá tu `chat_id` con el método `getUpdates` de la Bot API: es el número que aparece en `"chat":{"id":...}`.
4. Corré:

   ```bash
   npx tsx scripts/test-telegram.ts <chat_id>
   ```

5. Te llegan los 6 avisos.

Los tests automáticos no necesitan el token: `npm test`.

## Próximos pasos

- Guardar el `chat_id` en la tabla `users` y pasarlo como `telegramChatId` en `lib/notify/events.ts`. Hasta entonces, los avisos salen por mail.
- Una ruta que reciba el **Iniciar** del bot (webhook) y guarde el `chat_id`.
- Un botón "Recibir avisos por Telegram" en las pantallas.
