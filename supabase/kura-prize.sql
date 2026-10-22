-- Kura: admin-controlled countdown + mystery prize. Run once in Supabase > SQL Editor. Safe to run again.
alter table kura_season add column if not exists starts_at timestamptz;
alter table kura_season add column if not exists reveal_at timestamptz;
alter table kura_season add column if not exists prize_mystery boolean not null default false;
alter table kura_season add column if not exists prize_image_key text;
