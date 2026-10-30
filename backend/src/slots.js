// Sponsor slots: which sponsor "presents" Today on campus, the Polls tab and Kura.
//   GET  /api/sponsor-slots        public: { slots: { today: { id, name, link }, polls: ..., kura: ... } } (only live sponsors)
//   GET  /api/admin/sponsor-slots  admin: { ready, slots: { today: sponsorId|null, ... } }
//   POST /api/admin/sponsor-slots  admin: { slot, sponsor_id }  (sponsor_id empty = clear the slot)
import { json, err, sb, rows, post, UUID, isAdmin, audit, inList } from './lib.js';

const SLOTS = ['today', 'polls', 'kura'];

export async function slotRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (path !== '/api/sponsor-slots' && path !== '/api/admin/sponsor-slots') return null;

  if (path === '/api/sponsor-slots' && m === 'GET') {
    const r = await sb(env, 'sponsor_slots?select=slot,sponsor_id&limit=10');
    if (!r.ok) return json(env, { slots: {} });                       // table not created yet: no sponsor slots
    const set = (await rows(r)).filter((x) => x.sponsor_id && SLOTS.includes(x.slot));
    if (!set.length) return json(env, { slots: {} });
    const now = new Date().toISOString();
    const sp = (await rows(await sb(env, `sponsors?select=id,name,link,active,starts_at,ends_at&id=${inList(set.map((x) => x.sponsor_id))}`)))
      .filter((s) => s.active && (!s.starts_at || s.starts_at <= now) && (!s.ends_at || s.ends_at >= now));
    const slots = {};
    for (const x of set) { const s = sp.find((v) => v.id === x.sponsor_id); if (s) slots[x.slot] = { id: s.id, name: s.name, link: s.link }; }
    return json(env, { slots });
  }

  if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);
  if (m === 'GET') {
    const r = await sb(env, 'sponsor_slots?select=slot,sponsor_id&limit=10');
    if (!r.ok) return json(env, { ready: false, slots: {} });
    const slots = {}; for (const x of await rows(r)) slots[x.slot] = x.sponsor_id;
    return json(env, { ready: true, slots });
  }
  if (m === 'POST') {
    const b = await req.json().catch(() => ({}));
    const slot = String(b.slot || ''), sid = b.sponsor_id ? String(b.sponsor_id) : null;
    if (!SLOTS.includes(slot)) return err(env, 'Unknown slot');
    if (sid && !UUID.test(sid)) return err(env, 'Pick a sponsor');
    if (sid && !(await rows(await sb(env, `sponsors?select=id&id=eq.${sid}`))).length) return err(env, 'Sponsor not found', 404);
    const r = await post(env, 'sponsor_slots', { slot, sponsor_id: sid, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=minimal');
    if (!r.ok) return err(env, 'Could not save. Run sponsor-slots.sql in Supabase (Admin > Site > SQL) first.', 503);
    await audit(env, 'sponsor.slot', 'sponsor_slot', slot, sid, ip);
    return json(env, { ok: true });
  }
  return err(env, 'Not found', 404);
}
