create table if not exists blocked_terms (
  id bigserial primary key,
  term text not null unique,
  kind text default 'name',
  created_at timestamptz default now()
);
create table if not exists moderators (
  user_id uuid primary key,
  role text check (role in ('class_rep','student_leader')) not null,
  zone text,
  created_at timestamptz default now()
);
create table if not exists moderation_flags (
  id bigserial primary key,
  post_id text,
  user_id uuid,
  reasons text[],
  status text default 'pending' check (status in ('pending','removed','dismissed')),
  reviewed_by uuid,
  created_at timestamptz default now()
);
create table if not exists escrow_disputes (
  id bigserial primary key,
  order_id text not null,
  opened_by uuid,
  reason text,
  evidence text,
  status text default 'open' check (status in ('open','resolved')),
  resolution text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);
alter table blocked_terms enable row level security;
alter table moderators enable row level security;
alter table moderation_flags enable row level security;
alter table escrow_disputes enable row level security;
