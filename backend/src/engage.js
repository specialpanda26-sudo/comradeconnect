// Things that bring people back: Market top sales, the daily streak, and the invite-a-friend dashboard.
import { json, err, sb, rows, enc, inList, user, ago, DAY } from './lib.js';
import { getSettings } from './settings.js';
import { alias } from './stories.js';

const kenyaDay = (t = Date.now()) => new Date(t + 3 * 3600e3).toISOString().slice(0, 10);
const dayList = (n) => Array.from({ length: n }, (_, i) => kenyaDay(Date.now() - (n - 1 - i) * DAY));   // oldest first, ending today

// ---------- streak: how many days in a row someone checked in ----------
export const MILESTONES = [3, 7, 14, 30, 60, 100];
const shift = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);   // plain date arithmetic on YYYY-MM-DD
export function streakOf(days, today = kenyaDay()) {
  const set = new Set(days);
  let cur = 0, d = set.has(today) ? today : set.has(shift(today, -1)) ? shift(today, -1) : null;   // a streak stays alive until the end of the next day
  while (d && set.has(d)) { cur++; d = shift(d, -1); }
  let best = 0, run = 0, prev = null;
  for (const x of [...set].sort()) { run = prev && shift(prev, 1) === x ? run + 1 : 1; best = Math.max(best, run); prev = x; }
  return { current: cur, best };
}

