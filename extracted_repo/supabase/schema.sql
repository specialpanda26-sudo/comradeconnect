-- Mtaa Vibes — Supabase schema
-- Source of truth: docs/BUILD_PROMPT.md, Section 4.
-- Run this in the Supabase SQL editor.

-- Events
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organizer_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('fashion','dressing','dance','campus','club','art','other')),
  venue TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  poster_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','live','paused','ended')),
  commission_rate DECIMAL DEFAULT 0.10,
  organizer_mpesa_number TEXT NOT NULL,
  sold_tickets INTEGER DEFAULT 0, -- scaffold addition: incremented by the payment webhook
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tier pricing per event
CREATE TABLE event_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL CHECK (tier_name IN ('general','vip','premium')),
  price INTEGER NOT NULL,
  description TEXT,
  perks TEXT[]
);

-- Bulk discounts per event
CREATE TABLE bulk_discounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL,
  discount_percent DECIMAL NOT NULL,
  label TEXT
);

-- Tickets purchased
CREATE TABLE tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  tier_id UUID REFERENCES event_tiers(id),
  buyer_phone TEXT NOT NULL,
  buyer_name TEXT,
  quantity INTEGER DEFAULT 1,
  discount_applied DECIMAL DEFAULT 0,
  transaction_id TEXT UNIQUE,
  amount_paid INTEGER NOT NULL,
  commission_paid INTEGER NOT NULL,
  organizer_paid INTEGER NOT NULL,
  qr_code TEXT UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid','used','refunded')),
  paid_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizer verification
CREATE TABLE organizer_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organizer_id UUID REFERENCES auth.users(id) UNIQUE, -- one verification row per organizer; the dashboard upserts onConflict "organizer_id"
  id_front_url TEXT,
  id_back_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payouts to organizers
CREATE TABLE payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  organizer_id UUID REFERENCES auth.users(id),
  amount INTEGER NOT NULL,
  mpesa_receipt TEXT,
  -- Escrow hold: 'pending' = held until the event happens (protects buyers
  -- from no-show/scam events), 'released' = event has passed, cleared for
  -- payout, 'paid' = M-Pesa payout actually sent to the organizer.
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','released','paid')),
  held_until TIMESTAMPTZ, -- set to the event's event_date at insert time
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referrals: 100 points credited to the referrer for every friend who buys using their link/code
-- (REFERRAL_POINTS_PER_SIGNUP — tune this one constant in src/lib/constants.js before launch)
CREATE TABLE referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_phone TEXT NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  referred_phone TEXT,
  referred_ticket_id UUID REFERENCES tickets(id),
  points_awarded INTEGER DEFAULT 100,
  reward_status TEXT DEFAULT 'pending' CHECK (reward_status IN ('pending','earned')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Points ledger: running history of earns (referrals) and redemptions (used at checkout).
-- Balance for a phone number = SUM(amount) WHERE type='earn' - SUM(amount) WHERE type='redeem'
CREATE TABLE points_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  type TEXT CHECK (type IN ('earn','redeem')),
  amount INTEGER NOT NULL,
  reason TEXT, -- e.g. 'referral_signup', 'redeemed_at_checkout'
  referral_id UUID REFERENCES referrals(id),
  ticket_id UUID REFERENCES tickets(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pending payments: scaffold addition, bridges the STK push request to the
-- webhook (IntaSend's webhook only carries api_ref/invoice_id, not our
-- event/tier/quantity/referral context, so we stash it here in between).
CREATE TABLE pending_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_ref TEXT UNIQUE NOT NULL,
  invoice_id TEXT,
  event_id UUID REFERENCES events(id),
  tier_id UUID REFERENCES event_tiers(id),
  quantity INTEGER DEFAULT 1,
  buyer_phone TEXT NOT NULL,
  amount_paid INTEGER NOT NULL,
  referral_code TEXT,
  points_redeemed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buyer-side reviews. One review per ticket, and only submittable once the
-- ticket's used_at is set (i.e. the buyer actually attended) — enforced in
-- the API route, not here, since inserts go through the service-role client.
CREATE TABLE event_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) UNIQUE,
  buyer_phone TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

alter table event_reviews enable row level security;

-- Anyone can read reviews (public trust signal on the event page).
create policy "Reviews are publicly readable"
  on event_reviews for select
  to anon, authenticated
  using (true);

-- No direct insert/update policy for anon/authenticated: reviews are only
-- ever written by /api/reviews using the service-role client, which
-- verifies the ticket was actually used before inserting.


-- Computed live from real ticket/event data rather than a stored counter, so
-- it can never drift out of sync. Surfaced on PurchaseSheet as e.g.
-- "12 events hosted · 2% refund rate".
create or replace view organizer_stats as
select
  e.organizer_id,
  count(distinct e.id) as events_count,
  count(t.id) filter (where t.status in ('paid','used')) as tickets_sold,
  count(t.id) filter (where t.status = 'refunded') as refunded_count,
  case
    when count(t.id) filter (where t.status in ('paid','used','refunded')) = 0 then 0
    else round(
      100.0 * count(t.id) filter (where t.status = 'refunded')
      / count(t.id) filter (where t.status in ('paid','used','refunded')),
      1
    )
  end as refund_rate_percent
from events e
left join tickets t on t.event_id = e.id
group by e.organizer_id;

-- Readable by anyone (it's a public trust signal shown to buyers pre-purchase).
grant select on organizer_stats to anon, authenticated;

-- Private bucket for national ID photos uploaded on the dashboard. Files are
-- named "<organizer_id>/front.<ext>" and "<organizer_id>/back.<ext>" so RLS
-- can scope access to the folder matching the signed-in user's own id.
insert into storage.buckets (id, name, public)
values ('organizer-ids', 'organizer-ids', false)
on conflict (id) do nothing;

-- Organizers can upload/overwrite only their own two files.
create policy "Organizers upload their own ID files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'organizer-ids'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Organizers replace their own ID files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'organizer-ids'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Organizers can view their own upload (e.g. to re-check what's on file);
-- nobody else can — admin review reads these via the service-role key, which
-- bypasses RLS, so no separate policy is needed for that.
create policy "Organizers view their own ID files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'organizer-ids'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Row-level security on organizer_verifications itself: an organizer can
-- read/insert/update only their own verification row.
alter table organizer_verifications enable row level security;

create policy "Organizers manage their own verification row"
  on organizer_verifications for all
  to authenticated
  using (organizer_id = auth.uid())
  with check (organizer_id = auth.uid());
