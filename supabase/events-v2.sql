-- Events v2: start time, category and free events. Safe to run again. Run once in Supabase > SQL Editor.
alter table events add column if not exists starts_at text check (starts_at is null or starts_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table events add column if not exists category text;
