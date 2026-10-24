-- Forgot password by emailed code. Safe to run again. Run once in Supabase > SQL Editor.
create table if not exists password_resets (
  aid text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sent_at timestamptz not null default now()
);
alter table password_resets enable row level security;
