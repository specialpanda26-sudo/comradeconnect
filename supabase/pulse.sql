-- Campus pulse: the shared daily poll and hostel zone ratings (own tables). Safe to run again.
create table if not exists pulse_votes (
  day integer not null,
  aid text not null,
  campus text not null default 'kirinyaga',
  opt integer not null check (opt between 0 and 2),
  created_at timestamptz not null default now(),
  primary key (day, aid)
);
alter table pulse_votes enable row level security;
create index if not exists pulse_votes_campus_day on pulse_votes(campus, day);
create table if not exists pulse_ratings (
  campus text not null default 'kirinyaga',
  zone text not null,
  aid text not null,
  water integer not null check (water between 1 and 5),
  security integer not null check (security between 1 and 5),
  wifi integer not null check (wifi between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (campus, zone, aid)
);
alter table pulse_ratings enable row level security;
