import { json, err, sb, rows, one, post, patch, enc, user, str, int, UUID, hasContact, normPhone, throttle, tooMany } from './lib.js';
import { initPayment, credit, cardReady, manualMode } from './pay.js';
import { getSettings, feeOf } from './settings.js';
import { mailReady, sendMail } from './mail.js';
import { notify } from './notifications.js';

export const PRESETS = [
  { id: 'cake', label: 'Cake', amount: 50 }, { id: 'soda', label: 'Soda', amount: 100 }, { id: 'coffee', label: 'Coffee', amount: 300, popular: true },
  { id: 'lunch', label: 'Lunch', amount: 500 }, { id: 'dinner', label: 'Dinner', amount: 1000 },
];
const RESERVED = new Set(['admin', 'api', 'gift', 'gifts', 'support', 'comrade', 'comradeconnect', 'official', 'www', 'app', 'login', 'help']);
const mailOk = (v) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(String(v || ''));
const slugify = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);

const publicLink = (env, l) => ({ slug: l.slug, title: l.title, blurb: l.blurb || '', active: !!l.active });
async function bySlug(env, slug) {
  const s = slugify(slug); if (s.length < 3) return null;
  return one(await sb(env, `gift_links?select=*&slug=eq.${enc(s)}&limit=1`));
}

export async function giftPaid(env, p) {
  const [g] = await rows(await sb(env, `gifts?select=*&payment_id=eq.${p.id}`));
  if (!g || g.status === 'paid') return;
  const S = await getSettings(env), fee = feeOf(p.amount, S.gift_fee_percent), net = p.amount - fee;
  await credit(env, g.creator_aid, net, 'gift', 'gift:' + g.id, 'Gift' + (g.supporter_name ? ' from ' + g.supporter_name : ''));
  await patch(env, `gifts?id=eq.${g.id}&status=eq.pending`, { status: 'paid', gross: p.amount, fee, net, paid_at: new Date().toISOString(), receipt_email: null });
  try { await notify(env, g.creator_aid, 'gift', 'You received a gift', `KSh ${net} was added to your wallet.`, 'gift', g.id); } catch (e) {}
  if (g.receipt_email && mailReady(env)) {
    const [l] = await rows(await sb(env, `gift_links?select=title&id=eq.${g.link_id}`));
    await sendMail(env, { to: g.receipt_email, subject: 'Your Comrade Connect gift receipt', text: `Thank you. Your gift of KSh ${p.amount} to ${l ? l.title : 'a creator'} was received.\nM-Pesa receipt: ${p.receipt || 'n/a'}\nGifts are voluntary support and do not purchase goods, services or access.` }).catch(() => false);
  }
}
export async function giftFailed(env, p) { await patch(env, `gifts?payment_id=eq.${p.id}&status=eq.pending`, { status: 'failed', receipt_email: null }); }

