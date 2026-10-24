-- Section 1: Verified Lost and Found hub. Safe to run again. Free: uses your existing Supabase.
create table if not exists lost_found (
  id uuid primary key default gen_random_uuid(),
  aid text not null,
  campus text not null default 'kirinyaga',
  kind text not null check (kind in ('lost','found')),
  category text not null default 'Other',
  title text not null,
  details text,
  place text,
  happened_on date not null default current_date,
  status text not null default 'open' check (status in ('open','returned')),
  hidden boolean not null default false,
  ip text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists lost_found_campus on lost_found(campus, status, created_at desc);
create index if not exists lost_found_aid on lost_found(aid);
alter table lost_found enable row level security;
