-- Hostel vacancies: caretakers post vacant rooms with an exact location, room photos and the services included.
-- Run once in Supabase > SQL Editor. Safe to run again.

-- A hostels row is now either a comrade's review (kind = 'review') or a caretaker's vacancy post (kind = 'vacancy').
alter table hostels add column if not exists kind text not null default 'review';
alter table hostels add column if not exists vacancies integer;            -- rooms free right now (vacancy posts only); 0 = full
alter table hostels add column if not exists room_types text;              -- e.g. Single, Bedsitter, Double
alter table hostels add column if not exists amenities text;               -- services included: Water, Wi-Fi, Security...
alter table hostels add column if not exists address text;                 -- landmark and directions in words
alter table hostels add column if not exists lat double precision;
alter table hostels add column if not exists lng double precision;
alter table hostels add column if not exists accuracy_m integer;
alter table hostels add column if not exists contact_phone text;           -- only shown to signed-in comrades
create index if not exists hostels_kind on hostels(kind, hidden, created_at desc);

-- Room photos reuse the media table.
alter table media add column if not exists hostel_id uuid;
alter table media drop constraint if exists media_kind_check;
alter table media add constraint media_kind_check check (kind in ('clip','listing_photo','video','hostel_photo'));
create index if not exists media_hostel on media(hostel_id);

-- Caretakers who have paid the registration fee (the admin sets the fee in Admin > Money settings; 0 = free).
create table if not exists caretakers (
  aid text primary key,
  amount integer not null default 0,
  payment_id uuid,
  created_at timestamptz not null default now()
);
alter table caretakers enable row level security;
