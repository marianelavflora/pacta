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
3. **Una sola wallet de agente** para todo el evento: la que se carga en el submit de Loops. El puntaje queda atado a esa dirección. Es la bóveda y la que paga, y sirve igual en testnet y en mainnet (la misma dirección anda en las dos redes). No crees otras wallets de agente.
4. **Identidad ERC-8004** registrada desde esa misma wallet antes de la entrega (PAC-45). La wallet que registra es la dueña del `agentId`.
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
| Web + API | Next.js 16 (App Router), en Vercel. Node 22.12 o más (`.nvmrc`) |
| Estilos | Tailwind 4 + shadcn/ui |
| Tests | Vitest (`npm test`) |
| Blockchain | viem; wagmi en el navegador (MiniPay, Valora, MetaMask) |
| Tag | `@celo/attribution-tags` |
| Identidad | ERC-8004 (direcciones por red en *Referencias técnicas*) |
| Monedas | wARS, wBRL, wMXN de Ripio (18 decimales). En testnet, tARS y tBRL de prueba si no existen |
| FX | Textile + un DEX de Celo de respaldo (ver `docs/fx.md` cuando exista) |
| IA | Claude API (intake de hitos y resúmenes) |
| Base de datos | Supabase (Postgres) |
| Tareas programadas | Vercel Cron |
| Avisos | WhatsApp (API oficial de Meta o Twilio) + mail con Resend de respaldo. Nada de librerías no oficiales de WhatsApp |

Tag de atribución actual: **`celo_dc3ce5f39b37`** (el personal de Mavi). Va en la variable `NEXT_PUBLIC_ATTRIBUTION_TAG`, nunca escrito en el código. Si antes de mainnet nos anotamos como equipo en Loops, se reemplaza por el tag del equipo (regla 5) y se cambia solo esa variable.

Wallet del agente (la del submit de Loops, para testnet y mainnet): `0xab569A8d8A5b60CFfdf9B88EdE099c80d8328E73`. La clave privada vive solo en `.env.local` y en Vercel como `AGENT_PRIVATE_KEY`. Nunca va en capturas, chats ni el repo.

Contratos wFIAT en Celo mainnet: wARS `0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d`, wBRL `0xd76f5faf6888e24d9f04bf92a0c8b921fe4390e0`, wMXN `0x337e7456b420bd3481e7fa61fa9850343d610d34`.

## Convenciones de código

- Nombres de código en inglés; textos de la interfaz en castellano rioplatense y simples ("depositá", "aprobá"), sin jerga ("gas", "hash") salvo en detalles técnicos opcionales.
- Montos on-chain siempre como `bigint` en unidades mínimas (18 decimales). Convertí a texto solo para mostrar.
- Estados del hito: `pending → funded → delivered → reminded → approved | expired → converting → paid`, con `paused` desde `delivered`. Mantené estos nombres en código y base.
- Toda la lógica de cadena va en `lib/chain/`; la del agente (bóveda, liberador, cotizador) en `agent/`; la web en `app/`.
- Cambios chicos y enfocados en el ticket. Si ves algo para mejorar fuera del ticket, anotalo en un issue nuevo en vez de mezclarlo.

## Referencias técnicas

Leé la que corresponda antes de tocar wallet, tag, identidad o fondos.

### Tag de atribución: [BUILDERS.md de `celo-org/attribution-tags`](https://github.com/celo-org/attribution-tags/blob/main/BUILDERS.md)
- **Paquete:** `@celo/attribution-tags` (usa ERC-8021). El tag se pega al final de los datos de la transacción y el contrato lo ignora.
- **En el servidor:** el cliente del agente se crea con `createWalletClient(...).extend(withAttribution(TAG))`, y así sale taggeado todo `sendTransaction` y `writeContract` (PAC-05).
- **En el navegador (wagmi):** a `useWriteContract` se le pasa `dataSuffix: toDataSuffix(TAG)` en cada `writeContract`, o se extiende el cliente de `useWalletClient()` (PAC-20, el depósito del cliente).
- **Verificar:** `verifyTx({ client, hash })` devuelve `{ codes }`, o `null` si la transacción no tiene tag. Úsenlo en las pruebas de PAC-05 y PAC-28.
- **Errores típicos:**
  - Poner `data: 'celo_...'` en vez de `toDataSuffix(...)`.
  - Usar `withAttribution` y `dataSuffix` a la vez.
  - Llamar a `codeFromHostname(window.location...)` arriba de todo en un archivo `"use client"`: se rompe en el servidor.
  - Usar `sendCalls` o batch, que no lo cubre `withAttribution`.
  - Poner mayúsculas o espacios en el código.
