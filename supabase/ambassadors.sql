-- Campus ambassadors: one trusted comrade per hostel or club, with a monthly leaderboard. Safe to run again.
create table if not exists ambassadors (
  aid text primary key,
  label text not null,
  campus text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table ambassadors enable row level security;
create table if not exists ambassador_payouts (
  month text not null,
  aid text not null,
  rank integer not null,
  amount integer not null,
  created_at timestamptz not null default now(),
  primary key (month, aid)
);
alter table ambassador_payouts enable row level security;
create index if not exists referrals_created on referrals(created_at);
