# Avisos por Telegram

Pactá avisa a la freelancer y al cliente cada vez que cambia el estado de un hito. Los avisos salen por **Telegram**, a través de un bot, y por **mail** como respaldo.

## Por qué Telegram

- **Sin costo** por mensaje.
- **Sin plantillas que aprobar:** el bot manda el texto directamente.
- **Activación inmediata:** el bot se crea con `@BotFather` y queda listo para usar.
- **API oficial:** se usa la Bot API de Telegram con un `fetch`, sin librerías de terceros.

## Cómo funciona

1. En la pantalla de su acuerdo (`/cliente/<id>` o `/freelancer/<id>`), la persona toca **Recibir avisos por Telegram**. Se abre el bot de Pactá con un código que identifica el acuerdo y el lado: `c-<id>` para el cliente, `f-<id>` para la freelancer.
2. Toca **Iniciar**. Telegram le manda al webhook (`/api/telegram/webhook`) el mensaje `/start <código>` y el `chat_id` de esa conversación.
3. Pactá guarda el `chat_id`: el del cliente en el acuerdo (`agreements.client_telegram_chat_id`) y el de la freelancer en su usuario (`users.telegram_chat_id`). El bot le confirma que quedó suscripta.
4. Cuando cambia el estado de un hito, `notify` prueba los canales en orden: primero **Telegram** y, si no sale (la persona no se suscribió o Telegram falla), el **mail**.

Un bot de Telegram no puede escribirle a un número de teléfono: solo le escribe a quien tocó **Iniciar**. Por eso se guarda el `chat_id`, no el teléfono.

## Qué aporta

- La freelancer se entera al momento de que el cliente depositó, aprobó o de que le llegó el pago.
- El cliente recibe la entrega para revisar y un recordatorio al día 3, antes de que el pago se libere solo al día 6.
- Si un aviso no sale, el pago sigue su curso igual: `sendTelegram` nunca corta el proceso.

## Suscripción y baja

- **Una cuenta por lado:** la primera cuenta de Telegram que se suscribe queda fija y nadie puede pisarla. Si otra cuenta lo intenta, el bot le avisa que los avisos ya están activados en otra cuenta.
- **Baja:** escribiendo `/stop` al bot, esa cuenta deja de recibir avisos de todos sus acuerdos. Los avisos siguen saliendo por mail.
- **Seguridad del webhook:** la ruta solo acepta pedidos que traen la clave `TELEGRAM_WEBHOOK_SECRET` en el encabezado `X-Telegram-Bot-Api-Secret-Token`. Telegram la manda en cada pedido porque se la pasamos al conectar el bot.
- **Riesgo conocido:** el link del acuerdo es público (cualquiera que lo tenga ve las dos pantallas), así que alguien con el link podría suscribirse antes que la persona correcta. Que la primera cuenta quede fija limita el daño. La solución de fondo es pedir la firma de la billetera para suscribirse, y queda para después de la entrega.

## Código

| Archivo | Qué hace |
|---|---|
| `lib/notify/messages.ts` | Texto de cada aviso (asunto y cuerpo). Telegram y el mail usan los mismos. |
| `lib/notify/telegram.ts` | `sendTelegram`: manda el aviso por la Bot API. Devuelve `sent`, `skipped` o `failed`, igual que el mail. `sendTelegramText` manda un texto suelto (las respuestas del bot). |
| `lib/notify/telegram-links.ts` | Arma el link del botón (`t.me/<bot>?start=c-<id>`) y lee el código del `/start`. |
| `lib/notify/telegram-subscribe.ts` | Qué hace el bot con cada mensaje: `/start <código>` suscribe, `/stop` da de baja, el resto recibe una ayuda. |
| `lib/notify/telegram-webhook-auth.ts` | Verifica la clave del webhook. |
| `app/api/telegram/webhook/route.ts` | La ruta a la que Telegram manda los mensajes del bot. Siempre responde 200, para que Telegram no reintente. |
| `lib/notify/events.ts` | Lee el `chat_id` de cada lado y se lo pasa a los avisos. Si la migración todavía no corrió, los avisos salen por mail. |
| `components/TelegramSubscribe.tsx` | El botón "Recibir avisos por Telegram". No se muestra si falta `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`. |
| `supabase/migrations/0004_telegram_chat_id.sql` | Agrega las columnas del `chat_id`. Solo agrega: no borra datos. |
| `scripts/telegram-set-webhook.ts` | Conecta el bot con la web (`npm run telegram:webhook`). |
| `lib/notify/index.ts` | `notify` y los canales: `telegramChannel` primero, `emailChannel` de respaldo. |
| `scripts/test-telegram.ts` | Manda los 6 avisos a un chat de prueba. |
| `tests/notify/telegram.test.ts` y `tests/notify/telegram-subscribe.test.ts` | Tests sin red, con un Telegram y una base simulados. |

## Variables de entorno

| Variable | Qué es |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token del bot, generado por `@BotFather`. Va en `.env.local` y en Vercel, nunca en el repo. |
| `TELEGRAM_WEBHOOK_SECRET` | Clave del webhook. Se inventa (letras, números, `_` y `-`). Va en `.env.local` y en Vercel. |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Nombre del bot sin `@` (por ejemplo `pacta_test_bot`). Sin esto no aparece el botón. |

## Puesta en marcha (una sola vez)

1. **Base de datos:** correr `supabase/migrations/0004_telegram_chat_id.sql` en el SQL Editor de Supabase. Solo agrega dos columnas.
2. **Vercel:** cargar las tres variables de arriba en Production y volver a publicar.
3. **Conectar el bot:** con el token y la clave en `.env.local`, correr:

   ```bash
   npm run telegram:webhook -- https://pacta-dun.vercel.app
   ```

4. **Probar:** abrir un acuerdo, tocar **Recibir avisos por Telegram** y después **Iniciar**. El bot tiene que contestar que quedaste suscripta.

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

- Pedir la firma de la billetera para suscribirse, así solo la persona correcta puede activar los avisos de su lado.
- Borrar las columnas `whatsapp` y `whatsapp_opt_in` de `users`, que ya no se usan.
