-- Run once in Supabase > SQL Editor. Optional seller pin on a listing.
alter table listings add column if not exists lat double precision check (lat between -90 and 90);
alter table listings add column if not exists lng double precision check (lng between -180 and 180);
