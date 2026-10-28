-- Market "Top sales this month": lets an admin delete a "Just sold" line from the card.
-- Only hides it from the card. The order, the money and the earnings totals stay exactly as they were. Safe to run again.
alter table orders add column if not exists hide_top boolean not null default false;
create index if not exists orders_hide_top on orders(status, hide_top, created_at desc);
