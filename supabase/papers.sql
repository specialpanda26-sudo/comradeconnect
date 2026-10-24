-- Section 3: Past papers and notes library. Safe to run again. Free: stores links only (Drive, Mega...), no file storage used.
create table if not exists papers (
  id uuid primary key default gen_random_uuid(),
  aid text not null,
  campus text not null default 'kirinyaga',
  kind text not null default 'Past paper',
  course_code text not null,
  course_name text,
  year integer not null,
  title text not null,
  link text not null,
  details text,
  likes integer not null default 0,
  hidden boolean not null default false,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists papers_campus on papers(campus, course_code, year desc);
alter table papers enable row level security;
create table if not exists paper_likes (
  paper_id uuid references papers(id) on delete cascade,
  aid text,
  primary key (paper_id, aid)
);
alter table paper_likes enable row level security;