- **Qué código se acredita:** si el programa asigna un código, solo ese suma. Se pueden mandar varios: `toDataSuffix(['propio', 'asignado'])`. Antes de mainnet, confirmar el código del equipo en Loops (regla 5).

### Identidad del agente, el "DNI" con ERC-8004: [docs de Celo](https://docs.celo.org/build-on-celo/build-with-ai/8004)

| Red | Identity Registry | Reputation Registry |
|---|---|---|
| Celo mainnet (42220) | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| Celo Sepolia (testnet) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

- **Registrar:** `register(agentURI)` mintea un NFT a la wallet que llama, que pasa a ser la dueña de la identidad. El `agentId` se lee del evento `Registered` del recibo, no de una simulación.
- **Agent card (PAC-44):** es el JSON público al que apunta `agentURI`. Tiene `type`, `name`, `description`, `image`, `services` (por ejemplo `{ name: "web", endpoint }`), `active`, `x402Support`, `supportedTrust` y `registrations`.
- **Orden:** 1) publicar la card sin `registrations`; 2) llamar a `register`; 3) agregar `{ agentId, agentRegistry: "eip155:42220:<registry>" }` a la card; 4) llamar a `setAgentURI(agentId, uri)` (PAC-45).
- **Reputación:** usuarios que no son dueños del agente pueden dejarle feedback con `giveFeedback`. Suma como prueba de uso real.

### Pasar fondos a Celo (bridges): [docs de Celo](https://docs.celo.org/build/tools/bridges/bridges)
- **Para qué lo necesitamos:** fondear la wallet del agente en mainnet el 4 nov (PAC-43) y ayudar a usuarios que tienen plata en otra red.
- **Opciones:** Superbridge (también anda en testnet), Layerswap (también desde exchanges centralizados), Squid, Jumper, Hyperlane, Portal (Wormhole), Transporter (Chainlink CCIP) y SmolRefuel (para cargar un poco de gas).
- **Cuidado:** la página no recomienda ninguno. Antes de mover plata, leer los riesgos de cada uno, probar con un monto chico y que Mavi apruebe.

## Mapa del código

Dónde va cada cosa. Los tickets usan estos nombres; si cambiás uno, actualizá esta tabla.

| Ruta | Qué va |
|---|---|
| `app/page.tsx` | Inicio (`/`) |
| `app/nuevo/` | Crear acuerdo (`/nuevo`) |
| `app/a/[id]/` | Vista del cliente (`/a/<publicId>`) |
| `app/f/[id]/` | Vista de la freelancer (`/f/<publicId>`) |
| `app/recibo/[id]/` | Recibo de un hito (`/recibo/<milestoneId>`) |
| `app/como-funciona/` | Página "Cómo funciona" |
| `app/api/agreements/` | `POST` crear acuerdo, `GET [id]` leer acuerdo |
| `app/api/milestones/[id]/deliver/` y `approve/` | Entregar y aprobar un hito |
| `app/api/intake/`, `app/api/quote/`, `app/api/receipts/[id]/` | Intake con Claude, cotización, datos del recibo |
| `app/api/cron/` | Tareas programadas (protegidas con `CRON_SECRET`) |
| `components/` | Piezas de pantalla: `Header.tsx`, `Footer.tsx`, `Logo.tsx`; `components/ui/` es shadcn |
| `lib/db.ts` | Cliente de Supabase (solo servidor) |
| `lib/chain/` | `chains.ts` (red según `NEXT_PUBLIC_CHAIN` y links al explorador, `txUrl`), `wagmi.ts` (navegador), `wallet.ts` (cliente con tag, solo servidor), `tokens.ts` (direcciones por red), `approval.ts` (mensaje de firma) |
| `lib/fx/` | Precio de referencia y comparación |
| `lib/notify/` | `whatsapp.ts`, `email.ts`, `messages.ts` (textos), `events.ts` (un aviso por cambio de estado), `index.ts` (`notify`) |
| `lib/validation/` | Esquemas de zod compartidos entre web y API |
| `lib/ui/` | Textos de estados y errores amigables |
| `lib/routes.ts` | Direcciones de las páginas: `routes`, `clientUrl`, `freelancerUrl`, `receiptUrl` |
| `agent/` | Bóveda, liberador, cotizador y recordatorios |
| `supabase/migrations/` | SQL de las tablas: `users`, `agreements`, `milestones`, `movements`, `quotes` |
| `tests/` | Tests (Vitest). `tests/README.md` describe cada uno (PAC-60) |
| `scripts/` | Scripts sueltos |
| `public/` | Logos (`public/brand/`) y `agent-card.json` |

