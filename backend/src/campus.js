// Campuses and Land spots.
// The app sends the campus the person picked in the X-Campus header. Feed, events, Wi-Fi, hostels, roommates and services only show that
// campus, and new posts are tagged with it. Market, rewards, messages and everything else ignore it. Old rows default to 'kirinyaga'.
import { json, err, sb, rows, one, post, patch, enc, str, UUID, throttle, tooMany, user, authProfile, contactBlock } from './lib.js';

// To open the app to another university, add it here. The campus column takes any text, so no SQL is needed.
export const CAMPUSES = [
  { id: 'kirinyaga', name: 'Kirinyaga University', short: 'Kirinyaga', lat: -0.4986, lng: 37.2806 },
  { id: 'uon', name: 'University of Nairobi', short: 'UoN', lat: -1.2794, lng: 36.8167 },
];
export const DEFAULT_CAMPUS = 'kirinyaga';
export const CAMPUS_IDS = CAMPUSES.map((c) => c.id);
export const campusOf = (req) => { const v = String(req.headers.get('X-Campus') || '').toLowerCase(); return CAMPUS_IDS.includes(v) ? v : null; };
export const campusRow = (req) => { const c = campusOf(req); return c ? { campus: c } : {}; };      // spread into an insert
export const campusQuery = (req) => { const c = campusOf(req); return c ? '&campus=eq.' + c : ''; };   // append to a list query

export const SPOT_CATEGORIES = ['Food', 'Study', 'Hangout', 'Transport', 'Services', 'Worship', 'Safety', 'Other'];
const inKenya = (lat, lng) => lat > -5 && lat < 5.6 && lng > 33.5 && lng < 42;
const pubSpot = (r, me) => ({
  id: r.id, campus: r.campus, name: r.name, category: r.category, details: r.details || '', lat: r.lat ?? null, lng: r.lng ?? null,
  likes: r.likes || 0, createdAt: Date.parse(r.created_at), mine: !!me && me.aid === r.aid,
});

export async function campusRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (path === '/api/campuses' && m === 'GET') return json(env, { campuses: CAMPUSES, default: DEFAULT_CAMPUS, categories: SPOT_CATEGORIES });
  if (!path.startsWith('/api/spots')) return null;
  const body = async () => (await req.json().catch(() => ({})));

  if (path === '/api/spots' && m === 'GET') {
    const me = req.headers.get('X-Token') ? await authProfile(req, env) : null;
    const camp = campusOf(req) || (CAMPUS_IDS.includes(url.searchParams.get('campus')) ? url.searchParams.get('campus') : DEFAULT_CAMPUS);
    const cat = String(url.searchParams.get('category') || '');
    let q = `spots?hidden=eq.false&campus=eq.${camp}&order=created_at.desc&limit=100`;
    if (cat && cat !== 'All') q += '&category=eq.' + enc(cat.slice(0, 24));
    const r = await rows(await sb(env, q));
    const mine = me && r.length ? new Set((await rows(await sb(env, `spot_likes?select=spot_id&aid=eq.${enc(me.aid)}&spot_id=in.(${r.map((x) => x.id).join(',')})`))).map((x) => x.spot_id)) : new Set();
    return json(env, { campus: camp, spots: r.map((x) => ({ ...pubSpot(x, me), liked: mine.has(x.id) })).sort((a, b) => b.likes - a.likes || b.createdAt - a.createdAt) });
  }

  if (path === '/api/spots' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body();
    const name = str(b.name, 60), details = str(b.details, 300), cat = str(b.category, 24) || 'Other';
    if (name.length < 3) return err(env, 'Give the spot a name');
    const blk = contactBlock(env, name, details, cat); if (blk) return blk;
    const row = { name, details: details || null, category: cat, campus: campusOf(req) || DEFAULT_CAMPUS };
    if (b.lat != null && b.lng != null && b.lat !== '' && b.lng !== '') {
      const lat = Number(b.lat), lng = Number(b.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inKenya(lat, lng)) return err(env, 'That location is not in Kenya. Tap Use my location again or leave the pin off');
      row.lat = +lat.toFixed(5); row.lng = +lng.toFixed(5);
    }
    if (!(await throttle(env, ip, 'spot', u.aid, 8, 30))) return tooMany(env);
    const r = await one(await post(env, 'spots', { ...row, aid: u.aid, ip }));
    return r ? json(env, pubSpot(r, u), 201) : err(env, 'Could not save the spot. Try again.', 500);
  }

  const mm = path.match(/^\/api\/spots\/([0-9a-f-]{36})\/(remove|like)$/);
  if (mm && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const id = mm[1];
    const s = await one(await sb(env, `spots?id=eq.${id}&hidden=eq.false`));
    if (!s) return err(env, 'Not found', 404);
    if (mm[2] === 'remove') {
      if (s.aid !== u.aid) return err(env, 'Only the person who added it can remove it', 403);
      await patch(env, `spots?id=eq.${id}`, { hidden: true });
      return json(env, { ok: true });
    }
    // "Good spot": one vote per person, tap again to take it back
    const had = await rows(await sb(env, `spot_likes?select=aid&spot_id=eq.${id}&aid=eq.${enc(u.aid)}`));
    if (had.length) await sb(env, `spot_likes?spot_id=eq.${id}&aid=eq.${enc(u.aid)}`, { method: 'DELETE' });
    else await post(env, 'spot_likes', { spot_id: id, aid: u.aid }, 'resolution=ignore-duplicates,return=representation');
    const n = (await rows(await sb(env, `spot_likes?select=aid&spot_id=eq.${id}&limit=5000`))).length;
    await patch(env, `spots?id=eq.${id}`, { likes: n });
    return json(env, { liked: !had.length, likes: n });
  }
  return null;
}
