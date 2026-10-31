-- PAC-02 · Tablas users y agreements
-- Se puede correr varias veces y en una base vacía.
-- Los montos van en unidades mínimas (18 decimales), como bigint on-chain.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  wallet text not null unique check (wallet = lower(wallet)),
  name text not null,
  whatsapp text,
  whatsapp_opt_in boolean not null default false,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists agreements (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  freelancer_id uuid not null references users (id),
  client_wallet text check (client_wallet = lower(client_wallet)),
  client_contact text,
  title text not null,
  description text,
  client_currency text not null check (client_currency in ('wARS', 'wBRL', 'wMXN')),
  payout_currency text not null default 'wARS',
  total_amount numeric(78, 0) not null check (total_amount > 0),
  status text not null default 'pending' check (status in ('pending', 'funded', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  funded_at timestamptz
);

create index if not exists agreements_freelancer_id_idx on agreements (freelancer_id);

-- Sin policies: solo el servidor (service role) puede leer y escribir.
alter table users enable row level security;
alter table agreements enable row level security;
