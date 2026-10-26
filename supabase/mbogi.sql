-- Mbogi Talk: group video meetings with a share code (video itself runs on Agora, we keep the room, people, chat and reactions). Safe to run again.
create table if not exists mbogi_meetings (
  code text primary key,                        -- abc-defg-hij
  host_aid text not null,
  title text not null default 'Mbogi Talk',
  status text not null default 'open' check (status in ('open','ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists mbogi_meetings_host_idx on mbogi_meetings(host_aid, status);
create table if not exists mbogi_people (
  code text not null references mbogi_meetings(code) on delete cascade,
  viewer text not null,                         -- hash of account + browser tab
  aid text not null,
  name text not null,
  uid text,                                     -- Agora uid, so tiles can show names
  hand boolean not null default false,
  seen_at timestamptz not null default now(),
  primary key (code, viewer)
);
create index if not exists mbogi_people_seen_idx on mbogi_people(code, seen_at);
create table if not exists mbogi_events (
  id uuid primary key default gen_random_uuid(),
  code text not null references mbogi_meetings(code) on delete cascade,
  kind text not null check (kind in ('chat','react')),
  name text not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists mbogi_events_idx on mbogi_events(code, created_at);
alter table mbogi_meetings enable row level security;
alter table mbogi_people enable row level security;
alter table mbogi_events enable row level security;