export async function engageRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (m !== 'GET' || !(path === '/api/market/top' || path === '/api/streak' || path === '/api/referral/dashboard')) return null;

  // ---------- Market: top sellers and what is selling, from finished sales in the last 30 days ----------
  if (path === '/api/market/top') {
    const sold = await rows(await sb(env, `orders?select=id,listing_id,seller_aid,amount,created_at&status=eq.released&created_at=gte.${enc(ago(30 * DAY))}&order=created_at.desc&limit=2000`));
    if (!sold.length) return json(env, { sellers: [], categories: [], recent: [], total_sales: 0, days: 30 });
    const aids = [...new Set(sold.map((o) => o.seller_aid))];
    const profs = await rows(await sb(env, `profiles?select=aid,banned,verified,badge&aid=${inList(aids)}`));
    const bad = new Set(profs.filter((p) => p.banned).map((p) => p.aid));
    const ok = sold.filter((o) => !bad.has(o.seller_aid));
    const by = new Map();
    for (const o of ok) { const s = by.get(o.seller_aid) || { aid: o.seller_aid, sales: 0, total: 0 }; s.sales++; s.total += o.amount || 0; by.set(o.seller_aid, s); }
    const top = [...by.values()].sort((a, b) => b.sales - a.sales || b.total - a.total).slice(0, 5);
    const stars = top.length ? await rows(await sb(env, `seller_ratings?select=seller_aid,stars&seller_aid=${inList(top.map((s) => s.aid))}&limit=5000`)) : [];
    const me = req.headers.get('X-Token') ? await user(req, env) : null;
    const sellers = [];
    for (const s of top) {
      const p = profs.find((x) => x.aid === s.aid) || {}, rs = stars.filter((x) => x.seller_aid === s.aid);
      sellers.push({ alias: me && !(me instanceof Response) && me.aid === s.aid ? 'You' : await alias(env, s.aid), mine: !!me && !(me instanceof Response) && me.aid === s.aid, sales: s.sales, verified: !!p.verified, badge: p.badge || null, rating: rs.length ? +(rs.reduce((a, x) => a + x.stars, 0) / rs.length).toFixed(1) : null, ratings: rs.length });
    }
    const ls = await rows(await sb(env, `listings?select=id,title,category,price&id=${inList(ok.slice(0, 200).map((o) => o.listing_id))}`));
    const cats = new Map(); for (const o of ok.slice(0, 200)) { const c = (ls.find((l) => l.id === o.listing_id) || {}).category; if (c) cats.set(c, (cats.get(c) || 0) + 1); }
    const categories = [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([category, sales]) => ({ category, sales }));
    const recent = ok.slice(0, 6).map((o) => { const l = ls.find((x) => x.id === o.listing_id); return l ? { title: l.title, price: o.amount, at: Date.parse(o.created_at) } : null; }).filter(Boolean);
    return json(env, { sellers, categories, recent, total_sales: ok.length, days: 30 });
  }

  const u = await user(req, env); if (u instanceof Response) return u;

  // ---------- streak ----------
  if (path === '/api/streak') {
    const ck = await rows(await sb(env, `points_ledger?select=day&aid=eq.${enc(u.aid)}&kind=eq.checkin&order=day.desc&limit=400`));
    const days = ck.map((x) => String(x.day).slice(0, 10)), { current, best } = streakOf(days), set = new Set(days);
    const next = MILESTONES.find((x) => x > current) || null;
    return json(env, { current, best, checked_in: set.has(kenyaDay()), last14: dayList(14).map((d) => ({ day: d, done: set.has(d) })), milestones: MILESTONES.map((n) => ({ days: n, reached: best >= n })), next, to_next: next ? next - current : 0 });
  }

  // ---------- invite a friend: who joined, who bought, what you earned, and how active you are ----------
  if (path === '/api/referral/dashboard') {
    const S = await getSettings(env), a = enc(u.aid);
    const refs = await rows(await sb(env, `referrals?referrer_aid=eq.${a}&order=created_at.desc&limit=200`));
    const profs = refs.length ? await rows(await sb(env, `profiles?select=aid,handle&aid=${inList(refs.map((r) => r.referred_aid))}`)) : [];
    const people = [];
    for (const r of refs) {
      const p = profs.find((x) => x.aid === r.referred_aid) || {};
      const stage = r.status === 'unlocked' ? 'rewarded' : r.status === 'void' ? 'void' : r.order_id ? 'bought' : 'joined';
      people.push({ name: p.handle || (await alias(env, r.referred_aid)), stage, at: Date.parse(r.created_at), reward: r.reward, unlock_at: r.unlock_at ? Date.parse(r.unlock_at) : null });
    }
    const count = (s) => people.filter((p) => p.stage === s).length;
    const invited = people.length, bought = count('bought') + count('rewarded'), rewarded = count('rewarded'), waiting = count('joined');
    const reward = S.referral_reward || 0, sum = (s) => people.filter((p) => p.stage === s).reduce((n, p) => n + (p.reward || 0), 0);
    const rate = invited >= 5 ? bought / invited : 0.3;                       // what share of invited friends buy; a fair guess until there is enough history
    // your own activity over the last 30 days
    const since = ago(30 * DAY), sd = kenyaDay(Date.now() - 29 * DAY);
    const ts = async (q) => (await rows(await sb(env, q))).map((x) => (x.created_at ? kenyaDay(Date.parse(x.created_at)) : String(x.day).slice(0, 10)));
    const [posts, comments, media, buys, sells, checks] = await Promise.all([
      ts(`posts?select=created_at&aid=eq.${a}&created_at=gte.${enc(since)}&limit=500`), ts(`comments?select=created_at&aid=eq.${a}&created_at=gte.${enc(since)}&limit=500`),
      ts(`media?select=created_at&aid=eq.${a}&kind=in.(clip,video,story_photo,story_video)&status=eq.ready&created_at=gte.${enc(since)}&limit=500`),
      ts(`orders?select=created_at&buyer_aid=eq.${a}&created_at=gte.${enc(since)}&limit=200`), ts(`orders?select=created_at&seller_aid=eq.${a}&created_at=gte.${enc(since)}&limit=200`),
      ts(`points_ledger?select=day&aid=eq.${a}&kind=eq.checkin&day=gte.${sd}&limit=60`)]);
    const parts = [
      { key: 'checkins', n: new Set(checks).size, pts: Math.min(new Set(checks).size, 20) * 2, max: 40, tip: 'Check in each day to build your streak.' },
      { key: 'posts', n: posts.length, pts: Math.min(posts.length, 10) * 2, max: 20, tip: 'Post a story this week.' },
      { key: 'comments', n: comments.length, pts: Math.min(comments.length, 20), max: 20, tip: 'Comment on a few stories.' },
      { key: 'media', n: media.length, pts: Math.min(media.length, 5) * 3, max: 15, tip: 'Share a clip or a story.' },
      { key: 'market', n: buys.length + sells.length, pts: Math.min(buys.length + sells.length, 2) * 2.5, max: 5, tip: 'Buy or sell one thing in the Market.' }];
    const score = Math.round(parts.reduce((n, p) => n + p.pts, 0));
    const weakest = [...parts].sort((x, y) => x.pts / x.max - y.pts / y.max)[0];
    const all = [...posts, ...comments, ...media, ...buys, ...sells, ...checks];
    return json(env, {
      code: u.referral_code, reward, unlock_days: Number(env.REFERRAL_UNLOCK_DAYS || 7),
      funnel: { invited, bought, rewarded, void: count('void') },
      earnings: { earned: sum('rewarded'), coming: sum('bought'), possible: waiting * reward, expected: Math.round(waiting * reward * rate), conversion: invited ? Math.round((bought / invited) * 100) : null },
      people: people.slice(0, 50),
      activity: { score, level: score < 20 ? 'Just starting' : score < 50 ? 'Regular' : score < 80 ? 'Active' : 'Champion', parts: parts.map(({ key, n, pts, max }) => ({ key, n, pts, max })), tip: score >= 95 ? 'You are doing everything right.' : weakest.tip, last14: dayList(14).map((d) => ({ day: d, n: all.filter((x) => x === d).length })) },
    });
  }
  return err(env, 'Not found', 404);
}
