// Club: join, products, orders (stock reserved atomically), tickets with hashed codes.
import { json, err, sb, rows, one, post, patch, enc, inList, str, int, UUID, deriveCode, codeHash, tsEqual, throttle, tooMany, user, ago } from './lib.js';
import { initPayment, credit } from './pay.js';
import { getSettings } from './settings.js';

export async function restoreClubOrder(env, id) {         // give reserved stock back, once
  const [o] = await rows(await patch(env, `club_orders?id=eq.${id}&status=eq.pending&stock_held=eq.true`, { status: 'cancelled', stock_held: false }));
  if (o) await sb(env, 'rpc/take_stock', { method: 'POST', body: JSON.stringify({ p: o.product_id, n: -o.qty }) });
  return o;
}
export async function clubPaid(env, p) {
  const [o] = await rows(await patch(env, `club_orders?id=eq.${p.ref_id}&status=eq.pending`, { status: 'paid', payment_id: p.id }));
  if (!o) await credit(env, p.aid, p.amount, 'refund', 'pay:' + p.id, 'Club order expired, refunded to wallet');
}
export async function ticketPaid(env, p) {
  const ev = await one(await sb(env, `events?id=eq.${p.ref_id}&hidden=eq.false`));
  if (!ev) { await credit(env, p.aid, p.amount, 'refund', 'pay:' + p.id, 'Event not available'); return; }
  if (ev.capacity) {
    const sold = await rows(await sb(env, `tickets?select=id&event_id=eq.${ev.id}&status=neq.void&limit=5000`));
    if (sold.length >= ev.capacity) { await credit(env, p.aid, p.amount, 'refund', 'pay:' + p.id, 'Event sold out, refunded to wallet'); return; }
  }
  const id = crypto.randomUUID();
  const code = await deriveCode(env, 'ticket', id, 8);
  await post(env, 'tickets', { id, event_id: ev.id, aid: p.aid, payment_id: p.id, ticket_price: p.amount, code_hash: await codeHash(env, 'ticket', id, code) });
  if (ev.owner_aid) {
    const S = await getSettings(env), fee = Math.ceil((p.amount * (S.platform_fee_percent || 0)) / 100 - 1e-9);
    await credit(env, ev.owner_aid, p.amount - fee, 'sale', 'ticket:' + id, 'Ticket sold: ' + ev.title);
  }
}
export async function expireClubOrders(env) {
  let n = 0;
  for (const o of await rows(await sb(env, `club_orders?select=id&status=eq.pending&created_at=lte.${ago(15 * 60e3)}&limit=100`))) if (await restoreClubOrder(env, o.id)) n++;
  return n;
}

