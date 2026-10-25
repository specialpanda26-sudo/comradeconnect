# Comrade Connect (Kirinyaga Edition)

A campus app for Kirinyaga students: Market with escrow, wallet, anonymous messages, roommates, study groups, Hearts, polls, Club shop, event tickets, clips and an admin panel.
Production setup on Render: **RENDER.md** (backend `server.js` + static site). `DEPLOY.md` describes the older Cloudflare route.

## How it is built
| Folder | What it is |
|---|---|
| `frontend/` | Static site (`index.html`, `cc-core.js`, `admin.html`, `config.js` = the only settings file) |
| `server.js` | Starts the API on Render (Node 20+); `render.yaml` is the Blueprint |
| `backend/src/` | Cloudflare Worker API (endpoints listed in `API.md`) |
| `supabase/schema.sql` | Database tables, security rules and the two Storage buckets (safe to run again) |
| `tests/` | `npm test` (Worker, fake database, no keys) and `python3 tests/browser_*.py` (real page, fake Worker) |
| `wrangler.toml` | Worker settings, no secrets |

## Free stack
Cloudflare Workers + Pages, Supabase (database + Storage), Google sign-in, Gemini free tier, and **manual M-Pesa**: buyers pay your number, till or paybill, enter the M-Pesa code, and you confirm it in `admin.html`. TinyPesa (automatic prompts) is optional and has its own fees. Limits and caveats: the "Cost check" table in `DEPLOY.md`.

## Quick start
1. Follow `DEPLOY.md` in order: Supabase, Worker, Pages, payments, domain.
2. Run the tests before real money: `npm test` and `python3 tests/browser_manualpay.py` (needs Playwright; no keys).
3. Test with KSh 1 from two phones before launch.

## Secrets
Never commit keys. Every secret is set with `npx wrangler secret put NAME`; the names are listed in `.env.example` (no values). For local runs copy it to `.dev.vars`, which `.gitignore` already excludes.

## Status
`REMAINING.md` lists what is done, what is not, and every known limit. Nothing has been run against a real Supabase project, Worker or phone yet; the tests use fakes.

## SEO
After the site is live: `python3 set-domain.py YOUR-DOMAIN [GOOGLE_VERIFICATION_CODE]`, re-upload `frontend/`, then add the property and `sitemap.xml` in Google Search Console. Ranking for the single word "comrades" is unrealistic; realistic targets are "Comrade Connect" and "Comrade Connect Kirinyaga".


## Credits
Built by **Ogolla Tech**. Developers: **Christian N.**, **Peter M.**
