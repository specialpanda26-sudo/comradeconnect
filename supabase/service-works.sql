-- Section 2: "My work" photos and videos on Services. Safe to run again. Free: same Supabase Storage bucket you already use.
alter table media add column if not exists service_id uuid;
create index if not exists media_service on media(service_id);
alter table media drop constraint if exists media_kind_check;
alter table media add constraint media_kind_check check (kind in ('clip','listing_photo','video','hostel_photo','story_photo','story_video','service_photo','service_video'));
