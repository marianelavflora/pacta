# AGENTS.md

Contexto y reglas para cualquier agente de IA (Claude Code, Codex, Cursor, etc.) y para las personas que trabajan en este repo. Leelo entero antes de tocar código.

## Qué es Pactá

Pactá es un agente de IA que cobra trabajos freelance **por hitos y entre países, sin pasar por el dólar**. El cliente deposita al principio en su moneda (por ejemplo wBRL), la plata queda guardada en la bóveda del agente, y cada vez que se aprueba un hito el agente cotiza, convierte y le paga ese tramo a la freelancer en wARS. Si el cliente no responde en 3 días, el agente le manda un segundo aviso; si sigue sin responder 3 días más, libera el hito solo.

Es nuestro proyecto para la hackathon **Agents on Open Rails** (Loops House × Celo × Ripio).

- Track principal: **Stable Agents: LatAm** (Ripio × Celo).
- Track secundario: **Open Corridors: Textile FX**.
- Entrega: **lunes 9 nov 2026, 06:00 ART** (09:00 GMT). Objetivo real: domingo 8 nov.
- Plan completo: [`docs/PLAN.md`](docs/PLAN.md). Índice de toda la documentación (hackathon, logo, copias de las páginas): [`docs/README.md`](docs/README.md).
- Tickets: issues `PAC-01` a `PAC-54` (el número del issue es el mismo que el del ticket).

## Equipo

| Persona | Se ocupa de |
|---|---|
| Mavi | Agente, wallet, blockchain, pagos, FX, IA. Revisa todo lo que toque plata. |
| Flor | Frontend: base visual, wallet en la web, vistas, recibos, celular. |
| Leila | Base de datos, API, investigación de FX, tests, README. |
| Clau | Formularios, intake en pantalla, WhatsApp, mail, página "Cómo funciona". |

Si una persona del equipo te pide ayuda con un ticket, explicá lo que hacés en castellano y en palabras simples. Nadie del equipo tenía experiencia en web3 al arrancar: cuando algo sea de blockchain, explicá qué pasa como si fuera la primera vez.

## Reglas de la hackathon (no se negocian)

1. **Tag de atribución en toda transacción.** Toda transacción sale con el tag del equipo. Si no lo tiene, no suma y no hay forma de agregarlo después. Usá **siempre** el cliente de wallet único de `lib/` (ticket PAC-05). Nunca crees otro cliente de viem que mande transacciones, y nunca pongas `data: 'celo_...'` a mano.
2. **Solo cuenta mainnet (chain 42220).** Desarrollamos en testnet (Celo Sepolia) hasta el **miércoles 4 nov**, cuando pasamos a mainnet. La red se cambia con **una sola variable de entorno**; nunca hardcodees la red ni direcciones de una red en particular.
3. **Una sola wallet de agente** para todo el evento. Es la bóveda y la que paga. No crees otras wallets de agente.
4. **Identidad ERC-8004** registrada desde esa misma wallet antes de la entrega (PAC-45).
5. **Equipo y tag.** Antes de la primera transacción en mainnet hay que confirmar el equipo en Loops y usar **el tag del equipo**, no el personal de Mavi.
6. **Repo público** y todo el código escrito durante la hackathon.
7. **Usuarios independientes**: wallets que no creamos ni fondeamos nosotras y que ya usaban Celo antes. No inventes actividad ni fondees wallets para inflar números.

## Reglas de seguridad

- **Nunca** subas claves privadas, mnemonics, API keys ni tokens al repo. Van en variables de entorno (`.env.local`, Vercel). `.env.example` lleva los nombres, nunca los valores.
- **Nunca mandes transacciones en mainnet** desde un agente de IA sin que Mavi lo apruebe explícitamente en ese momento.
- Los pagos son **idempotentes**: un hito se paga una sola vez aunque la tarea corra dos veces. Antes de pagar, chequeá el estado y guardá el movimiento.
- Topes: máximo por acuerdo y máximo diario de pagos del agente durante la hackathon.
- La clave del agente solo vive en el servidor. Nada del navegador la toca.

## Stack

