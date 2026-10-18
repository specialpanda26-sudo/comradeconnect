-- Run against an already-deployed database to add buyer-side event reviews.

CREATE TABLE IF NOT EXISTS event_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) UNIQUE,
  buyer_phone TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

alter table event_reviews enable row level security;

drop policy if exists "Reviews are publicly readable" on event_reviews;
create policy "Reviews are publicly readable"
  on event_reviews for select
  to anon, authenticated
  using (true);