Variables de entorno clave: `NEXT_PUBLIC_CHAIN` (`celo-sepolia` o `celo`), `NEXT_PUBLIC_ATTRIBUTION_TAG`, `AGENT_PRIVATE_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `TWILIO_*`, `RESEND_API_KEY`, `CRON_SECRET`, `TIME_UNIT` (`days` o `minutes` para probar plazos rápido). Todas listadas en `.env.example`, sin valores.

## Cómo trabajamos

1. Agarrá un issue tuyo cuyo "Depende de" ya esté hecho y movelo a **En curso** en el tablero.
2. Creá una rama desde `main`: `pac-XX-descripcion-corta` (por ejemplo `pac-14-api-crear-acuerdo`).
3. Commits chicos y en castellano o inglés, como prefieras, pero claros.
4. Abrí un PR con la plantilla y `Closes #XX`. Al mergear, el issue se cierra y pasa a **Hecho** solo.
5. Pedí revisión a otra persona del equipo. Lo que toque wallet, pagos, liberador o FX lo revisa **Mavi**.
6. Si cambia una decisión del proyecto, actualizá en el mismo PR [`docs/PLAN.md`](docs/PLAN.md) y la sección de abajo.

Guía paso a paso, con comandos y qué hacer si algo se complica: [`docs/WORKFLOW.md`](docs/WORKFLOW.md).

Mini standup por WhatsApp a la mañana (opcional): qué hice, qué hago hoy, en qué estoy trabada.

## Qué tiene que hacer un agente de IA en este repo

- Antes de empezar, leé este archivo, `docs/PLAN.md` y el issue del ticket.
- Si algo no está claro o hay más de una forma razonable, **preguntá** antes de asumir.
- Antes de codear algo grande, contá el plan en pocas líneas y qué tecnologías vas a usar.
- No toques archivos de otro ticket sin avisar.
- Si tu cambio modifica una decisión, una dirección de contrato, una variable de entorno o el flujo, **actualizá este archivo** (sección "Estado y decisiones") y `docs/PLAN.md` en el mismo PR. Estos archivos tienen que reflejar siempre cómo está el proyecto hoy.
- Escribí la **descripción del PR en formato APB**, con la plantilla: qué cambia en palabras simples, cómo probarlo paso a paso y las palabras nuevas explicadas. Tiene que entenderla alguien del equipo que no vio el código.
- **Tests (QA):** después de cada implementación, revisá la carpeta `tests/` y agregá o editá los tests de lo que cambiaste. Anotá cada test nuevo en `tests/README.md` (qué prueba y de qué ticket viene).
- Antes de abrir el PR, corré `npm run lint`, `npm test` y `npm run build`, y contá en el PR si algo falló.
- El bloque `nextjs-agent-rules` del final de este archivo lo escribe `next dev` solo. No lo borres: si lo sacás, vuelve a aparecer.