| Capa | Tecnología |
|---|---|
| Lenguaje | TypeScript (strict) |
| Web + API | Next.js (App Router), en Vercel |
| Estilos | Tailwind + shadcn/ui |
| Blockchain | viem; wagmi en el navegador (MiniPay, Valora, MetaMask) |
| Tag | `@celo/attribution-tags` |
| Identidad | ERC-8004, Identity Registry de Celo `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Monedas | wARS, wBRL, wMXN de Ripio (18 decimales). En testnet, tARS y tBRL de prueba si no existen |
| FX | Textile + un DEX de Celo de respaldo (ver `docs/fx.md` cuando exista) |
| IA | Claude API (intake de hitos y resúmenes) |
| Base de datos | Supabase (Postgres) |
| Tareas programadas | Vercel Cron |
| Avisos | WhatsApp (API oficial de Meta o Twilio) + mail con Resend de respaldo. Nada de librerías no oficiales de WhatsApp |

Contratos wFIAT en Celo mainnet: wARS `0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d`, wBRL `0xd76f5faf6888e24d9f04bf92a0c8b921fe4390e0`, wMXN `0x337e7456b420bd3481e7fa61fa9850343d610d34`.

## Convenciones de código

- Nombres de código en inglés; textos de la interfaz en castellano rioplatense y simples ("depositá", "aprobá"), sin jerga ("gas", "hash") salvo en detalles técnicos opcionales.
- Montos on-chain siempre como `bigint` en unidades mínimas (18 decimales). Convertí a texto solo para mostrar.
- Estados del hito: `pending → funded → delivered → reminded → approved | expired → converting → paid`, con `paused` desde `delivered`. Mantené estos nombres en código y base.
- Toda la lógica de cadena va en `lib/chain/`; la del agente (bóveda, liberador, cotizador) en `agent/`; la web en `app/`.
- Cambios chicos y enfocados en el ticket. Si ves algo para mejorar fuera del ticket, anotalo en un issue nuevo en vez de mezclarlo.

## Cómo trabajamos

1. Agarrá un issue tuyo cuyo "Depende de" ya esté hecho y movelo a **En curso** en el tablero.
2. Creá una rama desde `main`: `pac-XX-descripcion-corta` (por ejemplo `pac-14-api-crear-acuerdo`).
3. Commits chicos y en castellano o inglés, como prefieras, pero claros.
4. Abrí un PR con la plantilla y `Closes #XX`. Al mergear, el issue se cierra y pasa a **Hecho** solo.
5. Pedí revisión a otra persona del equipo. Lo que toque wallet, pagos, liberador o FX lo revisa **Mavi**.
6. Si cambia una decisión del proyecto, actualizá en el mismo PR [`docs/PLAN.md`](docs/PLAN.md) y la sección de abajo.

Mini standup por WhatsApp a la mañana (opcional): qué hice, qué hago hoy, en qué estoy trabada.

## Qué tiene que hacer un agente de IA en este repo

- Antes de empezar, leé este archivo, `docs/PLAN.md` y el issue del ticket.
- Si algo no está claro o hay más de una forma razonable, **preguntá** antes de asumir.
- Antes de codear algo grande, contá el plan en pocas líneas y qué tecnologías vas a usar.
- No toques archivos de otro ticket sin avisar.
- Si tu cambio modifica una decisión, una dirección de contrato, una variable de entorno o el flujo, **actualizá este archivo** (sección "Estado y decisiones") y `docs/PLAN.md` en el mismo PR. Estos archivos tienen que reflejar siempre cómo está el proyecto hoy.

## Estado y decisiones

Registro vivo. Agregá una línea cuando cambie algo (más nuevo arriba).

- 2026-10-26 · README principal en inglés (lo lee el jurado); PLAN.md y AGENTS.md siguen en castellano. Las secciones *pending* del README las completan PAC-04, PAC-45, PAC-50 y PAC-52.
- 2026-10-26 · Usuarios de GitHub: Mavi `marianelavflora`, Leila `leispini`, Clau `ClaudiaRivero863`.
- 2026-10-26 · Las cuatro codean. Mavi toma pagos, wallet, blockchain e IA; el resto se reparte entre Flor, Leila y Clau.
- 2026-10-26 · Tickets como issues PAC-01 a PAC-54, tablero en GitHub Projects, una rama y un PR por ticket. `main` no está protegida, pero no se pushea directo: todo entra por PR.
- 2026-10-25 · Avisos por WhatsApp en vez de Telegram, con mail de respaldo.
- 2026-10-25 · Sin respuesta del cliente: segundo aviso al día 3 y auto-liberación al día 6.
- 2026-10-25 · Desarrollo en testnet hasta el 4 nov; ese día se pasa a mainnet.
- 2026-10-25 · MVP con la wallet del agente como bóveda; el contrato de garantía es extra (PAC-54).
- 2026-10-25 · Proyecto elegido: mezcla de las ideas de Lei (cobro cross-border sin dólar + cobro por hitos con garantía).

Pendiente de definir: si el equipo se registra como team en Loops (y su tag), la ruta de FX definitiva (PAC-08), el usuario de GitHub de Flor.
