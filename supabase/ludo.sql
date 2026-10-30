-- Ludo online rooms. Run once in Supabase > SQL Editor. Safe to run again.
create table if not exists ludo_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_aid text not null,
  mode text not null check (mode in ('kes','pts')),
  stake int not null check (stake >= 0),
  max_players int not null check (max_players between 2 and 4),
  status text not null default 'waiting' check (status in ('waiting','playing','done','cancelled')),
  seats jsonb not null default '[]',
  state jsonb,
  winner_aid text,
  pot int not null default 0,
  prize int not null default 0,
  payout_done boolean not null default false,
  version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ludo_rooms_open on ludo_rooms(status, mode, created_at desc);
alter table ludo_rooms enable row level security;   -- only the Worker (service key) touches this table

-- wallet kinds: add the Ludo ones to the final list
alter table wallet_ledger drop constraint if exists wallet_ledger_kind_check;
alter table wallet_ledger add constraint wallet_ledger_kind_check
  check (kind in ('sale','referral','withdrawal','refund','adjustment','topup','purchase','wholesale_fee','gift','ludo_stake','ludo_win','ludo_refund'));
