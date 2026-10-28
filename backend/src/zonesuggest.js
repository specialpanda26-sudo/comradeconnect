// Zone suggestions: "which places around this university do most students live in?"
//
// GET  /api/zones/suggest?campus=tmu&radius=1500&limit=15   (public, rate limited)
// POST /api/admin/zones/suggest-apply  { campus, names: [...] }   (admin: adds the chosen names as zones in one go)
//
// How the ranking works (two sections of evidence, both optional):
//   1. Our own data for that university: hostel vacancy posts, hostel reviews, roommate posts, Wi-Fi, services and feed posts that name a zone,
//      plus every pin (hostel, Wi-Fi, spot, listing) that has coordinates. Zones people already use rank higher.
//   2. OpenStreetMap (Overpass): named neighbourhoods, estates and villages within the radius, and how many homes, apartment blocks, dormitories and
//      hostels are mapped around each one. If Overpass is slow or down we still answer from section 1.
// Score = 0-100 "student signal", NOT a head-count. We never invent a number of students.
// The radius can be as small as 10 metres. Nothing within the radius gives an empty list and the distance to the nearest zone, so the app can say "try 500 m".
import { json, err, sb, rows, post, enc, str, bump, tooMany, isAdmin, audit } from './lib.js';
import { CAMPUSES, CAMPUS_IDS, DEFAULT_CAMPUS } from './campus.js';
import { getZones, DEFAULT_ZONES } from './settings.js';

export const MIN_RADIUS = 10, MAX_RADIUS = 20000, DEFAULT_RADIUS = 2000;
const MAP_PLACE_MAX = 8000, MAP_BUILD_MAX = 3000, ASSIGN_M = 1200, ATTACH_M = 600, CELL_M = 400;
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const W = { vacancy: 4, review: 2, room: 2, wifi: 1.5, service: 1, listing: 1, spot: 0.8, post: 0.3 };      // weight of each kind of evidence
const PLACE_BASE = { suburb: 6, neighbourhood: 5, quarter: 5, village: 4, hamlet: 2, locality: 1.5, isolated_dwelling: 0.5 };
const BUILDING_W = { dormitory: 5, apartments: 3, hostel: 5, residential: 1.5, house: 1, terrace: 1.2, semidetached_house: 1.2, detached: 1, bungalow: 1 };

