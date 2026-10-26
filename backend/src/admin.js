// Admin API. Login is the ADMIN_KEY (sent as X-Admin-Key). Every action is written to admin_audit_log.
import { json, err, sb, rows, one, post, patch, enc, inList, str, int, UUID, isAdmin, audit, bump, tooMany, corsHeaders, ahead, ago, DAY } from './lib.js';
import { releaseOrder, refundOrder } from './market.js';
import { credit, hooks } from './pay.js';
import { HIDE } from './content.js';
import { validateTicket } from './club.js';
import { getSettings, saveSettings, DEFS, envDefault, getZones, DEFAULT_ZONES, getGateways, saveGateways, GW_AREAS, GW_NAMES } from './settings.js';
import { payMode, gatewayReady } from './pay.js';
import { contactBlock } from './lib.js';

import * as store from './storage.js';
import { mediaUrl, PRIVATE_BUCKET } from './storage.js';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const realDate = (d) => DATE.test(d) && !isNaN(Date.parse(d + 'T00:00:00Z')) && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;   // an impossible date like 2099-13-45 must be refused, not crash
const endsAt = (v) => { v = String(v || '').trim(); if (!v) return null; return realDate(v) ? v + 'T23:59:59Z' : false; };
// Only the fields that were sent are changed. Returns { error } or the row to patch.
function editFields(kind, b) {
  const has = (k) => b[k] !== undefined, row = {};
  if (kind === 'notices') {
    if (has('title')) { const t = str(b.title, 100); if (t.length < 3) return { error: 'Add a title' }; row.title = t; }
    if (has('body')) row.body = str(b.body, 600);
    if (has('pinned')) row.pinned = !!b.pinned;
    if (has('expires_days')) { if (b.expires_days === '' || b.expires_days === null) row.expires_at = null; else { const n = int(b.expires_days, 1, 365); if (!n) return { error: 'Days: 1 to 365' }; row.expires_at = ahead(n * DAY); } }
  } else if (kind === 'events') {
    if (has('title')) { const t = str(b.title, 100); if (t.length < 3) return { error: 'Add a title' }; row.title = t; }
    if (has('date')) { const d = String(b.date || ''); if (!realDate(d)) return { error: 'Use a real date (YYYY-MM-DD)' }; row.starts_on = d; }
    if (has('venue')) row.venue = str(b.venue, 80) || null;
    if (has('details')) row.details = str(b.details, 400) || null;
    if (has('ticket_price')) { if (b.ticket_price === '' || b.ticket_price === null) row.ticket_price = null; else { const n = int(b.ticket_price, 1, 20000); if (!n) return { error: 'Ticket price: KSh 1 to 20,000' }; row.ticket_price = n; } }
  } else {
    if (has('name')) { const n = str(b.name, 80); if (n.length < 2) return { error: 'Add the sponsor name' }; row.name = n; }
    if (has('blurb')) row.blurb = str(b.blurb, 200) || null;
    if (has('link')) { const l = str(b.link, 200); if (l && !/^https:\/\//.test(l)) return { error: 'Links must start with https://' }; row.link = l || null; }
    if (has('amount')) { const n = b.amount === '' ? 0 : int(b.amount, 0, 1000000); if (n === null) return { error: 'Amount must be a number' }; row.amount = n; }
    if (has('active')) row.active = !!b.active;
    if (has('ends_on')) { const e = endsAt(b.ends_on); if (e === false) return { error: 'End date must look like 2026-12-31' }; row.ends_at = e; }
  }
  return row;
}

export async function adminRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/admin/') || path.startsWith('/api/admin/posts/')) return null;
  const body = async () => (await req.json().catch(() => ({})));

  if (path === '/api/admin/login' && m === 'POST') {      // replaces the old local PIN
    if (!isAdmin(req, env)) {
      if (!(await bump(env, 'adminfail:' + ip, 10))) return tooMany(env);
      return err(env, 'Wrong admin key', 403);
    }
    await audit(env, 'login', null, null, null, ip);
    return json(env, { ok: true });
  }
  if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);
  const A = (action, type, id, detail) => audit(env, action, type, id, detail, ip);

  // ---- review queue ----
  if (path === '/api/admin/queue' && m === 'GET') {
    // Recent payments that did not complete, with the reason when the database has the reason columns.
    const failedList = async () => {
      const base = `payments?status=in.(failed,expired)&created_at=gte.${ago(7 * 864e5)}&order=created_at.desc&limit=50&select=id,purpose,amount,phone,status,created_at`;
      let r = await sb(env, base + ',fail_reason,fail_code');
      if (!r.ok) r = await sb(env, base);
      return rows(r);
    };
    const failed = await failedList();
    const [ls, vs, disputes, wds, creps, mreps, under, confirm] = await Promise.all([
      sb(env, 'listings?status=eq.pending&order=created_at.asc&limit=50'), sb(env, 'verifications?select=id,aid,full_name,claimed_role,id_number,group_link,barcode_check,created_at&status=eq.pending&order=created_at.asc&limit=50'),
      sb(env, 'orders?dispute_status=eq.open&order=disputed_at.asc&limit=50'), sb(env, 'withdrawals?status=eq.requested&order=created_at.asc&limit=50'),
      sb(env, 'content_reports?status=eq.open&order=created_at.asc&limit=100'), sb(env, 'message_reports?status=eq.open&order=created_at.asc&limit=100'),
      sb(env, 'payments?select=id,aid,purpose,amount,receipt,created_at&status=eq.underpaid&order=created_at.desc&limit=50'),
      sb(env, 'payments?select=id,purpose,amount,phone,receipt,created_at&status=eq.submitted&order=created_at.asc&limit=50'),
    ].map((p) => p.then(rows)));
    const photos = ls.length ? await rows(await sb(env, `media?select=listing_id,r2_key&kind=eq.listing_photo&status=eq.ready&listing_id=${inList(ls.map((l) => l.id))}`)) : [];
    const titles = disputes.length ? await rows(await sb(env, `listings?select=id,title&id=${inList(disputes.map((o) => o.listing_id))}`)) : [];
    return json(env, {
      counts: { listings: ls.length, verifications: vs.length, disputes: disputes.length, withdrawals: wds.length, reports: creps.length + mreps.length, underpaid: under.length, confirm: confirm.length, failed: failed.length },
      listings: ls.map((l) => ({ id: l.id, title: l.title, description: l.description, price: l.price, category: l.category, seller: l.seller_aid, createdAt: Date.parse(l.created_at), photos: photos.filter((p) => p.listing_id === l.id).map((p) => mediaUrl(env, p.r2_key)) })),
      verifications: vs, withdrawals: wds, underpaid: under, confirm, failed, content_reports: creps, message_reports: mreps,
      disputes: disputes.map((o) => ({ id: o.id, title: titles.find((t) => t.id === o.listing_id)?.title, amount: o.amount, status: o.status, reason: o.dispute_reason, opened_by: o.dispute_by === o.buyer_aid ? 'buyer' : 'seller', buyer: o.buyer_aid, seller: o.seller_aid, at: o.disputed_at })),
    });
  }

  // ---- manual M-Pesa: the buyer sent a code; you checked your M-Pesa message ----
  let mm = path.match(/^\/api\/admin\/payments\/([0-9a-f-]{36})$/);
  if (mm && m === 'POST') {
    const act = (await body()).action;
    if (act !== 'approve' && act !== 'reject') return err(env, 'Unknown action');
    const [p] = await rows(await patch(env, `payments?id=eq.${mm[1]}&status=eq.submitted`, act === 'approve' ? { status: 'paid', paid_at: new Date().toISOString() } : { status: 'failed' }));
    if (!p) return err(env, 'This payment is not waiting for a decision', 409);
    if (act === 'approve') await hooks.onPaid(env, p); else await hooks.onFailed(env, p);
    await A('payment.' + act, 'payment', p.id, { amount: p.amount, purpose: p.purpose, receipt: p.receipt });
    return json(env, { ok: true });
  }

  if (path === '/api/admin/listings-live' && m === 'GET') {
    const ls = await rows(await sb(env, 'listings?status=eq.approved&order=created_at.desc&limit=100'));
    const ph = ls.length ? await rows(await sb(env, `media?select=listing_id,r2_key&kind=eq.listing_photo&status=eq.ready&listing_id=${inList(ls.map((l) => l.id))}`)) : [];
    return json(env, { listings: ls.map((l) => ({ id: l.id, title: l.title, description: l.description, price: l.price, category: l.category, seller: l.seller_aid, createdAt: Date.parse(l.created_at), photos: ph.filter((p) => p.listing_id === l.id).map((p) => mediaUrl(env, p.r2_key)) })) });
  }

  mm = path.match(/^\/api\/admin\/listings\/([0-9a-f-]{36})$/);
  if (mm && m === 'POST') {
    const b = await body(), act = b.action;
    if (act === 'approve') {
      const r = await rows(await patch(env, `listings?id=eq.${mm[1]}&status=eq.pending`, { status: 'approved', approved_by: 'admin', approved_at: new Date().toISOString(), reject_reason: null }));
      if (!r.length) return err(env, 'Listing is not waiting for review', 409);
    } else if (act === 'reject') {
      const reason = str(b.reason, 200); if (!reason) return err(env, 'Give a reason so the seller can fix it');
      const r = await rows(await patch(env, `listings?id=eq.${mm[1]}&status=eq.pending`, { status: 'rejected', reject_reason: reason, approved_by: 'admin' }));
      if (!r.length) return err(env, 'Listing is not waiting for review', 409);
    } else if (act === 'remove') await patch(env, `listings?id=eq.${mm[1]}&status=in.(pending,approved)`, { status: 'removed' });
    else return err(env, 'Unknown action');
    await A('listing.' + act, 'listing', mm[1], { reason: b.reason || null });
    return json(env, { ok: true });
  }

  mm = path.match(/^\/api\/admin\/verifications\/([0-9a-f-]{36})(\/image)?$/);
  if (mm && m === 'GET' && mm[2]) {
    const v = await one(await sb(env, `verifications?id=eq.${mm[1]}`));
    const obj = v?.r2_key ? await store.download(env, PRIVATE_BUCKET(env), v.r2_key) : null;
    if (!obj) return err(env, 'Image not available', 404);
    await A('verification.view', 'verification', mm[1]);
    return new Response(obj.body, { headers: { 'Content-Type': v.r2_key.endsWith('png') ? 'image/png' : 'image/jpeg', 'Cache-Control': 'no-store', ...corsHeaders(env) } });
  }
  if (mm && m === 'POST' && !mm[2]) {
    const b = await body(), act = b.action;
    if (act !== 'approve' && act !== 'reject') return err(env, 'Unknown action');
    const [v] = await rows(await patch(env, `verifications?id=eq.${mm[1]}&status=eq.pending`, {
      status: act === 'approve' ? 'approved' : 'rejected', decision_note: str(b.note, 200) || null, decided_by: 'admin', decided_at: new Date().toISOString(), purge_after: ahead(7 * DAY),
    }));
    if (!v) return err(env, 'Request is not waiting for review', 409);
    if (act === 'approve') {
      const badge = b.badge !== false && v.claimed_role && v.claimed_role !== 'Student' ? (v.claimed_role === 'Local seller' ? 'Business' : v.claimed_role) : null;   // admin can approve the ID but refuse the role badge
      await patch(env, `profiles?aid=eq.${enc(v.aid)}`, badge ? { verified: true, badge } : { verified: true });
    }
    await A('verification.' + act, 'verification', v.id, { note: b.note || null, badge: act === 'approve' ? b.badge !== false : null });
    return json(env, { ok: true });
  }

  // ---- escrow disputes: release to seller or refund the buyer ----
  mm = path.match(/^\/api\/admin\/orders\/([0-9a-f-]{36})$/);
  if (mm && m === 'POST') {
    const act = (await body()).action;
    let o;
    if (act === 'release') {
      o = await releaseOrder(env, mm[1], 'admin', ['held', 'handed', 'disputed']);
      if (o) await patch(env, `orders?id=eq.${mm[1]}`, { dispute_status: 'resolved_release' });
    } else if (act === 'refund') o = await refundOrder(env, mm[1], 'admin');
    else return err(env, 'Unknown action');
    if (!o) return err(env, 'This order is already finished', 409);
    await A('order.' + act, 'order', mm[1], { amount: o.amount });
    return json(env, { ok: true, status: act === 'release' ? 'released' : 'refunded' });
  }

  // ---- seller payouts / withdrawals (you send the M-Pesa by hand, then mark it paid) ----
  mm = path.match(/^\/api\/admin\/withdrawals\/([0-9a-f-]{36})$/);
  if (mm && m === 'POST') {
    const b = await body(), act = b.action;
    if (act === 'paid') {
      const ref = str(b.payout_ref, 40); if (!ref) return err(env, 'Add the M-Pesa reference');
      if ((await rows(await sb(env, `withdrawals?select=id&payout_ref=eq.${enc(ref)}&limit=1`))).length) return err(env, 'That M-Pesa code is already recorded on another payout', 409);
      const r = await rows(await patch(env, `withdrawals?id=eq.${mm[1]}&status=eq.requested`, { status: 'paid', payout_ref: ref, decided_by: 'admin', decided_at: new Date().toISOString() }));
      if (!r.length) return err(env, 'Already handled', 409);
    } else if (act === 'reject') {
      const [w] = await rows(await patch(env, `withdrawals?id=eq.${mm[1]}&status=eq.requested`, { status: 'rejected', decided_by: 'admin', decided_at: new Date().toISOString() }));
      if (!w) return err(env, 'Already handled', 409);
      await credit(env, w.aid, w.amount, 'adjustment', 'wdrej:' + w.id, 'Withdrawal rejected, money returned');
    } else return err(env, 'Unknown action');
    await A('withdrawal.' + act, 'withdrawal', mm[1], null);
    return json(env, { ok: true });
  }

  // ---- reports ----
  mm = path.match(/^\/api\/admin\/reports\/(content|message)\/([0-9a-f-]{36})$/);
  if (mm && m === 'POST') {
    const b = await body(), act = b.action, table = mm[1] === 'content' ? 'content_reports' : 'message_reports';
    if (act !== 'action' && act !== 'dismiss') return err(env, 'Unknown action');
    const [r] = await rows(await patch(env, `${table}?id=eq.${mm[2]}&status=eq.open`, { status: act === 'action' ? 'actioned' : 'dismissed', reviewed_by: 'admin', reviewed_at: new Date().toISOString() }));
    if (!r) return err(env, 'Already handled', 409);
    if (mm[1] === 'content' && HIDE[r.target_type] && UUID.test(r.target_id)) {
      if (b.hide) await patch(env, `${HIDE[r.target_type][0]}?id=eq.${r.target_id}`, HIDE[r.target_type][1]);
      if (b.unhide) await patch(env, `${HIDE[r.target_type][0]}?id=eq.${r.target_id}`, HIDE[r.target_type][2]);
    }
    await A('report.' + act, table, mm[2], { hide: !!b.hide, unhide: !!b.unhide });
    return json(env, { ok: true });
  }

  // ---- ban / mute / role ----
  mm = path.match(/^\/api\/admin\/users\/([A-Za-z0-9_-]{6,64})$/);
  if (mm && m === 'POST') {
    const b = await body(), act = b.action, aid = mm[1];
    const p = await one(await sb(env, `profiles?select=aid&aid=eq.${enc(aid)}`)); if (!p) return err(env, 'No such account', 404);
    const upd = { ban: { banned: true }, unban: { banned: false }, unmute: { muted_until: null } }[act];
    if (act === 'mute') { const h = int(b.hours, 1, 24 * 90); if (!h) return err(env, 'Give hours (1 to 2160)'); await patch(env, `profiles?aid=eq.${enc(aid)}`, { muted_until: ahead(h * 3600e3) }); }
    else if (act === 'role') { if (!['user', 'seller', 'club_admin', 'admin'].includes(b.role)) return err(env, 'Unknown role'); await patch(env, `profiles?aid=eq.${enc(aid)}`, { role: b.role }); }
    else if (upd) await patch(env, `profiles?aid=eq.${enc(aid)}`, upd);
    else return err(env, 'Unknown action');
    await A('user.' + act, 'user', aid, { hours: b.hours || null, role: b.role || null, reason: str(b.reason, 200) || null });
    return json(env, { ok: true });
  }

  // ---- notices, events, sponsors ----
  mm = path.match(/^\/api\/admin\/(notices|events|sponsors)$/);
  if (mm && m === 'POST') {
    const b = await body(), kind = mm[1]; let row;
    if (kind === 'notices') {
      const title = str(b.title, 100); if (title.length < 3) return err(env, 'Add a title');
      row = { title, body: str(b.body, 600), pinned: !!b.pinned, expires_at: b.expires_days ? ahead(int(b.expires_days, 1, 365) * DAY) : null, created_by: 'admin' };
    } else if (kind === 'events') {
      const title = str(b.title, 100), date = String(b.date || '');
      if (title.length < 3 || !realDate(date)) return err(env, 'Add a title and a real date (YYYY-MM-DD)');
      row = { title, starts_on: date, venue: str(b.venue, 80) || null, details: str(b.details, 400) || null, ticket_price: int(b.ticket_price, 1, 20000) };
    } else {
      const name = str(b.name, 80); if (name.length < 2) return err(env, 'Add the sponsor name');
      const link = str(b.link, 200); if (link && !/^https:\/\//.test(link)) return err(env, 'Links must start with https://');
      const amount = b.amount === undefined || b.amount === '' ? 0 : int(b.amount, 0, 1000000); if (amount === null) return err(env, 'Amount must be a number');
      const ends = endsAt(b.ends_on); if (ends === false) return err(env, 'End date must look like 2026-12-31');
      row = { name, blurb: str(b.blurb, 200) || null, link: link || null, active: b.active !== false, amount, ends_at: ends };
    }
    const r = await one(await post(env, kind, row));
    if (!r) return err(env, 'Could not save', 500);
    await A(kind + '.create', kind, r.id, row);
    return json(env, r, 201);
  }
  mm = path.match(/^\/api\/admin\/(notices|events|sponsors)\/([0-9a-f-]{36})$/);
  if (mm && m === 'POST') {
    const b = await body();
    if (b.action === 'update') {
      const row = editFields(mm[1], b); if (row.error) return err(env, row.error);
      if (!Object.keys(row).length) return err(env, 'Nothing to change');
      const r = await rows(await patch(env, `${mm[1]}?id=eq.${mm[2]}`, row));
      if (!r.length) return err(env, 'Not found', 404);
      await A(mm[1] + '.update', mm[1], mm[2], row);
      return json(env, { ok: true });
    }
    if (b.action !== 'delete') return err(env, 'Unknown action');
    await sb(env, `${mm[1]}?id=eq.${mm[2]}`, { method: 'DELETE' });
    await A(mm[1] + '.delete', mm[1], mm[2]);
    return json(env, { ok: true });
  }

  // ---- club admin: products, stock, orders, door check ----
  if (path === '/api/admin/club/products' && m === 'POST') {
    const b = await body(), name = str(b.name, 80), price = int(b.price, 0, 100000), qty = int(b.qty, 0, 100000) ?? 0;
    if (name.length < 2 || price === null) return err(env, 'Add a name and a price');
    const p = await one(await post(env, 'club_products', { name, price }));
    if (!p) return err(env, 'Could not save', 500);
    await post(env, 'club_stock', { product_id: p.id, qty });
    await A('club.product.create', 'club_product', p.id, { name, price, qty });
    return json(env, p, 201);
  }
  if (path === '/api/admin/club/stock' && m === 'POST') {
    const b = await body(), qty = int(b.qty, 0, 100000);
    if (!UUID.test(String(b.product_id || '')) || qty === null) return err(env, 'Pick a product and a quantity');
    await post(env, 'club_stock', { product_id: b.product_id, qty, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=representation');
    await A('club.stock.set', 'club_product', b.product_id, { qty });
    return json(env, { ok: true });
  }
  if (path === '/api/admin/club/orders' && m === 'GET') {
    return json(env, { orders: await rows(await sb(env, `club_orders?status=eq.${['paid', 'collected', 'pending'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : 'paid'}&order=created_at.desc&limit=100`)) });
  }
  mm = path.match(/^\/api\/admin\/club\/orders\/([0-9a-f-]{36})\/collect$/);
  if (mm && m === 'POST') {
    const r = await rows(await patch(env, `club_orders?id=eq.${mm[1]}&status=eq.paid`, { status: 'collected' }));
    if (!r.length) return err(env, 'Order is not waiting for collection', 409);
    await A('club.order.collect', 'club_order', mm[1]);
    return json(env, { ok: true });
  }
  if (path === '/api/admin/tickets/validate' && m === 'POST') {
    const b = await body(), r = await validateTicket(env, b.ticket_id, b.code, b.event_id);
    await A(r.ok ? 'ticket.used' : 'ticket.rejected', 'ticket', r.ticket_id || b.ticket_id || b.event_id || null, { reason: r.reason || null });
    return json(env, r.ok ? r : { ...r, error: r.reason }, r.ok ? 200 : 409);
  }

  // ---- money settings: fee %, advert prices, payout rules (apply to NEW orders, boosts and withdrawals) ----
  if (path === '/api/admin/settings' && m === 'GET') {
    const S = await getSettings(env);
    return json(env, { settings: Object.entries(DEFS).map(([key, d]) => ({ key, label: d.label, help: d.help, unit: d.unit, min: d.min, max: d.max, value: S[key], default: envDefault(env, key) })) });
  }
  if (path === '/api/admin/settings' && m === 'POST') {
    const r = await saveSettings(env, (await body()).values);
    if (r.error) return err(env, r.error);
    await A('settings.update', 'settings', null, r.changed);
    return json(env, { ok: true, changed: Object.keys(r.changed).length });
  }
  // ---- which payment gateway each part of the site uses ----
  if (path === '/api/admin/gateways' && m === 'GET') {
    const cur = await getGateways(env), ready = gatewayReady(env), site = payMode(env);
    return json(env, {
      site_default: site,
      gateways: [{ id: 'default', name: 'Site default (' + GW_NAMES[site] + ')', ready: true }].concat(['manual', 'tinypesa', 'intasend'].map((id) => ({ id, name: GW_NAMES[id], ready: ready[id] }))),
      areas: Object.entries(GW_AREAS).map(([key, d]) => ({ key, label: d.label, value: cur[key] })),
    });
  }
  if (path === '/api/admin/gateways' && m === 'POST') {
    const r = await saveGateways(env, (await body()).values);
    if (r.error) return err(env, r.error);
    await A('gateways.update', 'settings', null, r.changed);
    return json(env, { ok: true, changed: Object.keys(r.changed).length });
  }
  // ---- what the company has earned ----
  if (path === '/api/admin/earnings' && m === 'GET') {
    const since = ago(30 * DAY), sum = (l, f) => l.reduce((s, x) => s + (Number(x[f]) || 0), 0), net = (l) => l.reduce((s, x) => s + (Number(x.net ?? x.amount) || 0), 0);
    const [rel, held, boosts, paid, open, sp, gf] = await Promise.all([
      sb(env, 'orders?select=fee,released_at&status=eq.released&limit=20000'), sb(env, 'orders?select=fee&status=in.(held,handed,disputed)&limit=20000'),
      sb(env, 'payments?select=amount,paid_at&purpose=eq.boost&status=eq.paid&limit=20000'), sb(env, 'withdrawals?select=fee,net,amount,decided_at&status=eq.paid&limit=20000'),
      sb(env, 'withdrawals?select=net,amount&status=eq.requested&limit=2000'), sb(env, 'sponsors?select=amount&active=eq.true&limit=500'),
      sb(env, 'gifts?select=fee,gross,paid_at&status=eq.paid&limit=20000'),
    ].map((p) => p.then(rows)));
    const recent = (l, f) => l.filter((x) => x[f] && x[f] >= since);
    const out = {
      market_fees: { total: sum(rel, 'fee'), last30: sum(recent(rel, 'released_at'), 'fee'), in_escrow: sum(held, 'fee') },
      boosts: { total: sum(boosts, 'amount'), last30: sum(recent(boosts, 'paid_at'), 'amount') },
      withdrawal_fees: { total: sum(paid, 'fee'), last30: sum(recent(paid, 'decided_at'), 'fee') },
      gifts: { total: sum(gf, 'fee'), last30: sum(recent(gf, 'paid_at'), 'fee'), sent: sum(gf, 'gross'), count: gf.length },
      owed_to_sellers: net(open), paid_out: net(paid), sponsors_active: sum(sp, 'amount'),
    };
    out.total_earned = out.market_fees.total + out.boosts.total + out.withdrawal_fees.total + out.gifts.total;
    return json(env, out);
  }
  // ---- grant money to someone's wallet (a gift, a prize, a goodwill refund). Safe to repeat: the same key can only pay once. Always in the audit log. ----
  if (path === '/api/admin/wallet/grant' && m === 'POST') {
    const b = await body(), who = str(b.to, 60).replace(/^@/, ''), amount = int(b.amount, 1, 100000), note = str(b.note, 80) || 'Gift from Comrade Connect';
    if (!who) return err(env, 'Enter the account ID or the handle');
    if (!amount) return err(env, 'Amount: KSh 1 to 100,000');
    let p = await one(await sb(env, `profiles?select=aid,handle,banned&aid=eq.${enc(who)}`));
    if (!p) p = await one(await sb(env, `profiles?select=aid,handle,banned&handle=eq.${enc(who)}`));
    if (!p) return err(env, 'No account with that ID or handle', 404);
    if (p.banned) return err(env, 'That account is suspended', 403);
    const key = str(b.key, 40).replace(/[^A-Za-z0-9_-]/g, '') || crypto.randomUUID();
    if (!(await credit(env, p.aid, amount, 'adjustment', 'grant:' + key, note))) return err(env, 'This grant was already sent', 409);
    await A('wallet.grant', 'profile', p.aid, `KSh ${amount}: ${note}`);
    return json(env, { ok: true, aid: p.aid, handle: p.handle || null, amount });
  }
  if (path === '/api/admin/payouts' && m === 'GET') {
    const st = ['paid', 'rejected', 'requested'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : 'paid';
    return json(env, { payouts: await rows(await sb(env, `withdrawals?status=eq.${st}&order=created_at.desc&limit=100`)) });
  }
  if (path === '/api/admin/sponsors' && m === 'GET') {          // all sponsors, paused and expired too (the public list hides them)
    return json(env, { sponsors: await rows(await sb(env, 'sponsors?order=created_at.desc&limit=100')) });
  }
  if (path === '/api/admin/audit' && m === 'GET') {
    return json(env, { log: await rows(await sb(env, `admin_audit_log?order=created_at.desc&limit=${Math.min(200, parseInt(url.searchParams.get('limit')) || 50)}`)) });
  }
  // ---- zones: the places comrades pick from (Feed filter, Market, Wi-Fi, hostels...) ----
  if (path === '/api/admin/zones' && m === 'GET') return json(env, { zones: await getZones(env) });
  if (path === '/api/admin/zones' && m === 'POST') {
    const b = await body(), act = b.action, name = str(b.name, 30);
    const have = await rows(await sb(env, 'zones?select=name&limit=100'));
    const seed = async () => { if (!have.length) { for (const [i, z] of DEFAULT_ZONES.entries()) await post(env, 'zones', { name: z, sort: i }, 'resolution=ignore-duplicates,return=representation'); } };
    const cur = have.length ? have.map((x) => x.name) : DEFAULT_ZONES;
    if (act === 'add') {
      if (name.length < 2) return err(env, 'Type the zone name (at least 2 letters)');
      if (/[<>"]/.test(name)) return err(env, 'Use letters and numbers only');
      const blk = contactBlock(env, name); if (blk) return blk;
      if (cur.some((z) => z.toLowerCase() === name.toLowerCase())) return err(env, 'That zone is already there', 409);
      if (cur.length >= 40) return err(env, 'You can have up to 40 zones');
      await seed();
      await post(env, 'zones', { name, sort: cur.length }, 'return=representation');
    } else if (act === 'remove') {
      if (!cur.includes(name)) return err(env, 'No such zone', 404);
      if (cur.length <= 1) return err(env, 'Keep at least one zone');
      await seed();
      await sb(env, `zones?name=eq.${enc(name)}`, { method: 'DELETE' });
    } else return err(env, 'Unknown action');
    await A('zones.' + act, 'zone', name, null);
    return json(env, { ok: true, zones: await getZones(env) });
  }
  return err(env, 'Unknown admin action', 404);
}
