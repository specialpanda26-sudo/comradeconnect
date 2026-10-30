// Gigs ("Need a hand"): a comrade posts a small job (tutoring, printing, braiding, delivery, graphics...) and the money is held in escrow.
// 1. The poster's wallet is charged the price when the gig is posted. 2. Another comrade accepts. 3. The worker marks it delivered.
// 4. The poster confirms and the worker is paid (minus the normal platform fee), or after the auto-release days the worker is paid anyway.
// A problem goes to the admin (admin > Review > Gigs), who pays the worker or refunds the poster. Every status change is one conditional UPDATE.
import { json, err, sb, rows, one, post, patch, inList, enc, str, int, UUID, ahead, DAY, isAdmin, audit, user, throttle, tooMany, contactBlock } from './lib.js';
import { credit } from './pay.js';
import { notify, notifyAdmins } from './notifications.js';
import { getSettings, feeOf } from './settings.js';
import { campusRow, campusQuery } from './campus.js';

export const GIG_CATS = ['Tutoring', 'Printing', 'Braiding', 'Delivery', 'Graphics', 'Cleaning', 'Other'];
const MAX_POSTED = 5, MAX_WORKING = 3;

async function balance(env, aid) {
  const r = await sb(env, 'rpc/wallet_balance', { method: 'POST', body: JSON.stringify({ p: aid }) });
  const n = Number(await r.json().catch(() => 0)); return Number.isFinite(n) ? n : 0;
}
const pay = (g) => g.price - g.fee;
const days = async (env) => (await getSettings(env)).escrow_auto_release_days || 3;

// Pay the worker. Only one request can win the status change, so the worker is never paid twice.
export async function releaseGig(env, id, by, from = ['accepted', 'delivered']) {
  const [g] = await rows(await patch(env, `gigs?id=eq.${id}&status=${inList(from)}`, { status: 'released', released_at: new Date().toISOString(), decided_by: by }));
  if (!g) return null;
  if (!(await credit(env, g.worker_aid, pay(g), 'sale', 'gig:' + g.id, 'Gig: ' + String(g.title).slice(0, 40)))) console.error('gig release: credit may have failed', g.id);
  await notify(env, g.worker_aid, 'order', 'You got paid', 'KSh ' + pay(g) + ' for "' + String(g.title).slice(0, 50) + '" was added to your wallet.', 'gig', g.id);
  await notify(env, g.poster_aid, 'order', 'Gig completed', '"' + String(g.title).slice(0, 50) + '" is done and paid. Thanks!', 'gig', g.id);
  return g;
}
// Give the poster the whole price back.
export async function refundGig(env, id, by, from) {
  const [g] = await rows(await patch(env, `gigs?id=eq.${id}&status=${inList(from)}`, { status: by === 'poster' ? 'cancelled' : 'refunded', decided_by: by }));
  if (!g) return null;
  await credit(env, g.poster_aid, g.price, 'refund', 'gig:' + g.id, 'Gig refunded');
  await notify(env, g.poster_aid, 'order', 'Gig refunded', 'KSh ' + g.price + ' was returned to your wallet.', 'gig', g.id);
  if (g.worker_aid) await notify(env, g.worker_aid, 'order', 'Gig closed', '"' + String(g.title).slice(0, 50) + '" was refunded to the poster.', 'gig', g.id);
  return g;
}
export async function autoReleaseGigs(env) {
  const due = await rows(await sb(env, `gigs?select=id&status=eq.delivered&auto_release_at=lte.${new Date().toISOString()}&limit=50`));
  let n = 0; for (const g of due) if (await releaseGig(env, g.id, 'auto', ['delivered'])) n++;
  return n;
}

const names = async (env, aids) => {
  const ids = [...new Set(aids.filter(Boolean))]; if (!ids.length) return {};
  const o = {}; for (const p of await rows(await sb(env, `profiles?select=aid,handle&aid=${inList(ids)}`))) o[p.aid] = p.handle ? '@' + p.handle : 'A comrade';
  return o;
};
const pub = (g, me, nm) => ({
  id: g.id, title: g.title, details: g.details || '', category: g.category, price: g.price, pay: pay(g), status: g.status, campus: g.campus || '', at: Date.parse(g.created_at),
  by: nm[g.poster_aid] || 'A comrade', role: me ? (g.poster_aid === me ? 'poster' : g.worker_aid === me ? 'worker' : '') : '',
  worker: me && g.poster_aid === me ? (nm[g.worker_aid] || '') : '', auto_at: g.auto_release_at ? Date.parse(g.auto_release_at) : null, reason: me && g.poster_aid === me ? g.dispute_reason || '' : '',
});

