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
| `chain-wallet.test.ts` | Que el cliente del agente firme transacciones con el tag de atribución al final de los datos (transferencia, llamada a contrato y con `feeCurrency`), que rechace claves o tags inválidos, y que la red y los links al explorador salgan de `NEXT_PUBLIC_CHAIN`. No usa la red: un RPC falso guarda la tx firmada. La prueba real en testnet es `npm run tag:smoke`. | PAC-05 |
