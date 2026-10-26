-- Cart checkout: one payment can now pay for several items, so one payment may own several orders.
-- Run once in Supabase > SQL Editor (safe to run again).
-- Until you run it, single-item purchases keep working and a cart pays for its first item only;
-- the other items are refunded to the buyer's wallet automatically.
-- Note: if you ever run schema.sql again, run this file again after it (schema.sql puts the old one-order-per-payment index back).
drop index if exists orders_payment_uq;
create unique index if not exists orders_payment_listing_uq on orders(payment_id, listing_id);
