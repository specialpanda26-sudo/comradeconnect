-- Paid surveys, funded by the person who makes them (never by the platform).
-- The creator pays budget (responses x reward) plus the platform fee up front, from the wallet or by M-Pesa. The money is held;
-- every valid answer moves the reward to the comrade's wallet (held 24 hours first); what is left over goes back to the creator.
-- Safe to run again. Run it once in Supabase > SQL Editor (or paste it from Admin > Site > SQL).
create table if not exists surveys (
  id uuid primary key default gen_random_uuid(),
  aid text not null,                                   -- who made it (the funder). 'admin' for surveys the admin made with offline funding
  campus text not null default 'all',                  -- a campus id, or 'all'
  title text not null,
  intro text,
  questions jsonb not null default '[]'::jsonb,        -- [{ id:'q1', type:'single'|'multi'|'text', text, options:[..] }]
  wanted integer not null check (wanted >= 1),         -- number of responses wanted
  reward integer not null check (reward >= 1),         -- KSh paid to each comrade for one valid response
  fee_percent numeric not null default 0,              -- platform fee percent, copied from the admin setting when the survey was made
  budget integer not null,                             -- wanted x reward
  fee integer not null default 0,                      -- fee charged on the budget (only the part earned by real responses is kept)
  paid integer not null default 0,                     -- what the funder really paid in (budget + fee)
  refunded integer not null default 0,                 -- what has been returned to the funder so far
  settled boolean not null default false,              -- true once the leftover budget was returned
  funding text not null default 'app' check (funding in ('app','offline')),
  status text not null default 'unpaid' check (status in ('unpaid','pending','live','ended','rejected')),
  reject_note text,
  hidden boolean not null default false,
  sponsor_id uuid,                                     -- "Presented by" (a row of sponsors), set by the admin
  ends_on date not null,
  min_seconds integer not null default 5,              -- answers sent faster than this are refused
  payment_id uuid,
  end_reason text,
  ip text,
  approved_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists surveys_browse on surveys(status, hidden, ends_on);
create index if not exists surveys_owner on surveys(aid, created_at desc);
alter table surveys enable row level security;

create table if not exists survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  aid text not null,                                   -- never shown to the funder
  status text not null default 'started' check (status in ('started','done','released','flagged','rejected','overflow')),
  answers jsonb,
  reward integer not null default 0,
  flag_note text,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (survey_id, aid)                              -- one response per account
);
create index if not exists survey_responses_survey on survey_responses(survey_id, status);
create index if not exists survey_responses_aid on survey_responses(aid, created_at desc);
alter table survey_responses enable row level security;

-- Wallet: add the two survey kinds to the ONE final list (this keeps every kind used by older files, Ludo included).
-- NOT VALID keeps old rows untouched, new rows are checked.
alter table wallet_ledger drop constraint if exists wallet_ledger_kind_check;
alter table wallet_ledger add constraint wallet_ledger_kind_check
  check (kind in ('sale','referral','withdrawal','refund','adjustment','topup','purchase','wholesale_fee','gift','ludo_stake','ludo_win','ludo_refund','survey_reward','survey_refund')) not valid;
