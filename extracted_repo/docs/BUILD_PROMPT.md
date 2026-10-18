# MTAA VIBES — COMPLETE BUILD PROMPT FOR AI CODING ASSISTANT

Build a complete Next.js 14 (App Router) event ticketing platform called **"Mtaa Vibes"** targeted at Kenyan youth for fashion shows, dressing competitions, dance events, campus nights, and club events. The entire app must feel **young, premium, and full of energy** — not corporate.

---

## 1. TECH STACK (All Free)

- **Framework:** Next.js 14 with App Router (`/app` directory)
- **Styling:** Tailwind CSS v3
- **Database & Auth:** Supabase (PostgreSQL + Auth)
- **Storage:** Supabase Storage (event posters, ID uploads)
- **Payments:** IntaSend Collection API (M-Pesa STK push via IntaSend, not raw Daraja). Payment UI/branding shown to users is **"Ogolla"** / **"Ogolla Pay"** — IntaSend is the backend processor, never shown by name in the UI.
- **Hosting:** Vercel
- **Icons:** Inline SVG only (no icon libraries)
- **QR Codes:** `qrcode.react` npm package
- **Screenshot/Download:** `html2canvas` npm package
- **Animations:** CSS keyframes + Framer Motion where needed

**No external CSS frameworks. No Bootstrap. No Material UI.**

**Branding requirement:** Every page must show **"Powered by Ogolla Tech"** somewhere (site footer + bottom nav area on mobile). Anywhere the app references who is processing payments, use **"Ogolla"** / **"Ogolla Pay"** — never surface the name "IntaSend" in any user-facing copy, button, or receipt. The buyer-facing payment method itself stays labeled "M-Pesa" (since that's what they're actually paying with), but the platform/processor identity around it is Ogolla.

---

## 2. DESIGN SYSTEM — "LIQUID GLASS" AESTHETIC

This is the most important section. The entire app must follow this visual language:

### Colors
- **Page background:** Light gradient `linear-gradient(160deg, #f8f9fa 0%, #e9ecef 40%, #dee2e6 100%)`
- **Card backgrounds:** Semi-transparent white `rgba(255,255,255,0.72)` with `backdrop-filter: blur(16px)`
- **Borders:** Subtle white `rgba(255,255,255,0.6)` — 1px
- **Shadows:** Soft only — `0 8px 28px rgba(0,0,0,0.06)` to `0 16px 48px rgba(0,0,0,0.12)`. NO heavy shadows.
- **Text primary:** `#111` (near black)
- **Text secondary:** `#666`
- **Text tertiary:** `#999`
- **Accent red (discounts):** `#dc2626` with 10% tint background
- **Accent green (success):** `#16a34a`
- **NO blue as primary action color.** Black buttons, white text.

### Typography
- Font: System sans-serif / Inter fallback
- Weights: **400 and 500 ONLY.** No 600, no 700.
- Sizes: 11px badges → 13px body → 16px titles → 20px prices → 26px logo
- Letter-spacing: `-0.3px` on large text, `0` or positive on small text
- **Sentence case everywhere.** No ALL CAPS. No Title Case.

### Spacing & Shape
- Card border-radius: **20px**
- Button border-radius: **14px**
- Input border-radius: **12px–16px**
- Chip/pill border-radius: **24px**
- Gap between cards: **16px**
- Page padding: **16px horizontal, 20px top**

### Animations (CSS Keyframes)
Add these to `globals.css`:

```css
@keyframes floatUp {
  from { opacity: 0; transform: translateY(40px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes pulseRing {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0,0,0,0.08); }
  50% { box-shadow: 0 0 0 6px rgba(0,0,0,0); }
}
@keyframes floatBrand {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-12px) rotate(2deg); }
}
@keyframes shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes tabUnderline {
  from { transform: scaleX(0.6); opacity: 0.4; }
  to { transform: scaleX(1); opacity: 1; }
}
@keyframes successPop {
  0% { transform: scale(0.6); opacity: 0; }
  60% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); }
}
@keyframes fadeSlide {
  from { opacity: 0; transform: translateX(8px); }
  to { opacity: 1; transform: translateX(0); }
}
```

