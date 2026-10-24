-- Profile pictures. Safe to run again.
alter table profiles add column if not exists avatar text;