export async function clubRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/club') && !path.startsWith('/api/tickets')) return null;
  const body = async () => (await req.json().catch(() => ({})));

  if (path === '/api/club/join' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const name = str((await body()).display_name, 40);
    await post(env, 'club_members', { club: 'default', aid: u.aid, display_name: name || null, status: 'active' }, 'resolution=merge-duplicates,return=representation');
    return json(env, { member: true });
  }
  if (path === '/api/club/me' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const r = await one(await sb(env, `club_members?select=status&club=eq.default&aid=eq.${enc(u.aid)}`));
    return json(env, { member: r?.status === 'active' });
  }
  if (path === '/api/club/products' && m === 'GET') {
    const ps = await rows(await sb(env, 'club_products?active=eq.true&order=created_at.asc&limit=100'));
    const st = ps.length ? await rows(await sb(env, `club_stock?product_id=${inList(ps.map((p) => p.id))}`)) : [];
    return json(env, { products: ps.map((p) => ({ id: p.id, name: p.name, price: p.price, stock: st.find((s) => s.product_id === p.id)?.qty ?? 0 })) });
  }
  if (path === '/api/club/order' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body(), qty = int(b.qty, 1, 20) ?? 1;
    if (!UUID.test(String(b.product_id || ''))) return err(env, 'Pick a product');
    const mem = await one(await sb(env, `club_members?select=status&club=eq.default&aid=eq.${enc(u.aid)}`));
    if (mem?.status !== 'active') return err(env, 'Join the club first', 403);
    const p = await one(await sb(env, `club_products?id=eq.${b.product_id}&active=eq.true`)); if (!p) return err(env, 'Product not found', 404);
    const took = await (await sb(env, 'rpc/take_stock', { method: 'POST', body: JSON.stringify({ p: p.id, n: qty }) })).json().catch(() => false);
    if (took !== true) return err(env, 'Sorry, not enough stock', 409);
    const o = await one(await post(env, 'club_orders', { aid: u.aid, product_id: p.id, qty, amount: p.price * qty }));
    if (!o) { await sb(env, 'rpc/take_stock', { method: 'POST', body: JSON.stringify({ p: p.id, n: -qty }) }); return err(env, 'Could not save the order', 500); }
    const r = await initPayment(env, ip, { aid: u.aid, purpose: 'club', ref_id: o.id, amount: o.amount, phone: b.phone });
    if (r.res) { await restoreClubOrder(env, o.id); return r.res; }
    await patch(env, `club_orders?id=eq.${o.id}`, { payment_id: r.id });
    return json(env, { id: r.id, order_id: o.id, amount: o.amount }, 201);
  }
  if (path === '/api/club/orders/mine' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const os = await rows(await sb(env, `club_orders?aid=eq.${enc(u.aid)}&order=created_at.desc&limit=30`));
    const ps = os.length ? await rows(await sb(env, `club_products?select=id,name&id=${inList(os.map((o) => o.product_id))}`)) : [];
    return json(env, { orders: os.map((o) => ({ id: o.id, product: ps.find((p) => p.id === o.product_id)?.name, qty: o.qty, amount: o.amount, status: o.status, createdAt: Date.parse(o.created_at) })) });
  }

  // ---- tickets ----
  if (path === '/api/tickets/buy' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body();
    if (!UUID.test(String(b.event_id || ''))) return err(env, 'Pick an event');
    const ev = await one(await sb(env, `events?id=eq.${b.event_id}&hidden=eq.false`));
    if (!ev || !(ev.ticket_price > 0) || ev.starts_on < new Date().toISOString().slice(0, 10)) return err(env, 'Tickets are not available for this event', 404);
    const have = await rows(await sb(env, `tickets?select=id&event_id=eq.${ev.id}&aid=eq.${enc(u.aid)}&status=neq.void`));
    if (have.length >= 4) return err(env, 'Maximum 4 tickets per person');
    if (ev.capacity) { const sold = await rows(await sb(env, `tickets?select=id&event_id=eq.${ev.id}&status=neq.void&limit=5000`)); if (sold.length >= ev.capacity) return err(env, 'This event is sold out', 409); }
    const r = await initPayment(env, ip, { aid: u.aid, purpose: 'ticket', ref_id: ev.id, amount: ev.ticket_price, phone: b.phone });
    return r.res || json(env, { id: r.id, amount: ev.ticket_price }, 201);
  }
  if (path === '/api/tickets/mine' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const ts = await rows(await sb(env, `tickets?aid=eq.${enc(u.aid)}&order=created_at.desc&limit=30`));
    const evs = ts.length ? await rows(await sb(env, `events?select=id,title,starts_on,venue&id=${inList(ts.map((t) => t.event_id))}`)) : [];
    const out = [];
    for (const t of ts) { const e = evs.find((x) => x.id === t.event_id); out.push({ id: t.id, event: e?.title, date: e?.starts_on, venue: e?.venue, status: t.status, code: t.status === 'valid' ? await deriveCode(env, 'ticket', t.id, 8) : undefined }); }
    return json(env, { tickets: out });
  }
  return null;
}

// Door check (admin). Give the ticket id, or the event id plus the 8-digit code the buyer shows (the door has no ticket id).
// Marks the ticket used in one conditional update, so a code cannot be used twice.
export async function validateTicket(env, ticketId, code, eventId) {
  const digits = String(code || '').replace(/\D/g, '');
  let t = null;
  if (UUID.test(String(ticketId || ''))) t = await one(await sb(env, `tickets?id=eq.${ticketId}`));
  else if (UUID.test(String(eventId || ''))) {
    if (digits.length !== 8) return { ok: false, reason: 'Enter the 8-digit code' };
    for (const c of await rows(await sb(env, `tickets?event_id=eq.${eventId}&limit=2000`))) if (tsEqual(c.code_hash, await codeHash(env, 'ticket', c.id, digits))) { t = c; break; }
    if (!t) return { ok: false, reason: 'No ticket with that code for this event' };
  }
  if (!t) return { ok: false, reason: 'Ticket not found' };
  if (!tsEqual(t.code_hash, await codeHash(env, 'ticket', t.id, digits))) return { ok: false, reason: 'Wrong code' };
  const [u] = await rows(await patch(env, `tickets?id=eq.${t.id}&status=eq.valid`, { status: 'used', used_at: new Date().toISOString() }));
  return u ? { ok: true, ticket_id: t.id } : { ok: false, reason: t.status === 'used' ? 'Already used' : 'Ticket is not valid' };
}
