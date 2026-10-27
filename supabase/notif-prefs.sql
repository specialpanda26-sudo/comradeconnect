-- Which kinds of phone alert each person wants (comments, live, events, orders, wallet, messages, updates).
-- No row = everything on. Safe to run again.
create table if not exists notif_prefs (
  aid text primary key,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table notif_prefs enable row level security;
