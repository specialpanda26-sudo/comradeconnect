// Advertiser enquiries. The "Advertise with us" form posts here, so every lead is saved on the server and
// shows up in Admin > Review > Adverts (plus an email to ADMIN_EMAIL when mail is set up).
//   POST /api/advertise                 public, rate limited
//   GET  /api/admin/adverts?status=     admin: new | done | all
//   POST /api/admin/adverts/:id         admin: { action: contacted | won | dismissed | reopen, note }
import { json, err, sb, rows, post, patch, str, normPhone, isAdmin, audit, throttle, tooMany } from './lib.js';
import { sendMail, mailReady } from './mail.js';

const PACKAGES = ['Week banner', 'Month banner', 'Sponsored post', 'Event partner', 'Not sure yet'];
const SETUP = 'Advertiser enquiries are not switched on yet. The admin must run advertisers.sql in Supabase (Admin > Site > SQL).';
const missingTable = (r, d) => r.status === 404 || ['42P01', 'PGRST205', 'PGRST204', '42703'].includes(String((d && d.code) || ''));

async function emailAdmin(env, row) {
  try {
    const to = String(env.ADMIN_EMAIL || env.SUPPORT_EMAIL || '').trim();
    if (!to || !mailReady(env)) return;
    const text = ['New advertiser enquiry on Comrade Connect', '', `Business: ${row.business}`, `WhatsApp: 0${row.phone.slice(3)}  (https://wa.me/${row.phone})`,
      `Package: ${row.package || '-'}`, `They promote: ${row.note || '-'}`, '', 'Open the admin panel > Review > Adverts to follow it up.'].join('\n');
    await sendMail(env, { to, subject: 'New advertiser: ' + row.business.slice(0, 50), text });
  } catch (e) { console.error('advert mail failed', e && e.message); }
}

export async function advertRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  const pub = path === '/api/advertise', adm = path === '/api/admin/adverts' || path.startsWith('/api/admin/adverts/');
  if (!pub && !adm) return null;
  const body = async () => (await req.json().catch(() => ({})));

  if (pub) {
    if (m !== 'POST') return err(env, 'Not found', 404);
    const b = await body();
    if (String(b.website || '').trim()) return json(env, { ok: true });          // hidden trap field: bots fill it, people do not
    const business = str(b.business, 60), phone = normPhone(b.phone);
    if (business.length < 2) return err(env, 'Add your business name');
    if (!phone) return err(env, 'Add a valid WhatsApp number like 0712345678');
    if (!(await throttle(env, ip, 'advertise', 'public', 200, 4))) return tooMany(env);
    const pkg = PACKAGES.includes(b.package) ? b.package : 'Not sure yet';
    const row = { business, phone, package: pkg, note: str(b.note, 160) || null, campus: str(b.campus, 40) || null, ip };
    const r = await post(env, 'ad_enquiries', row, 'return=representation');
    if (!r.ok) {
      const d = await r.json().catch(() => null);
      return missingTable(r, d) ? err(env, SETUP, 503) : err(env, 'Could not send it. Try again in a moment.', 500);
    }
    await emailAdmin(env, row);
    return json(env, { ok: true }, 201);
  }

  if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);
  if (path === '/api/admin/adverts' && m === 'GET') {
    const st = url.searchParams.get('status') || 'new';
    const filter = st === 'new' ? '&status=eq.new' : st === 'done' ? '&status=in.(contacted,won,dismissed)' : '';
    const r = await sb(env, `ad_enquiries?select=*&order=created_at.desc&limit=200${filter}`), d = await r.json().catch(() => null);
    if (!Array.isArray(d)) return missingTable(r, d) ? json(env, { ready: false, items: [], open: 0, message: SETUP }) : err(env, 'Could not load', 500);
    const open = st === 'new' ? d.length : (await rows(await sb(env, 'ad_enquiries?select=id&status=eq.new&limit=500'))).length;
    return json(env, { ready: true, open, items: d.map((x) => ({ ...x, local: '0' + String(x.phone).slice(3) })) });
  }
  const mm = path.match(/^\/api\/admin\/adverts\/([0-9a-f-]{36})$/);
  if (mm && m === 'POST') {
    const b = await body(), act = b.action, note = str(b.note, 300);
    if (!['contacted', 'won', 'dismissed', 'reopen'].includes(act)) return err(env, 'Unknown action');
    const upd = act === 'reopen' ? { status: 'new', handled_at: null } : { status: act, admin_note: note || null, handled_at: new Date().toISOString() };
    const [x] = await rows(await patch(env, `ad_enquiries?id=eq.${mm[1]}`, upd));
    if (!x) return err(env, 'Enquiry not found', 404);
    await audit(env, 'advert.' + act, 'advert', x.id, note || null, ip);
    return json(env, { ok: true });
  }
  return err(env, 'Not found', 404);
}