### Primera vez: la frase para arrancar

Cuando abras el repo con tu agente (Claude Code, Cursor, Codex, Orca, el que sea), pegale esto cambiando tu nombre:

> Soy **Leila**. Leé `AGENTS.md`, `docs/WORKFLOW.md` y `docs/PLAN.md`. Después buscá cuál es mi próximo ticket siguiendo "Cómo elegir el próximo ticket" de `AGENTS.md` y decime cuál es y por qué. Leé ese issue entero, explicame el plan en palabras simples y qué tecnologías vas a usar, y esperá mi OK antes de tocar código.

Si ya sabés qué ticket querés, cambiá la segunda oración por "Mi ticket es el issue #XX".

### Cómo elegir el próximo ticket

El agente lo calcula así (con `gh`, la línea de comandos de GitHub; si no la tiene, le pide a la persona que pegue la lista de sus issues):

1. **Los issues de la persona:** abiertos y con su etiqueta (`flor`, `leila` o `clau`). Los de `todas` también cuentan. `gh issue list --state open --label leila`.
2. **Que se pueda arrancar:** en la sección "Depende de" de cada issue (`gh issue view 14`), todos los issues nombrados tienen que estar **cerrados**. Algunos dicen `PAC-05` en vez de `#5`: es el mismo número.
3. **Que nadie lo tenga:** que no haya una rama `pac-XX-…` ni un PR abierto para ese issue (`git fetch` y `git branch -r`, `gh pr list`).
4. **El orden:** entre los que quedan, primero el sprint más bajo (`sprint-1` antes que `sprint-2`) y después el número de issue más bajo.
5. **Si no queda ninguno:** decí qué ticket la traba y de quién es, así le avisa. Se puede adelantar una parte que no dependa de eso, avisando en el issue.

### Varios agentes a la vez: metodología sugerida (ahorra tokens y disco)

Cuando un agente coordina a otros para avanzar varios tickets en paralelo, conviene trabajar así. Sale de la primera tanda del sprint 1, donde 16 agentes gastaron cerca de 1,4 millones de tokens y las copias del repo llegaron a 6,5 GB.

1. **Pocos a la vez:** 2 o 3 agentes en paralelo, con tickets que no toquen los mismos archivos. Más que eso genera conflictos de merge y los revisores terminan actualizando ramas una y otra vez.
2. **Revisión solo donde importa:** lo que toca wallet, pagos, liberador, FX, base de datos o seguridad pasa por un agente revisor (y lo mira Mavi). Páginas, estilos y docs se mergean si los checks de GitHub (`test` y Vercel) están en verde y el PR se lee bien.
3. **Modelo según la tarea:** el que programa usa el modelo fuerte; el revisor y las tareas mecánicas (docs, conflictos, limpiar) pueden usar uno más liviano (por ejemplo Sonnet).
4. **Reusar copias del repo:** cada worktree con `node_modules` pesa unos 500 MB. Reusá una copia que ya tenga las dependencias instaladas en vez de crear una nueva por agente, y borrá las que ya no se usan (`git worktree remove` y `git worktree prune`).
5. **Instrucciones cortas y concretas:** decile al agente qué archivos ya existen y qué tiene que leer; no le pidas que relea todo el repo. Pedile un reporte final corto.
6. **Sesiones nuevas seguido:** cuando la conversación del coordinador se hace larga, cada mensaje cuesta más. Cerrala con un resumen del estado y arrancá una nueva pegando ese resumen.
7. **Nunca imprimir secretos:** los scripts que leen `.env.local` no muestran valores, ni siquiera en los mensajes de error.

## Estado y decisiones

Registro vivo. Agregá una línea cuando cambie algo (más nuevo arriba).

- 2026-10-31 · Aprobar un hito (PAC-25): el cliente firma EIP-712 `Approval` (dominio `{ name: "Pactá", version: "1", chainId }`; campos `mensaje`, `acuerdo` (public_id), `hito` (uuid), `posicion`, `monto` (formateado), `moneda`), armado por `buildApprovalTypedData` en `lib/chain/approval.ts`; `POST /api/milestones/[id]/approve` con `{ signature }` verifica contra `client_wallet` y deja el hito en `approved` (no paga).

