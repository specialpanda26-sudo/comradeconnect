// Admin-editable money settings (marketplace fee, advert prices, payout rules).
// Values live in the `settings` table; if a value is missing there, the env value (or the default below) is used,
// so the app keeps working even before the SQL is run. Changes apply to NEW orders, boosts and withdrawals only.
import { json, sb, rows, post } from './lib.js';

export const DEFS = {
  platform_fee_percent: { env: 'PLATFORM_FEE_PERCENT', def: 3, min: 0, max: 30, dec: true, unit: '%', label: 'Marketplace fee', help: 'Share of every sale the company keeps. The seller gets the rest after the buyer confirms.' },
  boost_price: { env: 'BOOST_PRICE', def: 30, min: 1, max: 5000, unit: 'KSh', label: 'Advert boost, 24 hours', help: 'Price of pinning a Feed story for 1 day.' },
  boost_price_3d: { env: 'BOOST_PRICE_3D', def: 70, min: 1, max: 15000, unit: 'KSh', label: 'Advert boost, 3 days', help: 'Price of pinning a Feed story for 3 days.' },
  withdraw_min: { env: 'WITHDRAW_MIN', def: 50, min: 50, max: 5000, unit: 'KSh', label: 'Smallest withdrawal', help: 'Sellers cannot request less than this.' },
  withdraw_fee_percent: { env: 'WITHDRAW_FEE_PERCENT', def: 0, min: 0, max: 20, dec: true, unit: '%', label: 'Withdrawal fee (percent)', help: 'Kept from each withdrawal. 0 = free. Use it to cover M-Pesa send charges.' },
  withdraw_fee_flat: { env: 'WITHDRAW_FEE_FLAT', def: 0, min: 0, max: 500, unit: 'KSh', label: 'Withdrawal fee (flat)', help: 'Fixed amount kept from each withdrawal, added to the percent fee.' },
  referral_reward: { env: 'REFERRAL_REWARD', def: 20, min: 0, max: 1000, unit: 'KSh', label: 'Referral reward', help: 'Paid to the inviter after the friend completes a purchase.' },
  listing_price_min: { env: 'LISTING_PRICE_MIN', def: 1, min: 1, max: 250000, unit: 'KSh', label: 'Lowest item price', help: 'Cheapest price a seller can put on a Market item. 1 means any price.' },
  listing_price_max: { env: 'LISTING_PRICE_MAX', def: 150000, min: 1, max: 250000, unit: 'KSh', label: 'Highest item price', help: 'Most a seller can ask for one Market item. M-Pesa allows at most 250,000 per payment.' },
  listing_auto_publish: { env: 'LISTING_AUTO_PUBLISH', def: 1, min: 0, max: 1, unit: '', label: 'New items go live instantly (1 = yes, 0 = admin approves first)', help: '1: items appear on the Market as soon as they are posted and you remove anything unsafe in Live items. 0: every item waits for your approval.' },
  escrow_auto_release_days: { env: 'ESCROW_AUTO_RELEASE_DAYS', def: 3, min: 1, max: 14, unit: 'days', label: 'Auto-release after', help: 'Days after "handed over" before the seller is paid if the buyer says nothing.' },
};

// Returns a clean number or null.
export function clean(d, v) {
  if (v === '' || v === null || v === undefined || typeof v === 'boolean') return null;
  let n = Number(v);
  if (!Number.isFinite(n)) return null;
  n = d.dec ? Math.round(n * 100) / 100 : n;
  if (!d.dec && !Number.isInteger(n)) return null;
  return n >= d.min && n <= d.max ? n : null;
}
export function envDefault(env, key) {
  const d = DEFS[key], raw = env[d.env];
  const n = raw === undefined || raw === '' ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.min(d.max, Math.max(d.min, n)) : d.def;
}

const CACHE = new WeakMap(), TTL = 10e3;
export async function getSettings(env) {
  const c = CACHE.get(env);
  if (c && Date.now() - c.at < TTL) return c.vals;
  const vals = {};
  for (const k of Object.keys(DEFS)) vals[k] = envDefault(env, k);
  try {
    for (const r of await rows(await sb(env, 'settings?select=key,value'))) {
      const v = DEFS[r.key] ? clean(DEFS[r.key], r.value) : null;
      if (v !== null) vals[r.key] = v;
    }
  } catch (e) { /* table not created yet: env values are used */ }
  CACHE.set(env, { at: Date.now(), vals });
  return vals;
}

// Whole shillings, rounded down in the platform's favour only when exact (same rule everywhere).
export const feeOf = (amount, pct) => Math.floor((amount * pct) / 100 + 1e-9);
export const withdrawFee = (amount, S) => Math.ceil((amount * S.withdraw_fee_percent) / 100 - 1e-9) + S.withdraw_fee_flat;
export const boostPlans = (S) => [{ id: '1d', hours: 24, price: S.boost_price }, { id: '3d', hours: 72, price: S.boost_price_3d }];
export const publicConfig = (S) => ({
  fee_percent: S.platform_fee_percent, boost_plans: boostPlans(S),
  price_min: S.listing_price_min, price_max: S.listing_price_max,
  withdraw_min: S.withdraw_min, withdraw_fee_percent: S.withdraw_fee_percent, withdraw_fee_flat: S.withdraw_fee_flat,
});

// Validates and saves. Returns { error } or { changed: { key: [old, new] } }.
export async function saveSettings(env, input) {
  if (!input || typeof input !== 'object') return { error: 'Nothing to save' };
  const cur = await getSettings(env), changed = {};
  for (const [k, v] of Object.entries(input)) {
    const d = DEFS[k];
    if (!d) return { error: 'Unknown setting: ' + k };
    const n = clean(d, v);
    if (n === null) return { error: `${d.label}: enter ${d.dec ? 'a number' : 'a whole number'} from ${d.min} to ${d.max}` };
    if (n !== cur[k]) changed[k] = [cur[k], n];
  }
  const next = { ...cur }; for (const k of Object.keys(changed)) next[k] = changed[k][1];
  if (next.listing_price_min > next.listing_price_max) return { error: 'Lowest item price cannot be higher than the highest item price.' };
  if (withdrawFee(next.withdraw_min, next) >= next.withdraw_min) return { error: 'That withdrawal fee would swallow the smallest withdrawal. Lower the fee or raise the minimum.' };
  for (const [k, [, n]] of Object.entries(changed)) {
    const res = await post(env, 'settings', { key: k, value: n, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=representation');
    if (!res.ok) return { error: 'Could not save. Run the newest SQL (end of supabase/schema.sql) in Supabase first.' };
  }
  CACHE.delete(env);
  return { changed };
}

// Public: the app reads fees and prices from here so the screens never disagree with the server.
export async function settingsRoutes(req, env, url) {
  if (req.method === 'GET' && url.pathname === '/api/config') return json(env, publicConfig(await getSettings(env)));
  return null;
}
