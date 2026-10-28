// Verified Lost and Found hub. A feed just for lost and found National IDs, student IDs, phones, cards, keys and bags around campus
// (Kerugoya, Kutus, the gate, the library...). Posts follow the campus picked in the app (X-Campus), like Land spots.
// Safety rules: no ID, card or serial numbers are ever posted (the owner proves it is theirs in the chat), no phone numbers or links,
// and the poster's name is never shown. Posters whose ID is verified get a "Verified" badge. Chat goes through anonymous messages.
import { json, err, sb, rows, one, post, patch, enc, str, UUID, throttle, tooMany, user, authProfile, contactBlock, inList, ago, DAY } from './lib.js';
import { campusOf, isAllCampuses, campusOrHome, CAMPUS_IDS, DEFAULT_CAMPUS } from './campus.js';

export const LF_CATS = ['National ID', 'Student ID', 'Phone', 'ATM card', 'Wallet or bag', 'Keys', 'Laptop', 'Books or notes', 'Other'];
export const LF_PLACES = ['Kerugoya town', 'Kutus', 'Campus main gate', 'Library', 'Lecture halls', 'Cafeteria', 'Hostels', 'Matatu stage', 'Market', 'Other'];
const hasBigNumber = (t) => /\d{6,}/.test(String(t || '').replace(/[\s\-.]/g, ''));
const today = () => new Date().toISOString().slice(0, 10);

const pub = (r, me, ver) => ({
  id: r.id, campus: r.campus, kind: r.kind, category: r.category, title: r.title, details: r.details || '', place: r.place || '',
  happenedOn: r.happened_on, status: r.status, createdAt: Date.parse(r.created_at), resolvedAt: r.resolved_at ? Date.parse(r.resolved_at) : null,
  mine: !!me && me.aid === r.aid, verified: ver.has(r.aid),
});

export async function lostFoundRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/lostfound')) return null;
  const body = async () => (await req.json().catch(() => ({})));

  if (path === '/api/lostfound/meta' && m === 'GET') return json(env, { categories: LF_CATS, places: LF_PLACES });

  if (path === '/api/lostfound' && m === 'GET') {
    const me = req.headers.get('X-Token') ? await authProfile(req, env) : null;
    const all = isAllCampuses(req);
    const camp = all ? 'all' : (campusOf(req) || (CAMPUS_IDS.includes(url.searchParams.get('campus')) ? url.searchParams.get('campus') : DEFAULT_CAMPUS));
    const sp = url.searchParams, kind = sp.get('kind'), cat = String(sp.get('category') || ''), status = sp.get('status') === 'returned' ? 'returned' : 'open';
    let q = `lost_found?hidden=eq.false&status=eq.${status}&created_at=gte.${ago(90 * DAY)}${all ? '' : '&campus=eq.' + camp}&order=created_at.desc&limit=100`;
    if (kind === 'lost' || kind === 'found') q += '&kind=eq.' + kind;
    if (cat && cat !== 'All') q += '&category=eq.' + enc(cat.slice(0, 24));
    const r = await rows(await sb(env, q));
    const aids = [...new Set(r.map((x) => x.aid))];
    const vr = aids.length ? await rows(await sb(env, `profiles?select=aid,verified,student_verified&aid=${inList(aids)}`)) : [];
    const ver = new Set(vr.filter((p) => p.verified || p.student_verified).map((p) => p.aid));
    const back = await rows(await sb(env, `lost_found?select=id&hidden=eq.false&status=eq.returned${all ? '' : '&campus=eq.' + camp}&limit=1000`));
    return json(env, { campus: camp, items: r.map((x) => pub(x, me, ver)), reunited: back.length });
  }

  if (path === '/api/lostfound' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body();
    const kind = b.kind === 'found' ? 'found' : b.kind === 'lost' ? 'lost' : null;
    const category = LF_CATS.includes(b.category) ? b.category : 'Other';
    const title = str(b.title, 80), details = str(b.details, 300), place = str(b.place, 60);
    if (!kind) return err(env, 'Say if you lost it or found it');
    if (title.length < 3) return err(env, 'Add a short title, like "Black Tecno phone"');
    const blk = contactBlock(env, title, details, place); if (blk) return blk;
    if (hasBigNumber(title) || hasBigNumber(details) || hasBigNumber(place)) return err(env, 'Do not post ID, card or serial numbers. Keep them to prove the owner in the chat.');
    let on = String(b.happened_on || '').slice(0, 10) || today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(on) || on > today() || on < new Date(Date.now() - 60 * DAY).toISOString().slice(0, 10)) return err(env, 'Pick a date within the last 60 days');
    if (!(await throttle(env, ip, 'lostfound', u.aid, 6, 24))) return tooMany(env);
    const r = await one(await post(env, 'lost_found', { aid: u.aid, campus: campusOrHome(req), kind, category, title, details: details || null, place: place || null, happened_on: on, ip }));
    if (!r) return err(env, 'Could not save the post. Try again.', 500);
    const ver = new Set(u.verified || u.student_verified ? [u.aid] : []);
    return json(env, pub(r, u, ver), 201);
  }

  const mm = path.match(/^\/api\/lostfound\/([0-9a-f-]{36})\/(returned|reopen|remove)$/);
  if (mm && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    if (!UUID.test(mm[1])) return err(env, 'Not found', 404);
    const it = await one(await sb(env, `lost_found?id=eq.${mm[1]}&hidden=eq.false`));
    if (!it) return err(env, 'Not found', 404);
    if (it.aid !== u.aid) return err(env, 'Only the person who posted this can change it', 403);
    if (mm[2] === 'remove') await patch(env, `lost_found?id=eq.${it.id}`, { hidden: true });
    else if (mm[2] === 'returned') await patch(env, `lost_found?id=eq.${it.id}`, { status: 'returned', resolved_at: new Date().toISOString() });
    else await patch(env, `lost_found?id=eq.${it.id}`, { status: 'open', resolved_at: null });
    return json(env, { ok: true });
  }
  return null;
}
