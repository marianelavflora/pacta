# Pasar Pactá a mainnet

Guía paso a paso para dejar **producción en Celo mainnet (chain 42220)** y **local en testnet (Celo Sepolia)**. Está pensada para hacerla con el documento adelante, en orden.

> **Regla de oro.** Todo lo que manda plata en mainnet lo aprueba **Mavi, a mano, en ese momento**. Un agente de IA no pone `APPROVED_MAINNET=yes`, no corre `--send` en mainnet ni firma nada. Los comandos de esta guía que mandan una transacción están marcados con **💸**.

## 1. Cómo se reparte cada entorno

La red se cambia con **una sola variable** (`NEXT_PUBLIC_CHAIN`). Cada lugar tiene su propio juego de variables:

| Dónde | Red | Base de datos | Puede mover plata real |
|---|---|---|---|
| Tu compu (`.env.local`) | `celo-sepolia` | proyecto de **pruebas** | No |
| Vercel **Preview** y **Development** (los previews de los PR) | `celo-sepolia` | proyecto de **pruebas** | No |
| Vercel **Production** (`https://pacta-dun.vercel.app`) | `celo` | proyecto de **producción** | **Sí** |

Qué cambia y qué no:

| Variable | Local, Preview y Development | Production |
|---|---|---|
| `NEXT_PUBLIC_CHAIN` | `celo-sepolia` | `celo` |
| `APPROVED_MAINNET` | **no se pone** | `yes` (es la aprobación de Mavi) |
| `MAX_PAYOUT_PER_MILESTONE_ARS` / `_BRL` / `_MXN` | vacías | **obligatorias** (ver paso 3) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | proyecto de pruebas | proyecto de producción |
| `NEXT_PUBLIC_ATTRIBUTION_TAG` | `celo_dc3ce5f39b37` (tag del equipo) | el mismo |
| `AGENT_PRIVATE_KEY` | la clave del agente, solo si probás pagos en testnet | la clave del agente |
| `CRON_SECRET`, `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `RESEND_API_KEY` | los de prueba | los de producción |

La wallet del agente (`0xab569A8d8A5b60CFfdf9B88EdE099c80d8328E73`) y el tag **son los mismos** en las dos redes.

## 2. Base de datos: un Supabase para producción

Hoy local y producción comparten la misma base. Al pasar a mainnet, los acuerdos de prueba (con tARS/tBRL) se mezclarían con los reales, y el liberador podría intentar pagarlos en la red equivocada. Por eso:

- El proyecto de Supabase que ya usan queda como **pruebas** (local y Preview). No se toca.
- Se crea uno **nuevo** para **producción**.

Pasos:

1. En Supabase: **New project** → nombre `pacta-prod`.
2. **SQL Editor → New query**. Pegá el contenido de cada archivo de `supabase/migrations/` **en orden** (`0001_...`, `0002_...` y los que sigan) y tocá **Run**.
3. En **Table Editor** tienen que estar `users`, `agreements`, `milestones`, `movements` y `quotes`, todas vacías.
4. Anotá la **Project URL** (Project Settings → Data API) y la clave **secret** (`sb_secret_...`, en API Keys). Nunca la publishable/anon. Van solo a Vercel Production (paso 3).

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
| `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` | las del proyecto **de producción** |

Los topes son en unidades enteras del token y valen para cada moneda por separado (1 wBRL y 1 wARS no valen lo mismo). Si una moneda no tiene el suyo, usa `MAX_PAYOUT_PER_MILESTONE`. **En mainnet, sin tope en una moneda no se paga en esa moneda.** Para la demo, valores de referencia: unos US$45 por pago (`250` wBRL, `800` wMXN, `50000` wARS; revisá el tipo de cambio del día).

**En Production, Preview y Development** (las tres casillas):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_ATTRIBUTION_TAG` | `celo_dc3ce5f39b37` |

**Preview y Development:** `NEXT_PUBLIC_CHAIN=celo-sepolia`, y las claves del Supabase de **pruebas**. No cargues `APPROVED_MAINNET` ni los topes. Sin `AGENT_PRIVATE_KEY` salvo que necesites probar pagos en un preview.

**Production, además:** `AGENT_PRIVATE_KEY`, `CRON_SECRET` (largo y al azar, por ejemplo `openssl rand -hex 32`), `GEMINI_API_KEY`, `NEXT_PUBLIC_APP_URL`, y los avisos que vayan a usar (`TELEGRAM_BOT_TOKEN`, `RESEND_API_KEY`).

> Las variables `NEXT_PUBLIC_…` se fijan **al construir** la web. Después de cambiar cualquiera, hay que **redeployar** Production (Deployments → los tres puntos → Redeploy).

En tu compu, `.env.local` queda con `NEXT_PUBLIC_CHAIN=celo-sepolia` y el Supabase de pruebas. Si usás `vercel env pull`, asegurate de que las variables de Development estén en testnet.

## 4. Antes de la primera transacción

Chequeá cada punto:

- [ ] La wallet del agente tiene CELO para las comisiones. Se verifica en [CeloScan](https://celoscan.io/address/0xab569A8d8A5b60CFfdf9B88EdE099c80d8328E73) (hoy: 5 CELO).
- [ ] La wallet que va a hacer de **cliente** tiene el token con que vas a depositar (por ejemplo wARS) y algo de CELO para su propio depósito.
- [ ] La freelancera es **otra** wallet distinta de la del cliente (por ejemplo, otra cuenta de MetaMask).
- [ ] Los pasos 2 y 3 están hechos y Production fue redeployada.
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
5. Disparar los barridos a mano (el plan Hobby de Vercel solo permite crons diarios):
   ```
   curl -H "Authorization: Bearer <CRON_SECRET>" https://pacta-dun.vercel.app/api/cron/vault
   curl -H "Authorization: Bearer <CRON_SECRET>" https://pacta-dun.vercel.app/api/cron/releaser
   ```
   El primero detecta el depósito y el segundo paga (**💸 sale plata del agente**).
6. **Verificar el tag de cada transacción** (el depósito y el pago). Cada una tiene un hash que se ve en el recibo y en CeloScan:
   `NEXT_PUBLIC_CHAIN=celo npm run tag:verify -- 0x<hash>`
   Tiene que decir "Tag del equipo verificado". Una transacción sin tag **no suma y no se puede arreglar después**. Si falta en alguna, frená y avisá.

> `npm run tag:smoke` **solo corre en testnet**: no sirve para mainnet. En mainnet se usa `tag:verify` sobre transacciones reales.

## 7. Si algo sale mal

- **Frenar al agente:** en Vercel, borrá `APPROVED_MAINNET` de Production y redeployá. En mainnet el agente no opera sin esa variable.
- **Un pago no salió:** el hito queda en `approved` y se puede correr el liberador de nuevo; los pagos son idempotentes (un hito se paga una sola vez).
- **No se ve un depósito:** corré `/api/cron/vault` y revisá que la red de la web sea Celo.

## 8. Pendientes que no bloquean el paso a mainnet

- Agendar los crons en `vercel.json` (en Hobby solo hay crons diarios; para la demo se disparan a mano).
- Cargar `RESEND_API_KEY` y el bot de Telegram para los avisos.
- Conversión on-chain entre monedas (PAC-32).
- Buscar usuarios independientes: wallets que no creamos ni fondeamos y que ya usaban Celo (regla 7 de `AGENTS.md`).
