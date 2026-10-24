// Campuses and Land spots.
// The app sends the campus the person picked in the X-Campus header. Feed, events, Wi-Fi, hostels, roommates and services only show that
// campus, and new posts are tagged with it. Market, rewards, messages and everything else ignore it. X-Campus: all shows every university (see isAllCampuses). Old rows default to 'kirinyaga'.
import { json, err, sb, rows, one, post, patch, enc, str, UUID, throttle, tooMany, user, authProfile, contactBlock } from './lib.js';

// To open the app to another university, add it here. The campus column takes any text, so no SQL is needed.
export const CAMPUSES = [
  { id: "kirinyaga", name: "Kirinyaga University", short: "Kirinyaga", lat: -0.4986, lng: 37.2806 },
  { id: "uon", name: "University of Nairobi", short: "UoN", lat: -1.2794, lng: 36.8167 },
  { id: "ku", name: "Kenyatta University", short: "KU", lat: -1.1807, lng: 36.93 },
  { id: "jkuat", name: "Jomo Kenyatta University of Agriculture and Technology", short: "JKUAT", lat: -1.091, lng: 37.012 },
  { id: "moi", name: "Moi University", short: "Moi", lat: 0.287, lng: 35.305 },
  { id: "egerton", name: "Egerton University", short: "Egerton", lat: -0.372, lng: 35.933 },
  { id: "maseno", name: "Maseno University", short: "Maseno", lat: -0.003, lng: 34.6 },
  { id: "mmust", name: "Masinde Muliro University of Science and Technology", short: "MMUST", lat: 0.286, lng: 34.762 },
  { id: "dekut", name: "Dedan Kimathi University of Technology", short: "DeKUT", lat: -0.402, lng: 36.959 },
  { id: "tuk", name: "Technical University of Kenya", short: "TU-K", lat: -1.297, lng: 36.823 },
  { id: "tum", name: "Technical University of Mombasa", short: "TUM", lat: -4.039, lng: 39.668 },
  { id: "pwani", name: "Pwani University", short: "Pwani", lat: -3.629, lng: 39.851 },
  { id: "uoeld", name: "University of Eldoret", short: "UoEld", lat: 0.58, lng: 35.33 },
  { id: "chuka", name: "Chuka University", short: "Chuka", lat: -0.333, lng: 37.65 },
  { id: "laikipia", name: "Laikipia University", short: "Laikipia", lat: 0.03, lng: 36.36 },
  { id: "must", name: "Meru University of Science and Technology", short: "MUST", lat: 0.09, lng: 37.63 },
  { id: "embu", name: "Embu University", short: "Embu", lat: -0.54, lng: 37.45 },
  { id: "kisii", name: "Kisii University", short: "Kisii", lat: -0.677, lng: 34.77 },
  { id: "karatina", name: "Karatina University", short: "Karatina", lat: -0.483, lng: 37.127 },
  { id: "machakos", name: "Machakos University", short: "Machakos", lat: -1.52, lng: 37.26 },
  { id: "mmu", name: "Multimedia University of Kenya", short: "MMU", lat: -1.41, lng: 36.75 },
  { id: "seku", name: "South Eastern Kenya University", short: "SEKU", lat: -1.35, lng: 38.01 },
  { id: "ttu", name: "Taita Taveta University", short: "TTU", lat: -3.39, lng: 38.56 },
  { id: "jooust", name: "Jaramogi Oginga Odinga University", short: "JOOUST", lat: -0.1, lng: 34.27 },
  { id: "garissa", name: "Garissa University", short: "Garissa", lat: -0.46, lng: 39.64 },
  { id: "kibabii", name: "Kibabii University", short: "Kibabii", lat: 0.6, lng: 34.58 },
  { id: "mut", name: "Murang'a University of Technology", short: "MUT", lat: -0.72, lng: 37.15 },
  { id: "rongo", name: "Rongo University", short: "Rongo", lat: -0.76, lng: 34.6 },
  { id: "kabianga", name: "University of Kabianga", short: "Kabianga", lat: -0.37, lng: 35.24 },
  { id: "cuk", name: "Co-operative University of Kenya", short: "CUK", lat: -1.33, lng: 36.71 },
  { id: "tmu", name: "Tom Mboya University", short: "TMU", lat: -0.53, lng: 34.45 },
  { id: "alupe", name: "Alupe University", short: "Alupe", lat: 0.49, lng: 34.13 },
  { id: "strathmore", name: "Strathmore University", short: "Strathmore", lat: -1.31, lng: 36.812 },
  { id: "usiu", name: "United States International University Africa", short: "USIU", lat: -1.219, lng: 36.883 },
  { id: "cuea", name: "Catholic University of Eastern Africa", short: "CUEA", lat: -1.35, lng: 36.7 },
  { id: "daystar", name: "Daystar University", short: "Daystar", lat: -1.45, lng: 36.99 },
  { id: "mku", name: "Mount Kenya University", short: "MKU", lat: -1.039, lng: 37.083 },
  { id: "kca", name: "KCA University", short: "KCA", lat: -1.235, lng: 36.878 },
  { id: "kemu", name: "Kenya Methodist University", short: "KeMU", lat: 0.05, lng: 37.65 },
  { id: "anu", name: "Africa Nazarene University", short: "ANU", lat: -1.4, lng: 36.76 },
  { id: "riara", name: "Riara University", short: "Riara", lat: -1.305, lng: 36.77 },
  { id: "zetech", name: "Zetech University", short: "Zetech", lat: -1.15, lng: 36.96 },
  { id: "kabarak", name: "Kabarak University", short: "Kabarak", lat: -0.1667, lng: 35.9667 },
  { id: "kaimosi", name: "Kaimosi Friends University", short: "Kaimosi", lat: 0.1167, lng: 34.8667 },
  { id: "gretsa", name: "Gretsa University", short: "Gretsa", lat: -1.0333, lng: 37.0833 },
  { id: "tharaka", name: "Tharaka University", short: "Tharaka", lat: -0.2, lng: 37.9 },
  { id: "lukenya", name: "Lukenya University", short: "Lukenya", lat: -2.6833, lng: 38.1667 },
  { id: "turkana", name: "Turkana University College", short: "Turkana", lat: 3.1167, lng: 35.6 },
  { id: "koitaleel", name: "Koitaleel Samoei University College", short: "Koitaleel", lat: 0.18, lng: 35.1 },
  { id: "bomet", name: "Bomet University College", short: "Bomet", lat: -0.7833, lng: 35.3417 },
  { id: "kheu", name: "Kenya Highlands Evangelical University", short: "KHEU", lat: -0.3667, lng: 35.28 },
  { id: "panac", name: "Pan Africa Christian University", short: "PAC", lat: -1.2214, lng: 36.8993 },
  { id: "spu", name: "St. Paul's University", short: "St Paul's", lat: -1.1333, lng: 36.6333 },
  { id: "pueac", name: "Presbyterian University of East Africa", short: "PUEA", lat: -1.25, lng: 36.6667 },
  { id: "mua", name: "Management University of Africa", short: "MUA", lat: -1.2833, lng: 36.8 },
  { id: "gluk", name: "Great Lakes University of Kisumu", short: "GLUK", lat: -0.1, lng: 34.75 },
  { id: "aiu", name: "Africa International University", short: "AIU", lat: -1.3333, lng: 36.7 },
  { id: "scott", name: "Scott Christian University", short: "Scott", lat: -1.4167, lng: 37.4 },
  { id: "other", name: "Other university or college", short: "Other", lat: -0.0236, lng: 37.9062 },
];
export const DEFAULT_CAMPUS = 'kirinyaga';
export const CAMPUS_IDS = CAMPUSES.map((c) => c.id);
export const campusOf = (req) => { const v = String(req.headers.get('X-Campus') || '').toLowerCase(); return CAMPUS_IDS.includes(v) ? v : null; };
// "All universities": the app sends X-Campus: all (not a real campus, so reads are NOT filtered) plus X-Home, the person's own university.
// New posts, events and spots are tagged with the home university (or the picked one), so reading everything never mislabels what you write.
export const isAllCampuses = (req) => String(req.headers.get('X-Campus') || '').toLowerCase() === 'all';
export const homeOf = (req) => { const v = String(req.headers.get('X-Home') || '').toLowerCase(); return CAMPUS_IDS.includes(v) ? v : null; };
export const campusOrHome = (req) => campusOf(req) || homeOf(req) || DEFAULT_CAMPUS;
export const campusRow = (req) => { const c = campusOf(req) || (isAllCampuses(req) ? homeOf(req) : null); return c ? { campus: c } : {}; };      // spread into an insert
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
    const all = isAllCampuses(req);
    const camp = all ? 'all' : (campusOf(req) || (CAMPUS_IDS.includes(url.searchParams.get('campus')) ? url.searchParams.get('campus') : DEFAULT_CAMPUS));
    const cat = String(url.searchParams.get('category') || '');
    let q = `spots?hidden=eq.false${all ? '' : '&campus=eq.' + camp}&order=created_at.desc&limit=100`;
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
    const row = { name, details: details || null, category: cat, campus: campusOrHome(req) };
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
