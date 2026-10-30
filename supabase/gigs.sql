-- Gigs and "Need a hand" board: comrades pay each other for small jobs, held in escrow from the poster's wallet. Safe to run again.
create table if not exists gigs (
  id uuid primary key default gen_random_uuid(),
  poster_aid text not null,
  worker_aid text,
  title text not null,
  details text,
  category text not null default 'Other',
  price integer not null check (price between 50 and 5000),
  fee integer not null default 0,
  campus text,
  status text not null default 'open' check (status in ('open','accepted','delivered','released','refunded','disputed','cancelled')),
  dispute_reason text,
  decided_by text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  delivered_at timestamptz,
  auto_release_at timestamptz,
  released_at timestamptz
);
alter table gigs enable row level security;
create index if not exists gigs_status on gigs(status, created_at desc);
create index if not exists gigs_poster on gigs(poster_aid, created_at desc);
create index if not exists gigs_worker on gigs(worker_aid, created_at desc);
