-- Section 5: campuses and Land spots. Safe to run again.
-- Existing rows become 'kirinyaga', so nothing disappears for current users.
alter table posts add column if not exists campus text not null default 'kirinyaga';
alter table events add column if not exists campus text not null default 'kirinyaga';
alter table wifi add column if not exists campus text not null default 'kirinyaga';
alter table hostels add column if not exists campus text not null default 'kirinyaga';
alter table rooms add column if not exists campus text not null default 'kirinyaga';
alter table services add column if not exists campus text not null default 'kirinyaga';
create index if not exists posts_campus on posts(campus, created_at desc);

create table if not exists spots (
  id uuid primary key default gen_random_uuid(),
  aid text not null,
  campus text not null default 'kirinyaga',
  name text not null,
  category text not null default 'Other',
  details text,
  lat double precision,
  lng double precision,
  likes integer not null default 0,
  hidden boolean not null default false,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists spots_campus on spots(campus, created_at desc);
alter table spots enable row level security;

create table if not exists spot_likes (
  spot_id uuid references spots(id) on delete cascade,
  aid text,
  primary key (spot_id, aid)
);
alter table spot_likes enable row level security;
