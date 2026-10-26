-- Review requests ("Request a review" on any error), withdrawal support, and the phone number every account can save.
-- Safe to run again. Run it once in Supabase > SQL Editor (or paste it from Admin > Site > SQL).

-- The M-Pesa number of the account. Stored as 2547XXXXXXXX. Admins see it, so a failed payout can be sent by hand.
alter table profiles add column if not exists phone text;

create table if not exists support_requests (
  id uuid primary key default gen_random_uuid(),
  aid text,                                          -- who asked (null if they were not signed in)
  kind text not null default 'error' check (kind in ('error','withdrawal','other')),
  page text,                                         -- the screen they were on, e.g. club, market, me
  message text,                                      -- the error they saw
  detail text,                                       -- technical detail: which request failed and the status code
  note text,                                         -- what the person typed
  phone text,                                        -- M-Pesa number to send money to (withdrawal help)
  amount integer,
  ref text,                                          -- withdrawal id, payment id, order id...
  status text not null default 'open' check (status in ('open','fixed','dismissed')),
  admin_note text,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists support_requests_open on support_requests(status, created_at desc);
create index if not exists support_requests_aid on support_requests(aid, created_at desc);
alter table support_requests enable row level security;
