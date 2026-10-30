-- Sponsor proof: how many comrades saw and tapped each sponsor card. Safe to run again.
-- Run it once in Supabase > SQL Editor (or paste it from Admin > Site > SQL).
alter table sponsors add column if not exists views integer not null default 0;
alter table sponsors add column if not exists taps integer not null default 0;
create table if not exists sponsor_daily (
  sponsor_id uuid not null references sponsors(id) on delete cascade,
  day date not null,
  views integer not null default 0,
  taps integer not null default 0,
  primary key (sponsor_id, day)
);
alter table sponsor_daily enable row level security;
create or replace function sponsor_hit(p uuid, k text) returns void language plpgsql as $$
begin
  if k = 'tap' then
    insert into sponsor_daily(sponsor_id, day, taps) values (p, current_date, 1)
      on conflict (sponsor_id, day) do update set taps = sponsor_daily.taps + 1;
    update sponsors set taps = taps + 1 where id = p;
  else
    insert into sponsor_daily(sponsor_id, day, views) values (p, current_date, 1)
      on conflict (sponsor_id, day) do update set views = sponsor_daily.views + 1;
    update sponsors set views = views + 1 where id = p;
  end if;
end $$;
