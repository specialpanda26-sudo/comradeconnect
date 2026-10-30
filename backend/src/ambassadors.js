// Campus ambassadors: one trusted comrade per hostel or club. They use their normal invite code.
// The leaderboard counts friends who joined with that code (and how many bought) in a Kenya-time month.
// The admin adds ambassadors and pays the top ones to their wallet once a month (admin > Joins > Ambassadors).
import { json, err, sb, rows, one, post, patch, inList, enc, str, int, isAdmin, audit, user, throttle, tooMany } from './lib.js';
import { credit } from './pay.js';
import { notify } from './notifications.js';

const KE = 3 * 3600e3;
const ymNow = () => new Date(Date.now() + KE).toISOString().slice(0, 7);
const validYm = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || ''));
const bounds = (ym) => { const [y, m] = ym.split('-').map(Number); return [new Date(Date.UTC(y, m - 1, 1) - KE).toISOString(), new Date(Date.UTC(y, m, 1) - KE).toISOString()]; };

// Everyone in the list, ranked: friends who bought first, then friends who joined.
async function standings(env, ym, all) {
  const r = await sb(env, 'ambassadors?select=aid,label,campus,active&order=created_at.asc&limit=500' + (all ? '' : '&active=eq.true'));
  if (!r.ok) return null;                                   // table not created yet
  const amb = await rows(r);
  if (!amb.length) return [];
  const [a, b] = bounds(ym);
  const refs = await rows(await sb(env, `referrals?select=referrer_aid,status,order_id&referrer_aid=${inList(amb.map((x) => x.aid))}&created_at=gte.${enc(a)}&created_at=lt.${enc(b)}&limit=10000`));
  const by = {};
  for (const x of refs) { if (x.status === 'void') continue; const s = (by[x.referrer_aid] ||= { joined: 0, bought: 0 }); s.joined++; if (x.order_id || x.status === 'unlocked') s.bought++; }
  return amb.map((x) => ({ aid: x.aid, label: x.label, campus: x.campus || '', active: x.active, joined: (by[x.aid] || {}).joined || 0, bought: (by[x.aid] || {}).bought || 0 }))
    .sort((p, q) => (q.active - p.active) || (q.bought - p.bought) || (q.joined - p.joined) || p.label.localeCompare(q.label))
    .map((x, i) => ({ ...x, rank: i + 1 }));
}

