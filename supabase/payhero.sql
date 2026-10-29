create table if not exists payhero_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  kind text,
  ref_id text,
  outcome text,
  payload jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists payhero_events_key on payhero_events(event_key);
create index if not exists payhero_events_ref on payhero_events(ref_id, created_at desc);
alter table payhero_events enable row level security;
