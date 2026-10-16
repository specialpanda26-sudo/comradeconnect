# Comrade Connect: deploy guide (v8)

Order matters: Supabase, then the Worker, then Pages, then payments (your M-Pesa number), then the domain.
Everything here runs on free plans with no card: Supabase, Cloudflare Workers and Pages, Supabase Storage, Google sign-in, Gemini free tier, manual M-Pesa. See "Cost check" at the end. Progress and known limits: REMAINING.md.

## 0. Before you start
- Free Cloudflare and Supabase accounts, Node.js 18+ on your computer (or Termux with nodejs).
- Never paste keys into chat, GitHub, or index.html. Keys only go in `wrangler secret put`.

## 1. Supabase (database)
1. supabase.com > New project (pick a region near Kenya, e.g. Frankfurt or Mumbai). Save the database password.
2. SQL Editor > New query > paste all of `supabase/schema.sql` > Run. It is safe to run again.
3. Table editor: you should now see `payments, orders, listings, messages, threads, profiles, wallet_ledger, verifications, tickets, admin_audit_log` and the rest. Every table should show RLS enabled.
4. Project Settings > API: copy the Project URL and the `service_role` key (secret; Worker only).
5. Note: the schema drops the old `orders.code` column (plaintext). If you already have real orders, back up first.

## 2. File storage (Supabase Storage, free, no card)
Nothing to create by hand: running `supabase/schema.sql` in step 1 already makes the two buckets `cc-media` (public: clips and listing photos) and `cc-private` (private: ID photos). Check under Supabase > Storage that you see both, and that `cc-private` says Private.
- No CORS setup is needed; browsers upload with one-time signed links from the Worker.
- Free plan limits: 1 GB of files in total and 5 GB of downloads a month. Clips are capped at 25 MB, and when media passes 800 MB the Worker deletes the oldest clips (listing photos are kept). Raise `MEDIA_BUDGET_MB` only if you upgrade.
- Live: the host streams on YouTube, Facebook, TikTok or Twitch (all free) and pastes the live link into the app. YouTube plays inside the app; the others open their own app.

## 3. Worker (from the folder with wrangler.toml)
```
npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_KEY
npx wrangler secret put ADMIN_KEY            # long random string, this is your admin login
npx wrangler secret put HASH_PEPPER          # long random string, never change it later or codes stop verifying
npx wrangler secret put GEMINI_API_KEY       # free key from aistudio.google.com; leave it out and the AI helper is simply off
npx wrangler deploy
```
Copy the Worker URL it prints. Generate random strings with: `openssl rand -hex 32`.

## 4. Site (Cloudflare Pages)
1. In `frontend/index.html` AND `frontend/admin.html` set `CC_API` to your Worker URL (same value in both).
2. Pages > Create > Upload assets > upload the whole `frontend` folder (it includes `cc-core.js`; the page breaks without it).
3. Update later: Pages > your project > Create deployment.

## 4b. Google sign-in (free, optional but recommended)
1. console.cloud.google.com > create a project > APIs & Services > OAuth consent screen: User type External, app name "Comrade Connect", your support email. Then click "Publish app" (in "Testing" mode only 100 listed test users can sign in).
2. Credentials > Create credentials > OAuth client ID > Web application. Under "Authorized JavaScript origins" add `https://comradeconnect.co.ke` and your `https://YOURPROJECT.pages.dev`. No redirect URI is needed. Copy the Client ID (it is public, not a secret).
3. Paste the same Client ID in two places: `GOOGLE_CLIENT_ID` in `wrangler.toml` (then `npx wrangler deploy`) and `CC_GOOGLE_ID` in `frontend/index.html` (then re-upload `frontend`).
4. Run the last 3 lines of `supabase/schema.sql` again (adds `profiles.google_sub`; safe to repeat).
5. Test: open the site in Chrome, tap Buy, tap "Continue with Google". Check Supabase > profiles: a row with `google_sub` filled.
Notes: leave both values empty and the app uses recovery codes only. A guest account already on a phone is linked to Google, so it keeps its orders. Google blocks sign-in inside some in-app browsers (links opened from WhatsApp, Instagram, Facebook); the sheet always offers "No Google? Use a recovery code", and you can tell people to open the link in Chrome.