const rad = (d) => (d * Math.PI) / 180;
export function distM(la1, ln1, la2, ln2) {
  const R = 6371000, dla = rad(la2 - la1), dln = rad(ln2 - ln1);
  const a = Math.sin(dla / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(dln / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export function compass(la1, ln1, la2, ln2) {
  const y = Math.sin(rad(ln2 - ln1)) * Math.cos(rad(la2)), x = Math.cos(rad(la1)) * Math.sin(rad(la2)) - Math.sin(rad(la1)) * Math.cos(rad(la2)) * Math.cos(rad(ln2 - ln1));
  return DIRS[Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360 / 45) % 8];
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const cleanName = (s) => str(String(s || '').replace(/[<>"]/g, ''), 30).replace(/\s+/g, ' ').trim();
const goodName = (s) => s.length >= 2 && !/\d{7,}/.test(s) && !/@|https?:|www\./i.test(s);
const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
const geo = (la, ln) => Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180;

// ---------- OpenStreetMap ----------
const cache = new Map();
export const clearZoneCache = () => cache.clear();   // used by the tests   // in-memory, per server instance: one answer per campus and radius band for 6 hours
async function overpass(query) {
  let last = 'down';
  for (const ep of OVERPASS) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 14000);
    try {
      const r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'ComradeConnect/1.0 (comradeconnect.co.ke)' }, body: 'data=' + encodeURIComponent(query), signal: ctl.signal });
      if (r.ok) { const d = await r.json().catch(() => null); if (d && Array.isArray(d.elements)) return d.elements; }
      last = 'bad';
    } catch (e) { last = 'down'; } finally { clearTimeout(t); }
  }
  throw new Error(last);
}
async function mapData(c, radius) {
  const band = radius <= 100 ? 100 : radius <= 500 ? 500 : radius <= 1000 ? 1000 : radius <= 2000 ? 2000 : radius <= 5000 ? 5000 : 8000;   // cache bands, so nearby radii share one answer
  const key = c.id + ':' + band, hit = cache.get(key);
  if (hit && Date.now() - hit.at < 6 * 3600e3) return hit.v;
  const pr = Math.min(Math.max(band, 500), MAP_PLACE_MAX), br = Math.min(Math.max(band, 500), MAP_BUILD_MAX);
  const places = `[out:json][timeout:20];(node["place"~"^(suburb|neighbourhood|quarter|village|hamlet|locality)$"](around:${pr},${c.lat},${c.lng});way["place"~"^(suburb|neighbourhood|quarter|village|hamlet|locality)$"](around:${pr},${c.lat},${c.lng}););out center 250;`;
  const homes = `[out:json][timeout:25];(way["building"~"^(dormitory|apartments|residential|house|terrace|semidetached_house|detached|bungalow)$"](around:${br},${c.lat},${c.lng});node["tourism"="hostel"](around:${br},${c.lat},${c.lng});way["tourism"="hostel"](around:${br},${c.lat},${c.lng}););out center 3000;`;
  const addrs = `[out:json][timeout:25];(nwr["addr:suburb"](around:${br},${c.lat},${c.lng});nwr["addr:neighbourhood"](around:${br},${c.lat},${c.lng}););out tags center 3000;`;
  const [p, h, ad] = await Promise.allSettled([overpass(places), overpass(homes), overpass(addrs)]);
  const v = { ok: p.status === 'fulfilled' || h.status === 'fulfilled' || ad.status === 'fulfilled', places: [], homes: [] };
  const at = (e) => ({ lat: num(e.lat ?? e.center?.lat), lng: num(e.lon ?? e.center?.lon) });
  if (p.status === 'fulfilled') for (const e of p.value) {
    const { lat, lng } = at(e), name = cleanName(e.tags?.name || e.tags?.['name:en']);
    if (geo(lat, lng) && goodName(name)) v.places.push({ name, lat, lng, type: e.tags?.place || 'locality' });
  }
  if (ad.status === 'fulfilled') {   // a suburb name written on many mapped addresses is a real neighbourhood even when nobody drew it as a place
    const g = new Map();
    for (const e of ad.value) {
      const { lat, lng } = at(e), name = cleanName(e.tags?.['addr:suburb'] || e.tags?.['addr:neighbourhood']); if (!geo(lat, lng) || !goodName(name)) continue;
      const k = norm(name), x = g.get(k) || { name, n: 0, la: 0, ln: 0 }; x.n++; x.la += lat; x.ln += lng; g.set(k, x);
    }
    for (const x of g.values()) if (!v.places.some((q) => norm(q.name) === norm(x.name))) v.places.push({ name: x.name, lat: x.la / x.n, lng: x.ln / x.n, type: 'neighbourhood', addr: x.n });
  }
  if (h.status === 'fulfilled') for (const e of h.value) {
    const { lat, lng } = at(e); if (!geo(lat, lng)) continue;
    const kind = e.tags?.tourism === 'hostel' ? 'hostel' : e.tags?.building;
    v.homes.push({ lat, lng, w: BUILDING_W[kind] || 1 });
  }
  if (v.ok) cache.set(key, { at: Date.now(), v });
  return v;
}

// ---------- our own data ----------
async function ownData(env, c) {
  const campus = c.id;
  const q = (t, sel, extra = '') => sb(env, `${t}?select=${sel}&hidden=eq.false&campus=eq.${enc(campus)}${extra}&limit=1500`).then(rows).catch(() => []);
  const [hostels, rms, wifi, svc, posts, spots] = await Promise.all([
    q('hostels', 'zone,lat,lng,kind'), q('rooms', 'zone'), q('wifi', 'zone,lat,lng'), q('services', 'zone'),
    sb(env, `posts?select=zone&hidden=eq.false&campus=eq.${enc(campus)}&order=created_at.desc&limit=2000`).then(rows).catch(() => []),
    q('spots', 'lat,lng'),
  ]);
  // Listings are not tied to a campus, so only pinned ones within 15 km of this university count
  const listings = (await sb(env, 'listings?select=zone,lat,lng&status=eq.approved&limit=1000').then(rows).catch(() => [])).filter((x) => geo(num(x.lat), num(x.lng)) && distM(c.lat, c.lng, num(x.lat), num(x.lng)) <= 15000);
  const ev = [];   // { zone, kind, lat, lng }
  const add = (arr, kind, f = (x) => kind) => arr.forEach((x) => ev.push({ zone: cleanName(x.zone), kind: f(x), lat: num(x.lat), lng: num(x.lng) }));
  add(hostels, 'review', (x) => (x.kind === 'vacancy' ? 'vacancy' : 'review')); add(rms, 'room'); add(wifi, 'wifi'); add(svc, 'service'); add(posts, 'post'); add(spots, 'spot'); add(listings, 'listing');
  return ev;
}

// ---------- the ranking ----------
export async function suggestZones(env, campusId, radius, limit, here) {
  const base = CAMPUSES.find((x) => x.id === campusId);
  const c = here ? { ...base, lat: here.lat, lng: here.lng, id: base.id + '@' + here.lat.toFixed(3) + ',' + here.lng.toFixed(3) } : base;   // here = the person's own spot; the scan is centred on it
  const ev = await ownData(env, base);
  const saved = await getZones(env, campusId), existing = saved.map((z) => norm(z));
  let mapStatus = 'ok', m = { places: [], homes: [] };
  try { m = await mapData(c, radius); if (!m.ok) mapStatus = 'unavailable'; } catch (e) { mapStatus = 'unavailable'; }

  const cand = new Map();   // key -> candidate
  const get = (name, key) => { if (!cand.has(key)) cand.set(key, { name, key, pts: [], counts: {}, raw: 0, build: 0, base: 0, lat: NaN, lng: NaN, osm: false }); return cand.get(key); };
  // 1. map places become candidates
  for (const p of m.places) { const k = norm(p.name); if (!k) continue; const z = get(p.name, k); if (!z.osm) { z.osm = true; z.lat = p.lat; z.lng = p.lng; z.base = (PLACE_BASE[p.type] || 1) + Math.min(6, (p.addr || 0) / 5); } }
  // 2. zone names people already use become candidates (evidence by name)
  for (const e of ev) {
    if (!e.zone) continue; const k = norm(e.zone); if (!k) continue;
    const z = get(e.zone, k); z.raw += W[e.kind] || 0.3; z.counts[e.kind] = (z.counts[e.kind] || 0) + 1;
    if (geo(e.lat, e.lng)) z.pts.push([e.lat, e.lng]);
  }
  // 2b. zones the admin already saved always appear (even with no pins or map data), so the base zones are never missing
  for (const nm of saved) { const k = norm(nm); if (k) { const z = get(nm, k); z.saved = true; } }
  // 3. a zone known only by pins takes the middle of its pins as its place; a map place keeps its own coordinates
  for (const z of cand.values()) if (!geo(z.lat, z.lng) && z.pts.length) { z.lat = z.pts.reduce((a, p) => a + p[0], 0) / z.pts.length; z.lng = z.pts.reduce((a, p) => a + p[1], 0) / z.pts.length; }
  const located = () => [...cand.values()].filter((z) => geo(z.lat, z.lng));
  // 4. pins with no zone name count for the nearest located candidate (within 600 m)
  for (const e of ev) {
    if (e.zone || !geo(e.lat, e.lng)) continue;
    let best = null, bd = ATTACH_M; for (const z of located()) { const d = distM(e.lat, e.lng, z.lat, z.lng); if (d <= bd) { bd = d; best = z; } }
    if (best) { best.raw += W[e.kind] || 0.3; best.counts[e.kind] = (best.counts[e.kind] || 0) + 1; }
  }
  // 5. mapped homes count for the nearest place; homes far from every place group into unnamed areas
  const loose = new Map();
  for (const h of m.homes) {
    let best = null, bd = ASSIGN_M; for (const z of located()) { if (!z.osm) continue; const d = distM(h.lat, h.lng, z.lat, z.lng); if (d <= bd) { bd = d; best = z; } }
    if (best) { best.build += h.w; best.counts.buildings = (best.counts.buildings || 0) + 1; continue; }
    const cy = Math.round(((h.lat - c.lat) * 111320) / CELL_M), cx = Math.round(((h.lng - c.lng) * 111320 * Math.cos(rad(c.lat))) / CELL_M), k = cx + ',' + cy;
    const g = loose.get(k) || { w: 0, n: 0, la: 0, ln: 0 }; g.w += h.w; g.n++; g.la += h.lat; g.ln += h.lng; loose.set(k, g);
  }
  for (const [k, g] of loose) if (g.n >= 12) {   // a cluster of 12+ mapped homes with no name is worth showing; the admin can name it
    const z = get('', 'area:' + k); z.lat = g.la / g.n; z.lng = g.ln / g.n; z.build = g.w; z.counts.buildings = g.n; z.osm = true; z.unnamed = true;
  }
  // 6. distance, filter by radius, score
  const all = [...cand.values()].map((z) => {
    const has = geo(z.lat, z.lng), d = has ? Math.round(distM(c.lat, c.lng, z.lat, z.lng)) : null;
    return { z, has, d };
  }).filter((x) => x.z.raw > 0 || x.z.build > 0 || x.z.base > 0 || x.z.saved);
  const inside = all.filter((x) => (x.has ? x.d <= radius : (x.z.saved || (radius >= 1000 && x.z.raw > 0))));   // a zone with no pins has no distance: saved zones always show, others only for wide searches
  const maxRaw = Math.max(0, ...inside.map((x) => x.z.raw)), maxMap = Math.max(0, ...inside.map((x) => Math.sqrt(x.z.build + x.z.base)));
  const wI = maxRaw > 0 && maxMap > 0 ? 0.6 : maxRaw > 0 ? 0.9 : 0, wM = maxRaw > 0 && maxMap > 0 ? 0.4 : maxMap > 0 ? 0.9 : 0, scale = Math.max(radius / 2, 100);
  const out = inside.map(({ z, has, d }) => {
    const iN = maxRaw ? z.raw / maxRaw : 0, mN = maxMap ? Math.sqrt(z.build + z.base) / maxMap : 0, prox = has ? 1 / (1 + d / scale) : 0.5;
    const score = Math.round(100 * Math.min(1, wI * iN + wM * mN + 0.1 * prox) * (0.75 + 0.25 * prox));
    const own = Object.entries(z.counts).filter(([k]) => k !== 'buildings').reduce((a, [, n]) => a + n, 0);
    return {
      name: z.name || null, unnamed: !!z.unnamed, score, lat: has ? +z.lat.toFixed(5) : null, lng: has ? +z.lng.toFixed(5) : null,
      distance_m: d, direction: has ? compass(c.lat, c.lng, z.lat, z.lng) : null,
      evidence: { vacancies: z.counts.vacancy || 0, hostel_reviews: z.counts.review || 0, rooms: z.counts.room || 0, wifi: z.counts.wifi || 0, services: z.counts.service || 0, posts: z.counts.post || 0, buildings: z.counts.buildings || 0 },
      confidence: own >= 5 ? 'high' : own >= 2 || (z.counts.buildings || 0) >= 20 ? 'medium' : 'low',
      source: own && z.osm ? 'both' : z.osm ? 'map' : 'app',
      existing: !!z.name && existing.includes(norm(z.name)), saved: !!z.name && existing.includes(norm(z.name)),
    };
  }).sort((a, b) => b.score - a.score || (a.distance_m ?? 1e9) - (b.distance_m ?? 1e9)).slice(0, limit);
  // nothing in range: tell the app how far the nearest one is, so it can say "try 500 m"
  const nearest = out.length ? null : all.filter((x) => x.has && x.d > radius).sort((a, b) => a.d - b.d)[0];
  return {
    campus: { id: base.id, name: base.name, short: base.short, lat: base.lat, lng: base.lng }, center: here ? { lat: here.lat, lng: here.lng, me: true } : { lat: base.lat, lng: base.lng, me: false }, radius_m: radius, zones: out,
    nearest_outside: nearest ? { name: nearest.z.name || null, distance_m: nearest.d } : null,
    sources: { app: ev.length, map: mapStatus }, attribution: mapStatus === 'ok' ? 'Map data \u00a9 OpenStreetMap contributors' : null, generated_at: new Date().toISOString(),
  };
}

export async function zoneSuggestRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (path === '/api/zones/suggest' && m === 'GET') {
    const id = String(url.searchParams.get('campus') || '').toLowerCase();
    if (!CAMPUS_IDS.includes(id)) return err(env, 'Pick a university first');
    if (id === 'other') return err(env, 'Zone suggestions need a named university. Pick yours from the list.');
    const r = Number(url.searchParams.get('radius') || DEFAULT_RADIUS);
    if (!Number.isFinite(r)) return err(env, 'Radius must be a number of metres');
    const radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Math.round(r)));
    const limit = Math.min(40, Math.max(1, parseInt(url.searchParams.get('limit')) || 7));
    let here = null; const la = Number(url.searchParams.get('lat')), ln = Number(url.searchParams.get('lng'));
    if (url.searchParams.get('lat') && url.searchParams.get('lng')) {
      if (!Number.isFinite(la) || !Number.isFinite(ln) || la < -5 || la > 5.6 || ln < 33.5 || ln > 42) return err(env, 'That location is not in Kenya');
      here = { lat: +la.toFixed(5), lng: +ln.toFixed(5) };
    }
    if (!(await bump(env, 'zsuggest:i:' + ip, 80))) return tooMany(env);
    return json(env, await suggestZones(env, id, radius, limit, here));
  }
  if (path === '/api/admin/zones/suggest-apply' && m === 'POST') {
    if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);
    const b = await req.json().catch(() => ({}));
    const camp = CAMPUS_IDS.includes(String(b.campus || '').toLowerCase()) ? String(b.campus).toLowerCase() : DEFAULT_CAMPUS;
    const want = [...new Set((Array.isArray(b.names) ? b.names : []).filter((n) => typeof n === 'string' && !/[<>"]/.test(n)).map(cleanName).filter(goodName))].slice(0, 40);   // names with < > " are refused, same as the Zones page
    if (!want.length) return err(env, 'Choose at least one zone');
    const base = camp === DEFAULT_CAMPUS ? DEFAULT_ZONES : ['On campus'];
    const have = await rows(await sb(env, 'zones?select=name&campus=eq.' + enc(camp) + '&limit=100'));
    if (!have.length) for (const [i, z] of base.entries()) await post(env, 'zones', { name: z, sort: i, campus: camp }, 'resolution=ignore-duplicates,return=representation');
    const cur = have.length ? have.map((x) => x.name) : base.slice();
    const added = [], skipped = [];
    for (const name of want) {
      if (cur.some((z) => z.toLowerCase() === name.toLowerCase())) { skipped.push(name); continue; }
      if (cur.length >= 40) { skipped.push(name); continue; }
      await post(env, 'zones', { name, sort: cur.length, campus: camp }, 'return=representation'); cur.push(name); added.push(name);
    }
    await audit(env, 'zones.suggest_apply', 'zone', camp, { added, skipped }, ip);
    return json(env, { ok: true, added, skipped, zones: await getZones(env, camp) });
  }
  return null;
}
