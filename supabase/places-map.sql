-- Section 2: map pins for Lost & Found and Events (Land spots already had lat and lng).
-- Run once in Supabase > SQL Editor. Safe to run again.
alter table lost_found add column if not exists lat double precision check (lat between -90 and 90);
alter table lost_found add column if not exists lng double precision check (lng between -180 and 180);
alter table events add column if not exists lat double precision check (lat between -90 and 90);
alter table events add column if not exists lng double precision check (lng between -180 and 180);
