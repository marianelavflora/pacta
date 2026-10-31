# Tests de Pactá

Acá viven todas las pruebas automáticas del proyecto. La guía completa la arma PAC-60 (#60).

## Cómo correrlos

```bash
npm test             # corre todos una vez
npm run test:watch   # los vuelve a correr cada vez que guardás
```

## La regla

Después de cada implementación, revisá esta carpeta: agregá o editá los tests de lo que cambiaste y sumá una fila en la tabla de abajo.

## Qué prueba cada archivo

| Archivo | Qué prueba | Ticket |
|---|---|---|
| `smoke.test.ts` | Que Vitest esté bien configurado y que los montos en `bigint` sumen sin perder precisión. | PAC-01 |
| `statuses.test.ts` | Que las listas de estados, tipos de movimiento y fuentes de cotización de `lib/validation/statuses.ts` coincidan con los `check` del SQL de `0002`, que los estados del hito sean los oficiales, que los montos sean `numeric(78, 0)` y que existan el cascade de hitos, el `tx_hash` único y el índice de un solo pago por hito. | PAC-03 |
| `agreements.test.ts` | `POST /api/agreements` sin red (la base es un doble en memoria): que el esquema de `lib/validation/agreement.ts` pida todos los campos con mensajes en castellano, rechace monedas y wallets inválidas, montos en 0, negativos, con coma o como `number`, y no pierda precisión con `bigint`; que se cree o reuse la usuaria, que el total salga de sumar los hitos (no de la web), que los hitos se guarden con `position` 1, 2, 3, que se reintente si el `public_id` ya existe, que se borre el acuerdo si fallan los hitos, y que la API responda 201, 400 o 500. | PAC-14 |
