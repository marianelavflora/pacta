# Prueba punta a punta · Sprint 1 (PAC-28)

Corrida automática en Celo Sepolia (testnet), 2026-11-08T05:02:35.000Z. Script: `scripts/e2e-sprint1.ts` (`npm run e2e:sprint1`).

**Resultado: todo anduvo.**

| # | Paso | ¿Anduvo? | Detalle |
|---|---|---|---|
| 1 | Cliente de prueba con CELO y tARS | Sí | 150 tARS |
| 2 | Crear acuerdo de 2 hitos | Sí | status 201, link /a/AfxWju2T |
| 3 | Leer el acuerdo: 2 hitos, total correcto, todo pending | Sí | estado pending |
| 4 | Depósito del cliente sale con el tag | Sí | https://celo-sepolia.blockscout.com/tx/0x3e2dc5fe716d7425bbd73f2ebda9047a8858e9a5c6f9fe979d4e880a36ef156b |
| 5 | La bóveda registra el depósito | Sí | status 200, recorded |
| 6 | Avisar dos veces el mismo depósito no lo duplica | Sí | already_recorded |
| 7 | Acuerdo y hitos pasan a financiado | Sí | acuerdo funded, hitos funded/funded |
| 8 | Barrido de la bóveda (cron) responde | Sí | status 200 |
| 9 | El liberador rechaza pedidos sin contraseña | Sí | status 401 |
| 10 | Otra billetera no puede entregar el hito | Sí | status 403 |
| 11 | Freelancer entrega el hito 1 | Sí | status 200, delivered |
| 12 | Una firma ajena no aprueba el hito | Sí | status 403 |
| 13 | Cliente aprueba el hito 1 con su firma | Sí | status 200, approved |
| 14 | El liberador paga el hito 1 | Sí | paid |
| 15 | El pago sale con el tag | Sí | https://celo-sepolia.blockscout.com/tx/0x2cec81458d0d44216e48d2e0b99ed4015eb3c6dcb53554bba122e1453ca9d858 |
| 16 | La freelancer recibió exactamente el monto del hito | Sí | +100 tARS |
| 17 | Pagar de nuevo no paga dos veces | Sí | already_paid |
| 18 | Recibo del hito pagado | Sí | status 200, hito paid |
| 19 | El recibo público no filtra contacto ni firma | Sí |  |

## Datos de la corrida

- Acuerdo: http://localhost:3000/a/AfxWju2T
- Recibo del hito 1: http://localhost:3000/recibo/c6c0b673-41ad-4982-9734-a77573394957
- Depósito: https://celo-sepolia.blockscout.com/tx/0x3e2dc5fe716d7425bbd73f2ebda9047a8858e9a5c6f9fe979d4e880a36ef156b
- Pago: https://celo-sepolia.blockscout.com/tx/0x2cec81458d0d44216e48d2e0b99ed4015eb3c6dcb53554bba122e1453ca9d858
- Billeteras de cliente y freelancer: descartables, creadas por el script.
