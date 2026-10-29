// Wholesaler membership: a paid plan (default KSh 100 per 30 days) that lifts the free-seller limits.
// Pay from the wallet, or by M-Pesa (purpose 'wholesale'). Joining and renewing are the same action.
import { json, err, sb, rows, patch, enc, user, normPhone, DAY } from './lib.js';
import { initPayment, credit } from './pay.js';
import { getSettings } from './settings.js';
import { balance } from './account.js';

export const isWholesaler = (p) => !!(p && p.wholesaler_until && Date.parse(p.wholesaler_until) > Date.now());

// Adds the plan length after whatever time is left, so renewing early never wastes days.
export async function extendWholesale(env, aid) {
  const S = await getSettings(env);
  const [p] = await rows(await sb(env, `profiles?select=wholesaler_until&aid=eq.${enc(aid)}`));
  const start = Math.max(Date.now(), p && p.wholesaler_until ? Date.parse(p.wholesaler_until) : 0);
  const until = new Date(start + S.wholesale_days * DAY).toISOString();
  const res = await patch(env, `profiles?aid=eq.${enc(aid)}`, { wholesaler_until: until });
  if (!res.ok) { console.error('wholesale: could not save the membership for', aid); return null; }
  return until;
}
export async function activeListings(env, aid) {
  return (await rows(await sb(env, `listings?select=id&seller_aid=eq.${enc(aid)}&status=in.(pending,approved)`))).length;
}
export async function wholesaleRoutes(req, env, url, ip) {
  const path = url.pathname;
  if (!path.startsWith('/api/wholesale')) return null;
  if (path === '/api/wholesale/me' && req.method === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const S = await getSettings(env);
    return json(env, { active: isWholesaler(u), until: u.wholesaler_until || null, fee: S.wholesale_fee, days: S.wholesale_days,
      free_limit: S.free_listing_limit, photos: S.wholesale_photos, used: await activeListings(env, u.aid), balance: await balance(env, u.aid) });
  }
  if (path === '/api/wholesale/join' && req.method === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await req.json().catch(() => ({})), S = await getSettings(env);
    if (b.method === 'wallet') {
      if ((await balance(env, u.aid)) < S.wholesale_fee) return err(env, 'Not enough wallet balance. Deposit first or pay with M-Pesa.', 402);
      const ref = 'ws:' + crypto.randomUUID();
      const undo = () => patch(env, `wallet_ledger?kind=eq.wholesale_fee&ref=eq.${enc(ref)}`, { status: 'void' });
      if (!(await credit(env, u.aid, -S.wholesale_fee, 'wholesale_fee', ref, 'Wholesaler membership'))) return err(env, 'Wallet payment is not ready yet. Nothing was charged.', 503);
      if ((await balance(env, u.aid)) < 0) { await undo(); return err(env, 'Not enough wallet balance', 402); }
      const until = await extendWholesale(env, u.aid).catch(() => null);
      if (!until) { await undo(); return err(env, 'Something went wrong. Nothing was charged.', 500); }
      return json(env, { active: true, until });
    }
    if (b.method !== 'card' && !normPhone(b.phone)) return err(env, 'Enter a Safaricom or Airtel number like 0712345678');
    const r = await initPayment(env, ip, { aid: u.aid, purpose: 'wholesale', amount: S.wholesale_fee, phone: b.phone, method: b.method, email: b.email });
    return r.res || json(env, { id: r.id, url: r.url, amount: S.wholesale_fee });
  }
  return null;
}
