# Pasar Pactá a mainnet

Guía paso a paso para dejar **producción en Celo mainnet (chain 42220)** y **local en testnet (Celo Sepolia)**. Está pensada para hacerla con el documento adelante, en orden.

> **Regla de oro.** Todo lo que manda plata en mainnet lo aprueba **Mavi, a mano, en ese momento**. Un agente de IA no pone `APPROVED_MAINNET=yes`, no corre `--send` en mainnet ni firma nada. Los comandos de esta guía que mandan una transacción están marcados con **💸**.

## 1. Cómo se reparte cada entorno

La red se cambia con **una sola variable** (`NEXT_PUBLIC_CHAIN`). Cada lugar tiene su propio juego de variables:

| Dónde | Red | Base de datos | Puede mover plata real |
|---|---|---|---|
| Tu compu (`.env.local`) | `celo-sepolia` | el mismo proyecto (ver paso 2) | No |
| Vercel **Preview** y **Development** (los previews de los PR) | `celo-sepolia` | el mismo proyecto (ver paso 2) | No |
| Vercel **Production** (`https://pacta-dun.vercel.app`) | `celo` | el mismo proyecto (ver paso 2: **riesgo conocido**) | **Sí** |

Qué cambia y qué no:

| Variable | Local, Preview y Development | Production |
|---|---|---|
| `NEXT_PUBLIC_CHAIN` | `celo-sepolia` | `celo` |
| `APPROVED_MAINNET` | **no se pone** | `yes` (es la aprobación de Mavi) |
| `MAX_PAYOUT_PER_MILESTONE_ARS` / `_BRL` / `_MXN` | vacías | **obligatorias** (ver paso 3) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | el proyecto actual | el mismo (hasta después de la deadline) |
| `NEXT_PUBLIC_ATTRIBUTION_TAG` | `celo_dc3ce5f39b37` (tag del equipo) | el mismo |
| `AGENT_PRIVATE_KEY` | la clave del agente, solo si probás pagos en testnet | la clave del agente |
| `CRON_SECRET`, `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `RESEND_API_KEY` | los de prueba | los de producción |

La wallet del agente (`0xab569A8d8A5b60CFfdf9B88EdE099c80d8328E73`) y el tag **son los mismos** en las dos redes.

## 2. Base de datos: decisión actual y riesgo conocido

> **Decisión (2026-11-09, Mavi): hasta después de la entrega, local, Preview y producción usan el MISMO proyecto de Supabase.** Separarlos en dos proyectos queda como tarea para después de la deadline (ver "Cómo separarlo después" más abajo).

### El riesgo (vulnerabilidad conocida)

Con una sola base, los acuerdos de prueba (con tARS/tBRL de testnet) y los reales (wARS/wBRL de mainnet) conviven en las mismas tablas. Consecuencias:

- **Pago por error en mainnet.** El liberador de producción paga todo hito en estado `approved` (y `expired`) que encuentre. Si hay un acuerdo de prueba aprobado en la base, intenta pagarlo **en mainnet, con plata real de la wallet del agente**, a la wallet que figure como freelancera de esa prueba. Los topes por pago limitan el daño, pero no lo evitan.
- **Datos mezclados.** Los recibos, listados y la vista del cliente pueden mostrar acuerdos de otra red.
- **Quién puede dispararlo.** Desde el 2026-11-09 el cron diario de Vercel (`vercel.json`) y la propia ruta de aprobación corren el liberador solas. **Está mitigado por una guarda:** el liberador solo paga un acuerdo si su depósito existe en la red actual (se comprueba en la cadena), así que un acuerdo de prueba de testnet nunca se paga con plata de mainnet. Los topes por moneda siguen limitando el daño.

### Cómo reducirlo mientras tanto (obligatorio antes de cada prueba en mainnet)

1. **Vaciá las tablas de prueba antes de pasar a mainnet.** En Supabase → SQL Editor, con cuidado de estar en el proyecto correcto:
   ```sql
   truncate table movements, quotes, milestones, agreements, users restart identity cascade;
   ```
   (Si ya hay usuarios reales de mainnet, no vacíes `users`: borrá solo los de prueba.)
2. **No corras pruebas locales que lleguen a `approved`** contra esa base. Si hace falta probar el flujo completo, hacelo en mainnet con montos mínimos, o vaciá las tablas otra vez después.
3. **El cron ya está agendado** (una vez por día, lo máximo que permite Hobby) y es seguro con la base compartida gracias a la guarda de red del liberador.
4. **Mantené los tres topes por moneda bajos** (paso 3) mientras convivan.
5. Antes de disparar `/api/cron/releaser` a mano, mirá en Supabase qué hitos están `approved` y confirmá que todos son los de la prueba que querés pagar.

### Cómo separarlo después de la deadline

1. En Supabase, crear un proyecto nuevo `pacta-prod`.
2. SQL Editor: pegar y correr, en orden, cada archivo de `supabase/migrations/` (`0001_...`, `0002_...` y los que sigan). Verificar que estén `users`, `agreements`, `milestones`, `movements` y `quotes`, vacías.
3. Anotar la **Project URL** (Project Settings → Data API) y la clave **secret** (`sb_secret_...`, en API Keys; nunca la publishable/anon).
4. En Vercel, partir `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`: **solo Production** con los del proyecto nuevo, y **Preview y Development** con los del proyecto actual (el de pruebas). Redeployar Production.
5. El cron ya está agendado; no hay nada más que hacer acá.

## 3. Variables en Vercel

Vercel → proyecto → **Settings → Environment Variables**. Cada variable tiene tres casillas: Production, Preview y Development.

**Solo en Production** (destildá Preview y Development):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_CHAIN` | `celo` |
| `APPROVED_MAINNET` | `yes` |
| `MAX_PAYOUT_PER_MILESTONE_ARS` | para la primera prueba, por ejemplo `100` |
| `MAX_PAYOUT_PER_MILESTONE_BRL` | para la primera prueba, por ejemplo `5` |
| `MAX_PAYOUT_PER_MILESTONE_MXN` | para la primera prueba, por ejemplo `20` |

