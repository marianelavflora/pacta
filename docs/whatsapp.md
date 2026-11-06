# Avisos por WhatsApp (PAC-09)

Cómo mandamos los avisos de Pactá por WhatsApp: el servicio que usamos, cómo probarlo y el texto de cada plantilla.

> **Nada secreto en este archivo.** El `TWILIO_ACCOUNT_SID`, el `TWILIO_AUTH_TOKEN` y los números de teléfono del equipo van en `.env.local` y en Vercel, nunca acá. Los IDs de las plantillas (`HX...`) **no** son secretos y sí van en la tabla de abajo.

## Qué servicio usamos

**Twilio**, con su WhatsApp Sandbox para probar y su *Content Template Builder* para las plantillas. Lo elegimos con Mavi el 1 nov porque:

- El sandbox anda al toque, sin esperar que Meta apruebe nada.
- Tiene una librería oficial para Node (`twilio`), que usa PAC-40.
- No usamos librerías no oficiales de WhatsApp (regla del proyecto).

Si un WhatsApp falla, el aviso sale igual por mail (Resend, PAC-41).

## Variables de entorno

Ya están en `.env.example` (sin valores):

| Variable | Qué es | Dónde se saca |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Identificador de la cuenta (empieza con `AC`). | Twilio Console → Account Info |
| `TWILIO_AUTH_TOKEN` | Clave de la cuenta. **Secreta.** | Twilio Console → Account Info |
| `TWILIO_WHATSAPP_FROM` | Número que manda los avisos, con formato `whatsapp:+14155238886`. | Messaging → Try it out → Send a WhatsApp message (en el sandbox) |

Clau le pasa el SID y el token a Mavi **por privado**, y Mavi los carga en Vercel.

## Cómo unirse al sandbox

El sandbox solo les manda mensajes a los celulares que se anotaron. Cada una del equipo tiene que hacerlo una vez:

1. Abrí WhatsApp en tu celular.
2. Mandale al número del sandbox (`+1 415 523 8886`, o el que muestre la consola) el mensaje `join <código>`. El código lo ve Clau en Twilio Console → Messaging → Try it out → Send a WhatsApp message.
3. Twilio te contesta que ya estás adentro.
4. **Ojo:** la inscripción vence a los 3 días sin mensajes. Si dejás de recibir los de prueba, mandá `join <código>` de nuevo.

| Persona | ¿Se unió? | ¿Recibió el mensaje de prueba? |
|---|---|---|
| Mavi | ⬜ | ⬜ |
| Flor | ⬜ | ⬜ |
| Leila | ⬜ | ⬜ |
| Clau | ⬜ | ⬜ |

## Plantillas

WhatsApp solo deja mandar mensajes automáticos con **plantillas** aprobadas: mensajes modelo con huecos (`{{1}}`, `{{2}}`…) que se completan con los datos de cada caso.

Reglas para que Meta no las rechace:

- Categoría **Utility** (avisos de una operación, no publicidad).
- Texto corto, neutral y sin emojis ni signos de exclamación de más.
- No pueden **empezar ni terminar** con una variable: por eso todas cierran con un punto o una frase.
- Los nombres van en minúscula y con guion bajo (`review_reminder`), igual que en el código.
- Idioma: **Spanish (es)**.

### Estado de cada plantilla

Completá el ID (`HX...`) y el estado cuando Twilio los dé. Estados: `borrador`, `enviada`, `aprobada`, `rechazada`.

| Nombre | Cuándo se manda | A quién | ID de Twilio (Content SID) | Estado |
|---|---|---|---|---|
| `deposit_received` | El cliente depositó y el hito pasa a `funded` | Freelancer | _pendiente_ | borrador |
| `milestone_delivered` | La freelancer entregó un hito (`delivered`) | Cliente | _pendiente_ | borrador |
| `review_reminder` | Día 3 sin respuesta (`reminded`) | Cliente | _pendiente_ | borrador |
| `milestone_approved` | El cliente aprobó (`approved`) | Freelancer | _pendiente_ | borrador |
| `auto_release` | Día 6 sin respuesta: se libera solo (`expired`) | Cliente | _pendiente_ | borrador |
| `milestone_paid` | El agente pagó el hito (`paid`) | Freelancer | _pendiente_ | borrador |

### Textos

Para copiar y pegar en el Content Template Builder. Debajo de cada una está qué va en cada hueco y un ejemplo, que Twilio pide como *sample* para mandarla a aprobar.

#### `deposit_received`

```text
Hola {{1}}, {{2}} depositó {{3}} para el acuerdo "{{4}}". Podés ver el acuerdo en {{5}} y arrancar cuando quieras: la plata ya está asegurada.
```

| Hueco | Qué va | Ejemplo |
|---|---|---|
| `{{1}}` | Nombre de la freelancer | Sofía |
| `{{2}}` | Nombre del cliente | Agencia Sol |
| `{{3}}` | Monto depositado con moneda | 1.500 wBRL |
| `{{4}}` | Título del acuerdo | Logo y manual de marca |
| `{{5}}` | Link a la vista de la freelancer | https://pacta.app/f/abc123 |

#### `milestone_delivered`

```text
Hola {{1}}, {{2}} entregó "{{3}}". Revisalo y aprobalo acá: {{4}}. Si no respondés en 6 días, el pago se libera solo.
```

