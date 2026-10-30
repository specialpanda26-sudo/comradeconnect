// Local deals. A food spot, salon or cyber cafe posts a student offer (an admin approves it first). A comrade taps
// "Get my code", shows the 6-digit code at the counter, and the business enters it to confirm. The business owes a small
// fee per confirmed redemption (the admin sets it in Admin > Money settings; the admin sees a monthly billing summary).
//   GET  /api/deals                     public: live deals for the campus (X-Campus), with my claim if I am signed in
//   POST /api/deals                     signed in: post a deal (waits for approval)
//   GET  /api/deals/mine                signed in: my codes and my own deals
//   POST /api/deals/:id/claim           signed in: get my 6-digit code (valid 24 hours, one per deal)
//   POST /api/deals/:id/redeem          the deal's owner: { code } confirms a customer
//   POST /api/deals/:id/end | remove    the deal's owner
//   GET  /api/admin/deals               admin: ?status=pending|approved|rejected|ended|all
//   POST /api/admin/deals/:id           admin: { action: approve | reject | hide | show, note }
//   GET  /api/admin/deals/billing       admin: ?month=YYYY-MM  what each business owes for confirmed redemptions
import { json, err, sb, rows, one, post, patch, str, int, UUID, throttle, tooMany, user, authProfile, contactBlock, inList, normPhone, isAdmin, audit, deriveCode, codeHash, bump, ahead, DAY } from './lib.js';
import { campusOf, isAllCampuses, campusOrHome, CAMPUS_IDS, DEFAULT_CAMPUS } from './campus.js';
import { getSettings } from './settings.js';
import { notify, notifyAdmins } from './notifications.js';

export const DEAL_CATS = ['Food', 'Salon or barber', 'Cyber and printing', 'Shop', 'Fitness', 'Other'];
const MAX_DAYS = 90, CODE_HOURS = 24;
const SETUP = 'Local deals are not switched on yet. The admin must run deals.sql in Supabase (Admin > Site > SQL).';
const today = () => new Date().toISOString().slice(0, 10);
const live = (c, now) => c.status === 'redeemed' || (c.status === 'claimed' && c.expires_at > now);   // claims that use up a place in the offer

const pub = (d, me, claims, now) => {
  const mine = claims.find((c) => me && c.aid === me.aid);
  const used = claims.filter((c) => live(c, now)).length;
  return {
    id: d.id, campus: d.campus, business: d.business, title: d.title, details: d.details || '', category: d.category, place: d.place || '',
    validUntil: d.valid_until, left: d.max_claims == null ? null : Math.max(0, d.max_claims - used), createdAt: Date.parse(d.created_at),
    mine: !!me && me.aid === d.aid,
    claim: mine ? { id: mine.id, status: mine.status === 'claimed' && mine.expires_at <= now ? 'expired' : mine.status, expiresAt: Date.parse(mine.expires_at) } : null,
  };
};