Los topes son en unidades enteras del token y valen para cada moneda por separado (1 wBRL y 1 wARS no valen lo mismo). Si una moneda no tiene el suyo, usa `MAX_PAYOUT_PER_MILESTONE`. **En mainnet, sin tope en una moneda no se paga en esa moneda.** Para la demo, valores de referencia: unos US$45 por pago (`250` wBRL, `800` wMXN, `50000` wARS; revisá el tipo de cambio del día).

**En Production, Preview y Development** (las tres casillas):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_ATTRIBUTION_TAG` | `celo_dc3ce5f39b37` |

**Preview y Development:** `NEXT_PUBLIC_CHAIN=celo-sepolia`, y las mismas claves de Supabase. No cargues `APPROVED_MAINNET` ni los topes. Sin `AGENT_PRIVATE_KEY` salvo que necesites probar pagos en un preview.

**Production, además:** `AGENT_PRIVATE_KEY`, `CRON_SECRET` (largo y al azar, por ejemplo `openssl rand -hex 32`), `GEMINI_API_KEY`, `NEXT_PUBLIC_APP_URL`, y los avisos que vayan a usar (`TELEGRAM_BOT_TOKEN`, `RESEND_API_KEY`).

> Las variables `NEXT_PUBLIC_…` se fijan **al construir** la web. Después de cambiar cualquiera, hay que **redeployar** Production (Deployments → los tres puntos → Redeploy).

En tu compu, `.env.local` queda con `NEXT_PUBLIC_CHAIN=celo-sepolia` y el mismo Supabase. Si usás `vercel env pull`, asegurate de que las variables de Development estén en testnet.

## 4. Antes de la primera transacción

Chequeá cada punto:

- [ ] La wallet del agente tiene CELO para las comisiones. Se verifica en [CeloScan](https://celoscan.io/address/0xab569A8d8A5b60CFfdf9B88EdE099c80d8328E73) (hoy: 5 CELO).
- [ ] La wallet que va a hacer de **cliente** tiene el token con que vas a depositar (por ejemplo wARS) y algo de CELO para su propio depósito.
- [ ] La freelancera es **otra** wallet distinta de la del cliente (por ejemplo, otra cuenta de MetaMask).
- [ ] Las tablas de prueba de Supabase están vaciadas (paso 2) y las variables del paso 3 están cargadas, con Production redeployada.
- [ ] Al abrir la web de producción, la billetera pide la red **Celo**, no Celo Sepolia.

## 5. Registrar la identidad ERC-8004 en mainnet (PAC-45)

Es el "DNI" del agente. Se registra **una sola vez por red**, desde la wallet del agente. El `agentId` de testnet **no** va a la card de producción.

Para no tocar tu `.env.local` de testnet, armá un archivo aparte, `.env.mainnet` (los archivos `.env*` no se suben al repo, pero contiene la clave del agente: no lo compartas ni lo captures) con:

```
NEXT_PUBLIC_CHAIN=celo
NEXT_PUBLIC_ATTRIBUTION_TAG=celo_dc3ce5f39b37
AGENT_PRIVATE_KEY=<la clave del agente>
```

1. **Ensayo (no manda nada):**
   `ENV_FILE=.env.mainnet npm run agent:register`
2. **💸 Registrar** (lo aprueba Mavi: agregá `APPROVED_MAINNET=yes` a `.env.mainnet` solo para este paso):
   `ENV_FILE=.env.mainnet npm run agent:register -- --send --write-card`
   Muestra el `agentId` y lo suma a `public/agent-card.json`.
3. **Publicar la card:** commit y PR con el cambio de `public/agent-card.json`, y esperar el deploy.
4. **💸 Apuntar la identidad a la card publicada:**
   `ENV_FILE=.env.mainnet npm run agent:register -- --set-uri=<agentId> --send`
5. Sacá `APPROVED_MAINNET` de `.env.mainnet` cuando termines.

## 6. Primera prueba completa en mainnet

Montos **mínimos**. Para la primera vez, un acuerdo en la **misma moneda** (wARS → wARS): hoy el liberador paga sin convertir (la conversión es PAC-32).

1. En la web de producción, **crear el acuerdo**: un hito chico (por ejemplo 100 wARS), moneda del cliente y de cobro iguales. Conectá la wallet de la **freelancera**.
2. Con la wallet del **cliente**, abrí el link del acuerdo y **💸 depositá**.
3. La **freelancera entrega** el hito.
4. El **cliente aprueba** firmando.
5. **Pago:** el cliente aprueba y la ruta de aprobación paga el hito apenas responde (no hace falta ningún cron). Si algo falló, el cron diario lo reintenta, o se dispara a mano:
   ```
   curl -H "Authorization: Bearer <CRON_SECRET>" https://pacta-dun.vercel.app/api/cron/vault
   curl -H "Authorization: Bearer <CRON_SECRET>" https://pacta-dun.vercel.app/api/cron/releaser
   ```
   El primero detecta el depósito y el segundo paga (**💸 sale plata del agente**).
6. **Verificar el tag de cada transacción** (el depósito y el pago). Cada una tiene un hash que se ve en el recibo y en CeloScan:
   `NEXT_PUBLIC_CHAIN=celo npm run tag:verify -- 0x<hash>`
   Tiene que decir "Tag del equipo verificado". Una transacción sin tag **no suma y no se puede arreglar después**. Si falta en alguna, frená y avisá.

> `npm run tag:smoke` **solo corre en testnet**: no sirve para mainnet. En mainnet se usa `tag:verify` sobre transacciones reales.

### Conversión entre monedas (Textile)

Si el cliente deposita en una moneda y la freelancera cobra en otra, el liberador cambia con Textile antes de pagar (4 transacciones: 2 aprobaciones y 2 swaps, todas con el tag del equipo). Antes de la primera prueba:

1. **Correr la migración** `supabase/migrations/0003_movements_details.sql` en el SQL Editor de Supabase (`alter table movements add column if not exists details jsonb;`). Sin esa columna el cambio falla antes de mover plata.
2. La wallet del agente necesita CELO (comisiones). La plata que se cambia es la del depósito del cliente.
3. Montos mínimos: Textile pide al menos ~US$1 por tramo.
4. Si un cambio queda a medias, el hito queda en `converting` y el log dice `NECESITA REVISION MANUAL`: puede haber USDT del agente en el medio. Mirá la wallet del agente en CeloScan antes de tocar nada. Nada se reintenta solo.

## 7. Si algo sale mal

- **Frenar al agente:** en Vercel, borrá `APPROVED_MAINNET` de Production y redeployá. En mainnet el agente no opera sin esa variable.
- **Un pago no salió:** el hito queda en `approved` y se puede correr el liberador de nuevo; los pagos son idempotentes (un hito se paga una sola vez).
- **No se ve un depósito:** corré `/api/cron/vault` y revisá que la red de la web sea Celo.

## 8. Pendientes que no bloquean el paso a mainnet

- **Separar Supabase en dos proyectos (después de la deadline)**, ver paso 2.
- Un cron más frecuente que una vez por día (Hobby no lo permite): hoy, pagar al aprobar y el cron diario cubren los plazos de 3 y 6 días.
- Cargar `RESEND_API_KEY` y el bot de Telegram para los avisos.
- Conversión on-chain entre monedas (PAC-32).
- Buscar usuarios independientes: wallets que no creamos ni fondeamos y que ya usaban Celo (regla 7 de `AGENTS.md`).
