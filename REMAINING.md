# Comrade Connect: progress tracker

## Section 1: Database, config, deploy docs (DONE)
schema.sql, wrangler.toml, .env.example, DEPLOY.md. Domain comradeconnect.co.ke filled into sitemap.xml, robots.txt, JSON-LD.

## Section 2: Worker endpoints + tests (DONE, with the limits below)
- backend/src: lib, feed, pay, account, market, messages, content, media, club, admin, index (see API.md).
- Tests: `npm test` runs 32 tests against a fake database (tests/mockdb.js): escrow, wallet, referrals, messaging, polls, Hearts, media, verification, live, club, tickets, admin.

### Not verified / not done in Section 2
- schema.sql has never run on a real Postgres. Run it in Supabase and report any error.
- The fake database copies PostgREST behaviour but is not PostgREST. Race protection relies on conditional UPDATEs and unique keys, which are the right tools, but test with real Supabase (2 phones, KES 1 payments) before launch.
- Presigned R2 URLs match the AWS reference vector, not tested against your real R2 bucket (CORS must allow PUT).
- Cloudflare Stream (Live) and TinyPesa calls follow their docs from memory and were never called for real.
- Refunds and seller payouts credit an in-app wallet; sending the actual M-Pesa money is MANUAL (admin marks withdrawal paid). No B2C automation.
- Underpaid or very late payments (after 30 min) need manual handling; they show in the admin queue only when underpaid.
- Feed posts/comments still trust the aid sent by the browser (old behaviour); only banned/muted aids are blocked. Fixed when the frontend moves to tokens (Section 3).
- Hearts 18+ is a self-declaration, not age verification.
- One shared ADMIN_KEY; the audit log says actor "admin", not which person.
- Points are stored but nothing awards them yet.
- Rate limits use daily counters that are not perfectly atomic (fine against abuse, not exact).
- Contact-info filter blocks common tricks but cannot catch every disguise.
- Live host rights: only role club_admin/admin, or the admin key.

## Section 3A: accounts + Market, escrow, wallet in the browser (DONE, with the limits below)
- `frontend/cc-core.js` (new file, loaded by index.html) and a small fetch shim in the page head. The old browser-only Market code is deleted.
- Accounts: first purchase/sale/listing registers an account on the server and shows the recovery code once. New accounts get a server-made ID (the old browser ID was visible in the Feed, so reusing it would let someone register your ID first). Me > Restore an account now needs account ID + recovery code.
- Market: browse, listing detail, buy with M-Pesa (polls payment status), My listings (remove), Sell (up to 5 photos, resized to JPEG in the browser, uploaded to R2, listing removed if the upload fails), Orders (buyer sees the 6-digit code, "I received it", report a problem; seller "I handed it over", enter code, report a problem), wallet balance, withdrawal request, loading/error/retry states, orders refresh every 20 s.
- Worker changes: platform fee is now 3% everywhere (wrangler.toml, tests, UI); new `POST /api/orders/:id/received` so the buyer can release without the code; 33 tests pass (`npm test`).
- Browser test: `python3 tests/browser_3a.py` (real page, fake Worker). 23 checks pass.

### 3A+ Google sign-in (added)
- `POST /api/auth/google` verifies the Google ID token (tokeninfo, audience and expiry checked), creates an account, links a guest account on the phone, or signs in to the linked one (old token dies). A guest with orders, listings or money is never dropped silently (409). Stores only Google's user id, not the email.
- Frontend: "Sign in to continue" sheet with Google button plus recovery-code fallback; Google button also in the 401 sheet and Me > Restore. Off when `CC_GOOGLE_ID` is empty.
- Tests: `npm test` (34 pass), `python3 tests/browser_3a.py`, `python3 tests/browser_google.py` (fake Google script and fake Worker). Never run against real Google: set it up with DEPLOY.md 4b.

### 3A+ Saved M-Pesa number and saved lists (added)
- The M-Pesa number is remembered on the phone (only after the server accepts a purchase or withdrawal) and prefilled in the buy and withdraw sheets.
- Market browse, My listings and Orders/wallet show the last saved copy instantly (kept 7 days, per account), refresh in the background, and stay visible with a retry button when offline. The 6-digit handover code is never saved. Tests: `python3 tests/browser_cache.py`.
- Feed is not cached yet: its cards count views when shown, so saved cards would double-count. Do it with the Feed auto-refresh in 3C.

