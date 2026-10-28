-- Run once in Supabase > SQL Editor. How many of an item the seller has. Each sale takes one; the listing shows as sold at zero.
alter table listings add column if not exists stock integer not null default 1 check (stock >= 0 and stock <= 999);
