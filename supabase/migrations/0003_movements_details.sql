-- PAC-32 · Detalle de cada tramo de un cambio de moneda.
-- Textile cambia en dos tramos (moneda -> USDT -> moneda) y la base solo permite UNA conversión por hito,
-- así que el movimiento `conversion` guarda adentro, en `details`, los hashes y montos de cada tramo.
-- Se puede correr varias veces.

alter table movements add column if not exists details jsonb;
