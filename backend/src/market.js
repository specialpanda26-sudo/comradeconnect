// Market listings and escrow orders.
import { json, err, sb, rows, one, post, patch, enc, inList, str, int, UUID, deriveCode, codeHash, tsEqual, throttle, tooMany, user, authProfile, contactBlock, ahead, DAY, normPhone } from './lib.js';
import { initPayment, credit } from './pay.js';
import { getSettings, feeOf } from './settings.js';
import { disputeHours } from './trust.js';
import { isWholesaler, activeListings } from './wholesale.js';
import { balance } from './account.js';
import { creditFor, spendPoints, giveBack, awardPoints } from './points.js';

const CATS = ['General', 'Electronics', 'Books', 'Clothes', 'Furniture', 'Food', 'Services', 'Other'];
import { mediaUrl } from './storage.js';
import { ratingMap, myRatings } from './ratings.js';

async function decorate(env, list, me) {          // photos + seller handle, never the seller's aid
  if (!list.length) return [];
  const ids = list.map((l) => l.id), aids = [...new Set(list.map((l) => l.seller_aid))];
  const photos = await rows(await sb(env, `media?select=listing_id,r2_key&kind=eq.listing_photo&status=eq.ready&listing_id=${inList(ids)}&order=created_at.asc`));
  const profs = await rows(await sb(env, `profiles?select=*&aid=${inList(aids)}`));
  const rt = await ratingMap(env, aids);
  return list.map((l) => {
    const p = profs.find((x) => x.aid === l.seller_aid);
    return {
      id: l.id, title: l.title, description: l.description, category: l.category, price: l.price, zone: l.zone, condition: l.condition,
      status: l.status, reject_reason: me && me.aid === l.seller_aid ? l.reject_reason : undefined,
      photos: photos.filter((x) => x.listing_id === l.id).map((x) => mediaUrl(env, x.r2_key)),
      seller: { handle: p?.handle || 'Seller', verified: !!p?.verified, student: !!p?.student_verified, rating: rt[l.seller_aid] || null },
      contact_phone: me && me.aid === l.seller_aid ? l.contact_phone || undefined : undefined,
      mine: !!me && me.aid === l.seller_aid, createdAt: Date.parse(l.created_at),
    };
  });
}

// ---------- escrow transitions (each is one conditional UPDATE, so two requests can never both win) ----------
export async function releaseOrder(env, id, by, from = ['handed']) {
  const [o] = await rows(await patch(env, `orders?id=eq.${id}&status=${inList(from)}`, {
    status: 'released', released_at: new Date().toISOString(), confirmed_at: new Date().toISOString(), decided_by: by,
    dispute_status: 'none',
  }));
  if (!o) return null;
  await credit(env, o.seller_aid, o.seller_amount ?? o.amount, 'sale', o.id, 'Sale');
  await awardPoints(env, o.seller_aid, 'sale', o.id, 10).catch(() => {});
  await awardPoints(env, o.buyer_aid, 'purchase', o.id, 5).catch(() => {});
  return o;
}
export async function refundOrder(env, id, by) {
  const [o] = await rows(await patch(env, `orders?id=eq.${id}&status=${inList(['held', 'handed', 'disputed'])}`, {
    status: 'refunded', refunded_at: new Date().toISOString(), decided_by: by, dispute_status: 'resolved_refund',
  }));
  if (!o) return null;
  const used = o.credit_ksh || 0;   // the buyer paid cash for the price minus the points credit
  if (o.amount - used > 0) await credit(env, o.buyer_aid, o.amount - used, 'refund', o.id, 'Order refunded');
  if (used > 0) await giveBack(env, o.buyer_aid, 'pay:' + o.payment_id);   // goes to the buyer's wallet; withdraw to M-Pesa is a manual step
  await patch(env, `listings?id=eq.${o.listing_id}&status=eq.sold`, { status: 'approved' });
  await patch(env, `referrals?order_id=eq.${o.id}&status=eq.pending`, { status: 'void' });
  return o;
}

