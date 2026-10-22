-- Section 2: stories (24 hours) and comments on clips and reels. Safe to run again.

-- Stories are stored as media rows; allow the two new kinds.
alter table media drop constraint if exists media_kind_check;
alter table media add constraint media_kind_check check (kind in ('clip','listing_photo','video','hostel_photo','story_photo','story_video'));

create table if not exists story_views (
  media_id uuid references media(id) on delete cascade,
  viewer_aid text,
  created_at timestamptz not null default now(),
  primary key (media_id, viewer_aid)
);
alter table story_views enable row level security;

create table if not exists media_comments (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references media(id) on delete cascade,
  aid text not null,
  text text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists media_comments_media on media_comments(media_id, created_at);
alter table media_comments enable row level security;
