// Admin: dashboard numbers, user list, user detail, create account with a password, set password, sign out everywhere, delete account.
// Sits in front of adminRoutes. Ban, unban, mute, unmute and role stay in admin.js: this file passes those through untouched.
import { json, err, sb, rows, one, post, patch, enc, str, int, randHex, H, isAdmin, audit, contactBlock, hashPassword, goodPassword, DAY } from './lib.js';
import { balance } from './account.js';

const SAFE = 'aid,handle,points,verified,student_verified,role,banned,muted_until,google_sub,badge,created_at,recovery_hash';
const kind = (p) => (p.google_sub ? 'google' : String(p.recovery_hash || '').startsWith('pw1:') ? 'password' : 'guest');   // how this person signs in
const pub = (p) => ({ aid: p.aid, handle: p.handle || null, points: p.points || 0, verified: !!p.verified, student_verified: !!p.student_verified, role: p.role || 'user', banned: !!p.banned,
  muted_until: p.muted_until || null, badge: p.badge || null, created_at: p.created_at, type: kind(p) });
const day = (t) => new Date(Date.parse(t) + 3 * 3600e3).toISOString().slice(0, 10);          // Kenya days (UTC+3)
const tally = (list, f) => list.reduce((o, x) => { const k = f(x); o[k] = (o[k] || 0) + 1; return o; }, {});