- Cards animate in with `floatUp`, staggered by `0.07s` each.
- Hover on cards: `translateY(-6px) scale(1.015)` + shadow increase. Transition: `0.4s cubic-bezier(0.34, 1.56, 0.64, 1)`
- Hover on buttons: `scale(1.05)` + shadow increase.
- Active/press: `scale(0.97)`
- Loading states (event list, ticket list, dashboard stats while fetching): skeleton blocks using the `shimmer` keyframe over a light gray gradient — never a blank white flash.
- Tab switch: content fades/slides in with `fadeSlide` (0.2s), active tab indicator glides with `tabUnderline` (0.25s) rather than snapping.
- Payment success (ticket page, dashboard payout confirmation): a single `successPop` on the checkmark/badge — no confetti, no extra flourish. Keep it to one clear motion per event so it reads as premium, not like a student UI project.

---

### Tabs (used for category filters, ticket views, guest-list filters)

Tabs are the primary way to switch between filtered views throughout the app — not just the event category filter, but also the buyer's ticket history and the organizer's guest list.

**Horizontal tabs (default, mobile-first):**
- Single row, `overflow-x: auto`, no visible scrollbar (`scrollbar-width: none` / `::-webkit-scrollbar { display: none }`)
- Each tab: glass bg pill, 13px, weight 500, rounded 24px, padding 8px 16px
- Active tab: black bg, white text, scaled 1.05, with a thin `tabUnderline`-animated indicator bar beneath it
- Inactive: gray text, no border
- Snap-scroll (`scroll-snap-type: x proximity`) so tabs land cleanly when swiped
- Sticky under the top bar when the section scrolls (`position: sticky; top: [topbar height]`)

**Vertical tabs (desktop ≥1024px, optional rail):**
- On wide viewports, the same tab set can render as a vertical rail on the left (e.g., of the event feed or My Tickets page) instead of a horizontal strip — `overflow-y: auto`, same active/inactive styling rotated to a column, connected indicator bar on the left edge of the active item instead of underneath
- This is a responsive swap of the same component/data, not a separate feature — one `TabBar` component with an `orientation="horizontal" | "vertical"` prop

**Where tabs are used:**
1. Event feed category filter (Page B) — "All events / Fashion / Dressing Comp / Dance / Campus / Club Night / Art & Culture"
2. My Tickets page (Page I, new — see below) — "Upcoming / Past / All"
3. Organizer Guest List modal (Page G) — "All / Paid / Used" status filter, replacing plain filter buttons

---

## 3. FLOATING BRAND MARKS (BACKGROUND TEXTURE)

On the landing page and event feed, create a background layer with large floating text marks:

- Text content (scattered): **"MTAA"**, **"VIBES"**, **"DANCE"**, **"STYLE"**, **"HYPE"**, **"KENYA"**, **"FASHION"**, **"YOUTH"**, **"TURNUP"**
- Style: `font-size: 48px–64px`, `font-weight: 700`, `opacity: 0.04`, `color: #111`
- Position: `absolute`, scattered across the viewport
- Animation: `floatBrand 6s ease-in-out infinite` with different `animation-delay` per element (0s, 1.2s, 2.4s, etc.)
- `pointer-events: none`, `user-select: none`, `z-index: 0`
- This creates a subtle texture behind the glass cards — energetic street/youth-culture feel, not locked to one scene (fashion, dance, campus, club all belong here).

---

## 4. DATABASE SCHEMA (SUPABASE)

Create these tables in Supabase:

