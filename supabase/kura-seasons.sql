-- Kura: several competitions at the same time. Run once in Supabase > SQL Editor. Safe to run again.
-- Every contestant now belongs to one competition (season). Your existing contestants stay in competition 1.
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'kura_season'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%id = 1%' loop
    execute format('alter table kura_season drop constraint %I', c);
  end loop;
end $$;
alter table kura_season add column if not exists archived boolean not null default false;
alter table kura_contestants add column if not exists season_id int not null default 1;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kura_contestants_season_fk') then
    alter table kura_contestants add constraint kura_contestants_season_fk foreign key (season_id) references kura_season(id);
  end if;
end $$;
-- the same email may enter a different competition, but not the same one twice
drop index if exists kura_contestants_email;
create unique index if not exists kura_contestants_season_email on kura_contestants (season_id, lower(email));
create index if not exists kura_contestants_season on kura_contestants (season_id, status, votes desc);
