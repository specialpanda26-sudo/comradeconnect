-- Mtaa Vibes — sample data (Section 8 of the build prompt)
-- Run after schema.sql. Replace 'YOUR_ORGANIZER_ID' with a real auth.users id
-- (create a test organizer account first, then copy their UUID from Supabase Auth).
-- Poster images are omitted — use CSS gradients as placeholders in the UI for MVP.

DO $$
DECLARE
  organizer UUID := 'YOUR_ORGANIZER_ID';
  eid UUID;
BEGIN
  -- 1. Nairobi Fashion Week 2026
  INSERT INTO events (organizer_id, title, category, venue, event_date, status, organizer_mpesa_number)
  VALUES (organizer, 'Nairobi Fashion Week 2026', 'fashion', 'KICC Grounds', '2026-08-15 19:00', 'live', '0700000001')
  RETURNING id INTO eid;
  INSERT INTO event_tiers (event_id, tier_name, price) VALUES (eid,'general',1500),(eid,'vip',3500),(eid,'premium',6000);
  INSERT INTO bulk_discounts (event_id, min_quantity, discount_percent, label) VALUES (eid,5,15,'Squad (5)'),(eid,10,25,'Crew (10)');

  -- 2. Campus Style Battle — UoN
  INSERT INTO events (organizer_id, title, category, venue, event_date, status, organizer_mpesa_number)
  VALUES (organizer, 'Campus Style Battle — UoN', 'dressing', 'UoN Graduation Square', '2026-08-18 18:00', 'live', '0700000001')
  RETURNING id INTO eid;
  INSERT INTO event_tiers (event_id, tier_name, price) VALUES (eid,'general',500),(eid,'vip',1200),(eid,'premium',2500);
  INSERT INTO bulk_discounts (event_id, min_quantity, discount_percent, label) VALUES (eid,5,10,'Squad (5)');

  -- 3. Mombasa Summer Rave
  INSERT INTO events (organizer_id, title, category, venue, event_date, status, organizer_mpesa_number)
  VALUES (organizer, 'Mombasa Summer Rave', 'club', 'Mombasa Beach Hotel', '2026-08-20 22:00', 'live', '0700000001')
  RETURNING id INTO eid;
  INSERT INTO event_tiers (event_id, tier_name, price) VALUES (eid,'general',2000),(eid,'vip',4500),(eid,'premium',8000);
  INSERT INTO bulk_discounts (event_id, min_quantity, discount_percent, label) VALUES (eid,4,20,'Table (4)'),(eid,8,30,'Booth (8)');

  -- 4. Kitenge & Culture Expo
  INSERT INTO events (organizer_id, title, category, venue, event_date, status, organizer_mpesa_number)
  VALUES (organizer, 'Kitenge & Culture Expo', 'fashion', 'Nairobi National Museum', '2026-08-22 12:00', 'live', '0700000001')
  RETURNING id INTO eid;
  INSERT INTO event_tiers (event_id, tier_name, price) VALUES (eid,'general',800),(eid,'vip',1800),(eid,'premium',3200);
  INSERT INTO bulk_discounts (event_id, min_quantity, discount_percent, label) VALUES (eid,5,12,'Family (5)');

  -- 5. Strathmore Freshers Night
  INSERT INTO events (organizer_id, title, category, venue, event_date, status, organizer_mpesa_number)
  VALUES (organizer, 'Strathmore Freshers Night', 'campus', 'Strathmore Auditorium', '2026-08-25 20:00', 'live', '0700000001')
  RETURNING id INTO eid;
  INSERT INTO event_tiers (event_id, tier_name, price) VALUES (eid,'general',400),(eid,'vip',900),(eid,'premium',1500);
  INSERT INTO bulk_discounts (event_id, min_quantity, discount_percent, label) VALUES (eid,5,10,'Squad (5)');

  -- 6. Kisumu Street Style Show
  INSERT INTO events (organizer_id, title, category, venue, event_date, status, organizer_mpesa_number)
  VALUES (organizer, 'Kisumu Street Style Show', 'dressing', 'Kisumu Mega City', '2026-08-28 17:00', 'live', '0700000001')
  RETURNING id INTO eid;
  INSERT INTO event_tiers (event_id, tier_name, price) VALUES (eid,'general',600),(eid,'vip',1400),(eid,'premium',2500);
  INSERT INTO bulk_discounts (event_id, min_quantity, discount_percent, label) VALUES (eid,5,10,'Squad (5)');

  -- 7. Amapiano Dance Off
  INSERT INTO events (organizer_id, title, category, venue, event_date, status, organizer_mpesa_number)
  VALUES (organizer, 'Amapiano Dance Off', 'dance', 'GoDown Arts Centre', '2026-08-30 18:00', 'live', '0700000001')
  RETURNING id INTO eid;
  INSERT INTO event_tiers (event_id, tier_name, price) VALUES (eid,'general',500),(eid,'vip',1100),(eid,'premium',2000);
  INSERT INTO bulk_discounts (event_id, min_quantity, discount_percent, label) VALUES (eid,5,12,'Squad (5)');

  -- 8. Tribal Art & Beats Festival
  INSERT INTO events (organizer_id, title, category, venue, event_date, status, organizer_mpesa_number)
  VALUES (organizer, 'Tribal Art & Beats Festival', 'art', 'GoDown Arts Centre', '2026-09-02 16:00', 'live', '0700000001')
  RETURNING id INTO eid;
  INSERT INTO event_tiers (event_id, tier_name, price) VALUES (eid,'general',1000),(eid,'vip',2200),(eid,'premium',4000);
  INSERT INTO bulk_discounts (event_id, min_quantity, discount_percent, label) VALUES (eid,5,15,'Squad (5)');

  -- 9. KU End-Month Bash
  INSERT INTO events (organizer_id, title, category, venue, event_date, status, organizer_mpesa_number)
  VALUES (organizer, 'KU End-Month Bash', 'campus', 'Kenyatta University', '2026-09-05 21:00', 'live', '0700000001')
  RETURNING id INTO eid;
  INSERT INTO event_tiers (event_id, tier_name, price) VALUES (eid,'general',350),(eid,'vip',800),(eid,'premium',1400);
  INSERT INTO bulk_discounts (event_id, min_quantity, discount_percent, label) VALUES (eid,5,8,'Squad (5)');

  -- 10. Nairobi Jazz & Vibes Night
  INSERT INTO events (organizer_id, title, category, venue, event_date, status, organizer_mpesa_number)
  VALUES (organizer, 'Nairobi Jazz & Vibes Night', 'club', 'Carnivore Grounds', '2026-09-08 20:00', 'live', '0700000001')
  RETURNING id INTO eid;
  INSERT INTO event_tiers (event_id, tier_name, price) VALUES (eid,'general',2500),(eid,'vip',5500),(eid,'premium',10000);
  INSERT INTO bulk_discounts (event_id, min_quantity, discount_percent, label) VALUES (eid,4,20,'Table (4)');

  -- 11. Eldoret Runway Challenge
  INSERT INTO events (organizer_id, title, category, venue, event_date, status, organizer_mpesa_number)
  VALUES (organizer, 'Eldoret Runway Challenge', 'dressing', 'Eldoret Sports Club', '2026-09-12 15:00', 'live', '0700000001')
  RETURNING id INTO eid;
  INSERT INTO event_tiers (event_id, tier_name, price) VALUES (eid,'general',700),(eid,'vip',1600),(eid,'premium',2800);
  INSERT INTO bulk_discounts (event_id, min_quantity, discount_percent, label) VALUES (eid,5,10,'Squad (5)');
END $$;
