// Admin: add and manage detailed services (printing, gas, laundry, food, boda...). They show up for everyone in Explore, Services.
// Official services carry a phone, WhatsApp, location, hours and a price list. Community posts stay anonymous.
import { json, err, sb, rows, one, post, patch, enc, str, isAdmin, audit } from './lib.js';
import { getZones } from './settings.js';

const phone = (v) => {                                   // 07.., 01.., 254.. or +254.. -> +254XXXXXXXXX
  v = String(v || '').replace(/[\s-]/g, ''); if (!v) return '';
  if (/^\+254[17]\d{8}$/.test(v)) return v;
  if (/^254[17]\d{8}$/.test(v)) return '+' + v;
  if (/^0[17]\d{8}$/.test(v)) return '+254' + v.slice(1);
  return null;
};
// Only the fields that were sent are changed. Returns { error } or the row.
async function fields(env, b, isNew) {
  const has = (k) => b[k] !== undefined, row = {};
  if (isNew || has('title')) { const t = str(b.title, 80); if (t.length < 3) return { error: 'Add the business name' }; row.title = t; }
  if (isNew || has('category')) row.category = str(b.category, 30) || 'General';
  if (has('zone')) { const z = str(b.zone, 30); if (z && !(await getZones(env)).includes(z)) return { error: 'Pick a zone from the list, or leave it empty for the whole campus' }; row.zone = z; } else if (isNew) row.zone = '';
  if (has('phone')) { const p = phone(b.phone); if (p === null) return { error: 'Phone must look like 0712345678' }; row.phone = p || null; }
  if (has('whatsapp')) { const p = phone(b.whatsapp); if (p === null) return { error: 'WhatsApp must look like 0712345678' }; row.whatsapp = p || null; }
  if (has('location')) row.location = str(b.location, 120) || null;
  if (has('hours')) row.hours = str(b.hours, 80) || null;
  if (has('price_note')) row.price_note = str(b.price_note, 40) || null;
  if (has('details')) row.details = str(b.details, 600);
  if (has('offerings')) {
    const lines = String(b.offerings || '').split('\n').map((l) => str(l, 80)).filter(Boolean);
    if (lines.length > 15) return { error: 'The price list can have up to 15 lines' };
    row.offerings = lines.join('\n') || null;
  }
  if (has('delivery')) row.delivery = !!b.delivery;
  if (has('featured')) row.featured = !!b.featured;
  return row;
}

export async function adminServiceRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (path !== '/api/admin/services' && !path.startsWith('/api/admin/services/')) return null;
  if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);
  const A = (action, id, detail) => audit(env, action, 'service', id, detail, ip);
  const body = async () => (await req.json().catch(() => ({})));

  if (path === '/api/admin/services' && m === 'GET') {          // every service, hidden ones too
    const r = await sb(env, 'services?order=featured.desc,created_at.desc&limit=500');
    const list = r.ok ? await rows(r) : await rows(await sb(env, 'services?order=created_at.desc&limit=500'));
    return json(env, { services: list.map(({ ip: _ip, ...x }) => x) });
  }
  if (path === '/api/admin/services' && m === 'POST') {
    const f = await fields(env, await body(), true); if (f.error) return err(env, f.error);
    const r = await one(await post(env, 'services', { ...f, official: true, aid: 'admin' }));
    if (!r) return err(env, 'Could not save. Run the newest SQL in Supabase (end of schema.sql), then try again.', 500);
    await A('service.add', r.id, { title: r.title });
    return json(env, { ok: true, id: r.id }, 201);
  }
  const mm = path.match(/^\/api\/admin\/services\/([0-9a-f-]{36})$/);
  if (mm && m === 'POST') {
    const b = await body(), id = mm[1], act = b.action;
    const cur = await one(await sb(env, `services?id=eq.${id}`)); if (!cur) return err(env, 'No such service', 404);
    if (act === 'delete') { await sb(env, `services?id=eq.${id}`, { method: 'DELETE' }); await A('service.delete', id, { title: cur.title }); return json(env, { ok: true }); }
    const flip = { hide: { hidden: true }, show: { hidden: false }, feature: { featured: true }, unfeature: { featured: false } }[act];
    let row = flip;
    if (act === 'edit') { row = await fields(env, b, false); if (row.error) return err(env, row.error); if (!Object.keys(row).length) return err(env, 'Nothing to change'); }
    if (!row) return err(env, 'Unknown action');
    await patch(env, `services?id=eq.${id}`, row);
    await A('service.' + act, id, { title: cur.title });
    return json(env, { ok: true });
  }
  return err(env, 'Unknown admin action', 404);
}
