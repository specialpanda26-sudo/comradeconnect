-- Recovery email for anyone (any provider). Only a keyed hash is stored. Safe to run again. Run once in Supabase > SQL Editor.
alter table profiles add column if not exists recovery_email_hash text;
create table if not exists recovery_email_codes (
  aid text primary key,
  email_hash text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sent_at timestamptz not null default now()
);
alter table recovery_email_codes enable row level security;
