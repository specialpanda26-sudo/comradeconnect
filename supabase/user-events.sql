-- User-hosted events: anyone signed in can host an event, sell tickets and scan them at the door.
-- Safe to run again. Run once in Supabase > SQL Editor.
alter table events add column if not exists owner_aid text;          -- null = event added by an admin
alter table events add column if not exists capacity integer check (capacity is null or capacity between 1 and 5000);
create index if not exists events_owner on events(owner_aid, starts_on desc);
create index if not exists tickets_event on tickets(event_id, status);
