# Tests de Pactá

Acá viven todas las pruebas automáticas del proyecto (la "caja de controles"). Si algo se rompe, un test se pone en rojo y nos enteramos antes de que le pase a alguien.

## Cómo correrlos

```bash
npm test             # corre todos una vez
npm run test:watch   # los vuelve a correr cada vez que guardás
```

`npm test` muestra cuántos pasaron, cuántos fallaron y cuántos quedan como `todo` (pendientes de escribir). En cada PR, GitHub corre `npm run lint` y `npm test` solo (`.github/workflows/test.yml`): si queda en rojo, no se mergea.

## La regla

Después de cada implementación, revisá esta carpeta y agregá o editá los tests de lo que cambiaste, y actualizá esta tabla.

- Si el código todavía no existe, dejá el caso como `it.todo("...")` para que se vea qué falta.
- Cuando escribas el test de verdad, cambiá el `it.todo` por `it` y actualizá la fila.

## Cómo está ordenada

Las carpetas siguen el **Mapa del código** de `AGENTS.md`:

| Carpeta | Qué prueba |
|---|---|
| `tests/api/` | Rutas de `app/api/` |
| `tests/agent/` | Bóveda (`vault.test.ts`: depósito completo, en partes, repetido, remitente, token, tx fallida, sin tag), liberador, cotizador y recordatorios (`agent/`) |
| `tests/chain/` | Wallet, tag y tokens (`lib/chain/`) |
| `tests/fx/` | Precio de referencia y comparación (`lib/fx/`) |
| `tests/notify/` | Avisos por Telegram y mail (`lib/notify/`) |
| `tests/validation/` | Esquemas de zod (`lib/validation/`) |
| `tests/helpers/` | Datos de ejemplo y funciones que repiten los tests |

Para importar código del proyecto usá el alias `@/` (por ejemplo `import { x } from "@/lib/fx/quote"`), igual que en la app.

### Datos de ejemplo (`tests/helpers/fixtures.ts`)

- `makeAgreement()`: un acuerdo en wBRL con 3 hitos (500 + 1000 + 500), montos en `bigint` con 18 decimales.
- `makeMilestone(status)` y `milestonesByStatus`: un hito en cada estado (`pending`, `funded`, `delivered`, `reminded`, `approved`, `expired`, `converting`, `paid`, `paused`).
- `units("12.5")`: pasa un monto escrito a unidades mínimas.
- Los estados vienen de `lib/validation/statuses.ts` (la lista oficial que también usa la base), no se copian acá.

Cada llamada devuelve una copia nueva, así un test no le cambia los datos a otro. El tipo `Milestone` toma solo algunos campos de la tabla `milestones`: si un test necesita otro, sumalo.

## Qué prueba cada archivo

Una fila por archivo, ordenadas por ruta. Al sumar un test, agregá su fila en el lugar que le toca.