export async function gigRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (path !== '/api/gigs' && !path.startsWith('/api/gigs/') && path !== '/api/admin/gigs' && !path.startsWith('/api/admin/gigs/')) return null;

  // ---------- admin: settle disputes ----------
  if (path.startsWith('/api/admin/gigs')) {
    if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);
    if (path === '/api/admin/gigs' && m === 'GET') {
      const r = await sb(env, 'gigs?select=*&status=eq.disputed&order=created_at.asc&limit=100');
      if (!r.ok) return json(env, { gigs: null });
      const list = await rows(r), nm = await names(env, list.flatMap((g) => [g.poster_aid, g.worker_aid]));
      return json(env, { gigs: list.map((g) => ({ id: g.id, title: g.title, details: g.details, price: g.price, pay: pay(g), poster: nm[g.poster_aid] || g.poster_aid, worker: nm[g.worker_aid] || g.worker_aid, reason: g.dispute_reason || '', at: Date.parse(g.created_at) })) });
    }
    const mm = path.match(/^\/api\/admin\/gigs\/([0-9a-f-]{36})$/);
    if (mm && m === 'POST') {
      const b = await req.json().catch(() => ({}));
      if (b.action === 'release') { const g = await releaseGig(env, mm[1], 'admin', ['disputed']); if (!g) return err(env, 'Not in dispute any more', 409); await audit(env, 'gig.release', 'gig', g.id, 'KSh ' + pay(g), ip); return json(env, { ok: true }); }
      if (b.action === 'refund') { const g = await refundGig(env, mm[1], 'admin', ['disputed']); if (!g) return err(env, 'Not in dispute any more', 409); await audit(env, 'gig.refund', 'gig', g.id, 'KSh ' + g.price, ip); return json(env, { ok: true }); }
      return err(env, 'Unknown action');
    }
    return err(env, 'Not found', 404);
  }

  // ---------- browse (anyone) ----------
  const S = await getSettings(env);
  if (path === '/api/gigs' && m === 'GET') {
    const mine = url.searchParams.get('mine') === '1';
    if (mine) {
      const u = await user(req, env); if (u instanceof Response) return u;
      const list = await rows(await sb(env, `gigs?select=*&or=${enc(`(poster_aid.eq.${u.aid},worker_aid.eq.${u.aid})`)}&order=created_at.desc&limit=50`));
      const nm = await names(env, list.flatMap((g) => [g.poster_aid, g.worker_aid]));
      return json(env, { gigs: list.map((g) => pub(g, u.aid, nm)), categories: GIG_CATS, fee_percent: S.platform_fee_percent });
    }
    const r = await sb(env, `gigs?select=*&status=eq.open${campusQuery(req)}&order=created_at.desc&limit=50`);
    if (!r.ok) return json(env, { gigs: null });
    const me = req.headers.get('X-Token') ? await user(req, env) : null, aid = me && !(me instanceof Response) ? me.aid : '';
    const list = (await rows(r)).filter((g) => g.poster_aid !== aid), nm = await names(env, list.map((g) => g.poster_aid));
    return json(env, { gigs: list.map((g) => pub(g, '', nm)), categories: GIG_CATS, fee_percent: S.platform_fee_percent });
  }

  // ---------- everything below needs a signed-in comrade ----------
  const u = await user(req, env, true); if (u instanceof Response) return u;
  if (!(await throttle(env, ip, 'gig', u.aid, 40, 120))) return tooMany(env);
  const body = async () => (await req.json().catch(() => ({})));

  if (path === '/api/gigs' && m === 'POST') {
    const b = await body(), title = str(b.title, 60), details = str(b.details, 400), category = GIG_CATS.includes(b.category) ? b.category : 'Other', price = int(b.price, 50, 5000);
    if (title.length < 4) return err(env, 'Write what you need, at least 4 letters');
    if (price === null) return err(env, 'The price must be a whole number from KSh 50 to 5,000');
    const bad = contactBlock(env, title, details); if (bad) return bad;
    const open = await rows(await sb(env, `gigs?select=id&poster_aid=eq.${enc(u.aid)}&status=in.(open,accepted,delivered,disputed)&limit=${MAX_POSTED + 1}`));
    if (open.length >= MAX_POSTED) return err(env, 'You already have ' + MAX_POSTED + ' gigs running. Finish one first.');
    if ((await balance(env, u.aid)) < price) return err(env, 'Your wallet has less than KSh ' + price + '. Top up your wallet first, the money stays safe until the job is done.', 402);
    const id = crypto.randomUUID(), ref = 'gig:' + id;
    if (!(await credit(env, u.aid, -price, 'purchase', ref, 'Gig held in escrow'))) return err(env, 'Could not hold the money. Nothing was charged.', 500);
    const undo = () => patch(env, `wallet_ledger?kind=eq.purchase&ref=eq.${enc(ref)}`, { status: 'void' });
    if ((await balance(env, u.aid)) < 0) { await undo(); return err(env, 'Not enough wallet balance', 402); }
    const g = await one(await post(env, 'gigs', { id, poster_aid: u.aid, title, details: details || null, category, price, fee: feeOf(price, S.platform_fee_percent), ...campusRow(req) }));
    if (!g) { await undo(); return err(env, 'Could not post the gig. Run gigs.sql in Supabase (admin > Site > SQL). Nothing was charged.', 500); }
    return json(env, { gig: pub(g, u.aid, {}) }, 201);
  }

  const mm = path.match(/^\/api\/gigs\/([0-9a-f-]{36})\/(accept|drop|deliver|confirm|dispute|cancel)$/);
  if (!mm || m !== 'POST' || !UUID.test(mm[1])) return err(env, 'Not found', 404);
  const id = mm[1], act = mm[2], me = enc(u.aid), title = (g) => String(g.title).slice(0, 50);

  if (act === 'accept') {
    const working = await rows(await sb(env, `gigs?select=id&worker_aid=eq.${me}&status=in.(accepted,delivered)&limit=${MAX_WORKING + 1}`));
    if (working.length >= MAX_WORKING) return err(env, 'You already have ' + MAX_WORKING + ' gigs to finish. Deliver one first.');
    const [g] = await rows(await patch(env, `gigs?id=eq.${id}&status=eq.open&poster_aid=neq.${me}`, { status: 'accepted', worker_aid: u.aid, accepted_at: new Date().toISOString() }));
    if (!g) return err(env, 'Someone else already took this gig', 409);
    await notify(env, g.poster_aid, 'order', 'Your gig was accepted', 'A comrade will do "' + title(g) + '". Message them in the app and agree where to meet.', 'gig', g.id);
    return json(env, { ok: true });
  }
  if (act === 'drop') {
    const [g] = await rows(await patch(env, `gigs?id=eq.${id}&status=eq.accepted&worker_aid=eq.${me}`, { status: 'open', worker_aid: null, accepted_at: null }));
    if (!g) return err(env, 'You cannot drop this gig now', 409);
    await notify(env, g.poster_aid, 'order', 'Your gig is open again', 'The comrade dropped "' + title(g) + '". It is back on the board.', 'gig', g.id);
    return json(env, { ok: true });
  }
  if (act === 'deliver') {
    const [g] = await rows(await patch(env, `gigs?id=eq.${id}&status=eq.accepted&worker_aid=eq.${me}`, { status: 'delivered', delivered_at: new Date().toISOString(), auto_release_at: ahead((await days(env)) * DAY) }));
    if (!g) return err(env, 'You cannot mark this gig done now', 409);
    await notify(env, g.poster_aid, 'order', 'Gig marked done', 'Check "' + title(g) + '" and confirm to pay. If you do nothing it pays out in ' + (await days(env)) + ' days.', 'gig', g.id);
    return json(env, { ok: true });
  }
  const mine = await one(await sb(env, `gigs?select=id&id=eq.${id}&poster_aid=eq.${me}`));
  if (!mine) return err(env, 'Only the person who posted this gig can do that', 403);
  if (act === 'confirm') { if (!(await releaseGig(env, id, 'poster', ['accepted', 'delivered']))) return err(env, 'This gig cannot be confirmed now', 409); return json(env, { ok: true }); }
  if (act === 'cancel') { if (!(await refundGig(env, id, 'poster', ['open']))) return err(env, 'You can only cancel a gig nobody has accepted', 409); return json(env, { ok: true }); }
  if (act === 'dispute') {
    const reason = str((await body()).reason, 200); if (reason.length < 5) return err(env, 'Tell us what went wrong');
    const [g] = await rows(await patch(env, `gigs?id=eq.${id}&status=in.(accepted,delivered)`, { status: 'disputed', dispute_reason: reason }));
    if (!g) return err(env, 'You cannot report this gig now', 409);
    await notifyAdmins(env, 'order', 'Gig dispute', '"' + title(g) + '" KSh ' + g.price + ': ' + reason.slice(0, 100), 'gig', g.id);
    await notify(env, g.worker_aid, 'order', 'Gig reported', 'The poster reported a problem with "' + title(g) + '". An admin will decide.', 'gig', g.id);
    return json(env, { ok: true });
  }
  return err(env, 'Not found', 404);
}
