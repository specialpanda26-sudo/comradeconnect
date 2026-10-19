-- Wi-Fi: shared networks (SSID + password + real location) and reseller plans (Mbps, prices, installation).
-- Safe to run more than once. Paste into Supabase > SQL editor > Run.
alter table wifi add column if not exists kind text not null default 'spot';       -- spot | share | reseller
alter table wifi add column if not exists ssid text;
alter table wifi add column if not exists password text;
alter table wifi add column if not exists lat double precision;
alter table wifi add column if not exists lng double precision;
alter table wifi add column if not exists accuracy_m integer;
alter table wifi add column if not exists business text;
alter table wifi add column if not exists tech text;
alter table wifi add column if not exists coverage text;
alter table wifi add column if not exists packages jsonb;                          -- [{name, mbps, price, period}]
alter table wifi add column if not exists install_fee integer;                     -- KSh, 0 = free installation
alter table wifi add column if not exists install_time text;
alter table wifi add column if not exists install_notes text;
alter table wifi add column if not exists contact_phone text;
create index if not exists wifi_kind_idx on wifi (kind, created_at desc);
