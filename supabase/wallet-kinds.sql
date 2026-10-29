-- Wallet ledger: ONE final list of allowed kinds. Older files each set a shorter list and the one run last won.
-- Run once in Supabase > SQL Editor. Safe to run again.
alter table wallet_ledger drop constraint if exists wallet_ledger_kind_check;
alter table wallet_ledger add constraint wallet_ledger_kind_check
  check (kind in ('sale','referral','withdrawal','refund','adjustment','topup','purchase','wholesale_fee','gift'));
