// Hostel vacancies. A caretaker registers once (the admin sets the fee, 0 = free), then posts vacant rooms with an exact
// GPS location, room photos, the services included and a landmark note. Comrades browse them, see photos and get directions.
import { json, err, sb, rows, one, post, patch, enc, int, str, UUID, user, authProfile, throttle, tooMany, normPhone, inList } from './lib.js';
import { initPayment, payFromWallet, wantsWallet } from './pay.js';
import { getSettings } from './settings.js';
import { mediaUrl } from './storage.js';

export const HOSTEL_PHOTOS = 8;
export const AMENITIES = ['Water', 'Electricity', 'Wi-Fi', 'Security', 'Laundry', 'Parking', 'Gas', 'Furnished', 'CCTV', 'Shower', 'Study room'];
const ROOMS = ['Single', 'Bedsitter', 'Double', 'Shared', 'One bedroom'];
export const hostelText = ['name', 'zone', 'review', 'room_types', 'amenities', 'address'];    // contact-filtered

// Kenya sits roughly between latitude -5 and 5.6 and longitude 33.5 and 42.
const inKenya = (lat, lng) => lat > -5 && lat < 5.6 && lng > 33.5 && lng < 42;

export async function isCaretaker(env, aid) {
  const S = await getSettings(env);
  if (S.hostel_reg_fee === 0) return true;                       // free registration: every signed-in comrade may post
  return !!(await one(await sb(env, `caretakers?select=aid&aid=eq.${enc(aid)}`)));
}
export async function caretakerPaid(env, p) {
  await post(env, 'caretakers', { aid: p.aid, amount: p.amount, payment_id: p.id }, 'resolution=ignore-duplicates,return=representation');
}

// Validates a new hostels row. Returns the row to insert, or an error string.
export function hostelParse(b) {
  const kind = b.kind === 'vacancy' ? 'vacancy' : 'review';
  const name = str(b.name, 60); if (name.length < 2) return 'Add the hostel name';
  const out = { kind, name, zone: str(b.zone, 30), rent: int(b.rent, 0, 200000), review: str(b.review, 400) };
  if (kind === 'review') { out.rating = int(b.rating, 1, 5); return out; }
  if (!out.rent) return 'Add the monthly rent in KSh';
  const vac = int(b.vacancies, 0, 500); if (vac === null) return 'Add how many rooms are vacant (0 if full)';
  out.vacancies = vac;
  out.room_types = str(Array.isArray(b.room_types) ? b.room_types.filter((x) => ROOMS.includes(x)).join(', ') : b.room_types, 120);
  out.amenities = (Array.isArray(b.amenities) ? b.amenities : String(b.amenities || '').split(',')).map((x) => str(x, 24)).filter((x) => AMENITIES.includes(x)).join(', ');
  out.address = str(b.address, 160);
  const lat = Number(b.lat), lng = Number(b.lng), acc = Math.round(Number(b.accuracy));
  if (b.lat === undefined || b.lat === null || b.lat === '' || !Number.isFinite(lat) || !Number.isFinite(lng)) return 'Tap Use my real location while you are at the hostel';
  if (!inKenya(lat, lng)) return 'That location is not in Kenya. Tap Use my real location again';
  if (Number.isFinite(acc) && acc > 300) return 'Your location is not accurate enough (' + acc + ' m). Stand at the hostel gate, switch on GPS and try again';
  out.lat = +lat.toFixed(5); out.lng = +lng.toFixed(5); out.accuracy_m = Number.isFinite(acc) ? Math.max(0, acc) : null;
  const ph = String(b.contact_phone ?? '').trim();
  if (ph) { const n = normPhone(ph); if (!n) return 'Phone number like 0712345678'; out.contact_phone = n; }
  return out;
}

// Adds photos to a list of hostels, hides the phone number from people who are not signed in.
export async function decorateHostels(env, items, me) {
  const ids = items.map((x) => x.id);
  const ph = ids.length ? await rows(await sb(env, `media?select=hostel_id,r2_key&kind=eq.hostel_photo&status=eq.ready&hostel_id=${inList(ids)}&order=created_at.asc`)) : [];
  return items.map((x) => {
    const has = !!x.contact_phone, { contact_phone, ...rest } = x;
    return { ...rest, photos: ph.filter((p) => p.hostel_id === x.id).map((p) => mediaUrl(env, p.r2_key)), has_phone: has, contact_phone: me ? contact_phone : undefined };
  });
}

export async function hostelRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/hostels')) return null;
  const body = async () => (await req.json().catch(() => ({})));

  // Am I a registered caretaker, and what does registering cost?
  if (path === '/api/hostels/caretaker' && m === 'GET') {
    const S = await getSettings(env), me = req.headers.get('X-Token') ? await authProfile(req, env) : null;
    return json(env, { fee: S.hostel_reg_fee, registered: me ? await isCaretaker(env, me.aid) : S.hostel_reg_fee === 0, amenities: AMENITIES, rooms: ROOMS, photos: HOSTEL_PHOTOS });
  }
  // Register as a caretaker: free when the fee is 0, otherwise an M-Pesa payment (purpose 'caretaker').
  if (path === '/api/hostels/caretaker/register' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const S = await getSettings(env), b = await body();
    if (await isCaretaker(env, u.aid)) return json(env, { registered: true });
    if (wantsWallet(b)) {
      const w = await payFromWallet(env, ip, { aid: u.aid, purpose: 'caretaker', amount: S.hostel_reg_fee, note: 'Caretaker registration' });
      return w.res || json(env, { id: w.id, paid: 'wallet', registered: true, amount: S.hostel_reg_fee });
    }
    if (b.method !== 'card' && !normPhone(b.phone)) return err(env, 'Enter a Safaricom or Airtel number like 0712345678');
    const r = await initPayment(env, ip, { aid: u.aid, purpose: 'caretaker', amount: S.hostel_reg_fee, phone: b.phone, method: b.method, email: b.email });
    return r.res || json(env, { id: r.id, url: r.url, amount: S.hostel_reg_fee });
  }

  const mm = path.match(/^\/api\/hostels\/([0-9a-f-]{36})\/(vacancies|remove)$/);
  if (mm && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    if (!UUID.test(mm[1])) return err(env, 'Not found', 404);
    if (!(await throttle(env, ip, 'hostelact', u.aid, 60, 240))) return tooMany(env);
    const h = await one(await sb(env, `hostels?id=eq.${mm[1]}&aid=eq.${enc(u.aid)}&hidden=eq.false`));
    if (!h) return err(env, 'Only the person who posted this can change it', 403);
    if (mm[2] === 'remove') { await patch(env, `hostels?id=eq.${h.id}`, { hidden: true }); return json(env, { ok: true }); }
    const n = int((await body()).vacancies, 0, 500); if (n === null) return err(env, 'Enter 0 to 500 rooms');
    await patch(env, `hostels?id=eq.${h.id}`, { vacancies: n });
    return json(env, { vacancies: n });
  }
  return err(env, 'Not found', 404);
}
