// Support and money visibility.
//  - "Request a review": when a person sees an error, one tap sends it to the admin panel (POST /api/support/report).
//  - Withdrawal support: a failed withdrawal can be reported with the M-Pesa number, so the admin can send the money by hand.
//  - The M-Pesa number of an account (GET/POST /api/me/phone), shown to the admin next to payments, withdrawals and requests.
//  - Admin: the review queue, EVERY transaction (payments, wallet movements, withdrawals), accounts with numbers, and a
//    health check that says which SQL file is missing in Supabase.
import { json, err, sb, rows, one, post, patch, enc, inList, str, int, UUID, normPhone, user, authProfile, isAdmin, audit, throttle, tooMany } from './lib.js';
import { notify } from './notifications.js';
import { sendMail, mailReady } from './mail.js';
import SQL from './sqltext.js';

const KINDS = ['error', 'withdrawal', 'other'];
const SETUP = 'Review requests are not switched on yet. The admin must run support.sql in Supabase (Admin > Site > SQL).';
const missingTable = (r, d) => r.status === 404 || ['42P01', 'PGRST205', 'PGRST204', '42703'].includes(String((d && d.code) || ''));
export const showPhone = (p) => (p && /^2547\d{8}$|^2541\d{8}$/.test(p) ? '0' + p.slice(3) : p || null);

// Profiles for a list of account ids: handle and saved phone (the phone column may not exist yet: then only the handle).
async function profilesOf(env, aids) {
  const ids = [...new Set(aids.filter(Boolean))].slice(0, 300), out = {};
  if (!ids.length) return out;
  let r = await sb(env, `profiles?select=aid,handle,phone&aid=${inList(ids)}&limit=300`);
  if (!r.ok) r = await sb(env, `profiles?select=aid,handle&aid=${inList(ids)}&limit=300`);
  for (const p of await rows(r)) out[p.aid] = p;
  return out;
}

const PURPOSE = { order: 'Market purchase', boost: 'Boost', club: 'Club order', ticket: 'Event ticket', topup: 'Wallet deposit', wholesale: 'Wholesaler plan', caretaker: 'Hostel caretaker', kura: 'Kura vote', gift: 'Gift', spillfee: 'Spill fee' };
const LEDGER = { sale: 'Sale paid out', referral: 'Referral reward', withdrawal: 'Withdrawal', refund: 'Refund', adjustment: 'Adjustment', topup: 'Deposit', purchase: 'Market purchase', wholesale_fee: 'Wholesaler plan' };

async function emailAdmin(env, row, who) {
  try {
    const to = String(env.ADMIN_EMAIL || env.SUPPORT_EMAIL || '').trim();
    if (!to || !mailReady(env)) return;
    const text = [`New ${row.kind === 'withdrawal' ? 'withdrawal support request' : 'review request'} on Comrade Connect`, '',
      `Account: ${who || 'not signed in'}`, `Screen: ${row.page || '-'}`, `Error: ${row.message || '-'}`, `Detail: ${row.detail || '-'}`,
      row.phone ? `M-Pesa number: ${showPhone(row.phone)}` : '', row.amount ? `Amount: KSh ${row.amount}` : '', row.note ? `Note: ${row.note}` : '', '',
      'Open the admin panel > Support to see it and mark it fixed.'].filter((x) => x !== '').join('\n');
    await sendMail(env, { to, subject: row.kind === 'withdrawal' ? 'Withdrawal support request' : 'Review request: ' + (row.message || 'error').slice(0, 60), text });
  } catch (e) { console.error('support mail failed', e && e.message); }
}

// Which tables each SQL file creates (read from the SQL text itself, so this list is never out of date).
function tablesBySql() {
  const out = [];
  for (const [file, text] of Object.entries(SQL)) {
    for (const m of String(text).matchAll(/create\s+table\s+if\s+not\s+exists\s+([a-z_0-9]+)/gi)) out.push({ file, table: m[1].toLowerCase() });
  }
  return out;
}
async function tableExists(env, t) {
  try {
    const r = await sb(env, `${t}?select=*&limit=1`), d = r.ok ? null : await r.json().catch(() => null);
    return r.ok || !missingTable(r, d);
  } catch (e) { return false; }
}

