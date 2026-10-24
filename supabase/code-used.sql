-- Remember when an emailed code was used, so a second try says "already used". Safe to run again.
-- Run once in Supabase > SQL Editor. The API still works if you forget (it then deletes used codes like before).
alter table email_verifications add column if not exists used_at timestamptz;
alter table recovery_email_codes add column if not exists used_at timestamptz;
alter table password_resets add column if not exists used_at timestamptz;
