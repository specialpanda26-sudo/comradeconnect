# Ludo + Withdrawals work: handoff

Goal: make Ludo match the site (monochrome glass, Poppins, no emoji, theme-aware), let players set any stake, and make the withdrawal panel explain exactly what is missing. Tell the next AI to read this file first.

## Phases
1. DONE: Offline game `frontend/ludo.html` rebuilt (site theme, 3D cube dice, SVG tokens/stars, custom stake input with validation, correct stake/pot/fee maths, bot and UI fixes).
2. DONE: Online lobby `frontend/ludo-online.html`: same redesign, custom KES stake input (min/max from `/api/ludo/config`), live pot/fee preview, no emoji.
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

## Phase 2 notes (online lobby, DONE)
- `frontend/ludo-online.html` rebuilt: site theme, Poppins, no emoji, loader with `data-hold` (hides after config loads).
- Stake input: points 0 to 1000 (0 = free, nothing deducted); KES min/max/balance from `/api/ludo/config`. Shortfall message says exactly how much to add. Live pot, fee and winner-gets preview (fee from config, floor maths same as server).
- Online board restyled the same as offline (SVG stars/arrows, yards) and 3D cube dice with roll animation, so Phase 3 only needs board QA plus the backend review.
- NEXT: Phase 3. Review `backend/src/ludo.js`: stake checks, refunds (leave/cancel/idle), payout idempotency, away players. Then Phase 4.

## Phase 2 notes (online lobby, DONE)
- `frontend/ludo-online.html` rebuilt: site theme, Poppins, no emoji, loader with `data-hold` (hides after config loads).
- Stake input: points 0 to 1000 (0 = free, nothing deducted); KES min/max/balance from `/api/ludo/config`. Shortfall message says exactly how much to add. Live pot, fee and winner-gets preview (fee from config, floor maths same as server).
- Online board restyled the same as offline (SVG stars/arrows, yards) and 3D cube dice with roll animation, so Phase 3 only needs board QA plus the backend review.
- NEXT: Phase 3. Review `backend/src/ludo.js`: stake checks, refunds (leave/cancel/idle), payout idempotency, away players. Then Phase 4.

## Phase 3 part A notes (DONE): backend `backend/src/ludo.js`
- Every seat has a unique `ref`: stake and refund ledger keys are per join, so leave then re-join works and refunds are never lost.
- Pot and prize come from stake x seats, not a stored counter. If the host stake fails, the room closes and only the others are refunded.
- Payout checks the ledger first, so an already-paid winner is not retried forever.
- `GET /api/ludo/room?code=X&back=1` takes an away seat back from the bot. Non-members are rejected before any write.
- New `GET /api/ludo/mine` returns the caller's open room code. Create also blocks players already seated elsewhere.
- State has `rn` (roll counter) and `rv` (last rolled value) so no-move rolls show on every phone.
- Cron cancels and refunds playing rooms idle for 20 min (was 3 h).

## Phase 3 part B notes (DONE): online board `frontend/ludo-online.html`
- Dice follows `rn/rv` from the server, so every phone sees every roll, including rolls with no legal move. Own roll shows the real value, not a random face.
- Reload or app restart resumes the open room through `/api/ludo/mine`, so a stake is never stranded.
- Polls send `back=1` after returning to the tab, so an away seat is taken back from the bot. Offline notice added. Last-moved token has a ring.
- NEXT: Phase 4 (withdrawal panel real rules: minimum, fee, step).
