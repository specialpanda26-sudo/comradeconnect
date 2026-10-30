-- Local deals: food spots, salons and cyber cafes post a student offer. A comrade taps "Get my code", shows the
-- 6-digit code at the counter, and the business enters it to confirm. Safe to run again.
-- Run it once in Supabase > SQL Editor (or paste it from Admin > Site > SQL).
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  aid text not null,                                   -- the business owner's account
  campus text not null default 'kirinyaga',
  business text not null,
  title text not null,                                 -- the offer, e.g. "20% off every meal with your student ID"
  details text,
  category text not null default 'Other',
  place text,
  billing_phone text not null,                         -- WhatsApp number for billing, stored as 2547XXXXXXXX, never shown to comrades
  valid_until date not null,
  max_claims integer,                                  -- null = no limit
  status text not null default 'pending' check (status in ('pending','approved','rejected','ended')),
  reject_note text,
  hidden boolean not null default false,
  ip text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists deals_browse on deals(status, hidden, campus, valid_until);
create index if not exists deals_owner on deals(aid, created_at desc);
alter table deals enable row level security;

create table if not exists deal_claims (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  aid text not null,                                   -- the comrade who claimed
  code_hash text not null,                             -- the 6-digit code is never stored, only its hash
  status text not null default 'claimed' check (status in ('claimed','redeemed','expired')),
  fee integer not null default 0,                      -- what the business owes for this redemption (set when it is confirmed)
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (deal_id, aid)                                -- one claim per comrade per deal
);
create index if not exists deal_claims_deal on deal_claims(deal_id, status);
create index if not exists deal_claims_aid on deal_claims(aid, created_at desc);
alter table deal_claims enable row level security;