### Not verified / not done in 3A
- Never run against your real Worker, Supabase, TinyPesa or R2. The browser test uses a fake Worker.
- Listings are photos only (the Worker takes JPG/PNG/WebP up to 5 MB each; videos belong to Clips).
- Admin approval, dispute decisions and withdrawal payouts have no screen yet (3B). Use the curl commands in DEPLOY.md section 7.
- Old demo listings, orders and wallet saved in the browser are ignored, not migrated.
- Referral code entry, messages, Hearts/roommates/groups/polls, clips, ID verification, club shop and tickets still use the old local code (3B). Boost and top-up payments start an account but the club/ticket checkouts will be refused until 3B.
- The "verify your ID" step before withdrawing and for listings over KSh 15,000 is still the old local screen; the server checks the verified flag set by an admin, so withdrawals will say "Verify your ID" until 3B connects ID checks.
- No push/email notice when a buyer pays; the seller sees it on the Orders tab.

## Section 3B: everything else on the server (IN PROGRESS)
- DONE: admin panel `frontend/admin.html` (listings, withdrawals, disputes, ID checks, reports, underpaid, accounts). Test: `python3 tests/browser_admin.py` (fake Worker; never run against the real one). Not in the panel yet: notices, events, sponsors, club products/stock/orders, ticket validation, audit log (API exists, see API.md).
- DONE (3B-1): ID verification upload and referrals, in the browser and on the Worker.
  - ID check: full name, admission/staff number, role, group link (class and hostel reps), barcode result. Front and back photos are joined into ONE JPEG on the phone and sent to the private R2 bucket. Status (waiting, rejected with the admin's note, verified, role badge) is read from the server. Admin panel shows the details and has "Approve with badge" and "Approve ID only".
  - Referrals: `?ref=CODE` is remembered, sent once right after the account exists (never inside signup, so no deadlock), dropped when the server refuses it (invalid, used, own code, too late), kept on network or server errors. Rewards screen shows the real invite link, friends waiting, rewards paid, and a box to enter a friend's code. Rewards go to the Market wallet; the old local pretend ledger is gone.
  - Tests: `npm test` (35 pass), `python3 tests/browser_3b.py` (28 checks), and the older browser tests still pass.
  - Needs: run the last 5 lines of schema.sql again; private R2 bucket CORS must allow PUT. Not tested against real Supabase or R2.
- DONE (3B-2): anonymous messages in the browser. "Message seller anonymously" on a Market item opens (or continues) a real conversation; Me > Messages is the inbox with unread counts; chats refresh every 15 s while open; mute 24 h, block (second tap confirms), unblock, and tap a message from the other person to report it. Phone numbers, handles and links are stopped on the phone and again by the Worker. Test: `python3 tests/browser_msg.py` (16 checks, fake Worker).
  - Not wired yet: messaging from Feed stories, roommate posts and Hearts still uses the old local screen ("not delivered"); those need the content screens first. No push notice for new messages; you see them in the inbox.
- DONE (3B-3): content screens on the server. Explore tabs Roommates, Study groups, Polls, Hearts, Wi-Fi, Hostels, Services, Study hub, and the zone leaderboard and rating sheet, all read and write through the Worker (`frontend/cc-core.js`, section "Explore on the server").
  - Messaging from a post: the Worker now accepts `ref_type` (post, room, service, group) + `ref_id` on `/api/messages/send`, finds the author itself and never returns their ID. Same post = same chat, a different post by the same person = a new chat. Used by roommate posts, services, study groups and Feed stories ("Message the poster anonymously"). Hearts chats open only from a match. Needs the new last line of schema.sql (`threads.ref_title`).
  - Hearts: 18+ confirmation calls the server; Interested returns a match and opens the private chat. The old "share my number after a match" step is gone (the Worker blocks numbers everywhere); matches talk in the app.
  - Creating something never shows it unless the server accepted it; a refusal keeps what you typed. Forms are not wiped when a list refreshes. Zone chips filter on the server; "Load more" pages.
  - Tests: `npm test` (36 pass), `python3 tests/browser_explore.py` (48 checks, fake Worker). All older browser tests still pass.
  - Changes from the old local screens, on purpose: Wi-Fi spots have no network name or password (the Worker never stored them, and posting other people's passwords is risky); services have no phone/WhatsApp buttons (numbers are blocked server-side), people reach them by anonymous message; hostel reviews have one overall rating instead of four; study tips have unit + tip (no separate title); zone ratings are Safety, Quiet and Value (the server stores noise, the phone converts); no "Helpful" vote on hostels.
  - Not done: there is no delete button on your own posts (the Worker has no delete route for content yet, only admin hide and 3-report auto-hide); polls have no closing time in the form; no refresh while you sit on a tab (it refreshes when you come back to Explore after a minute); lists are not saved for offline use; never run against your real Worker or Supabase.
- DONE (3B-4): Club shop and event tickets on the server (`cc-core.js`, section "Club shop and event tickets"; admin.html tabs Events and Club).
  - Phone: Club > Shop lists Worker products with live stock; Buy opens a quantity + M-Pesa sheet; the price is never sent, the Worker fixes it. Tab "Cart" is now "Tickets": upcoming events with Buy a ticket, and My tickets showing the 8-digit door code. Orders shows status (waiting for payment, paid, collected, cancelled, refunded) and a Ref (first 8 characters of the order id).
  - Door check: the Worker now accepts event id + 8-digit code (no ticket id needed). Admin > Events > Door check shows VALID or NOT VALID with the reason. A ticket works once.
  - Admin: Events (add with optional ticket price, delete, door check) and Club (add product, set stock, orders waiting for collection with Mark collected; the tab badge counts them).
  - Tests: `npm test` 36 pass (door check by code added); `tests/browser_club.py` and `tests/browser_admin_club.py`. All older browser tests pass.
  - Changes from the old local shop, on purpose: joining the Club is free (the Worker has no membership payment; the old KSh 100 fee was a local pretend); one product per order with a quantity, no cart (the Worker takes one product per payment); one Club price, no separate member/retail price; no delivery to hostels, collection on campus only; no 4-stage packing timeline, only paid then collected; "Help" support tickets are still local only.
  - Not done: delivery option; multi-item cart; a club membership fee; support tickets on the server; a QR code on tickets; notices and sponsors screens in the admin panel (the Worker routes exist); refunds of club orders from the admin panel.
- DONE (3B-5): clips and likes on the server (`cc-core.js`, section "Clips and likes").
  - Videos and Reels now show the Worker's clips (newest 20, "Load more"), with each clip's like count and whether you liked it. Upload goes phone to R2 by a signed URL, then the Worker checks the real file; it appears straight away and earns +5. Only MP4 or WebM (the Worker's rule); an iPhone .mov gets a message to switch Camera formats to Most Compatible.
  - Likes: the old screens still like locally; the phone then confirms with the Worker. A like cannot be undone (the Worker has no unlike), so tapping again does nothing. A refused like is rolled back with a message.
  - Report on other people's clips (type clip); the clip hides for you at once and for everyone after 3 reports or an admin.
  - Fixed on the way: in Videos, tapping Share or Report on a card opened Reels instead (an old handler caught the tap).
  - Tests: `tests/browser_clips.py` (fake Worker + R2). All older tests pass.
  - Not done / limits: R2 bucket needs a CORS rule allowing PUT from your site (DEPLOY.md section 8 already covers it) or uploads fail in the browser; poster handles are not shown for other people's clips (they appear as @comrade), and Follow, Save and Reels comments are still local to the phone; no delete for your own clips; no upload progress bar; the failed-like rollback has no automated check.
- DONE (3B-6): notices and sponsors in the admin panel (tabs Notices and Sponsors: add, delete). Notices: title, details, optional hide-after days, pin. Sponsors: name, one line, https link. The phone's Explore > Notices tab now shows the Worker's notices (pinned first, "Today / N days ago").
  - Bug fixed (it came from 3B-3): while connected, the Explore tabs Notices, Events and Search rendered nothing, because the new server code took over every tab except Top spills. It now only takes over the tabs the Worker serves. `tests/browser_explore.py` checks Notices and Events.
  - Limits: the admin lists show only live items (the Worker's public lists hide expired notices and inactive sponsors, so those cannot be deleted from the panel); notices have no category (all show as General on the phone); the Explore Events tab is still local (events are sold and listed under Club > Tickets); sponsors are stored but no phone screen shows them yet.
- DONE (3B-7): message alerts on the site (`cc-core.js`, section "message alerts"). While the site is open (even in a background tab) it checks the inbox every 30 seconds and when you return to the tab. A new message shows a banner at the top ("You have a new message", View opens Me > Messages, closes itself after 9 seconds), the tab title gets a count like "(2) Comrade Connect" and the Me tab gets a red dot. If you allowed alerts in Me > Alerts and the tab is in the background, it also sends a browser notification. Text is always generic: no sender, item or message words.
  - Respects the "Replies and messages" switch in Me > Alerts; muted and blocked chats never alert; the chat you have open does not alert.
  - Tests: `tests/browser_alerts.py` (16 checks). All older tests pass.
  - Limit, important: this is NOT push in the strict sense. It only works while the site is open in a browser tab. When the site is closed, or the phone is locked and the browser is suspended, nothing arrives. True push needs a service worker, VAPID keys and a send step in the Worker, and on iPhone the site must be added to the Home Screen first. That is a separate step if you want it.
  - Other limit: alerts cover messages only (not notices or the daily poll switches); no sound.
- NOT DONE: true push (site closed); 3C polish pass. The admin test does not cover the new ID check fields yet. No push alert for new messages.
Original list:
Messages, content (roommates, groups, polls, Hearts, Wi-Fi, hostels, services, tips, zones), clips + likes, ID verification upload, referrals, club shop + tickets, and the admin panel on ADMIN_KEY (replaces the PIN).

## Section 3C: polish and browser tests (IN PROGRESS, one part at a time)
- DONE (3C-1): Feed auto-refresh and new-stories button. While the Feed is on screen and the tab is visible, the page asks the Worker for the newest stories every 45 seconds (and when you come back to the tab after a minute). If there are newer stories for the chosen category and zone it shows a sticky button ("3 new stories. Tap to see"); tapping loads them at the top. Nothing is inserted on its own, so the page never jumps and views are not double-counted. Silent when offline, when the tab is hidden or when another screen is open. Tests: `tests/browser_feed.py` (13 checks). It found and fixed a bug: an empty category never checked for new stories.
  - Limits: the button counts up to 5 ("5 new stories"); the Feed list itself is still not saved for offline use; nothing refreshes comment counts or likes on cards already shown.
- NOT DONE: real events and products on the phone (the Explore Events tab is still local); offline and error states everywhere; a full browser layout test across phone sizes.

## Section 4: Legal and safety docs, nice-to-haves (NOT DONE)
Privacy policy + Terms matching real data (needs a Kenyan lawyer check), moderation plan, notifications, backups, error monitoring, opt-in analytics.

## v8 Group 1: files and Live without a card (DONE)
- Cloudflare R2 is gone. Clips, listing photos and ID photos now use Supabase Storage (`backend/src/storage.js`). Buckets `cc-media` (public) and `cc-private` are created by the last lines of `supabase/schema.sql`. Column `r2_key` keeps its old name but holds the Storage path.
- Safer than before: the Worker reads the first bytes of every upload and deletes it if it is not really a JPG, PNG, WebP, MP4 or WebM.
- Free-plan limits handled: clips max 25 MB; cron deletes abandoned uploads after 24 h and the oldest clips when media passes `MEDIA_BUDGET_MB` (800). 1 GB storage and 5 GB monthly downloads are Supabase's free limits: clips will be the first thing to hit them.
- Cloudflare Stream is gone (it is paid). Live is now a pasted YouTube/Facebook/TikTok/Twitch link (`POST /api/live/start {title, url}`); YouTube embeds, others open their own app. There is still no Live screen in the phone app (only the Worker side exists).
- Tests: `npm test` (36 pass), all browser tests pass with the new multipart upload.
- Not verified: never run against a real Supabase project. The signed-upload and info/range-download calls follow Supabase's documented REST API and the official client's behavior, and are tested only against a fake. First real test: post one listing photo and one clip, then open the clip.

## v8 Group 2: payments without fees or sign-up (DONE)
- New default `PAYMENT_MODE = "manual"`: the buyer is shown how to pay your number/till/paybill (`MPESA_PAY_TYPE`, `MPESA_PAY_TO`, `MPESA_PAY_NAME` in wrangler.toml), pays, then enters the 10-character M-Pesa code. The payment becomes `submitted`; you confirm it in `admin.html` > Confirm M-Pesa ("Money received" / "Not received"). Only then does the order, club purchase, ticket or boost happen.
- Same flow for every payment in the app (Market, Club shop, tickets, boost). A code can only be used once; the buyer can correct a typo until you decide; unpaid attempts expire after 90 minutes (`PENDING_MINUTES`), submitted ones wait for you.
- TinyPesa is still there as `PAYMENT_MODE = "tinypesa"` (automatic prompts, its own fees). Nothing else changed in the escrow rules.
- Tests: `npm test` (38 pass, includes manual flow, single-use code, expiry), `python3 tests/browser_manualpay.py`, admin test extended; all older browser tests pass.
- Limits: you are the check. Nothing verifies the code against Safaricom, so approve only after seeing the message. Not instant. A wrongly refused code means the buyer must pay again. Seller payouts and refunds are still manual M-Pesa from you. Never run against a real phone, Supabase or Worker.

## v8 Group 2 follow-up: docs and free-tier check (DONE)
- Re-verified: `npm test` 38 pass; all 14 browser tests pass (manual payment, admin, club, market, Google, alerts and the rest).
- Fixed: `AI_MODEL` was `gemini-2.0-flash`, which Google shut down on 1 June 2026, so the AI helper would fail. Now `gemini-3.1-flash-lite` (free tier per Google's pricing page). Google retires models often: if the helper stops answering, change `AI_MODEL`.
- Docs brought up to date: README.md rewritten (it still described TinyPesa and the browser-only version), DEPLOY.md renumbered with a "Cost check" table, `.env.example` marks TinyPesa optional, `.gitignore` ready for GitHub.
- Known gap: a buyer can submit a code and leave the payment `submitted`, which holds Market/Club stock until you tap Not received. Check the Confirm M-Pesa tab daily.
- Domain comradeconnect.co.ke is bought at Olitt. DEPLOY.md section 5 now covers pointing it at Cloudflare (nameservers) and Pages. The only recurring cost is the yearly renewal. `ALLOWED_ORIGINS` takes one address only. Group 3 (domain and hosting) is documented, not tested on the real domain.

## Icons and emoji (DONE)
- No emoji anywhere in the project (code, docs, tests). The social link icons (WhatsApp, Instagram, TikTok, X, YouTube, Telegram, Facebook, website) are now outline SVGs in the same style as the bottom tabs. The WhatsApp share text no longer starts with an emoji. API.md marks signed-in endpoints with [auth] instead of a lock emoji.

## v9: money controls (DONE)
- `settings` table, edited in admin.html > **Money and fees**: marketplace fee %, advert boost prices (24 h and 3 days), smallest withdrawal, withdrawal fee (percent + flat), referral reward, auto-release days. Falls back to the env values if the table is empty or missing. Each order stores its own fee when it is created, so a change never touches orders already paid.
- Company earnings card (market fees, boosts, withdrawal fees, owed to sellers, paid out). Payout history tab. Withdrawals show the exact amount to send (after the fee). The same M-Pesa code cannot be recorded on two payouts. Sellers can cancel a waiting withdrawal.
- Sponsors have an agreed amount and an end date, can be paused, edited and listed even when paused. Notices and events can be edited.
- Fixed: the boost screen showed KSh 30 / 70 but the server charged KSh 20. Both now come from the same setting. A boost now adds time to a boost that is still running.
- Run the last block of `supabase/schema.sql` (v9) in Supabase after deploying. Until then the app keeps working with the env values, but saving settings and withdrawal fees will say to run the SQL.
- Still not automatic: sending the M-Pesa money (needs Safaricom Daraja B2C approval). The admin sends it by hand and enters the code.

## v10 follow-up: test fix, search suggestions, SEO (DONE, with the limits below)
- Fixed the flaky Market sell-form test. Cause: the dropdown styler in index.html marked every select with `data-cc="1"`, the same attribute the Site editor uses for editable words. When the Site editor settings arrived, cc-site.js rewrote the select's contents and the Category options disappeared (whether it happened depended on timing). The styler now uses `data-ccsel`, and cc-site.js refuses to touch selects, inputs and anything whose key is not a real word key. Before the fix the test failed 4 of 5 runs (4 of 4 under CPU load); after it, it passes every run.
- Search suggestions as you type: `frontend/cc-suggest.js`, on the Market search box and the Explore > Search box. Up to 5 suggestions from what is already on the phone (listing titles; story categories, notice and event titles). Text only, never HTML. Test: `python3 tests/browser_suggest.py`.
- SEO: new `about.html` (real text, 3 app screenshots with alt text in `frontend/img/`), linked from the footer, added to sitemap.xml with image entries, JSON-LD AboutPage. `set-domain.py` now covers about.html.
- Security headers: `_headers` adds HSTS, frame-ancestors 'self' and Permissions-Policy. The API (`server.js`) adds HSTS and Referrer-Policy.
- Limits: the Google Search Console code is still yours to paste (index.html has the slot). HTTPS redirect and www to non-www are Cloudflare dashboard settings, not files (see DEPLOY.md, SEO section). Nothing here was tested on the live domain. Suggestions do not search the server, only what is loaded on the phone.
- Live was done in v11 (below).

## v11: Live (DONE, pasted-link route)
- A club admin starts a live on YouTube, Facebook, TikTok or Twitch and pastes the link. Comrades watch inside the app (YouTube) or open it in the platform's own app (the others), and chat, send hearts and see the viewer count here.
- Floating heart icons (SVG, no emoji), viewer count (phones that pinged in the last 40 seconds), live comments (account needed; no phone numbers, handles or links; cut at 140 characters), host can remove a comment, host can end the live.
- Backend: `backend/src/live.js`, new tables and function in the last block of `supabase/schema.sql` ("v11"). Run that block in Supabase BEFORE deploying. The cron clears old viewers (1 hour) and comments (3 days).
- Tests: `tests/live.test.mjs` (4) and `python3 tests/browser_live.py` (23 checks).
- Replaced: the old fake camera preview (nobody else could watch it).
- NOT possible on this route: front/back camera switch (the host's own streaming app does that). A switch inside Comrade Connect needs a paid streaming service.
- Cost to know: each phone watching sends one request every 5 seconds. The free Cloudflare Worker allows 100,000 requests a day, so about 130 viewer-hours a day before the limit. Hearts and comments add little on top.
- Limits: the viewer count is approximate (someone could inflate it by faking pings); hearts are not limited per person, only 10 per request; the host sees Remove buttons only in the session where they started the live.

## v12: seller phone number after payment (DONE)
- Sell form has a required phone number, stored in `listings.contact_phone` (run the v12 block at the end of schema.sql).
- Hidden until the buyer pays; then Orders shows it with Call and WhatsApp buttons. Hidden again after a refund.

## UI pass (Oct 2026): Section 1 DONE, Section 2 TO DO
### Section 1 (DONE): `frontend/cc-ui1.css` + `frontend/cc-ui1.js`, linked last in index.html
- Top bar: icons (search, safety, bell, layout, theme) sit bare on the bar, no circles, even spacing; the wordmark shows on two lines on phones so it is never cut.
- Location chip ("Kirinyaga . change") sits under the top bar, not behind it (the story tray's top gap was reduced to match).
- Glass without glow: cards, sheets, bars and buttons are frosted glass (high to low opacity), black drop shadow underneath, shading inside. No coloured outer glow. Primary buttons are tinted glass.
- Light mode: bottom bar labels are dark, Kura button and toast are readable, inputs have a faint grey glass.
- Robot (Tech): blink is now driven from script (eye `ry`), and the float animation is exempted from the reduced-motion rule, so both work on phones with "Remove animations" on. Cause found: index.html has `@media(prefers-reduced-motion:reduce){*{animation:none!important}}` and Android WebView follows the phone's "Remove animations" setting.
- Tested in headless Chromium at 360 and 412 px, light and dark. `python3 tests/browser_zones.py` already fails BEFORE this change (the campus picker covers the Spill button); not caused by it.

### Section 2 (TO DO): lock screen, fingerprint animation, re-lock on return, password fallback
Findings (already diagnosed, not yet changed):
1. `frontend/cc-fingerprint.js` function `scan()`: after `bio.caps().then(...)` it calls `direct(caps)` (skips the animated "Hi, NAME / Welcome back" screen, goes straight to Android's prompt). Commit 8145c6b did this. The animated screen is the function `build(caps)` in the same file. Call `build(caps)` instead (keep `direct` only as a fallback if build throws).
2. Same file sets `reduce` from prefers-reduced-motion and adds `data-rm` (kills the animation); `frontend/cc-lockscreen.js` has a reduced-motion rule too. Ignore reduced motion for the fingerprint and face animations.
3. Re-lock only happens in index.html (line with `visibilitychange` and `Date.now()-hidAt>60000`): only after 60 s away, and only if `ME.bio` is set. Make it lock every time the app goes to the background and comes back: listen to Capacitor `App` `appStateChange` (isActive false then true) plus `pause`/`resume` and `visibilitychange`; skip while Android's own biometric prompt is open (`ccNativeBio` has an internal `bioBusy`, expose it), during Google sign-in (`window.ccAwayOK`), and right after the lock opened. Then show `#lk` and call the existing auto-ask (`#lku` click).
4. "Sign in with my password": exists (`#lkpw` opens the password view built by `cc-lockglass.js`; `#lkr` checks the saved password or recovery code). Check it works from the animated screen (`#fpx-pw` button) in the app, and that the fingerprint button on the password view returns to the scan.
5. Light and dark check of the lock screen (`#lk`, `#ccfp`), and remove the glow rules at the end of `frontend/cc-glass.css` ("lock screen glass v3") and in `frontend/cc-lockglass.css`: same recipe as Section 1 (black shadow, shading inside, no coloured glow).
6. Bottom navigation buttons in both themes were fixed in Section 1; re-check them on the lock return.

## UI pass Section 2 DONE (lock screen)
- cc-fingerprint.js now shows the animated Hi NAME screen again (build instead of direct); reduced-motion no longer switches the fingerprint/face/robot animations off (index.html rule, cc-lockscreen.js, cc-fingerprint.js).
- cc-ui2.js: the app locks every time you leave and come back (not for Android's own prompt, Google sign-in, or a file/camera picker you opened). cc-native.js exposes ccNativeBio.busy().
- cc-ui2.css: lock and scan screens use black shadow + inner shading, no glow, light and dark.
- Not tested on a real phone: Android's real prompt, and the exact relock timing when the phone's own prompt closes.

## Current state (docs refresh)
- The platform fee default is 7% (admin-editable); earlier notes in this file that say 3% are history.
- Card payments were removed: there is no card code, test or redirect page. Payments are M-Pesa only (manual, TinyPesa or IntaSend STK push).
- Setup needs `schema.sql` plus the other `supabase/*.sql` files. admin > SQL shows what is still missing.
- `wrangler.toml` has a comma-separated `ALLOWED_ORIGINS`; the Cloudflare Worker route accepts only one address, Render accepts a list.
- Phone alerts work for the Android app only (`FCM_SERVICE_ACCOUNT`, RENDER.md section 12). Website push is switched off in `backend/src/push.js`; its VAPID code and the lines after the early `return` in `/api/push/subscribe` are dead code.
- `npm test` runs 217 tests against a fake database. They do not prove anything about the real Supabase, Render or payment providers.