export async function giftRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/gift') && path !== '/api/me/gift') return null;
  const body = async () => (await req.json().catch(() => ({})));

  if (path === '/api/me/gift') {
    const u = await user(req, env, m !== 'GET'); if (u instanceof Response) return u;
    const S = await getSettings(env);
    const [l] = await rows(await sb(env, `gift_links?select=*&aid=eq.${enc(u.aid)}`));
    if (m === 'GET') {
      const paid = await rows(await sb(env, `gifts?select=item,net,gross,supporter_name,message,paid_at&creator_aid=eq.${enc(u.aid)}&status=eq.paid&order=paid_at.desc&limit=200`));
      const since = Date.now() - 30 * 86400e3, sum = (a, f) => a.reduce((s, x) => s + (Number(x[f]) || 0), 0);
      return json(env, {
        link: l ? { ...publicLink(env, l), path: 'gift.html?c=' + l.slug } : null, fee_percent: S.gift_fee_percent,
        earned: { count: paid.length, net: sum(paid, 'net'), gross: sum(paid, 'gross'), last30: sum(paid.filter((x) => Date.parse(x.paid_at) >= since), 'net') },
        recent: paid.slice(0, 10).map((x) => ({ item: x.item, name: x.supporter_name || '', message: x.message || '', net: x.net, at: x.paid_at })),
      });
    }
    const b = await body();
    const title = str(b.title ?? (l && l.title) ?? u.handle, 40), blurb = str(b.blurb ?? (l && l.blurb) ?? '', 160);
    if (title.length < 2) return err(env, 'Enter the name people will see on your gift page');
    if (hasContact(title + ' ' + blurb)) return err(env, 'Remove phone numbers, handles and links from the name and the note');
    let slug = b.slug != null ? slugify(b.slug) : l ? l.slug : slugify(u.handle || title);
    if (slug.length < 3 || RESERVED.has(slug)) return err(env, 'Pick a link name of 3 to 24 letters or numbers');
    if (!l || slug.toLowerCase() !== l.slug.toLowerCase()) {
      const taken = await bySlug(env, slug); if (taken && taken.aid !== u.aid) return err(env, 'That link name is taken. Try another.', 409);
    }
    const active = b.active === undefined ? (l ? l.active : true) : !!b.active;
    if (!l) {
      if (!(await throttle(env, ip, 'giftlink', u.aid, 5, 20))) return tooMany(env);
      const r = await post(env, 'gift_links', { aid: u.aid, slug, title, blurb, active });
      if (!r.ok) return err(env, 'Could not create the link. Run supabase/gifts.sql in Supabase first.', 500);
    } else await patch(env, `gift_links?aid=eq.${enc(u.aid)}`, { slug, title, blurb, active });
    const [n] = await rows(await sb(env, `gift_links?select=*&aid=eq.${enc(u.aid)}`));
    return json(env, { ok: true, link: { ...publicLink(env, n), path: 'gift.html?c=' + n.slug } });
  }

  if (path === '/api/gift/public' && m === 'GET') {
    const l = await bySlug(env, url.searchParams.get('c') || '');
    if (!l || !l.active) return err(env, 'This gift link is not active', 404);
    const S = await getSettings(env);
    return json(env, { ...publicLink(env, l), presets: PRESETS, min: S.gift_min, max: S.gift_max, card: cardReady(env), receipts: mailReady(env), manual: manualMode(env) });
  }

  if (path === '/api/gift/send' && m === 'POST') {
    const b = await body();
    if (!(await throttle(env, ip, 'giftsend', String(b.c || '').toLowerCase().slice(0, 30), 15, 15))) return tooMany(env);
    const l = await bySlug(env, b.c);
    if (!l || !l.active) return err(env, 'This gift link is not active', 404);
    const S = await getSettings(env), pre = PRESETS.find((x) => x.id === b.item);
    const amount = pre ? pre.amount : int(b.amount, S.gift_min, S.gift_max), item = pre ? pre.id : 'custom';
    if (!amount) return err(env, `Choose a gift, or enter an amount from KSh ${S.gift_min} to KSh ${S.gift_max}`);
    if (b.method !== 'card' && !normPhone(b.phone)) return err(env, 'Enter a Safaricom or Airtel number like 0712345678');
    const name = str(b.name, 24), msg = str(b.message, 200), email = mailOk(b.email) && mailReady(env) ? str(b.email, 120) : null;
    if (hasContact(name + ' ' + msg)) return err(env, 'Remove phone numbers, handles and links from the name and the message');
    const r = await initPayment(env, ip, { aid: 'gift:' + l.id, purpose: 'gift', ref_id: l.id, amount, phone: b.phone, method: b.method, email });
    if (r.res) return r.res;
    await post(env, 'gifts', { link_id: l.id, creator_aid: l.aid, payment_id: r.id, item, gross: amount, supporter_name: name || null, message: msg || null, receipt_email: email });
    return json(env, { id: r.id, url: r.url, amount });
  }

  if (path === '/api/gift/confirm' && m === 'POST') {
    if (!manualMode(env)) return err(env, 'Payments are confirmed automatically', 400);
    const b = await body(), code = String(b.code || '').toUpperCase().replace(/[\s-]/g, '');
    if (!UUID.test(String(b.id || ''))) return err(env, 'bad id');
    if (!/^[A-Z0-9]{10}$/.test(code)) return err(env, 'The M-Pesa code has 10 letters and numbers, like SJK7ABC123');
    if (!(await throttle(env, ip, 'giftconfirm', b.id, 10, 40))) return tooMany(env);
    const res = await patch(env, `payments?id=eq.${b.id}&purpose=eq.gift&status=in.(pending,submitted)`, { status: 'submitted', receipt: code });
    if (res.status === 409) return err(env, 'That M-Pesa code was already used', 409);
    const [p] = await rows(res);
    return p ? json(env, { ok: true, status: 'submitted' }) : err(env, 'This payment is no longer waiting for a code', 404);
  }
  return null;
}