- 2026-10-31 · Páginas y navegación (PAC-11): esqueletos de `/nuevo`, `/a/[id]`, `/f/[id]`, `/recibo/[id]`, `/como-funciona` y `not-found`, con links en el header. Los links a páginas se arman con `lib/routes.ts`, no a mano. Como está prendido `cacheComponents`, todo lo que lea `params`, `usePathname()` o datos de la base tiene que ir dentro de `<Suspense>` (ver `components/IdBadge.tsx`); si no, `npm run build` falla. Piezas compartidas: `PageHeader` (título + volver) y `EmptyState`.
- 2026-10-31 · Metodología sugerida para trabajar con varios agentes a la vez (ver "Varios agentes a la vez"). El cliente puede depositar en partes: los hitos pasan a `funded` en orden a medida que lo depositado los cubre.
- 2026-10-31 · PAC-05: cliente único del agente en `lib/chain/wallet.ts` (tag con `withAttribution`, `feeCurrency` opcional por transacción) y red/explorador en `lib/chain/chains.ts`. Probado en Celo Sepolia con `npm run tag:smoke`.
- 2026-10-31 · Base visual (PAC-10): letra Familjen Grotesk; colores de marca iguales al logo (`docs/brand/`): fondo `#f6f7f3`, texto `#111814`, verde profundo `#17231d` (botón principal), amarillo `#f4e94a` (no el `#FBCC5C` que decía el issue), verde `#35d07f`, chips `#e6ede8`. Tokens en `app/globals.css` (shadcn + `highlight`, `success`, `chip`, `brand-*`). Modo oscuro según el sistema (`prefers-color-scheme`), sin botón para cambiarlo. shadcn/ui estilo `radix-nova` con botones redondos grandes y tarjetas con borde fino. El layout ya pone `<main>`, `Header` y `Footer`: las páginas no deben agregar otro `<main>`.
- 2026-10-26 · Proyecto base (PAC-01): Next.js 16, TypeScript strict con target ES2020 (para usar `bigint`), Tailwind 4, ESLint y Vitest. Pide Node 22.12 o más, porque Vitest 5 lo necesita.
- 2026-10-26 · QA: después de cada implementación se revisan los tests de `tests/` y se documentan en `tests/README.md` (PAC-60).
- 2026-10-26 · Frase de arranque para los agentes y regla para elegir el próximo ticket. Las descripciones de PR van en formato APB (plantilla nueva).
- 2026-10-26 · No se protege `main`: queda como acuerdo del equipo, no como regla de GitHub.
- 2026-10-31 · Tokens de prueba en Celo Sepolia (wARS/wBRL de Ripio no existen ahí), dueña la wallet del agente: tARS `0x7d0f189d248bffe3888903d071bacd5f8c435845`, tBRL `0xb02ecb85c1f37c42bf8c7aea4d13748c36a7e905`. `getToken("wARS")` devuelve tARS en testnet. Ojo: `deployContract` NO lleva el tag; se despliega con `sendTransaction` (ver `scripts/deploy-test-tokens.ts`).
- 2026-10-26 · Wallet del agente confirmada por Mavi: `0xab569A8d8A5b60CFfdf9B88EdE099c80d8328E73`. Es la del submit de Loops, se usa en testnet y en mainnet, y no se crea otra el 4 nov.
- 2026-10-26 · Tag de atribución `celo_dc3ce5f39b37` (personal de Mavi) en `NEXT_PUBLIC_ATTRIBUTION_TAG`. Cambia si hay equipo en Loops.
- 2026-10-26 · Sumadas referencias de tag, ERC-8004 y bridges. El Identity Registry de testnet es distinto al de mainnet.
- 2026-10-26 · Tickets de Flor, Leila y Clau reescritos en formato APB (paso a paso, archivos, cómo probar, palabras nuevas). Mapa del código y guía `docs/WORKFLOW.md`.
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

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
