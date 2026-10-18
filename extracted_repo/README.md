# Mtaa Vibes

Kenyan events, zero stress. Fashion shows, dressing competitions, dance
events, campus nights & club events — pay with M-Pesa, get instant QR
tickets.

This repo is a **working scaffold**, not a pixel-perfect final build. Every
page, component, API route, and the DB schema exist and are wired together,
but some pieces are intentionally simplified stubs (marked `TODO` in the
code) — auth-gated phone lookups, file uploads to Supabase Storage, admin
approval flows, and the camera-based QR scanner all need to be finished off.
The full, exact spec this was built from is in `docs/BUILD_PROMPT.md` — treat
it as the source of truth when fleshing anything out or feeding this repo to
a coding agent (e.g. Claude Code) to continue the build.

## Stack

- Next.js 14 (App Router) + Tailwind CSS
- Supabase (Postgres + Auth + Storage)
- IntaSend Collection API for M-Pesa STK push (backend processor — always
  branded to users as **"Ogolla" / "Ogolla Pay"**, never shown by name)
- `qrcode.react` for ticket QR codes, `html2canvas` for ticket downloads

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Create a Supabase project, then run `supabase/schema.sql` in the SQL
   editor. Optionally run `supabase/seed.sql` after replacing
   `YOUR_ORGANIZER_ID` with a real user UUID (create a test organizer account
   first via the sign-up page, then copy their id from Supabase Auth).
3. Copy `.env.example` to `.env.local` and fill in:
   - Supabase URL + anon key + service role key
   - IntaSend publishable + secret key (sign up at developers.intasend.com —
     sandbox keys need no Safaricom approval)
4. Run locally:
   ```
   npm run dev
   ```
5. In the IntaSend dashboard, set the webhook URL to
   `https://<your-deployed-domain>/api/pay/webhook` once deployed (webhooks
   can't reach localhost — use a tunnel like ngrok if you need to test this
   before deploying).

## What's genuinely done

- Full liquid-glass design system in `tailwind.config.js` +
  `src/app/globals.css` (colors, radii, shadows, all keyframes)
- All 9 pages (landing, event feed, ticket, scanner, dashboard, login,
  signup, my tickets) + the purchase sheet, guest list, and create-event
  form as components
- Points/referral system: `points_ledger` + `referrals` tables, redemption
  wired into the purchase sheet and the stkpush/webhook routes
- IntaSend STK push, webhook, and status routes

## What still needs work (see TODOs in code)

- Buyer identity on **My Tickets** currently reads a phone number from
  `localStorage` as a placeholder — replace with real OTP/session lookup
- **QR scanner** page uses a plain text input for the MVP, as specced —
  swap in a camera-based scanner when ready
- `docs/BUILD_PROMPT.md` Section 2's exact per-pixel EventCard hover/overlay
  treatment (gradient poster scale-on-hover, "Selling fast"/"Hot 🔥" style
  badges) is simplified in `EventCard.jsx` — flesh out against the spec
- The Card/Bank checkout redirect flow (see below) hasn't been tested
  end-to-end against a live IntaSend sandbox account — verify the exact
  response shape from `/api/v1/checkout/` before going live, since the field
  names in IntaSend's docs vary slightly by SDK version

## Payments — M-Pesa, Card, and Bank

`PurchaseSheet.jsx` now lets the buyer pick a method. Behind the scenes:

- **M-Pesa** — unchanged: `/api/pay/stkpush` calls IntaSend's Collection API
  with `method: "M-PESA"`, which pushes an STK prompt straight to the
  buyer's phone. No redirect involved.
- **Card / Bank** — `/api/pay/stkpush` now also accepts `method:
  "CARD-PAYMENT"` or `"BANK-PAYMENT"`. For these it calls IntaSend's
  Checkout API (`/api/v1/checkout/`) instead, which returns a hosted
  payment `url`. The frontend redirects the browser there; IntaSend sends
  the buyer back to `/pay/complete` afterward. Either way, the **webhook**
  is what actually finalizes the ticket (creates the row, updates
  `sold_tickets`, handles points/referrals) — the redirect page is just a
  waiting/confirmation screen.

