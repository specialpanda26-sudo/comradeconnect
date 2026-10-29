-- Run once in the Supabase SQL editor (safe to run again).
alter table profiles add column if not exists wholesaler_until timestamptz;
do $$ begin
  alter table wallet_ledger drop constraint if exists wallet_ledger_kind_check;
  alter table wallet_ledger add constraint wallet_ledger_kind_check
    check (kind in ('sale','referral','withdrawal','refund','adjustment','topup','purchase','wholesale_fee','gift'));
exception when others then null; end $$;
