# Ludo + Withdrawals work: handoff

Goal: make Ludo match the site (monochrome glass, Poppins, no emoji, theme-aware), let players set any stake, and make the withdrawal panel explain exactly what is missing. Tell the next AI to read this file first.

## Phases
1. DONE: Offline game `frontend/ludo.html` rebuilt (site theme, 3D cube dice, SVG tokens/stars, custom stake input with validation, correct stake/pot/fee maths, bot and UI fixes).
2. TODO: Online lobby `frontend/ludo-online.html`: same redesign, custom KES stake input (min/max from `/api/ludo/config`), live pot/fee preview, no emoji.
3. TODO: Online board screen + backend review `backend/src/ludo.js` (stake validation, refunds, payout idempotency, timeouts/away handling).
4. TODO: Withdrawal panel: find the withdraw UI (see `cc-gifts-withdraw.js`, `supabase/points-and-1-bob-withdrawals.sql`, backend withdraw route) and read the real rules (minimum, fee, step).
5. TODO: Explainable withdrawals: if balance can't be withdrawn exactly (e.g. KSh 500), show why and how much more to add (or the max withdrawable), with the fee breakdown.
6. TODO: Final QA: light/dark theme, small phones, service worker cache bump (`sw.js`), `cc-ludo.js` entry card style, README/API notes.

## Phase 1 notes
- Theme comes from `/cc-theme.js` (`data-theme` light/dark). Board colours are CSS variables.
- Offline points balance is in localStorage `ludo_pts`. Offline stake: min 10, max 100000, must be <= balance.
- Offline pot = stake x seats; only the human host's stake is deducted. Fee 7% (matches `LUDO_FEE_PERCENT`).

## Phase 2 part 1 notes
- `frontend/ludo-loader.js`: loading screen with two 3D tumbling dice. Include with `<script src="/ludo-loader.js"></script>` in head. Add `data-hold` to keep it up until the page calls `LudoLoader.hide()`. Min 1.5s, failsafe 9s. Follows theme vars.
- Hooked into `ludo.html` (auto hides on load).
