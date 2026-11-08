# Pantallas de Pactá (diseño de referencia)

Estas son las pantallas que vamos a usar y a las que vamos a darles un **pequeño rediseño** respecto de lo que ya está hecho. Son borradores pensados **celular primero** (390 px de ancho), con la tipografía Familjen Grotesk y los colores de marca de `app/globals.css`.

- Galería original (se edita en claude.ai): https://claude.ai/artifact/6edJkiDY53zWjeFEJCw2ak
- Copia de las imágenes: carpeta [`pantallas/`](pantallas/), para no depender del enlace.
- Los textos, montos y tipos de cambio son **de ejemplo** (Lucía, diseñadora en Córdoba, le hace logo y manual de marca a una agencia de São Paulo por R$ 1.500 en 3 hitos).

## Las 10 pantallas

| # | Pantalla | Ruta | Quién la ve | Imagen |
|---|---|---|---|---|
| 01 | Inicio: "Cobrá por hitos. Entre países. Sin vueltas." con dos botones, un ejemplo y "Cómo funciona" | `/` | Todas | [`01-inicio.png`](pantallas/01-inicio.png) |
| 02 | Conectar billetera (hoja que sube desde abajo; en MiniPay se conecta sola) | modal | Freelancer y cliente | [`02-conectar.png`](pantallas/02-conectar.png) |
| 03 | **Crear acuerdo, como chat con el agente** (paso 1 de 3) | `/nuevo` | Freelancer | [`03-intake.png`](pantallas/03-intake.png) |
| 04 | Acuerdo listo para compartir (paso 3 de 3): link, Telegram y avisos | `/nuevo` (fin) | Freelancer | [`04-compartir.png`](pantallas/04-compartir.png) |
| 05 | Cliente: revisar y depositar | `/a/[id]` | Cliente | [`05-cliente-deposito.png`](pantallas/05-cliente-deposito.png) |
| 06 | Cliente: aprobar una entrega (firma, también puede pausar) | `/a/[id]` | Cliente | [`06-cliente-aprobar.png`](pantallas/06-cliente-aprobar.png) |
| 07 | Panel de la freelancer | `/f/[id]` | Freelancer | [`07-freelancer-panel.png`](pantallas/07-freelancer-panel.png) |
| 08 | Marcar hito como entregado (hoja) | `/f/[id]` | Freelancer | [`08-entregar.png`](pantallas/08-entregar.png) |
| 09 | Recibo de un hito, con tipo de cambio vs. referencia | `/recibo/[id]` | Freelancer y cliente | [`09-recibo.png`](pantallas/09-recibo.png) |
| 10 | Avisos por Telegram (entrega, recordatorio del día 3, liberación) | Telegram | Cliente | [`10-avisos.png`](pantallas/10-avisos.png) |

Las rutas de la galería usan `/a/[id]` y `/f/[id]`; en el código se están renombrando a `/cliente/[id]` y `/freelancer/[id]` (ver `AGENTS.md`).

## Qué cambia respecto de lo que ya hay

- **Intake como chat (03).** Hoy `/nuevo` tiene una caja de texto arriba y un formulario en dos pasos. El diseño es un chat: la persona cuenta el trabajo, el agente contesta con una **tarjeta de hitos** (monto, descripción y fecha de entrega, con "Editar hitos" y "Agregar hito"), explica cómo se cobra ("tu cliente paga en wBRL y vos cobrás en wARS; si no responde en 3 días le aviso de nuevo, y a los 6 te pago igual") y ofrece atajos: **Cambiar monedas** y **Cambiar plazos**. Abajo hay un campo "Escribile al agente…" y el botón **Está bien, seguir**.
- **Tres pasos, no dos.** El diseño habla de "Paso 1 de 3" (contar el trabajo) y "Paso 3 de 3" (acuerdo listo). El paso del medio no está dibujado todavía.
- **Pantalla de compartir (04).** Muestra el resumen del acuerdo con la barra de hitos, el link para el cliente con **Copiar**, **Mandar por Telegram**, **Compartir de otra forma**, y el mail del cliente para los avisos. Dice que el link está en portugués y castellano y que el cliente no necesita cuenta, solo su billetera.
- **"Vos cobrás aprox." (01 y 04).** Muestra una estimación en pesos de lo que va a cobrar. Necesita el precio de referencia (PAC-31) y el cotizador (PAC-29/PAC-30).
- **Inicio (01).** Fondo oscuro, titular en tres líneas con la del medio en amarillo, ejemplo de un acuerdo en curso con barra de avance, "Cómo funciona" en 4 pasos y el aviso "¿Y si no me responde?".

## Reglas de diseño que se ven en las pantallas

- Colores: fondo claro `#f6f7f3` o verde muy oscuro; botón principal amarillo `#f4e94a`; verde `#35d07f` para lo cobrado y para el botón de compartir; tarjetas blancas con borde fino y esquinas muy redondeadas.
- Un número dentro de un círculo amarillo marca cada hito; el último paso "cobrás en pesos" va en verde.
- Arriba a la derecha, una etiqueta con la billetera conectada (`0x7a3…91c`) y un punto verde.
- Los montos siempre en la moneda de cada persona: R$ para el cliente, $ (wARS) para la freelancer.
