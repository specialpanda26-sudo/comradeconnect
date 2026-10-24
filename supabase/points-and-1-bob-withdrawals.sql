-- Run once in the Supabase SQL editor (safe to run again).
create table if not exists points_ledger (
  id uuid primary key default gen_random_uuid(),
  aid text not null,
  delta integer not null,
  kind text not null,
  ref text,
  day text not null,
  created_at timestamptz default now()
);
create unique index if not exists points_ref_uq on points_ledger(kind, ref) where ref is not null;
create index if not exists points_aid on points_ledger(aid, created_at);
alter table points_ledger enable row level security;
do $$ begin
  alter table withdrawals drop constraint if exists withdrawals_amount_check;
  alter table withdrawals add constraint withdrawals_amount_check check (amount >= 1);
exception when others then null; end $$;
alter table payments add column if not exists credit_ksh integer not null default 0;
alter table orders add column if not exists credit_ksh integer not null default 0;
-- If you ever saved "Smallest withdrawal" as 50 in admin, set it to 1 in Admin > Money and fees.
