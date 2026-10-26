// Admin: see every post (also hidden ones), hide / show / delete a post, and clear finished data to keep the panels clean.
// Clearing only touches finished, closed or old records. Open reports, live listings, orders still in escrow, unpaid post drafts,
// wallets, accounts and payments are never touched. Every clear needs the word CLEAR and is written to the audit log.
import { json, err, sb, rows, one, patch, enc, inList, str, UUID, isAdmin, audit } from './lib.js';

const now = () => new Date().toISOString();
const done = 'status=in.(released,refunded)';

// Each scope: what it is for, and the filters to count or delete. `aid` narrows it to one account where the table has an owner.
const SCOPES = {
  audit: { label: 'Admin activity log', note: 'The list of what admins did. One new line is kept to record this clear.', all: true,
    jobs: () => [['admin_audit_log', `created_at=lte.${enc(now())}`]] },
  reports: { label: 'Closed reports', note: 'Reports already actioned or dismissed. Open reports stay.',
    jobs: (a) => [['content_reports', `status=neq.open${a ? `&reporter_aid=eq.${enc(a)}` : ''}`], ['message_reports', `status=neq.open${a ? `&reporter_aid=eq.${enc(a)}` : ''}`]] },
  notifications: { label: 'Notifications', note: 'The bell lists of accounts.',
    jobs: (a) => [['notifications', `created_at=lte.${enc(now())}${a ? `&aid=eq.${enc(a)}` : ''}`]] },
  sold_listings: { label: 'Sold, removed and rejected listings', note: 'Listings no longer for sale. Live and pending listings stay.',
    jobs: (a) => [['listings', `status=in.(sold,removed,rejected)${a ? `&seller_aid=eq.${enc(a)}` : ''}`]] },
  finished_orders: { label: 'Finished orders', note: 'Released or refunded orders. Orders still in escrow stay. Company earnings totals are worked out from finished orders, so clearing them resets those totals.', risky: true,
    jobs: (a) => [['orders', a ? `${done}&or=(buyer_aid.eq.${enc(a)},seller_aid.eq.${enc(a)})` : done]] },
  hidden_posts: { label: 'Hidden posts', note: 'Posts already removed from the feed. Posts waiting for a fee payment stay.',
    jobs: (a) => [['posts', `hidden=eq.true&fee_pending=eq.0${a ? `&aid=eq.${enc(a)}` : ''}`]] },
};
const CAP = 5000;

const handles = async (env, aids) => {
  const ids = [...new Set(aids.filter(Boolean))];
  if (!ids.length) return {};
  const r = await rows(await sb(env, `profiles?select=aid,handle&aid=${inList(ids)}&limit=1000`));
  return Object.fromEntries(r.map((p) => [p.aid, p.handle || '']));
};

export async function adminCleanRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!/^\/api\/admin\/(posts|clear)/.test(path)) return null;
  if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);
  const body = async () => (await req.json().catch(() => ({})));
  const A = (action, type, id, detail) => audit(env, action, type, id, detail, ip);

  // ---- every post, newest first (hidden ones too) ----
  if (path === '/api/admin/posts' && m === 'GET') {
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1), limit = 20;
    const state = url.searchParams.get('state'), q = str(url.searchParams.get('q'), 60);
    let qs = `posts?select=id,aid,content,category,zone,hidden,fee_pending,likes,views,campus,created_at,comments(id)&order=created_at.desc&limit=${limit + 1}&offset=${(page - 1) * limit}`;
    if (state === 'hidden') qs += '&hidden=eq.true'; else if (state === 'visible') qs += '&hidden=eq.false';
    if (q) qs += `&content=ilike.${enc('*' + q.replace(/[*,()]/g, ' ') + '*')}`;
    const r = await rows(await sb(env, qs)), list = r.slice(0, limit), H = await handles(env, list.map((x) => x.aid));
    return json(env, { hasMore: r.length > limit, posts: list.map((x) => ({ id: x.id, handle: H[x.aid] || '', aid: x.aid, content: String(x.content || '').slice(0, 500), category: x.category, zone: x.zone || '', hidden: !!x.hidden, awaitingFee: (x.fee_pending || 0) > 0, likes: x.likes || 0, views: x.views || 0, comments: (x.comments || []).length, campus: x.campus, createdAt: x.created_at })) });
  }
  let mm = path.match(/^\/api\/admin\/posts\/([0-9a-f-]{36})$/);
  if (mm && m === 'POST') {
    const b = await body(), act = b.action, id = mm[1];
    if (!UUID.test(id)) return err(env, 'Bad post');
    const cur = await one(await sb(env, `posts?select=id,aid,content&id=eq.${id}`)); if (!cur) return err(env, 'Post not found', 404);
    if (act === 'hide') await patch(env, `posts?id=eq.${id}`, { hidden: true });
    else if (act === 'unhide') await patch(env, `posts?id=eq.${id}`, { hidden: false });
    else if (act === 'delete') await sb(env, `posts?id=eq.${id}`, { method: 'DELETE' });
    else return err(env, 'Unknown action');
    await A('post.' + act, 'post', id, { aid: cur.aid, text: String(cur.content || '').slice(0, 80) });
    return json(env, { ok: true });
  }

  // ---- clear data: first see the counts, then clear with the word CLEAR ----
  if (path === '/api/admin/clear' && m === 'GET') {
    const aid = str(url.searchParams.get('aid'), 64) || '';
    const out = [];
    for (const [key, s] of Object.entries(SCOPES)) {
      let n = 0;
      if (!(aid && s.all)) for (const [t, f] of s.jobs(aid)) n += (await rows(await sb(env, `${t}?select=id&${f}&limit=${CAP}`))).length;
      out.push({ key, label: s.label, note: s.note, risky: !!s.risky, count: n, capped: n >= CAP, perAccount: !s.all });
    }
    return json(env, { scopes: out });
  }
  if (path === '/api/admin/clear' && m === 'POST') {
    const b = await body();
    if (String(b.confirm || '').trim() !== 'CLEAR') return err(env, 'Type the word CLEAR to confirm');
    const keys = (Array.isArray(b.scopes) ? b.scopes : []).filter((k) => SCOPES[k]);
    if (!keys.length) return err(env, 'Pick what to clear');
    const aid = str(b.aid, 64) || '';
    if (aid && !(await one(await sb(env, `profiles?select=aid&aid=eq.${enc(aid)}`)))) return err(env, 'No such account', 404);
    const cleared = {};
    for (const k of keys) {
      const s = SCOPES[k]; cleared[k] = 0;
      if (aid && s.all) continue;                                    // the activity log has no owner, so it is only cleared for everyone
      for (const [t, f] of s.jobs(aid)) {
        const r = await sb(env, `${t}?select=id&${f}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
        if (!r.ok) return err(env, `Could not clear ${s.label.toLowerCase()}. Nothing more was cleared.`, 500);
        cleared[k] += (await rows(r)).length;
      }
    }
    await A('clear.data', 'system', aid || 'everyone', { cleared, scopes: keys });
    return json(env, { ok: true, cleared });
  }
  return null;
}
