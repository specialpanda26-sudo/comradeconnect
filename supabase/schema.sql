-- Run once in Supabase > SQL Editor. All access goes through the Worker (service key), so RLS stays ON with no public policies.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  aid text not null,                 -- anonymous account id from the app
  purpose text not null,             -- 'order' | 'boost' | 'club' | 'ticket' | 'topup'
  ref_id text,                       -- order/listing id in your app
  amount integer not null,
  phone text not null,
  request_id text,                   -- returned by TinyPesa initialize
  checkout_id text,                  -- CheckoutRequestID from callback
  receipt text,                      -- M-Pesa receipt number
  status text not null default 'pending',  -- pending | submitted (manual M-Pesa code waiting for you) | paid | failed | expired | underpaid
  created_at timestamptz default now(),
  paid_at timestamptz
);
create unique index if not exists payments_receipt_uq on payments(receipt) where receipt is not null;
create index if not exists payments_phone_amt on payments(phone, amount, status);

create table if not exists orders (      -- escrow
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references payments(id),
  listing_id text, buyer_aid text, seller_aid text,
  amount integer, code text,
  status text default 'held',            -- held | handed | released | refunded
  created_at timestamptz default now()
);

create table if not exists ai_usage (aid text, day date, n int default 0, primary key(aid, day));

alter table payments enable row level security;
alter table orders enable row level security;
alter table ai_usage enable row level security;

-- v2 additions (safe to run again)
alter table payments add column if not exists ip text;
create index if not exists payments_ip_time on payments(ip, created_at);

-- v3: shared Feed (posts, comments, likes, reports). Run once in the Supabase SQL editor.
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  aid text not null,
  content text not null,
  category text not null default 'General',
  zone text not null default '',
  verified boolean not null default false,   -- set only by the admin endpoint
  hidden boolean not null default false,
  boosted_until timestamptz,
  likes int not null default 0,
  views int not null default 0,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists posts_feed on posts(hidden, created_at desc);
create index if not exists posts_cat on posts(category, created_at desc);
create index if not exists posts_aid_time on posts(aid, created_at);
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  aid text not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_post on comments(post_id, created_at);
create index if not exists comments_aid_time on comments(aid, created_at);
create table if not exists post_likes (
  post_id uuid references posts(id) on delete cascade,
  aid text,
  primary key (post_id, aid)
);
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  aid text, reason text,
  created_at timestamptz not null default now()
);
create or replace function inc_post(p uuid, col text) returns posts language plpgsql as $$
declare r posts;
begin
  if col = 'likes' then update posts set likes = likes + 1 where id = p returning * into r;
  elsif col = 'views' then update posts set views = views + 1 where id = p returning * into r;
  end if;
  return r;
end $$;
alter table posts enable row level security;
alter table comments enable row level security;
alter table post_likes enable row level security;
alter table reports enable row level security;
-- No public policies: only the Worker (service key) reads and writes.

-- =====================================================================
-- v7 (Section 1): full marketplace, escrow, messaging, community, club, admin.
-- Safe to run again. All access goes through the Worker (service key); RLS stays ON, no public policies.
-- NOTE: aid = anonymous account id (text), same as in v1-v3.
-- =====================================================================

-- ---------- profiles ----------
create table if not exists profiles (
  aid text primary key,
  handle text,                                   -- public nickname, no contact info
  points int not null default 0,
  recovery_hash text,                            -- hash of the recovery code (never the code itself)
  verified boolean not null default false,       -- ID-verified (set only via verifications approval)
  role text not null default 'user',             -- user | seller | club_admin | admin
  banned boolean not null default false,
  muted_until timestamptz,                       -- admin moderation mute
  referral_code text,
  adult_confirmed boolean not null default false, -- 18+ self-declaration for Hearts
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_handle_uq on profiles(lower(handle)) where handle is not null;
create unique index if not exists profiles_refcode_uq on profiles(referral_code) where referral_code is not null;

-- ---------- media (clips, listing photos, videos) ----------
create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  aid text not null,
  kind text not null check (kind in ('clip','listing_photo','video')),
  r2_key text not null unique,                   -- file path in the Supabase Storage bucket (column keeps its old name)
  content_type text,
  bytes bigint,
  duration_s int,
  caption text,
  listing_id uuid,                               -- set for listing_photo
  likes int not null default 0,
  status text not null default 'pending' check (status in ('pending','ready','hidden')), -- ready after upload is confirmed
  created_at timestamptz not null default now()
);
create index if not exists media_feed on media(kind, status, created_at desc);
create index if not exists media_listing on media(listing_id);
create table if not exists media_likes (
  media_id uuid references media(id) on delete cascade,
  aid text,
  primary key (media_id, aid)
);