export async function adminUserRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (path !== '/api/admin/stats' && !path.startsWith('/api/admin/users')) return null;
  if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);
  const A = (action, type, id, detail) => audit(env, action, type, id, detail, ip);
  const allProfiles = async () => (await rows(await sb(env, `profiles?select=${SAFE}&order=created_at.desc&limit=20000`))).map((p) => Object.assign(pub(p), {}));

  // ---- numbers for the dashboard ----
  if (path === '/api/admin/stats' && m === 'GET') {
    const [users, ls, os] = await Promise.all([allProfiles(),
      sb(env, 'listings?select=status&limit=20000').then(rows), sb(env, 'orders?select=status,amount,created_at&limit=20000').then(rows)]);
    const now = Date.now(), t = (u) => Date.parse(u.created_at) || 0, muted = (u) => u.muted_until && Date.parse(u.muted_until) > now;
    const series = []; for (let i = 29; i >= 0; i--) series.push({ day: day(new Date(now - i * DAY).toISOString()), n: 0 });
    users.forEach((u) => { const s = series.find((x) => x.day === day(u.created_at)); if (s) s.n++; });
    const released = os.filter((o) => o.status === 'released');
    return json(env, {
      users: { total: users.length, last24h: users.filter((u) => now - t(u) < DAY).length, last7d: users.filter((u) => now - t(u) < 7 * DAY).length, last30d: users.filter((u) => now - t(u) < 30 * DAY).length,
        banned: users.filter((u) => u.banned).length, muted: users.filter(muted).length, verified: users.filter((u) => u.verified || u.student_verified).length, with_handle: users.filter((u) => u.handle).length,
        roles: tally(users, (u) => u.role), types: tally(users, (u) => u.type) },
      signups: series,
      listings: tally(ls, (l) => l.status),
      orders: Object.assign(tally(os, (o) => o.status), { total: os.length, gmv: released.reduce((s, o) => s + (Number(o.amount) || 0), 0) }),
      recent: users.slice(0, 6),
    });
  }

  // ---- list and search ----
  if (path === '/api/admin/users' && m === 'GET') {
    const q = str(url.searchParams.get('q'), 40).toLowerCase().replace(/^@/, ''), f = url.searchParams.get('filter') || 'all';
    const limit = Math.min(100, int(url.searchParams.get('limit'), 1, 100) || 30), offset = int(url.searchParams.get('offset'), 0, 100000) || 0, now = Date.now();
    let list = await allProfiles();
    if (q) list = list.filter((u) => u.aid.toLowerCase().includes(q) || (u.handle || '').toLowerCase().includes(q));
    const FILTERS = { banned: (u) => u.banned, muted: (u) => u.muted_until && Date.parse(u.muted_until) > now, verified: (u) => u.verified || u.student_verified, admin: (u) => u.role === 'admin' || u.role === 'club_admin',
      seller: (u) => u.role === 'seller', google: (u) => u.type === 'google', password: (u) => u.type === 'password', guest: (u) => u.type === 'guest' };
    if (FILTERS[f]) list = list.filter(FILTERS[f]);
    return json(env, { total: list.length, users: list.slice(offset, offset + limit) });
  }

  // ---- create an anonymous account with a password you choose ----
  if (path === '/api/admin/users/create' && m === 'POST') {
    const b = await req.json().catch(() => ({})), handle = str(b.handle, 20), pw = String(b.password || ''), role = ['user', 'seller', 'club_admin', 'admin'].includes(b.role) ? b.role : 'user';
    if (!/^[A-Za-z0-9_]{3,20}$/.test(handle)) return err(env, 'Username: 3 to 20 letters, numbers or _');
    const blk = contactBlock(env, handle); if (blk) return blk;
    if (!goodPassword(pw, handle)) return err(env, 'Password: 8 to 100 characters, and not the same as the username');
    const aid = 'u_' + randHex(8);
    const res = await post(env, 'profiles', { aid, handle, role, token_hash: await H(env, 'tok:' + randHex(24)), recovery_hash: await hashPassword(pw), referral_code: randHex(4).toUpperCase() });
    if (res.status === 409) return err(env, 'That username is already taken', 409);
    if (!res.ok) return err(env, 'Could not create the account', 500);
    await A('user.create', 'user', aid, { handle, role });
    return json(env, { ok: true, aid, handle, role }, 201);
  }

  const mm = path.match(/^\/api\/admin\/users\/([A-Za-z0-9_-]{6,64})$/);
  if (!mm) return null;
  const aid = mm[1], q = `profiles?aid=eq.${enc(aid)}`;

  // ---- everything about one person ----
  if (m === 'GET') {
    const p = await one(await sb(env, `${q}&select=${SAFE}`)); if (!p) return err(env, 'No such account', 404);
    const [bal, ledger, mine, bought, sold] = await Promise.all([balance(env, aid),
      sb(env, `wallet_ledger?select=delta,kind,status,note,created_at&aid=eq.${enc(aid)}&order=created_at.desc&limit=8`).then(rows),
      sb(env, `listings?select=id,status&seller_aid=eq.${enc(aid)}&limit=500`).then(rows),
      sb(env, `orders?select=id,status&buyer_aid=eq.${enc(aid)}&limit=500`).then(rows), sb(env, `orders?select=id,status&seller_aid=eq.${enc(aid)}&limit=500`).then(rows)]);
    return json(env, { user: pub(p), balance: bal, ledger, listings: { total: mine.length, live: mine.filter((l) => l.status === 'approved').length }, bought: bought.length, sold: sold.length,
      open_orders: [...bought, ...sold].filter((o) => ['held', 'handed', 'disputed'].includes(o.status)).length });
  }
  if (m !== 'POST') return null;
  const b = await req.clone().json().catch(() => ({})), act = b.action;
  if (!['password', 'signout', 'delete'].includes(act)) return null;                        // ban, unban, mute, unmute and role are handled in admin.js
  const p = await one(await sb(env, `${q}&select=aid,handle`)); if (!p) return err(env, 'No such account', 404);
  const lock = async () => H(env, 'tok:' + randHex(24));                                     // a token nobody knows: every phone using the account is signed out

  if (act === 'password') {
    const pw = String(b.password || ''); if (!goodPassword(pw, p.handle)) return err(env, 'Password: 8 to 100 characters, and not the same as the username');
    await patch(env, q, { recovery_hash: await hashPassword(pw), token_hash: await lock() });
    await A('user.password', 'user', aid, null);                                             // the password itself is never logged
    return json(env, { ok: true });
  }
  if (act === 'signout') { await patch(env, q, { token_hash: await lock() }); await A('user.signout', 'user', aid, null); return json(env, { ok: true }); }

  // delete: the person can never sign in again, the username is freed and their listings come down. Orders and money history stay for your records.
  const bal = await balance(env, aid);
  if (bal !== 0) return err(env, `This wallet holds KSh ${bal}. Pay it out or refund it first.`, 409);
  const open = [...(await rows(await sb(env, `orders?select=id,status&buyer_aid=eq.${enc(aid)}&status=in.(held,handed,disputed)&limit=1`))), ...(await rows(await sb(env, `orders?select=id,status&seller_aid=eq.${enc(aid)}&status=in.(held,handed,disputed)&limit=1`)))];
  if (open.length) return err(env, 'This person has an order in progress. Finish or refund it first.', 409);
  await patch(env, q, { banned: true, handle: null, google_sub: null, recovery_hash: null, token_hash: await lock(), badge: null, role: 'user' });
  await patch(env, `listings?seller_aid=eq.${enc(aid)}&status=in.(pending,approved)`, { status: 'removed' });
  await A('user.delete', 'user', aid, { handle: p.handle || null, reason: str(b.reason, 200) || null });
  return json(env, { ok: true });
}
