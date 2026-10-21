# Going live on Render (backend + site)

The API code is the same as before; `server.js` runs it as a normal Node web service on Render.
Your static site stays a Render **Static Site**. You will have two Render services:

| Service | Type | What it serves |
|---|---|---|
| comradeconnect (already live) | Static Site | `frontend/` at https://comradeconnect.co.ke |
| comradeconnect-api (new) | Web Service | `server.js` at https://api.comradeconnect.co.ke |

## 1. Database first (Supabase)
1. supabase.com > New project (production). SQL Editor > paste all of `supabase/schema.sql` > Run (safe to repeat). It also creates the buckets `cc-media` (public) and `cc-private` (private).
2. Project Settings > API: copy the **Project URL** and the **service_role** key. The key is a secret: it goes only into Render, never into GitHub or the site.

## 2. Create the web service
Render > New > Web Service > connect the GitHub repo.
- Runtime: Node. Build command: `echo no build`. Start command: `node server.js`.
- Health check path: `/healthz`. Region: Frankfurt (closest to Kenya).
- Plan: the free plan sleeps after 15 minutes and the first request then waits about 50 seconds. For real users use Starter ($7/month).
- Or use the Blueprint: New > Blueprint > pick the repo (`render.yaml` is included), then fill the secret values.

## 3. Environment variables (Render > service > Environment)
**Required (the server refuses to start without these four)**
| Name | Value |
|---|---|
| SUPABASE_URL | Project URL from step 1 |
| SUPABASE_SERVICE_KEY | service_role key |
| ADMIN_KEY | long random string, your admin login: `openssl rand -hex 32` |
| HASH_PEPPER | another long random string. Never change it later or handover and recovery codes stop working |

**Required for the site to work**
| Name | Value |
|---|---|
| ALLOWED_ORIGINS | `https://comradeconnect.co.ke,https://www.comradeconnect.co.ke` (comma separated) |
| PAYMENT_MODE | `manual` |
| MPESA_PAY_TYPE | `send`, `till` or `paybill` |
| MPESA_PAY_TO | your phone, till or paybill number |
| MPESA_PAY_NAME | the name M-Pesa shows for that number |
| GOOGLE_CLIENT_ID | from step 6 (empty = Google button hidden) |

**Recommended**
| Name | Value |
|---|---|
| CRON_SECRET | long random string, used in step 7 |
| GEMINI_API_KEY | free key from aistudio.google.com (empty = AI helper off) |
| NODE_VERSION | `22` |

**Optional tuning (defaults are fine)**: AI_MODEL, AI_DAILY_LIMIT, AI_GLOBAL_LIMIT, PLATFORM_FEE_PERCENT (7), ESCROW_AUTO_RELEASE_DAYS (3), REFERRAL_REWARD (20), REFERRAL_UNLOCK_DAYS (7), BOOST_PRICE (20), CLIP_MAX_MB (25), MEDIA_BUDGET_MB (800), WITHDRAW_REQUIRES_VERIFIED (1), MEDIA_BUCKET, PRIVATE_BUCKET.
Only if you ever use TinyPesa: PAYMENT_MODE=tinypesa, TINYPESA_API_KEY, CALLBACK_SECRET.

If PLATFORM_FEE_PERCENT changes, change `FEE` at the top of `frontend/cc-core.js` too so the app shows the same number.

## 4. Give the API its own address
Render > service > Settings > Custom Domains > add `api.comradeconnect.co.ke`. At your DNS provider add the CNAME Render shows. Wait for the green tick (HTTPS is automatic). Test: open https://api.comradeconnect.co.ke/healthz, it must show `{"ok":true}`.

## 5. Point the site at the API
Edit `frontend/config.js` (the only file with settings):
```
const CC_API = 'https://api.comradeconnect.co.ke';
const CC_GOOGLE_ID = 'xxxx.apps.googleusercontent.com';
```
Commit and push. The Static Site redeploys by itself. (If you skip the custom domain, use the `https://….onrender.com` address of the web service.)
Optional security headers for the Static Site: Render > Static Site > Headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and for `/admin.html` `Cache-Control: no-store` and `X-Frame-Options: DENY`. (The `_headers` file is for Cloudflare and Render ignores it.)

## 6. Google sign-in
1. console.cloud.google.com > create project > APIs & Services > OAuth consent screen: External, app name Comrade Connect, support email. Press **Publish app** (in Testing mode only 100 listed users can sign in).
2. Credentials > Create credentials > OAuth client ID > Web application. Authorized JavaScript origins: `https://comradeconnect.co.ke` and `https://www.comradeconnect.co.ke`. No redirect URI.
3. Copy the Client ID into **both** Render (`GOOGLE_CLIENT_ID`) and `frontend/config.js` (`CC_GOOGLE_ID`). They must be identical or sign-in fails with "Google sign-in failed".
4. Supabase: make sure the last lines of `schema.sql` (the `google_sub` column) have run.
5. Test in Chrome: Market > Buy > Continue with Google. A row with `google_sub` should appear in Supabase > profiles.
Google blocks sign-in inside some in-app browsers (WhatsApp, Instagram links). The sheet offers the recovery-code option, and you can tell people to open the link in Chrome.

