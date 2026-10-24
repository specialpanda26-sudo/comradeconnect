// User-hosted events: create an event, sell tickets, and a secret door-scan link for the host's helpers.
// Ticket money goes to the host's wallet (price minus the platform fee) and is withdrawn like any sale.
import { json, err, sb, rows, one, post, patch, enc, inList, str, int, UUID, deriveCode, tsEqual, throttle, tooMany, user, contactBlock } from './lib.js';
import { validateTicket } from './club.js';
import { getSettings } from './settings.js';
import { campusRow } from './campus.js';

const realDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d + 'T00:00:00Z')) && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;
// The scan key is derived from the event id and the server secret, so nothing extra is stored.
export const CATS = ['Party', 'Music', 'Sports', 'Academic', 'Club', 'Faith', 'Other'];
export const scanKey = (env, eventId) => deriveCode(env, 'scan', eventId, 12);
export const feeOn = (amount, S) => Math.ceil((amount * (S.platform_fee_percent || 0)) / 100 - 1e-9);

export async function myEventRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/my/events') && !path.startsWith('/api/scan')) return null;
  const body = async () => (await req.json().catch(() => ({})));
  const today = new Date().toISOString().slice(0, 10);

  // ---- host creates an event ----
  if (path === '/api/my/events' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body();
    const title = str(b.title, 100), venue = str(b.venue, 80), details = str(b.details, 400), date = String(b.date || '');
    if (title.length < 3) return err(env, 'Give your event a name');
    if (!realDate(date) || date < today) return err(env, 'Pick a date from today onwards');
    if (venue.length < 2) return err(env, 'Add the venue');
    const freeEv = b.ticket_price === undefined || b.ticket_price === null || b.ticket_price === '' || Number(b.ticket_price) === 0;
    const price = freeEv ? null : int(b.ticket_price, 1, 20000); if (!freeEv && !price) return err(env, 'Ticket price: KSh 1 to 20,000, or leave it empty for a free event');
    const time = String(b.time || ''); if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return err(env, 'Pick a valid start time');
    const category = CATS.includes(b.category) ? b.category : 'Other';
    let capacity = null;
    if (b.capacity !== undefined && b.capacity !== '' && b.capacity !== null) { capacity = int(b.capacity, 1, 5000); if (!capacity) return err(env, 'Capacity: 1 to 5,000 people'); }
    const blk = contactBlock(env, title, venue, details); if (blk) return blk;
    const open = await rows(await sb(env, `events?select=id&owner_aid=eq.${enc(u.aid)}&hidden=eq.false&starts_on=gte.${today}`));
    if (open.length >= 5) return err(env, 'You already have 5 upcoming events. Wait for one to finish or cancel one.');
    if (!(await throttle(env, ip, 'event_create', u.aid, 10))) return tooMany(env);   // counted only for real attempts, so typos do not lock a host out
    const [ev] = await rows(await post(env, 'events', { ...campusRow(req), title, starts_on: date, starts_at: time || null, category, venue, details: details || null, ticket_price: price, capacity: price ? capacity : null, owner_aid: u.aid }, 'return=representation'));
    if (!ev) return err(env, 'Could not create the event. Try again.', 500);
    return json(env, { id: ev.id, free: !price, scan_path: price ? `/scan.html?e=${ev.id}&k=${await scanKey(env, ev.id)}` : null }, 201);
  }

  // ---- host sees their events, sales and scan links ----
  if (path === '/api/my/events' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const evs = await rows(await sb(env, `events?owner_aid=eq.${enc(u.aid)}&order=starts_on.desc&limit=30`));
    const S = await getSettings(env);
    const tks = evs.length ? await rows(await sb(env, `tickets?select=event_id,status&event_id=${inList(evs.map((e) => e.id))}&limit=5000`)) : [];
    const out = [];
    for (const e of evs) {
      const mine = tks.filter((t) => t.event_id === e.id && t.status !== 'void');
      const gross = mine.length * (e.ticket_price || 0);
      out.push({ id: e.id, title: e.title, date: e.starts_on, time: e.starts_at, category: e.category, venue: e.venue, ticket_price: e.ticket_price, capacity: e.capacity, hidden: e.hidden,
        sold: mine.length, scanned: mine.filter((t) => t.status === 'used').length, you_earn: gross - mine.length * feeOn(e.ticket_price || 0, S),
        scan_path: e.ticket_price ? `/scan.html?e=${e.id}&k=${await scanKey(env, e.id)}` : null });
    }
    return json(env, { events: out, fee_percent: S.platform_fee_percent });
  }

  // ---- host cancels (only before any ticket is sold) ----
  let mm = path.match(/^\/api\/my\/events\/([0-9a-f-]{36})\/cancel$/);
  if (mm && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const ev = await one(await sb(env, `events?id=eq.${mm[1]}&owner_aid=eq.${enc(u.aid)}`));
    if (!ev) return err(env, 'Event not found', 404);
    const sold = await rows(await sb(env, `tickets?select=id&event_id=eq.${ev.id}&status=neq.void&limit=1`));
    if (sold.length) return err(env, 'Tickets are already sold. Contact an admin to cancel and refund.');
    await patch(env, `events?id=eq.${ev.id}`, { hidden: true });
    return json(env, { ok: true });
  }

  // ---- door scanner (no account needed, the secret key in the link is the pass) ----
  if (path === '/api/scan/info' && m === 'GET') {
    const id = url.searchParams.get('e') || '', key = url.searchParams.get('k') || '';
    if (!UUID.test(id)) return err(env, 'This scan link is not valid', 404);
    if (!(await throttle(env, ip, 'scan_info', id, 3000, 3000))) return tooMany(env);
    if (!tsEqual(key, await scanKey(env, id))) return err(env, 'This scan link is not valid', 404);
    const ev = await one(await sb(env, `events?id=eq.${id}`));
    if (!ev) return err(env, 'Event not found', 404);
    const tks = await rows(await sb(env, `tickets?select=status&event_id=eq.${id}&limit=5000`));
    return json(env, { title: ev.title, date: ev.starts_on, venue: ev.venue, sold: tks.filter((t) => t.status !== 'void').length, scanned: tks.filter((t) => t.status === 'used').length });
  }
  if (path === '/api/scan/check' && m === 'POST') {
    const b = await body(), id = String(b.event_id || ''), code = String(b.code || '').replace(/\D/g, '');
    if (!UUID.test(id)) return err(env, 'This scan link is not valid', 404);
    if (!(await throttle(env, ip, 'scan_check', id, 3000, 3000))) return tooMany(env);
    if (!tsEqual(String(b.key || ''), await scanKey(env, id))) return err(env, 'This scan link is not valid', 404);
    if (code.length !== 8) return json(env, { ok: false, reason: 'A ticket code has 8 digits' });
    const r = await validateTicket(env, null, code, id);
    return json(env, r);
  }
  return null;
}
