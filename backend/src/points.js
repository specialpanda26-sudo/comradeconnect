// Points: owned by the server, so a phone can no longer edit them. 50 points = KSh 5 by default (admin > Money and fees).
// Points can only be spent on a Market purchase, and only up to the platform fee on that purchase, so the platform never loses money.
import { json, sb, rows, post, enc, user, throttle, tooMany } from './lib.js';
import { getSettings, feeOf } from './settings.js';

const kenyaDay = (t = Date.now()) => new Date(t + 3 * 3600e3).toISOString().slice(0, 10);
export async function pointsBalance(env, aid) {
  const r = await rows(await sb(env, `points_ledger?select=delta&aid=eq.${enc(aid)}&limit=100000`));
  return r.reduce((s, x) => s + x.delta, 0);
}
async function earnedToday(env, aid) {
  const r = await rows(await sb(env, `points_ledger?select=delta,kind&aid=eq.${enc(aid)}&day=eq.${kenyaDay()}&delta=gt.0`));
  return r.filter((x) => x.kind !== 'spend_back').reduce((s, x) => s + x.delta, 0);
}
// Idempotent per kind+ref. Respects the daily cap. Returns the points actually awarded (0 if capped or already given).
export async function awardPoints(env, aid, kind, ref, pts) {
  const S = await getSettings(env);
  const room = Math.max(0, S.points_daily_cap - (await earnedToday(env, aid)));
  const n = Math.min(pts, room);
  if (!aid || n <= 0) return 0;
  const r = await rows(await post(env, 'points_ledger', { aid, delta: n, kind, ref: String(ref), day: kenyaDay() }, 'resolution=ignore-duplicates,return=representation'));
  return r.length ? n : 0;
}
// How much KSh of fee-covered credit this buyer can use on a price (whole shillings).
export async function creditFor(env, aid, price) {
  const S = await getSettings(env);
  const usable = Math.min(feeOf(price, S.platform_fee_percent), Math.floor((await pointsBalance(env, aid)) / S.points_per_ksh));
  return { ksh: Math.max(0, usable), pts: Math.max(0, usable) * S.points_per_ksh, rate: S.points_per_ksh };
}
// Take the points for a payment. Returns false (and takes nothing) if the balance is not there.
export async function spendPoints(env, aid, pts, payId) {
  if (pts <= 0) return true;
  await post(env, 'points_ledger', { aid, delta: -pts, kind: 'spend', ref: 'pay:' + payId, day: kenyaDay() }, 'resolution=ignore-duplicates,return=representation');
  if ((await pointsBalance(env, aid)) >= 0) return true;
  await giveBack(env, aid, 'pay:' + payId);
  return false;
}
// Return spent points (failed payment, refunded order). Once per ref, and only what was really spent (read from the ledger,
// so a later change of the points rate never changes what comes back).
export async function giveBack(env, aid, ref) {
  const [spent] = await rows(await sb(env, `points_ledger?select=delta&kind=eq.spend&ref=eq.${enc(ref)}&limit=1`));
  if (!spent) return false;
  return (await rows(await post(env, 'points_ledger', { aid, delta: -spent.delta, kind: 'spend_back', ref, day: kenyaDay() }, 'resolution=ignore-duplicates,return=representation'))).length > 0;
}

export async function pointsRoutes(req, env, url, ip) {
  const path = url.pathname;
  if (path === '/api/points' && req.method === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const S = await getSettings(env), pts = await pointsBalance(env, u.aid);
    const ck = await rows(await sb(env, `points_ledger?select=day&aid=eq.${enc(u.aid)}&kind=eq.checkin&order=day.desc&limit=8`));
    let streak = 0; for (let i = 0; i < ck.length; i++) { const want = kenyaDay(Date.now() - (ck[0].day === kenyaDay() ? i : i + 1) * 864e5); if (ck[i].day === want) streak++; else break; }
    return json(env, { points: pts, per_ksh: S.points_per_ksh, value_ksh: Math.floor(pts / S.points_per_ksh), daily_cap: S.points_daily_cap, earned_today: await earnedToday(env, u.aid), checked_in: ck[0]?.day === kenyaDay(), streak });
  }
  if (path === '/api/points/checkin' && req.method === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    if (!(await throttle(env, ip, 'ptcheckin', u.aid, 10, 20))) return tooMany(env);
    const ck = await rows(await sb(env, `points_ledger?select=day&aid=eq.${enc(u.aid)}&kind=eq.checkin&order=day.desc&limit=7`));
    if (ck[0]?.day === kenyaDay()) return json(env, { error: 'Already checked in today' }, 409);
    let streak = 1; for (let i = 0; i < ck.length; i++) { if (ck[i].day === kenyaDay(Date.now() - (i + 1) * 864e5)) streak++; else break; }
    const got = await awardPoints(env, u.aid, 'checkin', u.aid + ':' + kenyaDay(), 2 + Math.min(streak - 1, 5));
    return json(env, { awarded: got, streak, points: await pointsBalance(env, u.aid) });
  }
  return null;
}