## 7. The 15-minute cleanup job
It releases handed-over orders, unlocks referral rewards, expires unpaid payments and tidies storage. `server.js` runs it by itself while awake. To make it reliable (and keep a free plan awake) create a free job on cron-job.org every 15 minutes:
`POST https://api.comradeconnect.co.ke/internal/cron` with header `x-cron-secret: YOUR_CRON_SECRET`.

## 8. Test before real money
1. `/healthz` works; the site loads; Market shows items (an empty Market is normal at first).
2. Create a listing from one phone, open `https://comradeconnect.co.ke/admin.html`, sign in with ADMIN_KEY, approve it.
3. Buy it with KSh 1 from a second phone, pay your number, enter the code, tap "Money received" in admin, enter the handover code. The order must reach `released`.
4. Do something wrong on purpose (a phone number in a post, a wrong recovery code, airplane mode). You should see a short plain message each time, never a blank screen.

## 9. Before launch checklist
- Rotate any key that was ever pasted into chat, GitHub or a screenshot.
- Lawyer review of the Privacy Policy and Terms; escrow wording agreed with Safaricom.
- Supabase backups (free plan: export weekly).
- Keep `.env`, `.dev.vars` and `*.zip` out of Git (`.gitignore` already does).

## 10. Automatic M-Pesa prompts with TinyPesa (optional, replaces manual mode)
1. TinyPesa dashboard > Developer: copy the **link API key** and the **link username** that go together.
2. Render > Environment: `PAYMENT_MODE=tinypesa`, `TINYPESA_API_KEY=...`, `TINYPESA_USERNAME=...`, `CALLBACK_SECRET=<openssl rand -hex 32>`. Keep the same values in `render.yaml` or the next Blueprint sync reverts them.
3. TinyPesa callback URL: `https://YOUR-API-HOST/api/tinypesa/callback?s=YOUR_CALLBACK_SECRET` (the secret must match exactly).
4. Check: the same URL with `?s=wrong` returns 403, with the real secret returns `{"ok":true}`.
5. Buy a KSh 1 item, enter your PIN, confirm `payments.status = paid` in Supabase.
6. If a callback arrives after a payment expired (30 min), the payment moves to admin > Confirm M-Pesa with its receipt. Compare it with your M-Pesa/TinyPesa records, then approve or reject.
7. Roll back any time with `PAYMENT_MODE=manual`.

## 11. Automatic M-Pesa prompts with IntaSend (optional, replaces manual mode)
Runs on its own while you are away. IntaSend sends the prompt, tells us when it is paid, and we double-check with IntaSend before crediting anything.
1. IntaSend dashboard > Settings > API Keys: copy the **secret key** (starts `ISSecretKey_`). For testing use https://sandbox.intasend.com and set `INTASEND_TEST=1`.
2. Render > Environment: `PAYMENT_MODE=intasend`, `INTASEND_SECRET_KEY=...`, `INTASEND_WEBHOOK_CHALLENGE=<openssl rand -hex 32>`.
3. IntaSend > Settings > Webhooks > New: Endpoint `https://YOUR-API-HOST/api/intasend/webhook`, Challenge = the same string as `INTASEND_WEBHOOK_CHALLENGE`, event `collection_event`.
4. Optional backup: also set `TINYPESA_API_KEY` and `TINYPESA_USERNAME`. If IntaSend refuses to send a prompt, TinyPesa is tried automatically.
5. If a webhook is missed, the buyer's app and the 15-minute cron ask IntaSend directly, so nothing stays stuck.
6. If money arrives after a payment expired, it goes to admin > Confirm M-Pesa for you to approve by hand (compare with your M-Pesa/IntaSend statement first).

### Card payments (Visa and Mastercard) through IntaSend
Every pay sheet then shows **M-Pesa | Card**. The buyer types the card on IntaSend's own secure page, so card numbers never reach our server.
1. IntaSend dashboard > Settings > API Keys: also copy the **publishable key** (starts `ISPubKey_`) and set `INTASEND_PUBLISHABLE_KEY` on Render. Ask IntaSend to switch on card collections for your account.
2. Optional: `INTASEND_CARD_TARIFF=CUSTOMER-PAYS` makes the buyer pay IntaSend's card fee (default `BUSINESS-PAYS`: you pay it). `SITE_URL` if your website is not https://comradeconnect.co.ke. `CARD_PAYMENTS=0` switches cards off.
3. The same webhook as above confirms card payments. We always check the payment with IntaSend before crediting. Card payments are not retried by the 15-minute cron, so keep the webhook working; a payment that arrives late goes to admin > Confirm M-Pesa.