-- ---------- market listings ----------
create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  seller_aid text not null,
  title text not null,
  description text not null default '',
  category text not null default 'General',
  price integer not null check (price >= 1 and price <= 150000),
  zone text not null default '',
  condition text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','sold','removed')),
  reject_reason text,
  approved_by text,                              -- admin label from the audit log (not a secret)
  approved_at timestamptz,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists listings_browse on listings(status, created_at desc);
create index if not exists listings_seller on listings(seller_aid, created_at desc);
create index if not exists listings_cat on listings(category, status, created_at desc);

-- ---------- escrow: upgrade orders ----------
alter table orders add column if not exists code_hash text;           -- hash of the handover code; plaintext is never stored
alter table orders drop column if exists code;                        -- v1 plaintext column, no longer used
alter table orders add column if not exists handed_at timestamptz;
alter table orders add column if not exists confirmed_at timestamptz;
alter table orders add column if not exists released_at timestamptz;
alter table orders add column if not exists refunded_at timestamptz;
alter table orders add column if not exists dispute_status text not null default 'none'; -- none | open | resolved_release | resolved_refund
alter table orders add column if not exists dispute_reason text;
alter table orders add column if not exists disputed_at timestamptz;
alter table orders add column if not exists dispute_by text;
alter table orders add column if not exists code_attempts int not null default 0;        -- lock after too many wrong codes
alter table orders add column if not exists payout_status text not null default 'none';  -- none | requested | paid
alter table orders add column if not exists payout_ref text;                            -- M-Pesa ref of manual/automatic payout
alter table orders add column if not exists payout_at timestamptz;
alter table orders add column if not exists decided_by text;
alter table orders add column if not exists auto_release_at timestamptz;                -- optional safety deadline
alter table orders drop constraint if exists orders_status_chk;
alter table orders add constraint orders_status_chk check (status in ('held','handed','released','refunded','disputed'));
alter table orders drop constraint if exists orders_dispute_chk;
alter table orders add constraint orders_dispute_chk check (dispute_status in ('none','open','resolved_release','resolved_refund'));
create unique index if not exists orders_payment_uq on orders(payment_id);        -- one order per payment
create index if not exists orders_buyer on orders(buyer_aid, created_at desc);
create index if not exists orders_seller on orders(seller_aid, created_at desc);
create index if not exists orders_dispute on orders(dispute_status) where dispute_status = 'open';

-- ---------- anonymous messaging ----------
create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid,
  a_aid text not null,
  b_aid text not null,
  last_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (a_aid <> b_aid)
);
create unique index if not exists threads_pair_uq on threads(least(a_aid,b_aid), greatest(a_aid,b_aid), coalesce(listing_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists threads_a on threads(a_aid, last_at desc);
create index if not exists threads_b on threads(b_aid, last_at desc);
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id) on delete cascade,
  sender_aid text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_thread on messages(thread_id, created_at);
create index if not exists messages_sender_time on messages(sender_aid, created_at);
create table if not exists blocks (
  blocker_aid text, blocked_aid text,
  created_at timestamptz not null default now(),
  primary key (blocker_aid, blocked_aid)
);
create table if not exists thread_mutes (            -- user-chosen 24h mute of a thread
  thread_id uuid references threads(id) on delete cascade,
  aid text,
  muted_until timestamptz not null,
  primary key (thread_id, aid)
);
create table if not exists message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references messages(id) on delete set null,
  thread_id uuid references threads(id) on delete set null,
  reporter_aid text not null,
  reported_aid text,
  reason text,
  snapshot text,                                      -- copy of the reported message so it can be reviewed even if deleted
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_by text, reviewed_at timestamptz
);
create index if not exists message_reports_open on message_reports(status, created_at);

-- general moderation queue for non-feed content (listings, clips, hearts, etc.)
create table if not exists content_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,                          -- listing | clip | room | group | hearts | wifi | hostel | service | tip | user
  target_id text not null,
  reporter_aid text not null,
  reason text,
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_by text, reviewed_at timestamptz,
  unique (target_type, target_id, reporter_aid)
);
create index if not exists content_reports_open on content_reports(status, created_at);

