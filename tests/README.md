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
| `tests/agent/` | Bóveda, liberador, cotizador y recordatorios (`agent/`) |
| `tests/chain/` | Wallet, tag y tokens (`lib/chain/`) |
| `tests/fx/` | Precio de referencia y comparación (`lib/fx/`) |
| `tests/notify/` | Avisos por WhatsApp y mail (`lib/notify/`) |
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
| `agent/releaser.test.ts` | Liberador y recordatorios | Pago una sola vez, `paused` no paga, aviso al día 3, liberación al día 6, topes (todos `todo`) | PAC-60 |
| `api/agreements.test.ts` | API de acuerdos e hitos | `POST /api/agreements` sin red (la base es un doble en memoria): crea o reusa la usuaria, el total sale de sumar los hitos (no de la web), hitos con `position` 1, 2, 3, reintento si el `public_id` ya existe, borra el acuerdo si fallan los hitos, responde 201, 400 o 500 sin filtrar el error de la base. `GET /api/agreements/[id]`: acuerdo con hitos ordenados por `position` (sin mezclar hitos de otro acuerdo), montos como texto validados con `BigInt`, sin teléfonos, mails, contacto del cliente ni firma, 404 si no existe, 400 si el id tiene mal formato, 500 sin filtrar el error. Entregar y aprobar siguen `todo` | PAC-14, PAC-15 |
| `chain/wallet.test.ts` | Wallet y tokens | Tag en toda transacción, red por variable, direcciones por red (todos `todo`) | PAC-60 |
| `fx/quote.test.ts` | Cotización | Conversión en `bigint`, referencia vs DEX (todos `todo`) | PAC-60 |
| `helpers/fixtures.test.ts` | Los datos de ejemplo | `units`, total = suma de hitos, copias nuevas, un hito por estado | PAC-60 |
| `notify/messages.test.ts` | Avisos | Texto por estado, mail de respaldo, consentimiento de WhatsApp (todos `todo`) | PAC-60 |
| `smoke.test.ts` | Que Vitest esté bien configurado | Montos en `bigint` suman sin perder precisión | PAC-01 |
| `statuses.test.ts` | Estados y tipos de la base | Las listas de `lib/validation/statuses.ts` coinciden con los `check` del SQL de `0002`, los estados del hito son los oficiales, montos `numeric(78, 0)`, cascade de hitos, `tx_hash` único y un solo pago por hito | PAC-03 |
| `validation/agreement.test.ts` | Validación de acuerdos (`lib/validation/agreement.ts`) | Pide todos los campos con mensajes en castellano, rechaza monedas y wallets inválidas, montos en 0, negativos, con coma o como `number`, días de revisión inválidos; no pierde precisión con `bigint`; suma de hitos | PAC-14 |