Both paths write the same `pending_payments` row up front, so the webhook
doesn't need to know or care which method was used.

## Organizer ID verification

Wired end-to-end: the dashboard's verification card (`IdVerificationForm.jsx`)
uploads the front/back of an organizer's national ID to a **private**
Supabase Storage bucket (`organizer-ids`, created by `schema.sql`), scoped by
RLS so an organizer can only read/write their own two files, then upserts a
`pending` row into `organizer_verifications`. There's no admin review UI in
this scaffold — approve/reject by hand in the Supabase table editor (flip
`status` to `approved` or `rejected`) until that's built. To view an
uploaded ID, generate a signed URL server-side with the service-role client
(`supabaseAdmin().storage.from('organizer-ids').createSignedUrl(path, 60)`),
since the bucket is private and the stored `id_front_url` /
`id_back_url` columns hold storage paths, not public URLs.

## IntaSend webhook security

`/api/pay/webhook` now rejects any request whose `challenge` field doesn't
exactly match `INTASEND_WEBHOOK_CHALLENGE` in your `.env.local` — set the
same string in the IntaSend dashboard under Webhooks when you configure the
endpoint. Requests that fail this check get a 401 and are never trusted.
The webhook is also now idempotent: if a `COMPLETE` event is redelivered
(IntaSend, like most webhook senders, retries on timeout/non-2xx), it checks
for an existing ticket by `transaction_id` first and skips re-processing —
`tickets.transaction_id` also has a DB-level `UNIQUE` constraint as a backstop.

## Cinematic UI pass

A first batch of the "make it feel alive" visual work, all built on the
existing design system (Tailwind keyframes + `framer-motion`, already a
dependency — nothing new to install):

- `AnimatedLogo.jsx` — SVG wordmark draws itself in on load, sits in a
  sticky header, and shrinks slightly on scroll. Lives once in `layout.js`
  so it's consistent across every page (this is what "well-placed logo"
  turned into — a persistent header rather than a page-by-page static logo).
- Gradient-mesh animated hero backdrop (`.gradient-mesh` in `globals.css`)
  behind the landing page hero.
- `FeaturedCarousel.jsx` — CSS 3D "coverflow" of live events on the landing
  page (pure `transform: perspective/rotateY`, no WebGL dependency, so it's
  light and works everywhere).
- `RippleButton.jsx` — magnetic hover pull + click ripple, wraps the landing
  page CTAs and the payment button.
- `ConfettiBurst.jsx` — small dependency-free canvas confetti, fires on a
  successful M-Pesa STK push and when a ticket page first loads.
- `TicketQR.jsx` — 3D flip-in entrance + a holographic diagonal shimmer
  sweep (`.holo-sweep`) across the ticket card.
- `FlipCountdown.jsx` — departure-board style flip-digit countdown to an
  event's start time, shown on the ticket page.
- `EventCardSkeleton.jsx` — shimmering skeleton loaders in the event feed
  instead of a plain "Loading…" line.
- `CategoryChip.jsx` — spring-physics select/deselect via `framer-motion`.
- Event cards now enter the feed with a subtle 3D tilt-in (`animate-cardIn3d`
  in `tailwind.config.js`) instead of a flat fade.

### Still on the visual/backend wishlist (not built yet)

Logo/hero video background, neon club-night theme variant, magnetic hover
physics on more surfaces, ticket "unboxing" swipe gesture, scroll-depth
parallax on the whole feed (not just cards), spinning referral badge,
Supabase Realtime "selling fast" counter, automated organizer payout batch
job, SMS receipt delivery, admin verification-review dashboard, basic fraud
heuristics, organizer sales analytics. Say the word on any of these and
I'll build it next.

## Deploy

```
vercel --prod
```

Point your domain (e.g. `mtaavibes.co.ke`, if available) at the Vercel
deployment once it's live.