-- ---------- roommates, study groups ----------
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  aid text not null,
  kind text not null default 'looking' check (kind in ('looking','offering')),
  title text not null,
  details text not null default '',
  rent integer,
  zone text not null default '',
  hidden boolean not null default false,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists rooms_list on rooms(hidden, created_at desc);
create table if not exists study_groups (
  id uuid primary key default gen_random_uuid(),
  aid text not null,
  name text not null,
  unit text not null default '',
  details text not null default '',
  max_members int not null default 10 check (max_members between 2 and 100),
  hidden boolean not null default false,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists study_groups_list on study_groups(hidden, created_at desc);
create table if not exists group_members (
  group_id uuid references study_groups(id) on delete cascade,
  aid text,
  joined_at timestamptz not null default now(),
  primary key (group_id, aid)
);

-- ---------- polls (one vote per person) ----------
create table if not exists polls (
  id uuid primary key default gen_random_uuid(),
  aid text not null,
  question text not null,
  options jsonb not null,                            -- ["A","B",...] 2 to 6 items
  closes_at timestamptz,
  hidden boolean not null default false,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists polls_list on polls(hidden, created_at desc);
create table if not exists poll_votes (
  poll_id uuid references polls(id) on delete cascade,
  aid text,
  option_idx int not null check (option_idx >= 0 and option_idx < 6),
  created_at timestamptz not null default now(),
  primary key (poll_id, aid)                         -- enforces one vote per person
);

-- ---------- Hearts (18+) ----------
create table if not exists hearts_posts (
  id uuid primary key default gen_random_uuid(),
  aid text not null,
  content text not null,
  zone text not null default '',
  adult_only boolean not null default true check (adult_only = true),  -- 18+ flag, cannot be turned off
  hidden boolean not null default false,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists hearts_list on hearts_posts(hidden, created_at desc);
create table if not exists hearts_interests (
  post_id uuid references hearts_posts(id) on delete cascade,
  aid text,                                          -- the person who is interested
  created_at timestamptz not null default now(),
  primary key (post_id, aid)
);
-- A match = the post author also showed interest in a post by the interested person. Computed by the Worker.

-- ---------- Wi-Fi, hostels, services, study tips, zone ratings ----------
create table if not exists wifi (
  id uuid primary key default gen_random_uuid(),
  aid text not null,
  place text not null,
  zone text not null default '',
  speed_note text,
  hidden boolean not null default false,
  ip text,
  created_at timestamptz not null default now()
);
create table if not exists wifi_votes (
  wifi_id uuid references wifi(id) on delete cascade,
  aid text,
  value smallint not null check (value in (-1, 1)),
  primary key (wifi_id, aid)
);
create table if not exists hostels (
  id uuid primary key default gen_random_uuid(),
  aid text not null,
  name text not null,
  zone text not null default '',
  rent integer,
  rating smallint check (rating between 1 and 5),
  review text not null default '',
  hidden boolean not null default false,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists hostels_list on hostels(hidden, created_at desc);
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  aid text not null,
  title text not null,
  category text not null default 'General',
  price_note text,
  zone text not null default '',
  details text not null default '',
  hidden boolean not null default false,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists services_list on services(hidden, created_at desc);
create table if not exists study_tips (
  id uuid primary key default gen_random_uuid(),
  aid text not null,
  unit text not null default '',
  tip text not null,
  likes int not null default 0,
  hidden boolean not null default false,
  ip text,
  created_at timestamptz not null default now()
);
create table if not exists zone_ratings (
  zone text,
  aid text,
  safety smallint check (safety between 1 and 5),
  noise smallint check (noise between 1 and 5),
  value smallint check (value between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (zone, aid)
);

-- ---------- referrals and wallet ----------
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_aid text not null,
  referred_aid text not null unique,                 -- a person can only be referred once
  order_id uuid,                                     -- first paid order that triggers the reward
  reward integer not null default 0,
  status text not null default 'pending' check (status in ('pending','unlocked','void')),
  unlock_at timestamptz,                             -- paid_at + 7 days (refund window)
  created_at timestamptz not null default now(),
  check (referrer_aid <> referred_aid)
);
create index if not exists referrals_referrer on referrals(referrer_aid, status);
create table if not exists wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  aid text not null,
  delta integer not null,                            -- KES, positive = credit, negative = debit
  kind text not null check (kind in ('sale','referral','withdrawal','refund','adjustment','topup')),
  ref text,                                          -- order id / referral id / withdrawal id
  status text not null default 'available' check (status in ('pending','available','void')),
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists wallet_ref_uq on wallet_ledger(kind, ref) where ref is not null;  -- no double credit
create index if not exists wallet_aid on wallet_ledger(aid, created_at desc);
create table if not exists withdrawals (
  id uuid primary key default gen_random_uuid(),
  aid text not null,
  amount integer not null check (amount >= 50),
  phone text not null,
  status text not null default 'requested' check (status in ('requested','paid','rejected')),
  payout_ref text,
  decided_by text, decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists withdrawals_open on withdrawals(status, created_at);

-- ---------- verifications (ID checks) ----------
create table if not exists verifications (
  id uuid primary key default gen_random_uuid(),
  aid text not null,
  kind text not null default 'student_id',
  r2_key text,                                       -- file path in the private Storage bucket; deleted after the decision
  full_name text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decision_note text,
  decided_by text, decided_at timestamptz,
  purge_after timestamptz,                           -- when the ID image must be deleted
  created_at timestamptz not null default now()
);
create index if not exists verifications_queue on verifications(status, created_at);

-- ---------- club ----------
create table if not exists club_members (
  club text not null default 'default',
  aid text,
  display_name text,
  status text not null default 'active' check (status in ('active','left','removed')),
  joined_at timestamptz not null default now(),
  primary key (club, aid)
);
create table if not exists club_products (
  id uuid primary key default gen_random_uuid(),
  club text not null default 'default',
  name text not null,
  price integer not null check (price >= 0),
  image_key text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists club_stock (
  product_id uuid primary key references club_products(id) on delete cascade,
  qty int not null default 0 check (qty >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists club_orders (
  id uuid primary key default gen_random_uuid(),
  club text not null default 'default',
  aid text not null,
  product_id uuid references club_products(id),
  qty int not null default 1 check (qty between 1 and 20),
  amount integer not null,
  payment_id uuid references payments(id),
  status text not null default 'pending' check (status in ('pending','paid','collected','cancelled','refunded')),
  created_at timestamptz not null default now()
);
create index if not exists club_orders_aid on club_orders(aid, created_at desc);
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  aid text not null,
  payment_id uuid references payments(id),
  code_hash text not null,                           -- hash of the ticket code shown to the holder
  status text not null default 'valid' check (status in ('valid','used','void')),
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists tickets_aid on tickets(aid, created_at desc);

-- ---------- sponsors, notices, events, audit ----------
create table if not exists sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  blurb text,
  logo_key text,
  link text,
  active boolean not null default true,
  starts_at timestamptz, ends_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  pinned boolean not null default false,
  expires_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_on date not null,                           -- real dates; replaces the hard-coded EVENTS array
  venue text,
  details text,
  ticket_price integer,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists events_date on events(starts_on);
create table if not exists admin_audit_log (
  id bigint generated always as identity primary key,
  actor text not null,                               -- admin label (never the key)
  action text not null,
  target_type text, target_id text,
  detail jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists audit_time on admin_audit_log(created_at desc);

-- ---------- atomic helpers (avoid race conditions) ----------
-- Decrease club stock only if enough is left. Returns true if it worked.
create or replace function take_stock(p uuid, n int) returns boolean language plpgsql as $$
declare ok boolean;
begin
  update club_stock set qty = qty - n, updated_at = now() where product_id = p and qty >= n returning true into ok;
  return coalesce(ok, false);
end $$;
-- Spendable wallet balance (available entries only).
create or replace function wallet_balance(p text) returns integer language sql stable as $$
  select coalesce(sum(delta), 0)::int from wallet_ledger where aid = p and status = 'available';
$$;

-- ---------- RLS on every table (no policies = only the service key can access) ----------
do $$
declare t text;
begin
  for t in select unnest(array[
    'profiles','media','media_likes','listings','threads','messages','blocks','thread_mutes','message_reports','content_reports',
    'rooms','study_groups','group_members','polls','poll_votes','hearts_posts','hearts_interests',
    'wifi','wifi_votes','hostels','services','study_tips','zone_ratings',
    'referrals','wallet_ledger','withdrawals','verifications',
    'club_members','club_products','club_stock','club_orders','tickets',
    'sponsors','notices','events','admin_audit_log'])
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- =====================================================================
-- v7 (Section 2) additions needed by the Worker. Safe to run again.
-- =====================================================================
alter table profiles add column if not exists token_hash text;          -- hash of the secret login token (device proves it owns the aid)
alter table orders add column if not exists fee integer not null default 0;
alter table orders add column if not exists seller_amount integer;
alter table club_orders add column if not exists stock_held boolean not null default true;  -- stock reserved, restored on failure/expiry
alter table tickets add column if not exists ticket_price integer;

create table if not exists live_streams (
  id uuid primary key default gen_random_uuid(),
  host_aid text not null,
  title text not null,
  input_uid text not null,                          -- the live link (YouTube / Facebook / TikTok / Twitch)
  status text not null default 'live' check (status in ('live','ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
alter table live_streams enable row level security;

create or replace function inc_likes(t text, p uuid) returns int language plpgsql as $$
declare n int;
begin
  if t = 'media' then update media set likes = likes + 1 where id = p returning likes into n;
  elsif t = 'study_tips' then update study_tips set likes = likes + 1 where id = p returning likes into n;
  end if;
  return n;
end $$;
create table if not exists tip_likes (tip_id uuid references study_tips(id) on delete cascade, aid text, primary key (tip_id, aid));
alter table tip_likes enable row level security;
create unique index if not exists tickets_payment_uq on tickets(payment_id);

-- v7 Section 3A+: Google sign-in (stores only Google's stable user id, no email)
alter table profiles add column if not exists google_sub text;
create unique index if not exists profiles_google_sub_uq on profiles(google_sub) where google_sub is not null;

-- v7 Section 3B: ID verification details and official badge (safe to run again)
alter table verifications add column if not exists claimed_role text;
alter table verifications add column if not exists id_number text;
alter table verifications add column if not exists group_link text;
alter table verifications add column if not exists barcode_check text;
alter table profiles add column if not exists badge text;

-- v7 Section 3B-3: chats started from a Feed story, roommate post, service or study group keep a short title (safe to run again)
alter table threads add column if not exists ref_title text;

-- v8 Group 1: file storage on Supabase Storage (free, no card). Safe to run again.
-- Public bucket = clips and listing photos (the Worker picks random file names). Private bucket = ID photos (only the Worker can read).
-- Nobody can upload or list with the public anon key: storage.objects has RLS on and we add no policies. The Worker uses the service key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('cc-media',   'cc-media',   true,  26214400, array['image/jpeg','image/png','image/webp','video/mp4','video/webm']),
  ('cc-private', 'cc-private', false, 5242880,  array['image/jpeg','image/png'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- v9: admin-editable fees and prices, payout fees, advert amounts (safe to run again)
create table if not exists settings (
  key text primary key,
  value numeric not null,
  updated_at timestamptz not null default now()
);
alter table settings enable row level security;
alter table withdrawals add column if not exists fee integer not null default 0;
alter table withdrawals add column if not exists net integer;
alter table payments add column if not exists boost_hours integer;
alter table sponsors add column if not exists amount integer not null default 0;
create unique index if not exists withdrawals_payout_ref_uq on withdrawals(payout_ref) where payout_ref is not null;

-- v10: Site editor (admin changes words, links, banner and switches without code). Safe to run again.
create table if not exists site_content (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
alter table site_content enable row level security;


-- v11: Live extras (viewer count, hearts, comments). Safe to run again.
alter table live_streams add column if not exists hearts int not null default 0;
create table if not exists live_comments (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references live_streams(id) on delete cascade,
  aid text not null,
  name text not null,
  text text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists live_comments_stream_idx on live_comments(stream_id, created_at);
create table if not exists live_viewers (
  stream_id uuid not null references live_streams(id) on delete cascade,
  viewer text not null,
  seen_at timestamptz not null default now(),
  primary key (stream_id, viewer)
);
create index if not exists live_viewers_seen_idx on live_viewers(stream_id, seen_at);
alter table live_comments enable row level security;
alter table live_viewers enable row level security;
create or replace function live_heart(p uuid, n int) returns int language plpgsql as $$
declare t int;
begin
  update live_streams set hearts = hearts + least(greatest(n, 0), 10) where id = p and status = 'live' returning hearts into t;
  return t;
end $$;


-- v12: seller phone number, shown to the buyer only after payment. Safe to run again.
alter table listings add column if not exists contact_phone text;