```sql
-- Events
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organizer_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('fashion','dressing','dance','campus','club','art','other')),
  venue TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  poster_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','live','paused','ended')),
  commission_rate DECIMAL DEFAULT 0.10,
  organizer_mpesa_number TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tier pricing per event
CREATE TABLE event_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL CHECK (tier_name IN ('general','vip','premium')),
  price INTEGER NOT NULL,
  description TEXT,
  perks TEXT[]
);

-- Bulk discounts per event
CREATE TABLE bulk_discounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL,
  discount_percent DECIMAL NOT NULL,
  label TEXT
);

-- Tickets purchased
CREATE TABLE tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  tier_id UUID REFERENCES event_tiers(id),
  buyer_phone TEXT NOT NULL,
  buyer_name TEXT,
  quantity INTEGER DEFAULT 1,
  discount_applied DECIMAL DEFAULT 0,
  transaction_id TEXT UNIQUE,
  amount_paid INTEGER NOT NULL,
  commission_paid INTEGER NOT NULL,
  organizer_paid INTEGER NOT NULL,
  qr_code TEXT UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid','used','refunded')),
  paid_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizer verification
CREATE TABLE organizer_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organizer_id UUID REFERENCES auth.users(id),
  id_front_url TEXT,
  id_back_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payouts to organizers
CREATE TABLE payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  organizer_id UUID REFERENCES auth.users(id),
  amount INTEGER NOT NULL,
  mpesa_receipt TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referrals: 100 points credited to the referrer for every friend who buys using their link/code
-- (REFERRAL_POINTS_PER_SIGNUP — tune this one constant in /lib/constants.js before launch)
CREATE TABLE referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_phone TEXT NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  referred_phone TEXT,
  referred_ticket_id UUID REFERENCES tickets(id),
  points_awarded INTEGER DEFAULT 100,
  reward_status TEXT DEFAULT 'pending' CHECK (reward_status IN ('pending','earned')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Points ledger: running history of earns (referrals) and redemptions (used at checkout).
-- Balance for a phone number = SUM(amount) WHERE type='earn' - SUM(amount) WHERE type='redeem'
CREATE TABLE points_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  type TEXT CHECK (type IN ('earn','redeem')),
  amount INTEGER NOT NULL,
  reason TEXT, -- e.g. 'referral_signup', 'redeemed_at_checkout'
  referral_id UUID REFERENCES referrals(id),
  ticket_id UUID REFERENCES tickets(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. PAGES TO BUILD

### PAGE A: LANDING PAGE (`/app/page.js`)

**Background:** The gradient + floating brand marks described in Section 3.

**Hero Section (glass card):**
- Top bar: Logo "mtaa vibes" (left, 26px, weight 500, gradient text black→gray) + "beta" pill badge (right, black bg, white text, 11px)
- Headline: "Kenyan events, zero stress" — 22px, weight 500
- Subtext: "Fashion shows, dressing competitions, dance events, campus nights & club events. Pay with M-Pesa. Get instant QR tickets." — 14px, text-secondary
- Two CTAs: "Browse events" (black button) + "Sell tickets" (outline button)

**Marquee:** Horizontal infinite scroll of category names: "Fashion · Dressing Comp · Dance · Campus Night · Club Night · Art & Culture · Vibes · Kenya" — 14px, text-tertiary, scrolling continuously.

**Feature Cards (3 cards in a row on desktop, stacked on mobile):**
Each is a glass card with:
1. **M-Pesa checkout** — inline SVG icon + "Pay with M-Pesa. STK push to your phone. No stress."
2. **QR tickets, no fakes** — inline SVG icon + "Unique QR per ticket. Scan at the door. Screenshots don't work."
3. **Real-time sales dashboard** — inline SVG icon + "See your ticket sales live. Know exactly how much you've made."

**How It Works:**
3 steps with numbers in circles:
1. Create your event → 2. Share your link → 3. Get paid via M-Pesa

**Footer:** Simple links: Events · Sell tickets · About · Contact — plus a centered line below: "Powered by Ogolla Tech" (12px, text-tertiary).

---

### PAGE B: EVENT FEED (`/app/events/page.js`)

**Layout:**
1. **Search bar** — glass effect, rounded 16px, magnifying glass SVG icon left, placeholder "Search events, venues, artists..."
2. **Category tabs** — the `TabBar` component (horizontal, scrollable) described in Section 2: "All events", "Fashion", "Dressing Comp", "Dance", "Campus", "Club Night", "Art & Culture". Active tab: black bg, white text, slightly scaled (1.05), animated underline. Inactive: glass bg, gray text. `cursor: pointer`. On desktop (≥1024px) this can render as the vertical rail variant instead.
3. **Section title:** "Upcoming drops" left, event count right (e.g., "10 events") — 17px weight 500.
4. **Event cards** — vertical stack, full width.

**Event Card Structure (each card is glassmorphic, 20px radius):**

**Top half — Image area (160px height):**
- Background: CSS linear-gradient (use vibrant dark gradients as placeholders: e.g., `linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)`)
- Overlay: `linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)`
- **Live dot:** Top-left. Small red circle (`#ff4444`) with `pulseRing` animation. Text: "Live now" in white, 11px, weight 500, inside a glass pill (`rgba(0,0,0,0.5)` + `backdrop-filter: blur(8px)`)
- **Badge:** Top-right. Glass pill with event status: "Selling fast", "Hot 🔥", "Limited", "New", "Sold out", "Trending", "VIP only". White bg, black text, 11px.
- **Title overlay:** Bottom-left. Event title in white, 17px, weight 500, `text-shadow: 0 2px 8px rgba(0,0,0,0.4)`. Below it: venue + date in `rgba(255,255,255,0.85)`, 12px.
- **Hover effect:** The gradient image scales to 1.08 over 0.6s.

