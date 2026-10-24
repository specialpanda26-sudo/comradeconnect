// Seller ratings: the buyer of a completed (released) order can give the seller 1 to 5 stars, once per order.
// Stars only, no comments, so there is nothing to moderate. Sellers are never named: the app shows an average and a count.
import { json, err, sb, rows, one, post, enc, inList, int, UUID, throttle, tooMany, user } from './lib.js';

// { sellerAid: { avg: 4.7, count: 12 } } for the given sellers. Empty if the table is not created yet.
export async function ratingMap(env, aids) {
  const out = {};
  if (!aids.length) return out;
  for (const r of await rows(await sb(env, `seller_ratings?select=seller_aid,stars&seller_aid=${inList(aids)}&limit=5000`))) {
    const o = (out[r.seller_aid] ||= { s: 0, count: 0 }); o.s += r.stars; o.count++;
  }
  for (const k of Object.keys(out)) out[k] = { avg: Math.round((out[k].s / out[k].count) * 10) / 10, count: out[k].count };
  return out;
}

// { orderId: stars } for orders this buyer already rated.
export async function myRatings(env, orderIds) {
  const out = {};
  if (!orderIds.length) return out;
  for (const r of await rows(await sb(env, `seller_ratings?select=order_id,stars&order_id=${inList(orderIds)}`))) out[r.order_id] = r.stars;
  return out;
}

export async function ratingRoutes(req, env, url, ip) {
  const mm = url.pathname.match(/^\/api\/orders\/([0-9a-f-]{36})\/rate$/);
  if (!mm || req.method !== 'POST') return null;
  const u = await user(req, env, true); if (u instanceof Response) return u;
  const b = await req.json().catch(() => ({})), stars = int(b.stars, 1, 5);
  if (!stars) return err(env, 'Pick 1 to 5 stars');
  if (!UUID.test(mm[1])) return err(env, 'Not found', 404);
  const o = await one(await sb(env, `orders?id=eq.${mm[1]}`));
  if (!o || o.buyer_aid !== u.aid) return err(env, 'Not found', 404);
  if (o.status !== 'released') return err(env, 'You can rate the seller after you confirm the item', 409);
  if (!(await throttle(env, ip, 'rate', u.aid, 30, 100))) return tooMany(env);
  if (await one(await sb(env, `seller_ratings?select=order_id&order_id=eq.${enc(o.id)}`))) return err(env, 'You already rated this order', 409);
  const r = await post(env, 'seller_ratings', { order_id: o.id, seller_aid: o.seller_aid, buyer_aid: u.aid, stars }, 'resolution=ignore-duplicates,return=representation');
  return r.ok ? json(env, { ok: true, stars }) : err(env, 'Could not save your rating. Try again later.', 503);
}
