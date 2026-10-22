-- Kura: campus voting competition (contestants, paid votes, follows, season settings).
-- Run once in Supabase > SQL Editor. Safe to run again.

create table if not exists kura_season (
  id int primary key default 1 check (id = 1),
  title text not null default 'Campus Star Awards',
  tagline text not null default 'Music, style, creators, sports and more. Back your favourite contestant or enter your own category.',
  voting_open boolean not null default true,
  entries_open boolean not null default true,
  ends_at timestamptz,
  prize_title text,
  prize_text text,
  prizes jsonb not null default '[]'::jsonb,
  packs jsonb not null default '[{"votes":1,"price":10},{"votes":5,"price":50},{"votes":10,"price":100,"popular":true},{"votes":60,"price":500,"bonus":10},{"votes":150,"price":1000,"bonus":50}]'::jsonb,
  campuses jsonb not null default '["Kirinyaga University","University of Nairobi","Kenyatta University","Multimedia University","Moi University","JKUAT","Maseno University","Technical University of Kenya","Taita Taveta University","Strathmore University","USIU-Africa","Egerton University","Masinde Muliro University","Dedan Kimathi University","Chuka University","Embu University","Karatina University","Mount Kenya University","KCA University","Catholic University of Eastern Africa","Pwani University","Machakos University","Laikipia University","Other"]'::jsonb,
  divisions jsonb not null default '[{"id":"entertainment","name":"Entertainment","categories":["Singing","Dance","Rap","Comedy","Gospel","Deejay"]},{"id":"lifestyle","name":"Lifestyle & Pageantry","categories":["Campus celebrity of the year","Fashion and style","Beauty"]},{"id":"media","name":"Media & Creators","categories":["TikTok","Content creator","Photography","Video and film"]},{"id":"sports","name":"Sports & Craft","categories":["Sports","Craft and design"]},{"id":"more","name":"More","categories":["Academics","Other"]}]'::jsonb,
  updated_at timestamptz not null default now()
);
insert into kura_season (id, ends_at) values (1, now() + interval '30 days') on conflict (id) do nothing;

create table if not exists kura_contestants (
  id uuid primary key default gen_random_uuid(),
  aid text not null,
  name text not null,
  photo_key text,
  campus text not null,
  gender text not null check (gender in ('female','male')),
  division text not null,
  category text not null,
  tagline text,
  bio text,
  socials jsonb not null default '{}'::jsonb,
  email text not null,
  payout_phone text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','hidden')),
  verified boolean not null default false,
  note text,
  votes int not null default 0,
  followers int not null default 0,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create unique index if not exists kura_contestants_email on kura_contestants (lower(email));
create index if not exists kura_contestants_status on kura_contestants (status, votes desc);
create index if not exists kura_contestants_aid on kura_contestants (aid);

create table if not exists kura_votes (
  id uuid primary key default gen_random_uuid(),
  contestant_id uuid not null references kura_contestants(id) on delete cascade,
  aid text not null,
  payment_id uuid unique,
  votes int not null check (votes > 0),
  amount int not null,
  supporter_name text,
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists kura_votes_c on kura_votes (contestant_id, status, created_at desc);

create table if not exists kura_follows (
  contestant_id uuid not null references kura_contestants(id) on delete cascade,
  aid text not null,
  created_at timestamptz not null default now(),
  primary key (contestant_id, aid)
);

-- Add votes to a contestant in one atomic step (no lost updates when many people vote at once).
create or replace function kura_add_votes(p uuid, n int) returns int language plpgsql as $$
declare v int;
begin
  update kura_contestants set votes = votes + n where id = p returning votes into v;
  return coalesce(v, 0);
end $$;

-- RLS on: no public policies, so only the Worker (service key) can read or write.
do $$
declare t text;
begin
  foreach t in array array['kura_season','kura_contestants','kura_votes','kura_follows'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