**Bottom half — Card body (padding 14px 16px 16px):**

**Tier buttons row:**
- Three buttons side by side: "General", "VIP", "Premium"
- Each shows tier name (11px, gray) and price (14px, black)
- Default: glass bg, gray border. 
- Selected/hover: black bg, white text. Transition 0.2s.
- These are **display-only** on the card (show the prices). The actual selection happens in the purchase sheet.

**Price row:**
- Left stack:
  - Old price: struck through, 13px, text-tertiary. E.g., "Was KSh 2,000"
  - New price: 20px, weight 500, black. E.g., "KSh 1,500"
  - Discount tag: red text (`#dc2626`), red-tinted bg (10% opacity), 11px, rounded 6px. E.g., "Save 25% today"
- Right: "Get ticket" button — black bg, white text, 14px, weight 500, rounded 14px, padding 10px 22px. Shadow on hover.

**Bulk booking row (if event has bulk discounts):**
- Label "Bulk:" in text-tertiary, 12px
- Chips: e.g., "Squad (5) -15%", "Crew (10) -25%", "Table (4) -20%"
- Chip style: `rgba(0,0,0,0.04)` bg, rounded 10px, 12px, weight 500, text-secondary.
- Hover: black bg, white text.
- Clicking a bulk chip opens the purchase sheet **pre-filled** with that quantity and discount applied.

**Card entrance animation:** `floatUp` with staggered delay (index * 0.07s).

**Filtering:**
- Search filters by event title and venue (real-time as user types)
- Category chips filter by event category
- Show "No events found. Try another search." when empty.

---

### PAGE C: PURCHASE BOTTOM SHEET (Component, not a page)

This is a **bottom sheet** (slides up from bottom), NOT a center modal.

**Trigger:** Clicking "Get ticket" or a bulk chip on an event card.

**Sheet structure:**
- Container: `position: fixed`, bottom 0, full width, max-width 480px centered, `max-height: 85vh`, `overflow-y: auto`
- Background: `rgba(255,255,255,0.9)` with `backdrop-filter: blur(30px)`
- Top border-radius: **28px** on top corners only
- Top edge: A "perforated ticket" design — use pseudo-elements with circular cutouts or a dashed border.

**Header:**
- Left: Event title (20px, weight 500)
- Right: Close button (×) — 32px circle, glass bg, gray text.

**Event preview image:**
- 140px height, full width, rounded 16px, same gradient as the event card.

**Tier selection:**
- Label: "Select ticket tier" — 14px, weight 500
- Three option cards side by side:
  - General: name, price, description "Standard entry"
  - VIP: name, price, description "Priority queue + drink"
  - Premium: name, price, description "All-access + backstage"
- Default selected: General
- Selected state: black bg, white text, black border
- Unselected: glass bg, gray border
- Clicking updates the total price instantly.

**Quantity stepper:**
- Label left: "Number of tickets" (14px, weight 500) + subtitle showing selected tier name (12px, gray)
- Right: Minus button (—) → quantity number (18px, weight 500) → Plus button (+)
- Buttons: 36px square, rounded 12px, glass bg, black border, 18px text.
- Min: 1, Max: 20
- Changing quantity updates total instantly.

**Total row:**
- "Total" left (15px, weight 500)
- Price right (24px, weight 500)
- If bulk discount applies, show the discount in the subtitle.

