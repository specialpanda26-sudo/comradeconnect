-- Promo emails and SMS: only people who tick the box in Me > Offers and updates. Safe to run again.
create table if not exists promo_contacts (
  id uuid primary key default gen_random_uuid(),
  aid text not null unique,
  email text,
  phone text,
  email_ok boolean not null default false,
  sms_ok boolean not null default false,
  consent_at timestamptz,
  consent_ip text,
  unsub_token text not null unique,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists promo_contacts_email_ok on promo_contacts(email_ok) where email_ok;
create index if not exists promo_contacts_sms_ok on promo_contacts(sms_ok) where sms_ok;
create table if not exists promo_sends (
  campaign text not null,
  channel text not null check (channel in ('email','sms')),
  to_key text not null,
  contact_id uuid,
  ok boolean not null default false,
  detail text,
  created_at timestamptz not null default now(),
  primary key (campaign, channel, to_key)
);
alter table promo_contacts enable row level security;
alter table promo_sends enable row level security;