// Called when an 'order' payment is confirmed by the M-Pesa callback.
export async function createOrderFromPayment(env, p) {
  const [l] = await rows(await patch(env, `listings?id=eq.${p.ref_id}&status=eq.approved`, { status: 'sold' }));   // claim the listing atomically
  if (!l) { await credit(env, p.aid, p.amount, 'refund', 'pay:' + p.id, 'Item no longer available'); if (p.credit_ksh > 0) await giveBack(env, p.aid, 'pay:' + p.id); return null; }
  const credit_ksh = p.credit_ksh || 0, price = p.amount + credit_ksh;   // price = cash paid + points credit
  const fee = feeOf(price, (await getSettings(env)).platform_fee_percent);   // fixed on the order now: later fee changes never touch it
  const id = crypto.randomUUID();
  const o = await one(await post(env, 'orders', {
    id, payment_id: p.id, listing_id: l.id, buyer_aid: p.aid, seller_aid: l.seller_aid, amount: price, fee, seller_amount: price - fee, ...(credit_ksh ? { credit_ksh } : {}),
    status: 'held', code_hash: await codeHash(env, 'order', id, await deriveCode(env, 'order', id, 6)),
  }));
  if (!o) { await patch(env, `listings?id=eq.${l.id}`, { status: 'approved' }); if (credit_ksh) await giveBack(env, p.aid, 'pay:' + p.id); return null; }
  await patch(env, `referrals?referred_aid=eq.${enc(p.aid)}&status=eq.pending&order_id=is.null`, {
    order_id: id, unlock_at: ahead(Number(env.REFERRAL_UNLOCK_DAYS || 7) * DAY),
  });
  return o;
}