export async function ambassadorRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  const isPub = path === '/api/ambassador/board' || path === '/api/ambassador/me';
  const isAdm = path === '/api/admin/ambassadors' || path.startsWith('/api/admin/ambassadors/');
  if (!isPub && !isAdm) return null;

  // ---------- public ----------
  if (path === '/api/ambassador/board' && m === 'GET') {
    const month = ymNow(), list = await standings(env, month, false);
    return json(env, { month, board: (list || []).slice(0, 10).map(({ rank, label, campus, joined, bought }) => ({ rank, label, campus, joined, bought })) });
  }
  if (path === '/api/ambassador/me' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    if (!(await throttle(env, ip, 'ambme', u.aid, 60, 200))) return tooMany(env);
    const mine = await one(await sb(env, `ambassadors?select=aid,label,active&aid=eq.${enc(u.aid)}`));
    if (!mine || !mine.active) return json(env, { is_ambassador: false });
    const month = ymNow(), list = (await standings(env, month, false)) || [], me = list.find((x) => x.aid === u.aid) || { joined: 0, bought: 0, rank: 0 };
    const paid = await rows(await sb(env, `ambassador_payouts?select=amount&aid=eq.${enc(u.aid)}&limit=100`));
    return json(env, { is_ambassador: true, label: mine.label, code: u.referral_code, month, joined: me.joined, bought: me.bought, rank: me.rank, of: list.length, earned: paid.reduce((n, x) => n + (x.amount || 0), 0) });
  }

  // ---------- admin ----------
  if (!isAdm) return null;
  if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);
  const A = (a, id, d) => audit(env, a, 'ambassador', id, d, ip);
  const body = async () => (await req.json().catch(() => ({})));

  if (path === '/api/admin/ambassadors' && m === 'GET') {
    const month = validYm(url.searchParams.get('month')) ? url.searchParams.get('month') : ymNow();
    const list = await standings(env, month, true);
    if (list === null) return json(env, { month, ambassadors: null });
    const profs = list.length ? await rows(await sb(env, `profiles?select=aid,handle,referral_code&aid=${inList(list.map((x) => x.aid))}`)) : [];
    const paid = await rows(await sb(env, `ambassador_payouts?select=aid,amount,rank&month=eq.${month}&limit=100`));
    return json(env, { month, current: ymNow(), ambassadors: list.map((x) => { const p = profs.find((q) => q.aid === x.aid) || {}, d = paid.find((q) => q.aid === x.aid); return { ...x, handle: p.handle || '', code: p.referral_code || '', paid: d ? d.amount : 0 }; }) });
  }

  if (path === '/api/admin/ambassadors' && m === 'POST') {
    const b = await body(), who = str(b.who, 40), label = str(b.label, 60), campus = str(b.campus, 40);
    if (!/^[A-Za-z0-9_-]{2,40}$/.test(who)) return err(env, 'Type the comrade\'s username or invite code');
    if (label.length < 2) return err(env, 'Write the hostel or club name');
    const p = await one(await sb(env, `profiles?select=aid,handle&or=${enc(`(referral_code.eq.${who.toUpperCase()},handle.eq.${who})`)}&limit=1`));
    if (!p) return err(env, 'No comrade found with that username or code', 404);
    const r = await post(env, 'ambassadors', { aid: p.aid, label, campus: campus || null, active: true }, 'resolution=merge-duplicates,return=representation');
    if (!r.ok) return err(env, 'Could not save. Run ambassadors.sql in Supabase (admin > Site > SQL), then try again.', 500);
    await A('ambassador.add', p.aid, label);
    await notify(env, p.aid, 'reward', 'You are a Campus Ambassador', 'You now represent ' + label + '. Share your invite link to climb the monthly leaderboard.', 'referral', null);
    return json(env, { ok: true }, 201);
  }

  if (path === '/api/admin/ambassadors/pay' && m === 'POST') {
    const b = await body(), month = String(b.month || '');
    if (!validYm(month)) return err(env, 'Pick a month');
    if (month >= ymNow()) return err(env, 'That month is not over yet. Pay it after it ends.');
    const amounts = (Array.isArray(b.amounts) ? b.amounts : []).slice(0, 5).map((x) => int(x, 0, 20000));
    if (!amounts.length || amounts.some((x) => x === null)) return err(env, 'Enter the prize for each place in whole shillings');
    const list = await standings(env, month, false);
    if (!list) return err(env, 'Run ambassadors.sql first', 500);
    const paid = [];
    for (let i = 0; i < amounts.length; i++) {
      const w = list[i]; if (!w || !amounts[i] || w.bought < 1) continue;           // nobody gets paid for zero real purchases
      const ok = await credit(env, w.aid, amounts[i], 'adjustment', `amb:${month}:${w.aid}`, `Campus ambassador prize ${month}, place ${i + 1}`);
      if (!ok) continue;                                                           // already paid this month
      await post(env, 'ambassador_payouts', { month, aid: w.aid, rank: i + 1, amount: amounts[i] }, 'resolution=ignore-duplicates');
      await notify(env, w.aid, 'reward', 'Ambassador prize: KSh ' + amounts[i], 'You came ' + (i + 1) + ' for ' + month + '. It is in your wallet.', 'wallet', null);
      paid.push({ label: w.label, amount: amounts[i] });
    }
    await A('ambassador.pay', month, JSON.stringify(paid).slice(0, 300));
    return json(env, { ok: true, paid });
  }

  const mm = path.match(/^\/api\/admin\/ambassadors\/([A-Za-z0-9_-]{6,64})$/);
  if (mm && m === 'POST') {
    const b = await body(), q = `ambassadors?aid=eq.${enc(mm[1])}`;
    if (b.action === 'remove') { await sb(env, q, { method: 'DELETE' }); await A('ambassador.remove', mm[1], null); return json(env, { ok: true }); }
    const f = {};
    if (b.active !== undefined) f.active = !!b.active;
    if (b.label !== undefined) { const l = str(b.label, 60); if (l.length < 2) return err(env, 'Write the hostel or club name'); f.label = l; }
    if (!Object.keys(f).length) return err(env, 'Nothing to change');
    if (!(await one(await patch(env, q, f)))) return err(env, 'Ambassador not found', 404);
    await A('ambassador.update', mm[1], JSON.stringify(f).slice(0, 200));
    return json(env, { ok: true });
  }
  return err(env, 'Not found', 404);
}