| Archivo | Qué prueba | Casos | Ticket |
|---|---|---|---|
| `api/agreements.test.ts` | API de acuerdos e hitos | `POST /api/agreements` sin red (la base es un doble en memoria): crea o reusa la usuaria, el total sale de sumar los hitos (no de la web), hitos con `position` 1, 2, 3, reintento si el `public_id` ya existe, borra el acuerdo si fallan los hitos, responde 201, 400 o 500 sin filtrar el error de la base. `GET /api/agreements/[id]`: acuerdo con hitos ordenados por `position` (sin mezclar hitos de otro acuerdo), montos como texto validados con `BigInt`, sin teléfonos, mails, contacto del cliente ni firma, 404 si no existe, 400 si el id tiene mal formato, 500 sin filtrar el error. Entregar y aprobar siguen `todo` | PAC-14, PAC-15 |
| `api/milestones-deliver.test.ts` | Entregar hito (`lib/milestones.ts`, `lib/validation/milestone.ts`) | Sin red: `funded` pasa a `delivered` con link, nota y fecha, es idempotente (si ya está `delivered` no pisa los datos), rechaza cualquier otro estado, otra wallet no entrega, hito inexistente, base que falla, no filtra datos privados; el link tiene que ser `https://` y la nota tiene tope | PAC-22 |
| `api/milestones-approve.test.ts` | Aprobar hito (`lib/approvals.ts`, `lib/chain/approval.ts`) | Sin red, firmando con una cuenta de prueba de Hardhat: mensaje EIP-712 determinístico con acuerdo, hito, posición, monto, moneda y red; `delivered` y `reminded` pasan a `approved` guardando firma y fecha; firma de otra wallet, de otro hito, otra posición u otra red da `forbidden`; `pending`, `funded`, `expired` y `paused` no se aprueban; idempotente si ya está `approved` o más adelante; hito inexistente, acuerdo sin `client_wallet`, base que falla | PAC-25 |
| `chain/tokens.test.ts` | Monedas por red (`lib/chain/tokens.ts`) | Mainnet con los wARS, wBRL y wMXN de Ripio; en `celo-sepolia` wARS→tARS y wBRL→tBRL (tokens de prueba, `scripts/deploy-test-tokens.ts`); wMXN falla en testnet; `parseAmount` y `formatAmount` ida y vuelta en `bigint` con 18 decimales; el artefacto compilado tiene `mint` | PAC-07 |
| `chain/wallet.test.ts` | Wallet, red y tokens | El cliente del agente firma con el tag al final de los datos (transferencia, llamada a contrato y con `feeCurrency`), rechaza claves o tags inválidos sin mostrar la clave, la red y los links al explorador salen de `NEXT_PUBLIC_CHAIN`. No usa la red: un RPC falso guarda la tx firmada; la prueba real en testnet es `npm run tag:smoke`. | PAC-05 |
| `fx/quote.test.ts` | Cotizador (`lib/fx/math.ts`, `lib/fx/quote.ts`, `lib/fx/sources.ts`) | Precios a rate sin perder precisión, conversión de montos de 18 decimales con `bigint`, formato argentino (280,84), diferencia contra la referencia, elige la ruta real que más paga, cae a la referencia si fallan las demás, `NoQuoteError` si no contesta nadie, misma moneda no consulta | PAC-08, 29, 30, 31 |
| `fx/receipt.test.ts` | Recibo v2 (`lib/fx/receipt.ts`) | Tipo de cambio efectivo del pago y su diferencia contra la referencia, sin referencia, sin cambio de moneda, montos en cero | PAC-34 |
| `helpers/fixtures.test.ts` | Los datos de ejemplo | `units`, total = suma de hitos, copias nuevas, un hito por estado | PAC-60 |
| `notify/messages.test.ts` | Avisos (`lib/notify/`) | Texto de cada aviso, mail de respaldo con Resend (sin clave no manda, sin mail válido no manda, falla sin tirar error), canales en orden (si Telegram falla sale el mail), `siteUrl`. | PAC-41, PAC-42 |
| `agent/reminders.test.ts` | Recordatorios (`agent/reminders.ts`) | Día 3: `delivered` → `reminded` con aviso al cliente; día 6: `reminded` → `expired` con aviso; no avisa dos veces si corre dos veces; no toca otros estados; `TIME_UNIT=minutes` | PAC-38, PAC-39 |
| `notify/telegram.test.ts` | Canal de Telegram (`lib/notify/telegram.ts`) | Sin red, con un Telegram falso: sin token o sin `chat_id` válido devuelve `skipped` sin llamar a Telegram (un teléfono no sirve); manda asunto y texto al chat correcto; si Telegram rechaza o se cae la red devuelve `failed` sin tirar error ni mostrar el token; `notify` prueba Telegram primero y, si no sale, el mail | PAC-40 |
| `lib/agreement-form.test.ts` | Formulario de `/nuevo` (`lib/amounts.ts`, `lib/agreement-form.ts`) | "1500,50" pasa a unidades mínimas sin floats, rechaza montos raros, avisos de campos vacíos, contacto válido, montos vacíos/cero/negativos, entre 1 y 10 hitos, total = suma exacta | PAC-16, PAC-17 |
| `lib/agreement-share.test.ts` | Guardar y compartir (`lib/agreement-form.ts`) | Arma el pedido a la API con montos en unidades minimas y el link para compartir por Telegram con el link y el mensaje codificados | PAC-18 |
| `lib/approval-ui.test.ts` | Botón aprobar (`lib/approval-ui.ts`, `lib/chain/approval.ts`) | Ida y vuelta: lo que arma `buildApprovalTypedData` se firma con una cuenta de prueba de Hardhat y `verifyTypedData` lo verifica (y falla con otra posición); el botón solo aparece en `delivered`/`reminded` con la billetera del cliente; mensajes amables por error de la API y firma cancelada | PAC-24 |
| `routes.test.ts` | Direcciones de las páginas (`lib/routes.ts`) | Rutas fijas iguales al mapa del código, `clientUrl`, `freelancerUrl` y `receiptUrl`, escapa caracteres raros, no arma una dirección sin id | PAC-11 |
| `smoke.test.ts` | Que Vitest esté bien configurado | Montos en `bigint` suman sin perder precisión | PAC-01 |
| `statuses.test.ts` | Estados y tipos de la base | Las listas de `lib/validation/statuses.ts` coinciden con los `check` del SQL de `0002`, los estados del hito son los oficiales, montos `numeric(78, 0)`, cascade de hitos, `tx_hash` único y un solo pago por hito | PAC-03 |
| `validation/agreement.test.ts` | Validación de acuerdos (`lib/validation/agreement.ts`) | Pide todos los campos con mensajes en castellano, rechaza monedas y wallets inválidas, montos en 0, negativos, con coma o como `number`, días de revisión inválidos; no pierde precisión con `bigint`; suma de hitos | PAC-14 |
| `ui-status.test.ts` | Textos de estados del hito (`lib/ui/status.ts`) | Hay texto en castellano para cada estado oficial, `funded` es "Depositado", un estado desconocido no rompe | PAC-19 |
| `chain-address.test.ts` | Direcciones cortas (`lib/chain/address.ts`) | Abrevia `0x12ab…89cd`, deja igual las cortas | PAC-12 |
| `deliver.test.ts` | Entregar hito (`lib/deliver.ts`, `lib/ui/status-labels.ts`) | El botón solo en hitos `funded` y con la billetera de la freelancer, link https obligatorio, mensajes por código de error, textos de estado | PAC-23 |
| `chain/deposit.test.ts` | Depósito del cliente (`lib/chain/deposit.ts`) | El calldata del `transfer` termina con el sufijo del tag (se lee con `fromDataSuffix`), tag inválido falla, montos en `bigint` (0, negativos y texto se rechazan), errores de billetera en castellano | PAC-20 |
| `agent/releaser.test.ts` | Liberador (`agent/releaser.ts`) y recordatorios | Liberador (PAC-26): paga un hito `approved` una sola vez (tambien con dos corridas a la vez), simulacion que revierte no deja nada a medias, envio sin hash queda en revision manual sin reintento, recibo lento se reconcilia sin reenviar, saldo, estado, moneda, wallet y tope. Tambien paga los hitos `expired` (auto-liberados al dia 6) y avisa el pago sin que un aviso caido frene el pago. Topes por acuerdo/diarios (`todo`, PAC-60) | PAC-26, PAC-60 |
| `lib/receipts.test.ts` | Recibo de un hito (`lib/receipts.ts`) | Con una base falsa: arma el recibo con el pago `payout` confirmado y montos como texto, sin pago devuelve `payout: null`, hito inexistente o id mal formado da `null`, no filtra contactos ni firmas | PAC-27 |
| `intake/extract.test.ts` | Intake con IA (`lib/intake/extract.ts`), con un doble de la IA (sin red) | Limpia montos ("1.500,50" pasa a "1500.5"), el texto sin monto deja `amount: ""` y avisa (nunca inventa montos), acota días de revisión (0 a 60), descarta hitos sin título y corta en 20, reintenta una vez si la respuesta no sirve, avisa si falla dos veces, un error 4xx de la API no se reintenta, no llama a la IA con texto vacío, el texto de la persona va separado de las instrucciones y se pide `store: false` ; si INTAKE_MODEL no existe (404) usa el modelo por defecto; si la IA no contesta corta la espera y avisa | PAC-35 |
| `intake/chat.test.ts` | Chat del agente y monedas (`lib/intake/chat.ts`, `lib/ui/currency.ts`) | Junta los mensajes de la persona en orden, explica monedas y plazos (o manda a "Cambiar monedas" si falta), aplica los mismos días a todos los hitos, símbolos R$ / $ / MX$ y montos que no se inventan | PAC-37 |
| `security.test.ts` | Refuerzos de seguridad (`lib/rate-limit.ts`, `lib/chain/mainnet-guard.ts`, `lib/validation/agreement.ts`) | Límite de pedidos por IP y ventana, primera IP de `x-forwarded-for`, mainnet no opera sin `APPROVED_MAINNET` ni sin tope por pago, largos máximos de títulos, descripción y contacto | Auditoría |
| `fx/routes.test.ts` | Rutas reales de cambio (`lib/fx/uniswap.ts`, `lib/fx/textile.ts`, `lib/chain/dex.ts`) y guarda del cotizador | Camino Uniswap `moneda → USDT → moneda` (66 bytes), rate desde lo que cotiza el Quoter, monto de referencia sin monto, testnet y wMXN sin ruta; Textile en dos tramos, `no_quote` y errores como "sin precio"; la guarda descarta precios a más de 15 % de la referencia (pool rota) pero acepta la brecha real del peso cripto en los dos sentidos | PAC-32, PAC-08 |
| `fx/textile-swap.test.ts` | Cambio real con Textile (`lib/fx/textile-swap.ts`) | Aprueba y manda el swap, firma la prueba de control EIP-712, no aprueba de más, rechaza antes de mandar un swap o aprobación a un contrato que no es de Textile o por más de lo gastado, no gasta más de lo pedido, pide otra cotización si vence, frena si paga menos del mínimo, distingue "seguro que no salió plata" de "pudo salir", hace los dos tramos moneda → USDT → moneda y avisa si queda USDT en el medio | PAC-32 |
| `agent/releaser-conversion.test.ts` | El liberador cambia de moneda antes de pagar (`agent/releaser.ts`) | Sin conversor no paga monedas distintas, cambia y paga lo convertido, guarda el cambio con tipo de cambio y hash, no cambia ni paga dos veces, frena antes de cambiar si no hay ruta, si el monto estimado pasa el tope o si falta saldo, un fallo seguro reabre el hito y se reintenta, un fallo dudoso queda a revisión manual y no se reintenta solo, y retoma un cambio ya confirmado sin cambiar de nuevo | PAC-32 |
| `payout-caps.test.ts` | Topes de pago por moneda (`lib/chain/payout-caps.ts`) | Vacío = sin tope, pasa a unidades mínimas, falla (no ignora) si está mal escrito o es 0, cada moneda usa su tope y las demás el general | topes por moneda |
| `intake/questions.test.ts` | Preguntas del agente (`lib/intake/questions.ts`) | Pregunta lo que falta en orden (monto de cada hito, moneda, título, contacto), no pregunta nada cuando está todo, entiende montos con símbolos, monedas por nombre y valida el contacto sin guardar respuestas inválidas | chat que completa y genera el acuerdo |
| `intake/apply-draft.test.ts` | Propuesta de la IA al formulario (`lib/intake/apply-draft.ts`) | Carga título, moneda e hitos y deja el texto como descripción, el total sale de los montos propuestos y cambia al editar uno, no pisa lo que la persona ya escribió, hito sin monto queda vacío, corta en 10 hitos y avisa, cada fila con su id | PAC-37 |
| `api/intake.test.ts` | `POST /api/intake` (`app/api/intake/route.ts`), con la IA falsa | Devuelve el borrador, 400 si el cuerpo no es JSON o el texto falta o es muy largo, 503 si falta la clave de la IA (manda al formulario manual), 422 si no arma hitos válidos, 502 si la IA no responde | PAC-35 |
| `old-links.test.ts` | Links viejos (`next.config.ts`, `lib/routes.ts`) | `/a/<id>` redirige a `/cliente/<id>` y `/f/<id>` a `/freelancer/<id>`; los links nuevos usan `/cliente` y `/freelancer` | Renombre de rutas |
| `agent-card.test.ts` | Agent card ERC-8004 (`public/agent-card.json`) | Tiene `type`, `name`, `description`, `active`, `x402Support` y `supportedTrust`; el servicio web y la imagen son URLs https del mismo dominio y el ícono existe en `public/`; `registrations` trae el `agentId` de mainnet (PAC-45); no lleva claves | PAC-44 |
| `chain/identity.test.ts` | Identidad ERC-8004 (`lib/chain/identity.ts`) | Registros de mainnet y de Celo Sepolia (distintos), `agentRegistry` con formato `eip155:<chainId>:<registro>`, la ABI trae `register`, `setAgentURI` y `Registered`, `withRegistration` agrega el `agentId` sin repetir ni tocar la card original y conserva otras redes | PAC-45 |
| `ui-how-it-works.test.ts` | Textos de "Cómo funciona" (`lib/ui/how-it-works.ts`) | Sin jerga (gas, hash, token, blockchain), 5 pasos para quien cobra y 5 para quien paga, los plazos de 3 y 6 días, las cinco preguntas frecuentes del ticket | PAC-48 |

## Prueba punta a punta (no corre con `npm test`)

| Script | Qué prueba | Ticket |
|---|---|---|
| `scripts/e2e-sprint1.ts` (`npm run e2e:sprint1`) | Contra el servidor local y **solo en Celo Sepolia**: crea un acuerdo de 2 hitos, el cliente deposita con tag, la bóveda lo registra, entrega, aprobación con firma, el liberador paga y se arma el recibo. También comprueba que una firma o entrega ajena se rechaza, que el cron pide contraseña, que el pago sale con tag y que no se paga dos veces. Escribe el resultado en `docs/pruebas/sprint-1.md`. Necesita `npm run dev` con el mismo `CRON_SECRET`. | PAC-28 |