## 4c. ID verification (needed before anyone can withdraw)
1. Run the last 5 lines of `supabase/schema.sql` again (adds columns to `verifications` and `profiles.badge`; safe to repeat).
2. The private bucket `cc-private` needs nothing extra. Never make it public.
3. Test: Me > Get verified, send photos, then open `admin.html` > ID checks, show the photo and approve.

## 5. Domain (comradeconnect.co.ke, bought at Olitt)
Cloudflare Pages needs the domain's DNS on Cloudflare (free plan), so you change the nameservers once. The domain stays registered at Olitt.
1. Cloudflare dashboard > Add a site > `comradeconnect.co.ke` > Free plan. Cloudflare shows you two nameservers.
2. Log in at Olitt > your domain > Nameservers (custom) > replace the current ones with Cloudflare's two. Changes can take from a few hours up to 48 hours. Cloudflare emails you when the site is active.
3. Pages > your project > Custom domains > Set up a custom domain > `comradeconnect.co.ke`. Cloudflare adds the DNS record by itself.
4. Optional: make `www.comradeconnect.co.ke` redirect to the main address (Cloudflare > Rules > Redirect Rules), so everyone uses one address.
5. The domain is already written into index.html (JSON-LD), sitemap.xml and robots.txt. If you ever change it, run `python3 set-domain.py newdomain` and re-upload `frontend`.
6. Lock the API to your site: in wrangler.toml set `ALLOWED_ORIGINS = "https://comradeconnect.co.ke"` and run `npx wrangler deploy`. This setting takes exactly ONE address, so after this the app only works from `https://comradeconnect.co.ke` (not www, not name.pages.dev). Keep `"*"` until step 3 works.
7. Google sign-in (4b): add `https://comradeconnect.co.ke` under Authorized JavaScript origins.
8. Renewal: .co.ke domains renew every year (about KSh 1,200 at Olitt per Truehost's published price; check your Olitt invoice). If it lapses the site goes down.

## 6. Payments (free: manual M-Pesa)
Default mode needs no sign-up, no API key and no fees from us. The buyer sends the money to YOUR number, till or paybill and types the M-Pesa code from the message; you confirm it in the admin panel (tab "Confirm M-Pesa"), and only then does the order start.
1. In `wrangler.toml` set `MPESA_PAY_TYPE` (`send` for Send Money to a phone, `till` for Buy Goods, `paybill`), `MPESA_PAY_TO` (your number, till or paybill number) and `MPESA_PAY_NAME` (the name M-Pesa shows when the number is typed, so buyers can check it is you). Then `npx wrangler deploy`.
2. Test: buy a KSh 1 item from a second phone, send KSh 1 to your number, enter the code in the app, then open `admin.html` > Confirm M-Pesa and tap "Money received". The order must appear for the buyer.
3. Every day, check the tab. Unconfirmed codes make buyers wait; unpaid attempts expire by themselves after 90 minutes.
4. Always compare the code AND the amount with your own M-Pesa message before approving. A made-up code has no message behind it: tap "Not received".
5. Know the limits: it is not instant, you confirm by hand, and a wrongly refused code means the buyer must pay again (they keep their M-Pesa message as proof; sort it out with them directly). Safaricom may query a personal number that receives many payments; a Till (free to get from a Safaricom shop, receivers pay a small fee per payment) is the safer choice once you have regular sales.
6. Later, if you want automatic prompts: set `PAYMENT_MODE = "tinypesa"`, `npx wrangler secret put TINYPESA_API_KEY` and `CALLBACK_SECRET`, and set the TinyPesa callback to `https://YOUR-WORKER.workers.dev/api/tinypesa/callback?s=YOUR_CALLBACK_SECRET`. TinyPesa has its own charges, so check them first.

## 7. Test it before real money
- Run the Worker tests on your computer first: `npm test` (no keys needed, uses a fake database).
- Admin login uses the `ADMIN_KEY` (sent as the `X-Admin-Key` header). Do not share the key. If it leaks, run `npx wrangler secret put ADMIN_KEY` with a new value.
- To let someone host Live streams: admin panel > user > role `club_admin` (API: `POST /api/admin/users/:aid {action:"role", role:"club_admin"}`).
- The Worker runs a cron every 15 minutes (see `[triggers]` in wrangler.toml) for auto-release, referral unlocks, expiring stale payments and deleting old ID photos. Check it under Workers > your Worker > Triggers.
- Walk through: create a listing, approve it as admin, buy it with KES 1, enter the handover code, check the order moves to `released`.

## 8. Google and SEO
See the SEO steps in README.md (Search Console, sitemap).

## Things you must do before real money moves
- Get the Privacy Policy, Terms and M-Pesa wording reviewed by a Kenyan lawyer. Register with the Office of the Data Protection Commissioner if required for your processing.
- Confirm with Safaricom (and a lawyer) that holding buyer money until handover (escrow) is allowed on the number, till or paybill you use. Seller payouts are manual until you set up B2C.
- Set up backups (Supabase paid plan has daily backups; on the free plan export weekly).


## 9. Admin panel
Open `https://YOUR-SITE/admin.html` on your phone and sign in with your `ADMIN_KEY`. Tabs: Listings (approve or reject with a reason), Withdrawals (send the M-Pesa by hand, then enter the M-Pesa code and tap "I sent it"), Confirm M-Pesa (buyers' payment codes, see section 6), Disputes (pay the seller or refund the buyer), ID checks, Reports, Underpaid payments, Events, Club, Notices, Sponsors and Accounts (ban, mute, role). The key stays in that browser tab only and you are signed out when you close it. The page is hidden from Google (noindex, robots.txt) but anyone with the key can use it, so keep the key private.

Backup, if the panel is ever down: the same actions by curl. Replace `YOUR-WORKER` and `YOUR_ADMIN_KEY`. From a terminal:

    # see what is waiting
    curl -s -H "X-Admin-Key: YOUR_ADMIN_KEY" https://YOUR-WORKER.workers.dev/api/admin/queue
    # approve (or use "reject" with "reason")
    curl -s -X POST -H "X-Admin-Key: YOUR_ADMIN_KEY" -H "Content-Type: application/json" -d '{"action":"approve"}' https://YOUR-WORKER.workers.dev/api/admin/listings/LISTING_ID
    # mark a withdrawal paid after you sent the M-Pesa
    curl -s -X POST -H "X-Admin-Key: YOUR_ADMIN_KEY" -H "Content-Type: application/json" -d '{"action":"paid","payout_ref":"MPESA_CODE"}' https://YOUR-WORKER.workers.dev/api/admin/withdrawals/WITHDRAWAL_ID

## Cost check (every integration, free plan)
| Part | Plan | Limit that matters | Watch out |
|---|---|---|---|
| Cloudflare Workers | Free | 100,000 requests a day | Past that the API refuses calls until the next day |
| Cloudflare Pages | Free | Static site, unlimited bandwidth | none |
| Supabase database and Storage | Free | 500 MB database, 1 GB files, 5 GB downloads a month | The project pauses after about a week with no traffic; open the dashboard to wake it. Clips hit the limits first |
| Google sign-in | Free | none | Publish the consent screen (4b) |
| Gemini AI helper | Free tier | Daily caps set by Google (the Worker adds its own `AI_DAILY_LIMIT` and `AI_GLOBAL_LIMIT`) | Google retires models often; if the helper stops answering, update `AI_MODEL` in wrangler.toml from https://ai.google.dev/gemini-api/docs/models |
| M-Pesa payments | Manual mode, free | You confirm by hand | Safaricom's normal receiving charges can apply to a Till or Paybill; a personal number pays none |
| Domain | Already bought (Olitt) | Renews yearly, about KSh 1,200 | Cloudflare DNS and Pages are free; only the yearly renewal costs |
| TinyPesa | Optional, paid | Its own fees | Off by default |
Limits are the providers' current published ones and can change; check their pricing pages before launch.