**Points redemption (only shown if the buyer's phone has a points balance):**
- A single glass row above the pay button: checkbox/toggle + "Use my points" on the left, "[balance] pts ≈ KSh [value] off" on the right
- Toggling it recalculates the total (capped so points can't take the price below KSh 0) and, if the payment succeeds, logs a `redeem` entry in `points_ledger` for that amount
- Not shown for first-time buyers with no points yet — don't clutter the sheet with an empty state here

**Pay button:**
- Full width, black bg, white text, 16px, weight 500, rounded 16px, padding 16px
- Text: "Pay KSh [amount] with M-Pesa"
- Small subtext below button, centered, 11px, text-tertiary: "Secured by Ogolla Pay"
- Shadow: `0 6px 24px rgba(0,0,0,0.15)`
- Hover: `translateY(-2px)`, larger shadow.
- **On click:**
  1. Button text changes to green checkmark + "STK push sent!"
  2. Button bg changes to green (`#16a34a`)
  3. After 2 seconds, sheet closes, button resets.
  4. (In real app, this calls the IntaSend collection API, which triggers the actual M-Pesa STK push to the buyer's phone)

**State management:**
- `selectedTier`: 'general' | 'vip' | 'premium'
- `quantity`: number (1-20)
- `currentEvent`: the event object
- `totalPrice`: calculated from tier price × quantity × (1 - discount)

---

### PAGE D: PAYMENT API ROUTES (IntaSend, branded as "Ogolla Pay")

Payments run through **IntaSend's Collection API** (M-Pesa STK push), not a direct Safaricom Daraja integration. This avoids needing your own paybill/till approval — IntaSend handles the Daraja relationship, settlement, and payouts to your IntaSend wallet. None of this should be visible to the user; all user-facing copy says "Ogolla" / "Ogolla Pay", never "IntaSend".

Create these API routes in `/app/api/`:

**`/api/pay/stkpush/route.js`**
- POST endpoint
- Receives: `amount`, `phoneNumber`, `eventId`, `tierId`, `quantity`, `referralCode` (optional, read from the `?ref=CODE` query param on the event/checkout page), `pointsRedeemed` (optional, 0 if the buyer didn't toggle "Use my points")
- Steps:
  1. If `pointsRedeemed > 0`, subtract its KSh value (via `POINTS_TO_KSH_RATE`) from `amount` before calling IntaSend — never trust a client-sent discounted total without recalculating server-side.
  2. POST to `https://sandbox.intasend.com/api/v1/payment/collection/` (use `https://payment.intasend.com/...` in production) with:
     - Header: `Authorization: Bearer ${INTASEND_SECRET_KEY}`
     - Body: `public_key` (your IntaSend publishable key), `amount`, `phone_number` (buyer phone, format 2547XXXXXXXX), `currency`: "KES", `api_ref`: a unique reference you generate (e.g. `MTAAVIBES-${eventId}-${Date.now()}`), `method`: "M-PESA"
  3. IntaSend returns an `invoice` object with `invoice_id` and `state: "PENDING"`. Store this `invoice_id` alongside a `pending` ticket row (or a temp `pending_payments` record) keyed by `api_ref`, including `eventId`/`tierId`/`quantity`/buyer info/`referralCode`/`pointsRedeemed` so the webhook can complete the picture.
  4. Return the `invoice_id` to the frontend so it can poll status if needed.

**`/api/pay/webhook/route.js`**
- POST endpoint — configure this URL in your IntaSend dashboard as the webhook/callback URL.
- Receives IntaSend's payment event payload containing the `invoice` object (`invoice_id`, `state`, `api_ref`, `value`, `provider`, etc.)
- Verify the request is genuinely from IntaSend per their webhook verification docs before trusting it.
- If `state === "COMPLETE"`:
  1. Look up the pending record by `api_ref` / `invoice_id` to recover `eventId`, `tierId`, `quantity`, buyer phone/name, `referralCode`, `pointsRedeemed`.
  2. Insert into `tickets` table: `event_id`, `tier_id`, `buyer_phone`, `quantity`, `amount_paid`, `commission_paid` (10%), `organizer_paid` (90%), `transaction_id` (the IntaSend `invoice_id`), `qr_code` (generate UUID), `status`: 'paid', `paid_at`: NOW()
  3. Update `events` table: increment `sold_tickets` by quantity
  4. Insert into `payouts` table: `event_id`, `organizer_id`, `amount` = organizer_paid, `status`: 'pending'
  5. If `pointsRedeemed > 0`: insert a `redeem` row into `points_ledger` for that phone (`reason`: 'redeemed_at_checkout', `ticket_id`: the new ticket's id)
  6. If `referralCode` was present: look up the matching `referrals` row, set `referred_phone`/`referred_ticket_id`/`reward_status: 'earned'`, and insert an `earn` row into `points_ledger` (100 points, `reason`: 'referral_signup') for the **referrer's** phone — not the buyer's
- If `state === "FAILED"`: Log failure. Do not insert ticket, do not touch points.
- Return a 200 response promptly so IntaSend doesn't retry unnecessarily.

**`/api/pay/status/route.js`** (optional, for the frontend to poll while waiting on the STK prompt)
- POST to `https://sandbox.intasend.com/api/v1/payment/status/` with `invoice_id` to check current `state` if the webhook hasn't landed yet.

**Environment variables needed:**
- `INTASEND_SECRET_KEY` (server-side only, never exposed to the client)
- `INTASEND_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Note: verify exact field names/endpoints against IntaSend's current docs (developers.intasend.com) before implementing — payment APIs evolve and this is a spec, not a guarantee of the live contract.

---

### PAGE E: QR TICKET PAGE (`/app/ticket/[id]/page.js`)

This is the digital ticket the buyer sees after purchase.

**Design:**
- Full page, centered ticket card
- Ticket card: glassmorphic, rounded 20px, max-width 380px
- **Perforated top edge:** Use CSS pseudo-elements (`::before`, `::after`) with circular cutouts or a dashed line to look like a real torn ticket.
- **QR Code:** Large, centered. Use `qrcode.react` to generate from the ticket UUID. Size: 180×180px.
- **Event details below QR:**
  - Event title: 18px, weight 500
  - Date + venue: 13px, gray
  - Tier type: "General Admission" / "VIP" / "Premium"
  - Price paid: 16px, weight 500
  - Transaction ID: monospace font, 12px, gray
  - Green badge: "Paid via M-Pesa" with checkmark SVG icon
  - Small footer line on the ticket card: "Powered by Ogolla Tech" (10px, text-tertiary)
- **Download button:** "Download ticket" — black button. On click, use `html2canvas` to capture the ticket card DOM and trigger a PNG download.
- **Share button:** "Share to WhatsApp" — generates a WhatsApp share link with the ticket URL.

---

### PAGE F: QR SCANNER / VALIDATION (`/app/scan/page.js`)

For organizers to validate tickets at the door.

**Design:**
- Simple page with large input field: "Enter QR code or scan"
- For MVP: use a text input where the organizer types/pastes the QR code string. (Later: integrate camera QR scanner)
- "Validate" button: black bg.
- **Validation logic:**
  1. Query Supabase `tickets` table where `qr_code = input`
  2. If NOT FOUND → Show big red "FAKE TICKET" with X icon
  3. If FOUND and `status = 'paid'` → Show big green "VALID — Let them in" with checkmark. Update ticket `status` to 'used', set `used_at = NOW()`.
  4. If FOUND and `status = 'used'` → Show yellow/orange "ALREADY SCANNED" with warning icon. Show `used_at` timestamp.
  5. If FOUND and `status = 'pending'` → Show "PAYMENT PENDING"
- Display ticket details: buyer name, event title, tier, quantity.

---

### PAGE G: ORGANIZER DASHBOARD (`/app/dashboard/page.js`)

**Protected route:** Only logged-in users. Use Supabase Auth middleware.

**Before first event — Verification gate:**
- If `organizer_verifications` status is NOT 'approved', show:
  - "Verify your account to start selling tickets"
  - Upload fields: ID front (image), ID back (image)
  - Upload to Supabase Storage, save URLs to `organizer_verifications` table
  - Status badge: "Pending review"

**Dashboard sections:**

**1. Stats cards (top row, 3 glass cards):**
- Total events created
- Total tickets sold (all events)
- Total earnings (sum of organizer_paid from payouts)

**2. "Create Event" button** → opens a form modal/sheet.

**3. Create Event Form:**
- Title (text input)
- Description (textarea)
- Category (dropdown: Fashion, Dressing Comp, Dance, Campus, Club Night, Art & Culture, Other)
- Venue (text input)
- Event date & time (datetime-local input)
- Poster image upload (file input → Supabase Storage)
- **Tier pricing section:**
  - General: price input (KSh)
  - VIP: price input (KSh) + perks text input
  - Premium: price input (KSh) + perks text input
- **Bulk discounts section:**
  - Dynamic list: "Add bulk tier" button
  - Each tier: quantity input, discount % input, label input (e.g., "Squad (5)")
  - Can add/remove tiers
- Organizer M-Pesa number (text input)
- Submit button: "Publish event"
- On submit: insert into `events`, `event_tiers`, `bulk_discounts` tables. Status = 'live'.

**4. My Events list:**
- Each event as a glass card with:
  - Poster thumbnail + title + date
  - Status badge: draft / live / paused / ended
  - Sales summary: "87/200 sold" + revenue KSh X + commission KSh Y + net KSh Z
  - Action buttons: "Guest list", "Scan tickets", "Edit", "Pause/End"

**5. Guest List modal:**
- Table: Buyer name, phone, tier, quantity, status (paid/used), purchase date
- Filter by tier or status using the horizontal `TabBar` component ("All / Paid / Used") instead of plain filter buttons
- Search by phone number

**6. Fraud prevention in descriptions:**
- Before saving event description, scan text with regex for Kenyan phone numbers: `/^(\+?254|0)?[71]\d{8}$/` and `/(\+?254|0)?[71]\d{8}/g`
- If found, block submission and show error: "Phone numbers are not allowed in descriptions. All payments go through Mtaa Vibes."

---

### PAGE H: AUTHENTICATION

Use Supabase Auth.

**Sign up / Sign in pages:**
- Clean glassmorphic cards, centered
- Options: Email + password, OR Phone number + OTP (perfect for Kenya)
- After sign-up, redirect to dashboard (if organizer) or events feed (if buyer)
- Buyer doesn't need to sign in to browse events, but needs phone number to buy.

---

### PAGE I: MY TICKETS (`/app/my-tickets/page.js`)

For buyers to see everything they've bought, without needing an organizer account.

**Access:** Buyer identifies by phone number (OTP or a saved session) — same phone used at checkout pulls up their tickets.

**Layout:**
- Top: `TabBar` — "Upcoming / Past / All" (horizontal, scrollable, sticky under the top bar)
- Below: vertical scrolling list of the buyer's tickets, most recent first. Each row is a compact version of the `TicketQR` card (thumbnail-sized event image, title, date, tier, status badge) — tapping opens the full ticket page (Page E).
- Empty state ("No tickets yet"): friendly copy + "Browse events" button.

**Referral section (bottom of the scroll, below the ticket list):**
- A `ReferralCard`: shows the buyer's current **points balance**, their personal referral link/code, a "Share to WhatsApp" button, and how many friends they've referred so far.
- Copy: "Earn 100 points for every friend who buys a ticket with your link." Points balance is the running total from `points_ledger` (earn minus redeem) for that phone number.
- This sits *after* the ticket list on purpose — it rewards people who scroll through their tickets rather than fighting for attention at the top.
- Points are redeemable at checkout (see Page C) — 2 points = KSh 1 off (i.e. 100 points ≈ KSh 50). This rate lives in one place (`POINTS_TO_KSH_RATE` in `/lib/constants.js`) so it's easy to tune before launch.

---

Build these as reusable components in `/components/`:

1. **GlassCard** — Wrapper with glassmorphism styles (blur, white bg, border, radius, shadow)
2. **EventCard** — The full event card with image, tiers, price, bulk chips
3. **CategoryChip** — The pill button for categories (used inside TabBar)
4. **TabBar** — Reusable scrollable tab strip (horizontal on mobile, vertical rail on desktop ≥1024px). Props: `tabs`, `activeTab`, `onChange`, `orientation`. Used on the event feed, My Tickets page, and Guest List modal.
5. **PurchaseSheet** — The bottom sheet modal for buying tickets
6. **TicketQR** — The QR ticket display component
7. **LiveDot** — The pulsing red dot with "Live now" text
8. **PriceDisplay** — Old price + new price + discount tag
9. **FloatingBrands** — The background brand marks layer
10. **SearchBar** — Glass search input with icon
11. **MpesButton** — The black pay button with loading/success states, labeled "Pay with M-Pesa" / "Secured by Ogolla Pay"
12. **ReferralCard** — Glass card showing the buyer's referral code/link + share button, used at the bottom of the My Tickets page

---

## 7. NAVIGATION & LAYOUT

**Bottom navigation bar (mobile-first, fixed bottom):**
- 4 icons with labels:
  - 🏠 Home (landing)
  - 🔍 Events (feed)
  - 🎫 My tickets (if logged in) → Page I, `/app/my-tickets`
  - 👤 Profile / Dashboard
- Glassmorphic: `rgba(255,255,255,0.85)` + `backdrop-filter: blur(20px)` + top border
- Active tab: black icon/text. Inactive: gray.

**Top bar (on scroll):**
- When user scrolls down on event feed, a compact glass top bar appears with logo + search icon.

---

## 8. SAMPLE DATA

Seed the database with 11 sample events. Use these exact events:

| Title | Category | Venue | Date | General | VIP | Premium | Old Price | Badge | Bulk |
|-------|----------|-------|------|---------|-----|---------|-----------|-------|------|
| Nairobi Fashion Week 2026 | fashion | KICC Grounds | 2026-08-15 19:00 | 1500 | 3500 | 6000 | 2000 | Selling fast | Squad(5)-15%, Crew(10)-25% |
| Campus Style Battle — UoN | dressing | UoN Graduation Square | 2026-08-18 18:00 | 500 | 1200 | 2500 | 700 | Hot 🔥 | Squad(5)-10% |
| Mombasa Summer Rave | club | Mombasa Beach Hotel | 2026-08-20 22:00 | 2000 | 4500 | 8000 | 2500 | Limited | Table(4)-20%, Booth(8)-30% |
| Kitenge & Culture Expo | fashion | Nairobi National Museum | 2026-08-22 12:00 | 800 | 1800 | 3200 | 1000 | New | Family(5)-12% |
| Strathmore Freshers Night | campus | Strathmore Auditorium | 2026-08-25 20:00 | 400 | 900 | 1500 | 600 | Sold out | Squad(5)-10% |
| Kisumu Street Style Show | dressing | Kisumu Mega City | 2026-08-28 17:00 | 600 | 1400 | 2500 | 800 | Trending | Squad(5)-10% |
| Amapiano Dance Off | dance | GoDown Arts Centre | 2026-08-30 18:00 | 500 | 1100 | 2000 | 700 | Hot 🔥 | Squad(5)-12% |
| Tribal Art & Beats Festival | art | GoDown Arts Centre | 2026-09-02 16:00 | 1000 | 2200 | 4000 | 1300 | New | Squad(5)-15% |
| KU End-Month Bash | campus | Kenyatta University | 2026-09-05 21:00 | 350 | 800 | 1400 | 500 | Hot 🔥 | Squad(5)-8% |
| Nairobi Jazz & Vibes Night | club | Carnivore Grounds | 2026-09-08 20:00 | 2500 | 5500 | 10000 | 3500 | VIP only | Table(4)-20% |
| Eldoret Runway Challenge | dressing | Eldoret Sports Club | 2026-09-12 15:00 | 700 | 1600 | 2800 | 900 | New | Squad(5)-10% |

Use CSS gradients as poster images for each (no actual image files needed for MVP).

---

## 9. SECURITY & ANTI-SCAM RULES

1. **No off-platform payments:** Regex-detect phone numbers in event descriptions. Block submission if found.
2. **Organizer verification:** ID upload required before first event. Admin (you) manually approves via Supabase dashboard.
3. **QR uniqueness:** Each ticket gets a UUID QR code. One scan = status changes to 'used'. Cannot be reused.
4. **Escrow-like flow:** Money lands in the platform's IntaSend wallet first (surfaced to users as "Ogolla"). Organizer gets paid out after event completion (or daily for trusted organizers).
5. **Refund window:** Buyers can request refund within 24 hours of event start if event is cancelled. Admin reviews.

---

## 10. DEPLOYMENT CHECKLIST

1. Initialize Next.js project: `npx create-next-app@14 mtaa-vibes --typescript --tailwind --eslint --app --src-dir`
2. Install dependencies: `npm install @supabase/supabase-js qrcode.react html2canvas framer-motion`
3. Set up Supabase project, run the SQL schema above
4. Configure environment variables in `.env.local`
5. Sign up for an IntaSend account and grab sandbox API keys (`developers.intasend.com`) — no Safaricom Daraja app approval needed
6. Test STK push against IntaSend's sandbox, and configure the webhook URL in the IntaSend dashboard
7. Deploy to Vercel: `vercel --prod`
8. Buy domain `mtaavibes.co.ke` (check availability — this is a suggestion, not a reservation) and point to Vercel

---

## OUTPUT REQUIREMENTS

Generate the complete Next.js 14 project with:
- All pages (A through I) fully functional
- All components listed in Section 6
- All API routes in Section 4
- Tailwind config extended with custom utilities for glassmorphism
- Global CSS with all keyframe animations
- Sample data pre-loaded or hardcoded for demo
- Mobile-first responsive design (works perfectly on 375px width iPhone)
- Clean file structure with comments

**The app must look and feel like a premium Kenyan youth-culture brand — not a corporate ticketing site. Think "high-end event drop" meets "M-Pesa convenience," flexible enough to cover fashion, dance, campus, and club scenes equally.**