export async function dealRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/deals') && !path.startsWith('/api/admin/deals')) return null;
  const body = async () => (await req.json().catch(() => ({})));
  const ready = async (r) => { if (r.ok) return null; return err(env, SETUP, 503); };

  // ---------------- admin ----------------
  if (path.startsWith('/api/admin/deals')) {
    if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);
    if (path === '/api/admin/deals/billing' && m === 'GET') {
      const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') || '') ? url.searchParams.get('month') : today().slice(0, 7);
      const from = month + '-01T00:00:00.000Z', t = new Date(from); t.setUTCMonth(t.getUTCMonth() + 1);
      const rc = await sb(env, `deal_claims?select=deal_id,fee,redeemed_at&status=eq.redeemed&redeemed_at=gte.${from}&redeemed_at=lt.${t.toISOString()}&limit=5000`);
      if (!rc.ok) return json(env, { ready: false, month, businesses: [], total: 0 });
      const cl = await rows(rc), ids = [...new Set(cl.map((c) => c.deal_id))];
      const ds = ids.length ? await rows(await sb(env, `deals?select=id,aid,business,title,billing_phone&id=${inList(ids)}`)) : [];
      const by = {};
      for (const c of cl) {
        const d = ds.find((x) => x.id === c.deal_id); if (!d) continue;
        const o = (by[d.aid + '|' + d.business] ||= { aid: d.aid, business: d.business, phone: d.billing_phone, deals: new Set(), redemptions: 0, owed: 0 });
        o.deals.add(d.id); o.redemptions++; o.owed += c.fee || 0;
      }
      const businesses = Object.values(by).map((o) => ({ ...o, deals: o.deals.size })).sort((a, b) => b.owed - a.owed);
      return json(env, { ready: true, month, businesses, total: businesses.reduce((s, o) => s + o.owed, 0), redemptions: businesses.reduce((s, o) => s + o.redemptions, 0) });
    }
    if (path === '/api/admin/deals' && m === 'GET') {
      const st = String(url.searchParams.get('status') || 'pending');
      const r = await sb(env, `deals?select=*${['pending', 'approved', 'rejected', 'ended'].includes(st) ? '&status=eq.' + st : ''}&order=created_at.desc&limit=200`);
      if (!r.ok) return json(env, { ready: false, deals: [] });
      const ds = await rows(r), ids = ds.map((d) => d.id);
      const cl = ids.length ? await rows(await sb(env, `deal_claims?select=deal_id,status,expires_at&deal_id=${inList(ids)}&limit=5000`)) : [];
      const now = new Date().toISOString();
      return json(env, { ready: true, deals: ds.map((d) => {
        const c = cl.filter((x) => x.deal_id === d.id);
        return { id: d.id, aid: d.aid, campus: d.campus, business: d.business, title: d.title, details: d.details || '', category: d.category, place: d.place || '', phone: d.billing_phone, validUntil: d.valid_until,
          status: d.status, hidden: !!d.hidden, note: d.reject_note || '', claims: c.filter((x) => live(x, now)).length, redeemed: c.filter((x) => x.status === 'redeemed').length, createdAt: Date.parse(d.created_at) };
      }) });
    }
    const am = path.match(/^\/api\/admin\/deals\/([0-9a-f-]{36})$/);
    if (am && m === 'POST') {
      const b = await body(), d = await one(await sb(env, `deals?id=eq.${am[1]}`));
      if (!d) return err(env, 'Deal not found', 404);
      const action = String(b.action || ''), note = str(b.note, 200);
      if (action === 'approve') {
        if (d.valid_until < today()) return err(env, 'This deal has already expired');
        await patch(env, `deals?id=eq.${d.id}`, { status: 'approved', approved_at: new Date().toISOString(), reject_note: null, hidden: false });
        await notify(env, d.aid, 'deal', 'Your deal is live', `"${d.title}" is now shown to comrades.`, 'deal', d.id);
      } else if (action === 'reject') {
        await patch(env, `deals?id=eq.${d.id}`, { status: 'rejected', reject_note: note || null });
        await notify(env, d.aid, 'deal', 'Your deal was not approved', note || 'It did not meet our rules. You can post it again with changes.', 'deal', d.id);
      } else if (action === 'hide' || action === 'show') await patch(env, `deals?id=eq.${d.id}`, { hidden: action === 'hide' });
      else return err(env, 'Unknown action');
      await audit(env, 'deal.' + action, 'deal', d.id, note || d.business, ip);
      return json(env, { ok: true });
    }
    return err(env, 'Not found', 404);
  }

  // ---------------- public list ----------------
  if (path === '/api/deals' && m === 'GET') {
    const me = req.headers.get('X-Token') ? await authProfile(req, env) : null;
    const all = isAllCampuses(req);
    const camp = all ? 'all' : (campusOf(req) || (CAMPUS_IDS.includes(url.searchParams.get('campus')) ? url.searchParams.get('campus') : DEFAULT_CAMPUS));
    const cat = String(url.searchParams.get('category') || '');
    let q = `deals?status=eq.approved&hidden=eq.false&valid_until=gte.${today()}${all ? '' : '&campus=eq.' + camp}&order=created_at.desc&limit=100`;
    if (DEAL_CATS.includes(cat)) q += '&category=eq.' + encodeURIComponent(cat);
    const r = await sb(env, q);
    if (!r.ok) return json(env, { campus: camp, items: [], ready: false });
    const ds = await rows(r), ids = ds.map((d) => d.id), now = new Date().toISOString();
    const cl = ids.length ? await rows(await sb(env, `deal_claims?select=id,deal_id,aid,status,expires_at&deal_id=${inList(ids)}&limit=5000`)) : [];
    const S = await getSettings(env);
    return json(env, { campus: camp, ready: true, categories: DEAL_CATS, fee: S.deal_fee_per_redeem, items: ds.map((d) => pub(d, me, cl.filter((c) => c.deal_id === d.id), now)) });
  }

  // ---------------- post a deal ----------------
  if (path === '/api/deals' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body();
    const business = str(b.business, 60), title = str(b.title, 90), details = str(b.details, 300), place = str(b.place, 60);
    const category = DEAL_CATS.includes(b.category) ? b.category : 'Other';
    if (business.length < 2) return err(env, 'Enter the business name');
    if (title.length < 5) return err(env, 'Describe the offer, like "20% off every meal with your student ID"');
    const blk = contactBlock(env, business, title, details, place); if (blk) return blk;
    const phone = normPhone(b.billing_phone); if (!phone) return err(env, 'Enter a valid WhatsApp number for billing, like 0712345678');
    const until = String(b.valid_until || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || until < today()) return err(env, 'Pick the last day the offer is valid');
    if (until > new Date(Date.now() + MAX_DAYS * DAY).toISOString().slice(0, 10)) return err(env, `An offer can run for at most ${MAX_DAYS} days. You can post it again later.`);
    let max = null;
    if (b.max_claims !== undefined && b.max_claims !== null && b.max_claims !== '') { max = int(b.max_claims, 1, 5000); if (max === null) return err(env, 'Number of places must be from 1 to 5000'); }
    if (!(await throttle(env, ip, 'deals', u.aid, 3, 12))) return tooMany(env);
    const r = await post(env, 'deals', { aid: u.aid, campus: campusOrHome(req), business, title, details: details || null, category, place: place || null, billing_phone: phone, valid_until: until, max_claims: max, ip }, 'return=representation');
    if (!r.ok) return err(env, SETUP, 503);
    const d = await one(r);
    await notifyAdmins(env, 'deal', 'New deal to approve', `${business}: ${title}`, 'deal', d.id);
    return json(env, { id: d.id, status: 'pending' }, 201);
  }

  // ---------------- mine ----------------
  if (path === '/api/deals/mine' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const now = new Date().toISOString();
    const rc = await sb(env, `deal_claims?aid=eq.${encodeURIComponent(u.aid)}&order=created_at.desc&limit=50`);
    if (!rc.ok) return json(env, { ready: false, claims: [], deals: [] });
    const cl = await rows(rc), ids = [...new Set(cl.map((c) => c.deal_id))];
    const ds = ids.length ? await rows(await sb(env, `deals?select=id,business,title,place,valid_until&id=${inList(ids)}`)) : [];
    const claims = [];
    for (const c of cl) {
      const d = ds.find((x) => x.id === c.deal_id); if (!d) continue;
      const status = c.status === 'claimed' && c.expires_at <= now ? 'expired' : c.status;
      claims.push({ id: c.id, dealId: d.id, business: d.business, title: d.title, place: d.place || '', status, expiresAt: Date.parse(c.expires_at),
        code: status === 'claimed' ? await deriveCode(env, 'deal', c.id, 6) : null });
    }
    const mine = await rows(await sb(env, `deals?aid=eq.${encodeURIComponent(u.aid)}&hidden=eq.false&order=created_at.desc&limit=50`));
    const mc = mine.length ? await rows(await sb(env, `deal_claims?select=deal_id,status,expires_at&deal_id=${inList(mine.map((d) => d.id))}&limit=5000`)) : [];
    const S = await getSettings(env);
    return json(env, { ready: true, fee: S.deal_fee_per_redeem, claims, deals: mine.map((d) => {
      const c = mc.filter((x) => x.deal_id === d.id);
      return { id: d.id, business: d.business, title: d.title, status: d.status === 'approved' && d.valid_until < today() ? 'ended' : d.status, note: d.reject_note || '', validUntil: d.valid_until,
        claimed: c.filter((x) => live(x, now)).length, redeemed: c.filter((x) => x.status === 'redeemed').length, maxClaims: d.max_claims };
    }) });
  }

  const mm = path.match(/^\/api\/deals\/([0-9a-f-]{36})\/(claim|redeem|end|remove)$/);
  if (mm && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const d = await one(await sb(env, `deals?id=eq.${mm[1]}&hidden=eq.false`));
    if (!d) return err(env, 'Deal not found', 404);
    const now = new Date().toISOString();

    if (mm[2] === 'claim') {
      if (d.aid === u.aid) return err(env, 'You cannot claim your own deal');
      if (d.status !== 'approved' || d.valid_until < today()) return err(env, 'This deal is no longer available');
      if (!(await throttle(env, ip, 'dealclaim', u.aid, 20, 60))) return tooMany(env);
      const cl = await rows(await sb(env, `deal_claims?select=id,aid,status,expires_at&deal_id=eq.${d.id}&limit=5000`));
      const mine = cl.find((c) => c.aid === u.aid);
      if (mine) {
        if (mine.status === 'redeemed') return err(env, 'You have already used this deal');
        if (mine.status === 'claimed' && mine.expires_at > now) return json(env, { id: mine.id, code: await deriveCode(env, 'deal', mine.id, 6), expiresAt: Date.parse(mine.expires_at), again: true });
        return err(env, 'Your code for this deal expired. Each comrade can claim a deal once.');
      }
      if (d.max_claims != null && cl.filter((c) => live(c, now)).length >= d.max_claims) return err(env, 'Sorry, all places on this deal are taken');
      const id = crypto.randomUUID(), code = await deriveCode(env, 'deal', id, 6), exp = ahead(CODE_HOURS * 3600e3);
      const r = await post(env, 'deal_claims', { id, deal_id: d.id, aid: u.aid, code_hash: await codeHash(env, 'deal', id, code), expires_at: exp });
      if (!r.ok) return err(env, 'You already claimed this deal', 409);
      return json(env, { id, code, expiresAt: Date.parse(exp) }, 201);
    }

    if (d.aid !== u.aid) return err(env, 'Only the business that posted this deal can do that', 403);

    if (mm[2] === 'redeem') {
      const b = await body(), code = String(b.code || '').replace(/\D/g, '');
      if (code.length !== 6) return err(env, 'Enter the 6-digit code the comrade shows you');
      if (!(await bump(env, 'dealredeem:' + u.aid, 60))) return tooMany(env);          // stops code guessing
      const cl = await rows(await sb(env, `deal_claims?deal_id=eq.${d.id}&status=eq.claimed&limit=5000`));
      let hit = null;
      for (const c of cl) if (c.expires_at > now && c.code_hash === await codeHash(env, 'deal', c.id, code)) { hit = c; break; }
      if (!hit) return err(env, 'That code does not match an active claim. It may be wrong, expired or already used.', 404);
      const S = await getSettings(env);
      const r = await sb(env, `deal_claims?id=eq.${hit.id}&status=eq.claimed`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: 'redeemed', redeemed_at: now, fee: S.deal_fee_per_redeem }) });
      if (!(await rows(r)).length) return err(env, 'That code was already used', 409);
      await notify(env, hit.aid, 'deal', 'Deal confirmed', `Enjoy your offer at ${d.business}.`, 'deal', d.id);
      return json(env, { ok: true, fee: S.deal_fee_per_redeem });
    }

    if (mm[2] === 'end') { await patch(env, `deals?id=eq.${d.id}`, { status: 'ended' }); return json(env, { ok: true }); }
    await patch(env, `deals?id=eq.${d.id}`, { hidden: true });
    return json(env, { ok: true });
  }

  return null;
}