| Hueco | Qué va | Ejemplo |
|---|---|---|
| `{{1}}` | Nombre del cliente | Agencia Sol |
| `{{2}}` | Nombre de la freelancer | Sofía |
| `{{3}}` | Título del hito | Entrega 1: bocetos del logo |
| `{{4}}` | Link a la vista del cliente | https://pacta.app/a/abc123 |

#### `review_reminder` (día 3)

```text
Hola {{1}}, {{2}} te entregó "{{3}}" hace 3 días. Revisalo y aprobalo acá: {{4}}. Si no respondés en 3 días, el pago se libera solo.
```

| Hueco | Qué va | Ejemplo |
|---|---|---|
| `{{1}}` | Nombre del cliente | Agencia Sol |
| `{{2}}` | Nombre de la freelancer | Sofía |
| `{{3}}` | Título del hito | Entrega 1: bocetos del logo |
| `{{4}}` | Link a la vista del cliente | https://pacta.app/a/abc123 |

#### `milestone_approved`

```text
Hola {{1}}, {{2}} aprobó "{{3}}". Estamos preparando tu pago de {{4}} y te avisamos cuando llegue.
```

| Hueco | Qué va | Ejemplo |
|---|---|---|
| `{{1}}` | Nombre de la freelancer | Sofía |
| `{{2}}` | Nombre del cliente | Agencia Sol |
| `{{3}}` | Título del hito | Entrega 1: bocetos del logo |
| `{{4}}` | Monto del hito con moneda | 500 wBRL |

#### `auto_release` (día 6)

```text
Hola {{1}}, como no hubo respuesta, liberamos el pago de "{{2}}" a {{3}}. Podés ver el recibo en {{4}} cuando quieras.
```

| Hueco | Qué va | Ejemplo |
|---|---|---|
| `{{1}}` | Nombre del cliente | Agencia Sol |
| `{{2}}` | Título del hito | Entrega 1: bocetos del logo |
| `{{3}}` | Nombre de la freelancer | Sofía |
| `{{4}}` | Link al recibo | https://pacta.app/recibo/xyz789 |

#### `milestone_paid`

```text
Hola {{1}}, te pagamos "{{2}}": recibiste {{3}} con un tipo de cambio de {{4}}. Podés ver el recibo en {{5}} cuando quieras.
```

| Hueco | Qué va | Ejemplo |
|---|---|---|
| `{{1}}` | Nombre de la freelancer | Sofía |
| `{{2}}` | Título del hito | Entrega 1: bocetos del logo |
| `{{3}}` | Monto recibido con moneda | 120.000 wARS |
| `{{4}}` | Tipo de cambio usado | 1 BRL = 240 ARS |
| `{{5}}` | Link al recibo | https://pacta.app/recibo/xyz789 |

### Links

Ninguna plantilla termina con un hueco: Meta rechaza las que empiezan o terminan con una variable. Por eso las que llevan link siguen con una frase corta después ("…en {{5}} cuando quieras.").

Si Meta rechaza una igual, la alternativa es el tipo de contenido **Llamada a la acción** (*Call to action*), con un botón "Ver recibo" cuyo link es `https://<dominio>/recibo/{{1}}` (el hueco es solo el ID).

## Paso a paso en Twilio

1. Creá la cuenta en [twilio.com](https://www.twilio.com) (la cuenta de prueba alcanza).
2. Messaging → Try it out → **Send a WhatsApp message**: activá el sandbox y anotá el código `join ...`.
3. Que cada una del equipo se una (ver "Cómo unirse al sandbox") y mandá un mensaje de prueba desde esa misma pantalla.
4. Mensajería → **Creador de plantillas de contenido** (*Content Template Builder*) → *Crear nuevo*: cargá cada plantilla con su nombre, idioma Español (`es`), tipo de contenido **Texto** y los ejemplos de la tabla.
5. Mandá cada una a aprobar para WhatsApp, categoría **Utility**, y anotá el ID `HX...` y el estado en la tabla de arriba.
6. Pasale a Mavi por privado el `TWILIO_ACCOUNT_SID` y el `TWILIO_AUTH_TOKEN`.

## Si algo se traba

- **Twilio no deja mandarla a aprobar:** para aprobar plantillas hace falta un número de WhatsApp propio (*sender*) conectado a una cuenta de WhatsApp Business. Si todavía no lo tenemos, dejá las plantillas en `borrador`, avisá a Mavi y seguimos probando con el sandbox.
- **Meta rechaza una plantilla:** suele ser porque suena a publicidad. Dejala más corta y neutral y reenviala. Anotá el motivo en la tabla.
- **No llega el mensaje de prueba:** revisá que te hayas unido al sandbox en los últimos 3 días.

## Palabras nuevas

- **Plantilla:** un mensaje modelo con huecos (`{{1}}`, `{{2}}`) que se completan con los datos de cada caso. WhatsApp solo deja mandar mensajes automáticos con plantillas aprobadas.
- **Sandbox:** un modo de prueba que anda al toque, pero solo con los números que se unieron.
- **Content SID:** el ID que Twilio le da a cada plantilla (empieza con `HX`). El código lo usa para saber qué plantilla mandar (PAC-40).
- **Utility:** la categoría de WhatsApp para avisos de una operación (un pago, una entrega), que no son publicidad.