export async function marketRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/market') && !path.startsWith('/api/orders')) return null;
  const body = async () => (await req.json().catch(() => ({})));

  // ---- create a listing (goes to the admin review queue) ----
  if (path === '/api/market/listings' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body();
    const title = str(b.title, 80), description = str(b.description, 600), zone = str(b.zone, 30), condition = str(b.condition, 20);
    const S = await getSettings(env), category = CATS.includes(b.category) ? b.category : 'General', price = int(b.price, S.listing_price_min, S.listing_price_max);
    if (title.length < 3 || !price) return err(env, `Add a title and a price (KSh ${S.listing_price_min.toLocaleString('en-US')} to ${S.listing_price_max.toLocaleString('en-US')})`);
    const contact_phone = normPhone(b.contact_phone);
    if (!contact_phone) return err(env, 'Add your phone number (like 0712345678). The buyer sees it only after they pay.');
    const blk = contactBlock(env, title, description, zone, condition); if (blk) return blk;
    if (!isWholesaler(u) && (await activeListings(env, u.aid)) >= S.free_listing_limit) return err(env, `Free sellers can have ${S.free_listing_limit} items posted at once. Join the wholesalers community (KSh ${S.wholesale_fee}) to post as many as you want.`, 402);
    const live = (await getSettings(env)).listing_auto_publish === 1;
    const ins = await post(env, 'listings', { seller_aid: u.aid, title, description, category, price, zone, condition: condition || null, contact_phone, ip,
      ...(live ? { status: 'approved', approved_by: 'auto', approved_at: new Date().toISOString() } : {}) });
    const insText = await ins.text().catch(() => ''); let l = null; try { const d = JSON.parse(insText); l = Array.isArray(d) ? d[0] : null; } catch (e) {}
    if (!l) {
      console.error('listing insert failed', ins.status, insText.slice(0, 400));
      const schema = /column|schema cache|relation|does not exist|constraint/i.test(insText);
      return err(env, schema ? 'Market is being updated. Please try again in a few minutes.' : 'Could not save the listing', schema ? 503 : 500);
    }
    return json(env, (await decorate(env, [l], u))[0], 201);
  }
  // ---- browse approved listings ----
  if (path === '/api/market/listings' && m === 'GET') {
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1), limit = Math.min(30, Math.max(1, parseInt(url.searchParams.get('limit')) || 12));
    let q = `listings?status=eq.approved&order=created_at.desc&limit=${limit + 1}&offset=${(page - 1) * limit}`;
    const cat = url.searchParams.get('category'); if (cat && CATS.includes(cat)) q += `&category=eq.${enc(cat)}`;
    const zone = url.searchParams.get('zone'); if (zone && zone !== 'All') q += `&zone=eq.${enc(zone.slice(0, 30))}`;
    const r = await rows(await sb(env, q));
    const me = req.headers.get('X-Token') ? await authProfile(req, env) : null;
    return json(env, { listings: await decorate(env, r.slice(0, limit), me), hasMore: r.length > limit });
  }
  if (path === '/api/market/mine' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    return json(env, { listings: await decorate(env, await rows(await sb(env, `listings?seller_aid=eq.${enc(u.aid)}&order=created_at.desc&limit=50`)), u) });
  }
  let mm = path.match(/^\/api\/market\/listings\/([0-9a-f-]{36})$/);
  if (mm && m === 'GET') {
    const l = await one(await sb(env, `listings?id=eq.${mm[1]}&status=in.(approved,sold)`));
    return l ? json(env, (await decorate(env, [l], null))[0]) : err(env, 'Not found', 404);
  }
  mm = path.match(/^\/api\/market\/listings\/([0-9a-f-]{36})\/remove$/);
  if (mm && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const r = await rows(await patch(env, `listings?id=eq.${mm[1]}&seller_aid=eq.${enc(u.aid)}&status=in.(pending,approved,rejected)`, { status: 'removed' }));
    return r.length ? json(env, { ok: true }) : err(env, 'Cannot remove this listing', 409);
  }

  // ---- buy: starts the M-Pesa prompt; the order is created when the callback confirms payment ----
  if (path === '/api/market/buy' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body();
    if (!UUID.test(String(b.listing_id || ''))) return err(env, 'Pick an item');
    const l = await one(await sb(env, `listings?id=eq.${b.listing_id}&status=eq.approved`));
    if (!l) return err(env, 'This item is no longer available', 404);
    if (l.seller_aid === u.aid) return err(env, 'You cannot buy your own item', 400);
    // Points can pay for the platform's fee on this purchase (never more), so the seller still gets their full share.
    if (b.pay_with === 'wallet') {
      const c = b.use_points ? await creditFor(env, u.aid, l.price) : { ksh: 0, pts: 0 }, cash = l.price - c.ksh, pid = crypto.randomUUID();
      if ((await balance(env, u.aid)) < cash) return err(env, 'Not enough wallet balance. Deposit first.', 402);
      if (c.ksh > 0 && !(await spendPoints(env, u.aid, c.pts, pid))) return err(env, 'Not enough points. Try again without points.', 409);
      const pr = await one(await post(env, 'payments', { id: pid, aid: u.aid, purpose: 'order', ref_id: l.id, amount: cash, phone: 'wallet', ip, status: 'paid', receipt: 'WAL' + pid.replace(/-/g, '').slice(0, 12).toUpperCase(), paid_at: new Date().toISOString(), ...(c.ksh > 0 ? { credit_ksh: c.ksh } : {}) }));
      if (!pr) { if (c.ksh > 0) await giveBack(env, u.aid, 'pay:' + pid); return err(env, 'Could not start the order', 500); }
      await credit(env, u.aid, -cash, 'purchase', 'pay:' + pid, 'Bought: ' + l.title.slice(0, 40));
      if ((await balance(env, u.aid)) < 0) {
        await patch(env, `wallet_ledger?kind=eq.purchase&ref=eq.${enc('pay:' + pid)}`, { status: 'void' });
        await patch(env, `payments?id=eq.${pid}`, { status: 'failed' });
        if (c.ksh > 0) await giveBack(env, u.aid, 'pay:' + pid);
        return err(env, 'Not enough wallet balance', 402);
      }
      const o = await createOrderFromPayment(env, pr);
      return o ? json(env, { paid: 'wallet', order_id: o.id, amount: cash, credit: c.ksh, price: l.price }) : err(env, 'This item was just sold. Your money is back in your wallet.', 409);
    }
    const c = b.use_points ? await creditFor(env, u.aid, l.price) : { ksh: 0, pts: 0 };
    const r = await initPayment(env, ip, { aid: u.aid, purpose: 'order', ref_id: l.id, amount: l.price - c.ksh, phone: b.phone, credit_ksh: c.ksh });
    if (r.res) return r.res;
    if (c.ksh > 0 && !(await spendPoints(env, u.aid, c.pts, r.id))) {
      await patch(env, `payments?id=eq.${r.id}&status=eq.pending`, { status: 'failed' });
      return err(env, 'Not enough points. Try again without points.', 409);
    }
    return json(env, { id: r.id, amount: l.price - c.ksh, credit: c.ksh, price: l.price });
  }

  // ---- orders ----
  if (path === '/api/orders/mine' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const a = enc(u.aid);
    const all = [...await rows(await sb(env, `orders?buyer_aid=eq.${a}&order=created_at.desc&limit=50`)), ...await rows(await sb(env, `orders?seller_aid=eq.${a}&order=created_at.desc&limit=50`))];
    const ls = all.length ? await rows(await sb(env, `listings?select=id,title,contact_phone&id=${inList(all.map((o) => o.listing_id))}`)) : [];
    const mine = await myRatings(env, all.filter((o) => o.buyer_aid === u.aid && o.status === 'released').map((o) => o.id));
    const out = [];
    for (const o of all.sort((x, y) => (x.created_at < y.created_at ? 1 : -1))) {
      const buyer = o.buyer_aid === u.aid;
      out.push({
        id: o.id, role: buyer ? 'buyer' : 'seller', title: ls.find((l) => l.id === o.listing_id)?.title || 'Item',
        seller_phone: buyer && ['held', 'handed', 'disputed', 'released'].includes(o.status) ? ls.find((l) => l.id === o.listing_id)?.contact_phone || null : undefined, amount: o.amount,
        you_receive: buyer ? undefined : o.seller_amount, fee: buyer ? undefined : o.fee, status: o.status, dispute_status: o.dispute_status, dispute_reason: o.dispute_reason, dispute_due_at: o.dispute_status === 'open' && o.disputed_at ? new Date(Date.parse(o.disputed_at) + disputeHours(env) * 3600e3).toISOString() : undefined,
        // only the buyer can see the handover code; the seller must be given it in person
        code: buyer && ['held', 'handed', 'disputed'].includes(o.status) ? await deriveCode(env, 'order', o.id, 6) : undefined,
        my_rating: buyer ? mine[o.id] || null : undefined, handed_at: o.handed_at, auto_release_at: o.auto_release_at, released_at: o.released_at, refunded_at: o.refunded_at, createdAt: Date.parse(o.created_at),
      });
    }
    return json(env, { orders: out });
  }

  mm = path.match(/^\/api\/orders\/([0-9a-f-]{36})\/(handed|confirm|received|dispute)$/);
  if (mm && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const id = mm[1], act = mm[2], b = await body();
    const o = await one(await sb(env, `orders?id=eq.${id}`));
    if (!o || (o.buyer_aid !== u.aid && o.seller_aid !== u.aid)) return err(env, 'Not found', 404);

    if (act === 'handed') {                                    // seller: "I gave the item to the buyer"
      if (o.seller_aid !== u.aid) return err(env, 'Only the seller can do this', 403);
      const r = await rows(await patch(env, `orders?id=eq.${id}&status=eq.held&dispute_status=eq.none`, {
        status: 'handed', handed_at: new Date().toISOString(), auto_release_at: ahead((await getSettings(env)).escrow_auto_release_days * DAY),
      }));
      return r.length ? json(env, { status: 'handed' }) : err(env, 'This order cannot be marked as handed over', 409);
    }
    if (act === 'confirm') {                                   // seller types the buyer's code to release the money
      if (o.seller_aid !== u.aid) return err(env, 'Only the seller can do this', 403);
      if (o.status !== 'handed' || o.dispute_status !== 'none') return err(env, 'Mark the item as handed over first', 409);
      if (o.code_attempts >= 5) return err(env, 'Too many wrong codes. Open a dispute or wait for auto-release.', 429);
      // Take one attempt BEFORE checking the code, using an optimistic lock, so parallel guesses cannot beat the limit.
      const took = await rows(await patch(env, `orders?id=eq.${id}&code_attempts=eq.${o.code_attempts}`, { code_attempts: o.code_attempts + 1 }));
      if (!took.length) return err(env, 'Try again in a moment', 429);
      const code = String(b.code || '').replace(/\D/g, '');
      if (!tsEqual(o.code_hash || '', await codeHash(env, 'order', id, code))) return err(env, `Wrong code. ${4 - o.code_attempts} tries left.`, 400);
      const r = await releaseOrder(env, id, 'seller-code');
      return r ? json(env, { status: 'released' }) : err(env, 'This order can no longer be released', 409);
    }
    if (act === 'received') {                                  // buyer: "I got the item", releases the money without needing the code
      if (o.buyer_aid !== u.aid) return err(env, 'Only the buyer can do this', 403);
      if (o.dispute_status !== 'none') return err(env, 'This order has an open dispute', 409);
      const r = await releaseOrder(env, id, 'buyer-confirm', ['held', 'handed']);
      return r ? json(env, { status: 'released' }) : err(env, 'This order can no longer be released', 409);
    }
    if (act === 'dispute') {                                   // buyer or seller flags a problem; admin decides
      const reason = str(b.reason, 300);
      if (reason.length < 5) return err(env, 'Tell us what went wrong (at least a few words)');
      const blk = contactBlock(env, reason); if (blk) return blk;
      const r = await rows(await patch(env, `orders?id=eq.${id}&status=${inList(['held', 'handed'])}&dispute_status=eq.none`, {
        status: 'disputed', dispute_status: 'open', dispute_reason: reason, disputed_at: new Date().toISOString(), dispute_by: u.aid,
      }));
      return r.length ? json(env, { status: 'disputed' }) : err(env, 'This order cannot be disputed now', 409);
    }
  }
  return null;
}

// Cron: release handed-over orders whose buyer never disputed within the window.
export async function autoReleaseOrders(env) {
  const due = await rows(await sb(env, `orders?select=id&status=eq.handed&dispute_status=eq.none&auto_release_at=lte.${new Date().toISOString()}&limit=100`));
  let n = 0;
  for (const o of due) if (await releaseOrder(env, o.id, 'auto-release')) n++;
  return n;
}
