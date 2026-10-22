-- Section 1: in-app notifications. Safe to run again.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  aid text not null,                                 -- who receives it
  kind text not null,                                -- comment | reel_comment | like_milestone | order | referral | reward | ...
  title text not null,
  body text not null default '',
  ref_type text,                                     -- post | clip | order | referral | event
  ref_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_aid_time on notifications(aid, created_at desc);
create index if not exists notifications_unread on notifications(aid) where read_at is null;
alter table notifications enable row level security;

-- When this person last opened their notifications; events published after this are "new" for them.
create table if not exists notif_state (
  aid text primary key,
  events_seen_at timestamptz not null default now()
);
alter table notif_state enable row level security;
