-- Advertiser enquiries ("Advertise with us" form). They are saved on the server, so you never lose a lead.
-- Safe to run again. Run it once in Supabase > SQL Editor (or paste it from Admin > Site > SQL).
create table if not exists ad_enquiries (
  id uuid primary key default gen_random_uuid(),
  business text not null,
  phone text not null,                               -- WhatsApp number, stored as 2547XXXXXXXX
  package text,                                      -- Week banner, Month banner, Sponsored post...
  note text,                                         -- what they sell or promote
  campus text,
  ip text,
  status text not null default 'new' check (status in ('new','contacted','won','dismissed')),
  admin_note text,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ad_enquiries_status on ad_enquiries(status, created_at desc);
alter table ad_enquiries enable row level security;
