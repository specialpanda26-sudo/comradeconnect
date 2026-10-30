-- Sponsor slots: "Today on campus, presented by [brand]", sponsored Polls and sponsored Kura. Safe to run again.
-- Run it once in Supabase > SQL Editor (or paste it from Admin > Site > SQL). Run sponsor-stats.sql first.
create table if not exists sponsor_slots (
  slot text primary key check (slot in ('today','polls','kura')),
  sponsor_id uuid references sponsors(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table sponsor_slots enable row level security;
