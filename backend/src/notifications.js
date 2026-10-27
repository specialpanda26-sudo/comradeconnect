// In-app notifications: comments on your stories, clips and reels, milestones, new orders, referral news, and new events.
// Notifications never say who did something: the app is anonymous, so they only say what happened.
import { json, err, sb, rows, one, post, patch, enc, inList, UUID, user, throttle, tooMany } from './lib.js';
import { sendPush, catOfKind, cleanPrefs } from './push.js';

const snip = (t, n = 90) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

// Best effort: a failed notification must never break the action that caused it.
export async function notify(env, aid, kind, title, body, refType, refId) {
  try {
    if (!aid) return false;
    const res = await post(env, 'notifications', { aid, kind, title: snip(title, 80), body: snip(body, 160), ref_type: refType || null, ref_id: refId ? String(refId) : null });
    if (res.ok) await sendPush(env, aid, { title: snip(title, 80), body: snip(body, 160), view: 'bell', tag: 'n-' + kind, cat: catOfKind(kind) });
    return res.ok;
  } catch (e) { console.error('notify failed', e && e.message); return false; }
}
export const notifySnippet = snip;

const today = () => new Date().toISOString().slice(0, 10);
const fmtItem = (n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, ref_type: n.ref_type, ref_id: n.ref_id, read: !!n.read_at, at: Date.parse(n.created_at) });

// Events published since the person last opened their notifications. Only events that have not happened yet.
async function newEvents(env, u, state) {
  const since = state ? state.events_seen_at : u.created_at;
  const r = await rows(await sb(env, `events?hidden=eq.false&starts_on=gte.${today()}&created_at=gt.${enc(since || new Date(0).toISOString())}&order=created_at.desc&limit=10`));
  return r.map((e) => ({ id: e.id, title: e.title, date: e.starts_on, venue: e.venue || '', details: e.details || '', ticket_price: e.ticket_price || 0, at: Date.parse(e.created_at) }));
}

export async function notificationRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/notifications')) return null;
  const a = async () => { const u = await user(req, env); return u; };

  if (path === '/api/notifications' && m === 'GET') {
    const u = await a(); if (u instanceof Response) return u;
    const state = await one(await sb(env, `notif_state?aid=eq.${enc(u.aid)}`));
    const items = (await rows(await sb(env, `notifications?aid=eq.${enc(u.aid)}&order=created_at.desc&limit=40`))).map(fmtItem);
    const events = await newEvents(env, u, state);
    const unread = items.filter((n) => !n.read).length;
    if (url.searchParams.get('count')) return json(env, { unread: unread + events.length });
    return json(env, { items, events, unread, unread_total: unread + events.length });
  }

  // Which kinds of alert this person wants on their phone: comments, live, events, orders, wallet, messages, updates.
  if (path === '/api/notifications/prefs' && (m === 'GET' || m === 'POST')) {
    const u = await a(); if (u instanceof Response) return u;
    if (m === 'GET') {
      let row = null; try { row = await one(await sb(env, `notif_prefs?select=prefs&aid=eq.${enc(u.aid)}`)); } catch (e) {}
      return json(env, { prefs: cleanPrefs(row && row.prefs) });
    }
    if (!(await throttle(env, ip, 'notifprefs', u.aid, 120, 600))) return tooMany(env);
    const b = await req.json().catch(() => ({})), prefs = cleanPrefs(b.prefs);
    const res = await sb(env, 'notif_prefs', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ aid: u.aid, prefs, updated_at: new Date().toISOString() }) });
    if (!res.ok) return err(env, 'Could not save. Try again.', 500);
    return json(env, { ok: true, prefs });
  }

  // Clear: really removes them from the list (Mark-as-read only greys them).
  if (path === '/api/notifications/clear' && m === 'POST') {
    const u = await a(); if (u instanceof Response) return u;
    if (!(await throttle(env, ip, 'notifclear', u.aid, 60, 300))) return tooMany(env);
    const b = await req.json().catch(() => ({}));
    if (b.all === true) await sb(env, `notifications?aid=eq.${enc(u.aid)}`, { method: 'DELETE' });
    else if (Array.isArray(b.ids) && b.ids.length) {
      const ids = b.ids.filter((x) => UUID.test(String(x))).slice(0, 50);
      if (ids.length) await sb(env, `notifications?aid=eq.${enc(u.aid)}&id=${inList(ids)}`, { method: 'DELETE' });
    }
    if (b.events === true) await sb(env, 'notif_state', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ aid: u.aid, events_seen_at: new Date().toISOString() }) });
    return json(env, { ok: true });
  }

  if (path === '/api/notifications/read' && m === 'POST') {
    const u = await a(); if (u instanceof Response) return u;
    if (!(await throttle(env, ip, 'notifread', u.aid, 300, 600))) return tooMany(env);
    const b = await req.json().catch(() => ({})), now = new Date().toISOString();
    if (b.all === true) await patch(env, `notifications?aid=eq.${enc(u.aid)}&read_at=is.null`, { read_at: now });
    else if (Array.isArray(b.ids) && b.ids.length) {
      const ids = b.ids.filter((x) => UUID.test(String(x))).slice(0, 50);
      if (ids.length) await patch(env, `notifications?aid=eq.${enc(u.aid)}&id=${inList(ids)}&read_at=is.null`, { read_at: now });
    }
    if (b.events === true) await sb(env, 'notif_state', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ aid: u.aid, events_seen_at: now }) });
    return json(env, { ok: true });
  }
  return err(env, 'Not found', 404);
}