export async function supportRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  const mine = path.startsWith('/api/support') || path === '/api/me/phone';
  const adm = path === '/api/admin/support' || path.startsWith('/api/admin/support/') || path === '/api/admin/transactions' || path === '/api/admin/phones' || path === '/api/admin/health';
  if (!mine && !adm) return null;
  const body = async () => (await req.json().catch(() => ({})));

  // ---------------- people ----------------
  if (path === '/api/me/phone' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    return json(env, { phone: showPhone(u.phone) });
  }
  if (path === '/api/me/phone' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    if (!(await throttle(env, ip, 'phone', u.aid, 20, 60))) return tooMany(env);
    const p = normPhone((await body()).phone);
    if (!p) return err(env, 'Enter a Safaricom or Airtel number like 0712345678');
    const r = await patch(env, `profiles?aid=eq.${enc(u.aid)}`, { phone: p });
    if (!r.ok) { const d = await r.json().catch(() => null); return missingTable(r, d) ? err(env, SETUP, 503) : err(env, 'Could not save the number. Try again.', 500); }
    return json(env, { ok: true, phone: showPhone(p) });
  }

  if (path === '/api/support/report' && m === 'POST') {
    const p = await authProfile(req, env);                       // signing in is optional: a person who cannot sign in can still report it
    if (p && p.banned) return err(env, 'This account is suspended', 403);
    const b = await body(), kind = KINDS.includes(b.kind) ? b.kind : 'error';
    if (kind === 'withdrawal' && !p) return err(env, 'Please sign in again', 401);
    if (!(await throttle(env, ip, 'support', p ? p.aid : 'ip:' + ip, 20, 80))) return tooMany(env);
    const message = str(b.message, 300), detail = str(b.detail, 400), note = str(b.note, 500), page = str(b.page, 60).replace(/[^\w -]/g, '');
    if (!message && !note && kind !== 'withdrawal') return err(env, 'Tell us what went wrong');
    let phone = normPhone(b.phone) || (p && p.phone) || null, amount = int(b.amount, 1, 1e7), ref = str(b.ref, 60);
    if (kind === 'withdrawal') {
      if (UUID.test(ref)) {
        const w = await one(await sb(env, `withdrawals?select=id,amount,phone,status&id=eq.${ref}&aid=eq.${enc(p.aid)}`));
        if (w) { phone = normPhone(b.phone) || w.phone || phone; amount = amount || w.amount; } else ref = '';
      } else ref = '';
      if (!phone) return err(env, 'Add the M-Pesa number the money should go to');
    }
    if (p && ref) {                                              // the same problem is not filed twice
      const dup = await one(await sb(env, `support_requests?select=id&aid=eq.${enc(p.aid)}&kind=eq.${kind}&ref=eq.${enc(ref)}&status=eq.open`));
      if (dup) return json(env, { ok: true, id: dup.id, duplicate: true });
    }
    const row = { aid: p ? p.aid : null, kind, page: page || null, message: message || null, detail: detail || null, note: note || null, phone, amount: amount || null, ref: ref || null };
    const r = await post(env, 'support_requests', row, 'return=representation'), d = await r.json().catch(() => null), saved = Array.isArray(d) ? d[0] : null;
    if (!saved) return missingTable(r, d) ? err(env, SETUP, 503) : err(env, 'Could not send it. Try again in a moment.', 500);
    if (p && phone && !p.phone && normPhone(b.phone)) await patch(env, `profiles?aid=eq.${enc(p.aid)}`, { phone }).catch(() => {});   // remember the number for next time
    await emailAdmin(env, row, p ? '@' + (p.handle || p.aid) + ' (' + p.aid + ')' : null);
    return json(env, { ok: true, id: saved.id }, 201);
  }
  if (path === '/api/support/mine' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const list = await rows(await sb(env, `support_requests?select=id,kind,message,status,admin_note,created_at,resolved_at&aid=eq.${enc(u.aid)}&order=created_at.desc&limit=20`));
    return json(env, { items: list });
  }
  if (mine) return null;

  // ---------------- admin ----------------
  if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);

  if (path === '/api/admin/support' && m === 'GET') {
    const st = url.searchParams.get('status') || 'open';
    const filter = st === 'open' ? '&status=eq.open' : st === 'done' ? '&status=in.(fixed,dismissed)' : '';
    const r = await sb(env, `support_requests?select=*&order=created_at.desc&limit=200${filter}`), d = await r.json().catch(() => null);
    if (!Array.isArray(d)) return missingTable(r, d) ? json(env, { ready: false, items: [], open: 0, message: SETUP }) : err(env, 'Could not load', 500);
    const who = await profilesOf(env, d.map((x) => x.aid));
    const open = st === 'open' ? d.length : (await rows(await sb(env, 'support_requests?select=id&status=eq.open&limit=500'))).length;
    return json(env, { ready: true, open, items: d.map((x) => ({ ...x, phone: showPhone(x.phone), handle: who[x.aid]?.handle || null, account_phone: showPhone(who[x.aid]?.phone) })) });
  }
  let mm = path.match(/^\/api\/admin\/support\/([0-9a-f-]{36})$/);
  if (mm && m === 'POST') {
    const b = await body(), act = b.action, note = str(b.note, 300);
    if (!['fixed', 'dismissed', 'reopen'].includes(act)) return err(env, 'Unknown action');
    const patchBody = act === 'reopen' ? { status: 'open', resolved_at: null, resolved_by: null } : { status: act, admin_note: note || null, resolved_at: new Date().toISOString(), resolved_by: 'admin' };
    const [x] = await rows(await patch(env, `support_requests?id=eq.${mm[1]}`, patchBody));
    if (!x) return err(env, 'Request not found', 404);
    if (act === 'fixed' && x.aid) await notify(env, x.aid, 'admin', 'Your review request was handled', note || 'An admin looked into the problem you reported and fixed it. Please try again.', 'support', x.id);
    await audit(env, 'support.' + act, 'support', x.id, note || null, ip);
    return json(env, { ok: true });
  }

  if (path === '/api/admin/transactions' && m === 'GET') {
    const type = url.searchParams.get('type') || 'all', q = str(url.searchParams.get('q'), 60).toLowerCase().replace(/^@/, '');
    const limit = int(url.searchParams.get('limit'), 1, 200) || 60, offset = int(url.searchParams.get('offset'), 0, 5000) || 0, per = 250;
    const want = (k) => type === 'all' || type === k;
    const [pays, led, wds] = await Promise.all([
      want('payments') ? sb(env, `payments?select=id,aid,purpose,ref_id,amount,phone,receipt,status,created_at,paid_at&order=created_at.desc&limit=${per}`).then(rows) : [],
      want('wallet') ? sb(env, `wallet_ledger?select=id,aid,delta,kind,ref,status,note,created_at&order=created_at.desc&limit=${per}`).then(rows) : [],
      want('withdrawals') ? sb(env, `withdrawals?select=*&order=created_at.desc&limit=${per}`).then(rows) : [],
    ]);
    const who = await profilesOf(env, [...pays, ...led, ...wds].map((x) => x.aid));
    const list = [
      ...pays.map((x) => ({ id: 'p' + x.id, type: 'payment', title: PURPOSE[x.purpose] || x.purpose || 'Payment', aid: x.aid, phone: x.phone, amount: x.amount, status: x.status, ref: x.receipt || x.ref_id || null, note: null, at: x.created_at })),
      ...led.map((x) => ({ id: 'l' + x.id, type: 'wallet', title: LEDGER[x.kind] || x.kind, aid: x.aid, phone: null, amount: x.delta, status: x.status, ref: x.ref || null, note: x.note || null, at: x.created_at })),
      ...wds.map((x) => ({ id: 'w' + x.id, type: 'withdrawal', title: 'Withdrawal to M-Pesa', aid: x.aid, phone: x.phone, amount: -x.amount, status: x.status, ref: x.payout_ref || x.id, note: x.fee ? 'Fee KSh ' + x.fee + ', net KSh ' + (x.net == null ? x.amount - x.fee : x.net) : null, at: x.created_at })),
    ].map((x) => ({ ...x, handle: who[x.aid]?.handle || null, phone: showPhone(x.phone) || showPhone(who[x.aid]?.phone), account_phone: showPhone(who[x.aid]?.phone) }));
    const hay = (x) => [x.aid, x.handle, x.phone, x.account_phone, x.ref, x.note, x.title, x.status, String(Math.abs(x.amount))].join(' ').toLowerCase();
    const digits = q.replace(/\D/g, ''), local = digits.startsWith('254') ? '0' + digits.slice(3) : digits;      // 254712... and 0712... find the same person
    const hit = q ? list.filter((x) => hay(x).includes(q) || (local.length >= 4 && [x.phone, x.account_phone].some((p) => p && p.replace(/\D/g, '').includes(local)))) : list;
    hit.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const money = (f) => hit.filter(f).reduce((s, x) => s + Math.abs(x.amount), 0);
    return json(env, { total: hit.length, items: hit.slice(offset, offset + limit),
      totals: { paid_in: money((x) => x.type === 'payment' && x.status === 'paid'), paid_out: money((x) => x.type === 'withdrawal' && x.status === 'paid'), waiting_out: money((x) => x.type === 'withdrawal' && ['requested', 'sending'].includes(x.status)) } });
  }

  if (path === '/api/admin/phones' && m === 'GET') {
    const q = str(url.searchParams.get('q'), 40).toLowerCase().replace(/^@/, ''), digits = q.replace(/\D/g, '');
    const r = await sb(env, 'profiles?select=aid,handle,phone,created_at&phone=not.is.null&order=created_at.desc&limit=1000');
    if (!r.ok) return json(env, { ready: false, items: [], message: SETUP });
    let list = (await rows(r)).map((x) => ({ aid: x.aid, handle: x.handle || null, phone: showPhone(x.phone), created_at: x.created_at }));
    const local = digits.startsWith('254') ? '0' + digits.slice(3) : digits;
    if (q) list = list.filter((x) => x.aid.toLowerCase().includes(q) || (x.handle || '').toLowerCase().includes(q) || (local.length >= 3 && (x.phone || '').replace(/\D/g, '').includes(local)));
    return json(env, { ready: true, total: list.length, items: list.slice(0, 200) });
  }

  // Which SQL files still have to be run? Probes every table the SQL files create.
  if (path === '/api/admin/health' && m === 'GET') {
    const all = tablesBySql(), res = [];
    for (let i = 0; i < all.length; i += 12) res.push(...(await Promise.all(all.slice(i, i + 12).map(async (t) => ({ ...t, ok: await tableExists(env, t.table) })))));
    const byFile = {};
    for (const t of res) { const f = (byFile[t.file] = byFile[t.file] || { file: t.file, tables: 0, missing: [] }); f.tables++; if (!t.ok) f.missing.push(t.table); }
    const phoneCol = await sb(env, 'profiles?select=phone&limit=1').then((r) => r.ok).catch(() => false);
    if (!phoneCol) { const f = (byFile['support.sql'] = byFile['support.sql'] || { file: 'support.sql', tables: 0, missing: [] }); if (!f.missing.includes('profiles.phone')) f.missing.push('profiles.phone'); }
    const files = Object.values(byFile).filter((f) => f.missing.length);
    return json(env, { ok: !files.length, checked: res.length, to_run: files, mail: { ready: mailReady(env), to: !!String(env.ADMIN_EMAIL || env.SUPPORT_EMAIL || '').trim() } });
  }
  return null;
}
