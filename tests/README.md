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
