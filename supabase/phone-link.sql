-- WhatsApp number link with a confirmation code. Safe to run again. Run once in Supabase > SQL Editor.
-- phone_hash is a keyed hash of the normalized number, so one number can only back ONE account.
-- phone_enc keeps the normalized number only if the person also ticked "WhatsApp me" for offers; otherwise it stays null.
create table if not exists phone_links (
  aid text primary key,
  phone_hash text not null unique,
  phone_enc text,
  last4 text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
alter table phone_links add column if not exists last4 text;
create table if not exists phone_codes (
  aid text primary key,
  phone_hash text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sent_at timestamptz not null default now(),
  last4 text
);
alter table phone_codes add column if not exists last4 text;
alter table phone_links enable row level security;
alter table phone_codes enable row level security;
