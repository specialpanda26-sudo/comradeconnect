-- Gift links: creators share a link, supporters send them a gift by M-Pesa, the site keeps a percentage.
create table if not exists gift_links (
  id uuid primary key default gen_random_uuid(),
  aid text not null unique,
  slug text not null,
  title text not null,
  blurb text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists gift_links_slug_uq on gift_links(lower(slug));

create table if not exists gifts (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references gift_links(id) on delete cascade,
  creator_aid text not null,
  payment_id uuid unique,
  item text not null default 'custom',
  gross integer not null,
  fee integer not null default 0,
  net integer not null default 0,
  supporter_name text,
  message text,
  receipt_email text,
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists gifts_creator on gifts(creator_aid, status, created_at desc);

alter table gift_links enable row level security;
alter table gifts enable row level security;

do $$ begin alter table wallet_ledger drop constraint if exists wallet_ledger_kind_check; alter table wallet_ledger add constraint wallet_ledger_kind_check check (kind in ('sale','referral','withdrawal','refund','adjustment','topup','purchase','wholesale_fee','gift')); exception when others then null; end $$;
