-- Passkeys + one-phone-one-account lock. Run once in Supabase > SQL Editor. Safe to run again.
-- All access goes through the Worker (service key), so RLS stays ON with no public policies.

create table if not exists passkeys (
  id            text primary key,                                   -- credential id (base64url)
  aid           text not null references profiles(aid) on delete cascade,
  public_key    text not null,                                      -- public key as JSON (the private key never leaves the phone)
  alg           integer not null,                                   -- -7 = ES256, -257 = RS256
  sign_count    bigint not null default 0,
  name          text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index if not exists passkeys_aid_idx on passkeys(aid);
alter table passkeys enable row level security;

create table if not exists account_devices (
  device_hash text not null,                                        -- keyed hash of the Android ID (or browser id); never the raw value
  aid         text not null references profiles(aid) on delete cascade,
  kind        text not null default 'app',                          -- 'app' = Android ID, 'web' = browser id (weaker)
  created_at  timestamptz not null default now(),
  primary key (device_hash, aid)
);
create index if not exists account_devices_aid_idx on account_devices(aid);
alter table account_devices enable row level security;
