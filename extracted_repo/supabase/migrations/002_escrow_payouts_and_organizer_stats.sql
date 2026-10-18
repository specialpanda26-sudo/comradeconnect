-- Run this against an already-deployed database to pick up the escrow-style
-- payout hold + organizer track record features without re-running the full
-- schema.sql. Safe to run once; guards included where practical.

-- 1. Escrow hold columns + status widened from free-text to a checked enum.
alter table payouts
  add column if not exists held_until timestamptz,
  add column if not exists released_at timestamptz;

-- Widen status: drop any existing unnamed/looser check, then add the real one.
-- (If your `status` column has no CHECK constraint yet, the DROP is a no-op.)
alter table payouts drop constraint if exists payouts_status_check;
alter table payouts
  add constraint payouts_status_check check (status in ('pending','released','paid'));

-- Backfill held_until for existing pending payouts from their event's date,
-- so nothing already in flight is silently exempt from the hold.
update payouts p
set held_until = e.event_date
from events e
where p.event_id = e.id
  and p.held_until is null
  and p.status = 'pending';

-- 2. Organizer trust-signal view — see schema.sql for column definitions.
create or replace view organizer_stats as
select
  e.organizer_id,
  count(distinct e.id) as events_count,
  count(t.id) filter (where t.status in ('paid','used')) as tickets_sold,
  count(t.id) filter (where t.status = 'refunded') as refunded_count,
  case
    when count(t.id) filter (where t.status in ('paid','used','refunded')) = 0 then 0
    else round(
      100.0 * count(t.id) filter (where t.status = 'refunded')
      / count(t.id) filter (where t.status in ('paid','used','refunded')),
      1
    )
  end as refund_rate_percent
from events e
left join tickets t on t.event_id = e.id
group by e.organizer_id;

grant select on organizer_stats to anon, authenticated;
