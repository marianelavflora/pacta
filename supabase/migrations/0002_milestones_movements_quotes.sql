-- PAC-03 · Tablas milestones, movements y quotes
-- Se puede correr varias veces y en una base vacía (después de 0001).
-- Los montos van en unidades mínimas (18 decimales) como numeric(78, 0):
-- un uint256 tiene hasta 78 dígitos y no entra en bigint (int8), que llega a ~9.2e18.
-- Las listas de valores permitidos tienen su copia en lib/validation/statuses.ts
-- (tests/statuses.test.ts verifica que coincidan).

create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references agreements (id) on delete cascade,
  position int not null check (position >= 1),
  title text not null,
  amount numeric(78, 0) not null check (amount > 0),
  review_days int not null default 3 check (review_days >= 0),
  release_days int not null default 3 check (release_days >= 0),
  status text not null default 'pending' check (status in ('pending', 'funded', 'delivered', 'reminded', 'approved', 'expired', 'converting', 'paid', 'paused')),
  delivery_url text,
  delivery_note text,
  approval_signature text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  reminded_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  -- Permite que movements verifique que el hito es del mismo acuerdo.
  unique (id, agreement_id)
);

-- No puede haber dos "hito 1" en el mismo acuerdo.
create unique index if not exists milestones_agreement_position_key on milestones (agreement_id, position);

create table if not exists movements (
  id uuid primary key default gen_random_uuid(),
  -- Sin cascade: un movimiento de plata no se borra solo. Para borrar un acuerdo
  -- de prueba con movimientos, primero hay que borrar sus movimientos a mano.
  agreement_id uuid not null references agreements (id),
  -- Vacío para el depósito, que es del acuerdo entero.
  milestone_id uuid,
  kind text not null check (kind in ('deposit', 'conversion', 'payout', 'refund')),
  from_currency text,
  to_currency text,
  amount_in numeric(78, 0) check (amount_in >= 0),
  amount_out numeric(78, 0) check (amount_out >= 0),
  fx_rate numeric check (fx_rate > 0),
  -- Único: el mismo movimiento on-chain nunca se guarda dos veces.
  -- Puede estar vacío mientras la transacción todavía no salió.
  tx_hash text unique check (tx_hash = lower(tx_hash)),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  created_at timestamptz not null default now(),
  -- El hito tiene que ser del mismo acuerdo que el movimiento.
  foreign key (milestone_id, agreement_id) references milestones (id, agreement_id)
);

create index if not exists movements_agreement_id_idx on movements (agreement_id);

-- Idempotencia de pagos: cada hito tiene como mucho una conversión y un pago
-- que no hayan fallado. Si la tarea corre dos veces, el segundo insert da error
-- y no se paga dos veces. Si uno falla (status = 'failed'), se puede reintentar.
create unique index if not exists movements_milestone_kind_once_key
  on movements (milestone_id, kind)
  where milestone_id is not null and kind in ('conversion', 'payout') and status <> 'failed';

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  pair text not null,
  source text not null check (source in ('textile', 'dex')),
  amount_in numeric(78, 0) not null check (amount_in > 0),
  price numeric not null check (price > 0),
  reference_price numeric check (reference_price > 0),
  diff_pct numeric,
  created_at timestamptz not null default now()
);

-- Sin policies: solo el servidor (service role) puede leer y escribir.
alter table milestones enable row level security;
alter table movements enable row level security;
alter table quotes enable row level security;
