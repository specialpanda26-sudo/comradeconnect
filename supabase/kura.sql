create table if not exists kura_season (
  id int primary key,
  title text, tagline text,
  voting_open boolean not null default true,
  entries_open boolean not null default true,
  ends_at timestamptz,
  prize_title text, prize_text text,
  prizes jsonb not null default '[]',
  packs jsonb not null default '[]',
  campuses jsonb not null default '[]',
  divisions jsonb not null default '[]',
  updated_at timestamptz default now()
);

create table if not exists kura_contestants (
  id uuid primary key default gen_random_uuid(),
  aid text,
  name text not null,
  photo_key text,
  campus text, gender text, division text, category text,
  tagline text, bio text,
  socials jsonb not null default '{}',
  email text unique,
  payout_phone text,
  status text not null default 'pending',
  note text,
  votes int not null default 0,
  followers int not null default 0,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index if not exists kura_c_status on kura_contestants(status);
create index if not exists kura_c_aid on kura_contestants(aid);

create table if not exists kura_votes (
  id uuid primary key default gen_random_uuid(),
  contestant_id uuid references kura_contestants(id) on delete cascade,
  aid text,
  payment_id text unique,
  supporter_name text,
  votes int not null default 0,
  amount numeric not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists kura_v_c on kura_votes(contestant_id, status);

create table if not exists kura_follows (
  contestant_id uuid references kura_contestants(id) on delete cascade,
  aid text,
  primary key (contestant_id, aid)
);

create or replace function kura_add_votes(p uuid, n int) returns void
language sql as $$
  update kura_contestants set votes = votes + n where id = p;
$$;

alter table kura_season enable row level security;
alter table kura_contestants enable row level security;
alter table kura_votes enable row level security;
alter table kura_follows enable row level security;
revoke execute on function kura_add_votes(uuid, int) from public, anon, authenticated;

insert into kura_season (id, title, packs, campuses, divisions) values (
  1, 'Campus Star Awards',
  '[{"votes":10,"price":100},{"votes":50,"price":450,"bonus":5},{"votes":120,"price":1000,"popular":true},{"votes":300,"price":2400}]',
  '["Kirinyaga University","Mount Kenya University","University of Nairobi"]',
  '[{"id":"creators","label":"Creators","categories":["Comedy","Dance","Music","Fashion","Content Creator"]},{"id":"talent","label":"Talent","categories":["Singing","Rapping","Acting","Sports"]}]'
) on conflict (id) do nothing;
