// Admin-editable money settings (marketplace fee, advert prices, payout rules).
// Values live in the `settings` table; if a value is missing there, the env value (or the default below) is used,
// so the app keeps working even before the SQL is run. Changes apply to NEW orders, boosts and withdrawals only.
import { json, sb, rows, post, enc } from './lib.js';
import { campusOf, isAllCampuses, DEFAULT_CAMPUS } from './campus.js';

export const DEFS = {
  platform_fee_percent: { env: 'PLATFORM_FEE_PERCENT', def: 7, min: 0, max: 30, dec: true, unit: '%', label: 'Platform fee (every sale and ticket)', help: 'Share of every Market sale and every event ticket that the website keeps. The seller or host gets the rest. Example: 7 means a KSh 100 sale pays the seller KSh 93.' },
  boost_price: { env: 'BOOST_PRICE', def: 30, min: 1, max: 5000, unit: 'KSh', label: 'Advert boost, 24 hours', help: 'Price of pinning a Feed story for 1 day.' },
  boost_price_3d: { env: 'BOOST_PRICE_3D', def: 70, min: 1, max: 15000, unit: 'KSh', label: 'Advert boost, 3 days', help: 'Price of pinning a Feed story for 3 days.' },
  withdraw_min: { env: 'WITHDRAW_MIN', def: 1, min: 1, max: 5000, unit: 'KSh', label: 'Smallest withdrawal', help: 'Sellers cannot request less than this.' },
  withdraw_max: { env: 'WITHDRAW_MAX', def: 150000, min: 50, max: 250000, unit: 'KSh', label: 'Largest withdrawal', help: 'Sellers cannot request more than this in one withdrawal.' },
  withdraw_fee_percent: { env: 'WITHDRAW_FEE_PERCENT', def: 0, min: 0, max: 20, dec: true, unit: '%', label: 'Withdrawal fee (percent)', help: 'Kept from each withdrawal. 0 = free. Use it to cover M-Pesa send charges.' },
  withdraw_fee_flat: { env: 'WITHDRAW_FEE_FLAT', def: 10, min: 0, max: 500, unit: 'KSh', label: 'Withdrawal fee (flat)', help: 'Fixed amount kept from each withdrawal, added to the percent fee.' },
  points_per_ksh: { env: 'POINTS_PER_KSH', def: 10, min: 1, max: 1000, unit: 'pts', label: 'Points worth KSh 1', help: '10 means 50 points = KSh 5. Points can only be spent on Market items, and never more than your fee on that purchase.' },
  points_daily_cap: { env: 'POINTS_DAILY_CAP', def: 30, min: 0, max: 1000, unit: 'pts', label: 'Most points one account can earn per day', help: 'Limits point farming. 0 stops new points.' },
  referral_reward: { env: 'REFERRAL_REWARD', def: 20, min: 0, max: 1000, unit: 'KSh', label: 'Referral reward', help: 'Paid to the inviter after the friend completes a purchase.' },
  listing_price_min: { env: 'LISTING_PRICE_MIN', def: 1, min: 1, max: 250000, unit: 'KSh', label: 'Lowest item price', help: 'Cheapest price a seller can put on a Market item. 1 means any price.' },
  listing_price_max: { env: 'LISTING_PRICE_MAX', def: 150000, min: 1, max: 250000, unit: 'KSh', label: 'Highest item price', help: 'Most a seller can ask for one Market item. M-Pesa allows at most 250,000 per payment.' },
  listing_auto_publish: { env: 'LISTING_AUTO_PUBLISH', def: 1, min: 0, max: 1, unit: '', label: 'New items go live instantly (1 = yes, 0 = admin approves first)', help: '1: items appear on the Market as soon as they are posted and you remove anything unsafe in Live items. 0: every item waits for your approval.' },
  wholesale_fee: { env: 'WHOLESALE_FEE', def: 100, min: 1, max: 10000, unit: 'KSh', label: 'Wholesaler membership fee', help: 'Paid to join the wholesalers community and again at every renewal.' },
  wholesale_days: { env: 'WHOLESALE_DAYS', def: 30, min: 1, max: 365, unit: 'days', label: 'Wholesaler membership length', help: 'Days one payment keeps the membership active. Renewing early adds days to the end date.' },
  free_listing_limit: { env: 'FREE_LISTING_LIMIT', def: 5, min: 1, max: 1000, unit: 'items', label: 'Live items for free sellers', help: 'Most items a non-wholesaler can have posted at once. Wholesalers have no limit.' },
  wholesale_photos: { env: 'WHOLESALE_PHOTOS', def: 15, min: 5, max: 50, unit: 'photos', label: 'Photos per item for wholesalers', help: 'Free sellers get 5 photos per item.' },
  hostel_reg_fee: { env: 'HOSTEL_REG_FEE', def: 100, min: 0, max: 50000, unit: 'KSh', label: 'Hostel caretaker registration fee', help: 'Paid once by a caretaker before they can post hostel vacancies. 0 = free. Caretakers who already paid keep their access.' },
  gift_fee_percent: { env: 'GIFT_FEE_PERCENT', def: 10, min: 0, max: 50, dec: true, unit: '%', label: 'Gift link fee (percent)', help: 'Share of every gift that the website keeps. The creator gets the rest in their wallet.' },
  gift_min: { env: 'GIFT_MIN', def: 20, min: 1, max: 5000, unit: 'KSh', label: 'Smallest custom gift', help: 'Least a supporter can send with Custom gift.' },
  gift_max: { env: 'GIFT_MAX', def: 20000, min: 50, max: 150000, unit: 'KSh', label: 'Largest custom gift', help: 'Most a supporter can send in one gift.' },
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

export const DEFAULT_ZONES = ['Kerugoya', 'Kutus', 'Kagio', 'On campus'];
// The zones comrades pick from. The admin edits them (admin > Zones); an empty table means the built-in four.
// Each campus has its own list. campus = an id, or 'all' / nothing for every campus together.
export async function getZones(env, campus) {
  const all = !campus || campus === 'all';
  const fallback = () => (all || campus === DEFAULT_CAMPUS ? DEFAULT_ZONES.slice() : ['On campus']);
  try {
    const r = await rows(await sb(env, 'zones?select=name,sort,created_at&order=sort.asc,created_at.asc&limit=400' + (all ? '' : '&campus=eq.' + enc(campus))));
    const names = [...new Set(r.map((x) => x.name).filter(Boolean))];
    return names.length ? names : fallback();
  } catch (e) { return fallback(); }
}
// Whole shillings, rounded down in the platform's favour only when exact (same rule everywhere).
export const feeOf = (amount, pct) => Math.floor((amount * pct) / 100 + 1e-9);
export const withdrawFee = (amount, S) => Math.ceil((amount * S.withdraw_fee_percent) / 100 - 1e-9) + S.withdraw_fee_flat;
export const boostPlans = (S) => [{ id: '1d', hours: 24, price: S.boost_price }, { id: '3d', hours: 72, price: S.boost_price_3d }];
const envNum = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
export const publicConfig = (S, env = {}) => ({
  payout_net_min: envNum(env.PAYOUT_AUTO_MIN, 10), payout_daily_max: envNum(env.PAYOUT_AUTO_DAILY_MAX, 150000), withdraw_requires_id: (env.WITHDRAW_REQUIRES_VERIFIED ?? '1') === '1',
  fee_percent: S.platform_fee_percent, boost_plans: boostPlans(S),
  price_min: S.listing_price_min, price_max: S.listing_price_max,
  points_per_ksh: S.points_per_ksh, withdraw_min: S.withdraw_min, withdraw_max: S.withdraw_max, withdraw_fee_percent: S.withdraw_fee_percent, withdraw_fee_flat: S.withdraw_fee_flat,
  wholesale_fee: S.wholesale_fee, wholesale_days: S.wholesale_days, free_listing_limit: S.free_listing_limit, wholesale_photos: S.wholesale_photos,
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
  if (next.withdraw_min > next.withdraw_max) return { error: 'Smallest withdrawal cannot be higher than the largest withdrawal.' };
  if (withdrawFee(next.withdraw_min, next) >= next.withdraw_min) return { error: 'That withdrawal fee would swallow the smallest withdrawal. Lower the fee or raise the minimum.' };
  for (const [k, [, n]] of Object.entries(changed)) {
    const res = await post(env, 'settings', { key: k, value: n, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=representation');
    if (!res.ok) {
      const t = await res.text().catch(() => ''); console.error('settings save failed', res.status, t.slice(0, 300));
      return { error: /does not exist|schema cache|relation|PGRST20/i.test(t) ? 'The settings table is missing in Supabase. Run the catch-up SQL in the Supabase SQL editor, then save again.' : 'Could not save (' + res.status + '): ' + t.slice(0, 140) };
    }
  }
  CACHE.delete(env);
  return { changed };
}

// Public: the app reads fees and prices from here so the screens never disagree with the server.
export async function settingsRoutes(req, env, url) {
  if (req.method === 'GET' && url.pathname === '/api/config') return json(env, { ...publicConfig(await getSettings(env), env), zones: await getZones(env, campusOf(req) || (isAllCampuses(req) ? 'all' : DEFAULT_CAMPUS)) });
  return null;
}
