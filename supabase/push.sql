-- Phone notifications (Web Push): one row per phone/browser that allowed alerts.
create table if not exists push_subs (
  endpoint text primary key,
  aid text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_aid_idx on push_subs(aid);
alter table push_subs enable row level security;
