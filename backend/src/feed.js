import { json, sb, rows, ago, isAdmin, hasContact, standingBlock, audit, user } from './lib.js';
import { feeFor } from './postrules.js';
import { checkText } from './moderation.js';
import { notify, notifySnippet } from './notifications.js';
import { campusRow, campusQuery } from './campus.js';

// ---------- Feed ----------
const CAT_OK = /^[A-Za-z0-9]{2,22}$/;
const fmtPost = (r) => ({
  _id: r.id, content: r.content, category: r.category, zone: r.zone || '', verified: !!r.verified, aid: r.aid,
  campus: 'Kirinyaga University', likes: r.likes || 0, views: r.views || 0,
  boosted: !!(r.boosted_until && new Date(r.boosted_until) > new Date()),
  comments: (r.comments || []).sort((a, b) => a.created_at < b.created_at ? -1 : 1).map((c) => ({ text: c.text, createdAt: Date.parse(c.created_at) })),
  createdAt: Date.parse(r.created_at),
});
const SEL = 'select=*,comments(text,created_at)';

export async function feedRoutes(req, env, url, ip) {
  const path = url.pathname;
  // List
  if (path === '/api/posts' && req.method === 'GET') {
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
    const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit')) || 5));
    let q = `posts?${SEL}&hidden=eq.false&order=created_at.desc&limit=${limit + 1}&offset=${(page - 1) * limit}`;
    const cat = url.searchParams.get('category'), zone = url.searchParams.get('zone');
    if (cat && cat !== 'All' && CAT_OK.test(cat)) q += `&category=eq.${cat}`;
    if (zone && zone !== 'All') q += `&zone=eq.${encodeURIComponent(zone.slice(0, 30))}`;
    q += campusQuery(req);                                  // the campus you picked
    const r = await rows(await sb(env, q));
    const posts = r.slice(0, limit).map(fmtPost).sort((a, b) => (b.boosted ? 1 : 0) - (a.boosted ? 1 : 0));
    return json(env, { posts, hasMore: r.length > limit });
  }
  // Create
  if (path === '/api/posts' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const aid = String(b.aid || '').slice(0, 64), content = String(b.content || '').trim().slice(0, 500);
    const category = CAT_OK.test(String(b.category || '')) ? b.category : 'General';
    const zone = String(b.zone || '').slice(0, 30);
    if (!aid || content.length < 2) return json(env, { error: 'Write something first' }, 400);
    { const blk = await standingBlock(env, aid); if (blk) return blk; }
    if (category === 'Notices' && !isAdmin(req, env)) return json(env, { error: 'Only admins post notices' }, 403);
    if (hasContact(content)) return json(env, { error: 'Remove phone numbers, handles and links' }, 400);
    const ccMod = isAdmin(req, env) ? { action: 'allow' } : checkText(content, String(env.BLOCKED_NAMES || '').split(','));
    if (ccMod.action === 'block') return json(env, { error: 'Remove vulgar words and personal details' }, 400);
    const ccHold = ccMod.action === 'review';
    const byAid = await rows(await sb(env, `posts?select=id&aid=eq.${encodeURIComponent(aid)}&created_at=gte.${ago(3600e3)}&limit=10`));
    const byIp = await rows(await sb(env, `posts?select=id&ip=eq.${encodeURIComponent(ip)}&created_at=gte.${ago(3600e3)}&limit=20`));
    if (byAid.length >= 10 || byIp.length >= 20) return json(env, { error: 'Too many posts. Try again later.' }, 429);
    // A post about money (data bundles, prices, packages...) is kept hidden until its small fee is paid.
    const due = isAdmin(req, env) ? { fee: 0 } : await feeFor(env, content);
    if (due.fee > 0) {
      const u = await user(req, env, true); if (u instanceof Response) return u;       // paying needs a signed-in account
      const [draft] = await rows(await sb(env, 'posts', { method: 'POST', body: JSON.stringify({ aid: u.aid, content, category, zone, ip, hidden: true, fee_pending: due.fee, ...campusRow(req) }) }));
      if (!draft) return json(env, { error: 'Could not save your post. Try again.' }, 500);
      return json(env, { payment_required: true, fee: due.fee, rule: due.rule, post_id: draft.id, error: `Posts about money cost KSh ${due.fee}. Pay to publish it.` }, 402);
    }
    const [row] = await rows(await sb(env, 'posts', { method: 'POST', body: JSON.stringify({ aid, content, category, zone, ip, verified: category === 'Notices', hidden: ccHold, ...campusRow(req) }) }));
    return json(env, fmtPost({ ...row, comments: [] }), 201);
  }
  const m = path.match(/^\/api\/posts\/([0-9a-f-]{36})\/(like|view|comments|report)$/);
  if (m && req.method === 'POST') {
    const id = m[1], act = m[2];
    const b = await req.json().catch(() => ({}));
    const aid = String(b.aid || '').slice(0, 64);
    const [post] = await rows(await sb(env, `posts?${SEL}&id=eq.${id}&hidden=eq.false`));
    if (!post) return json(env, { error: 'Not found' }, 404);
    if (act === 'view') {
      const [u] = await rows(await sb(env, 'rpc/inc_post', { method: 'POST', body: JSON.stringify({ p: id, col: 'views' }) }));
      return json(env, fmtPost({ ...post, views: u?.views ?? post.views }));
    }
    if (!aid) return json(env, { error: 'Missing account' }, 400);
    if (act === 'comments') { const blk = await standingBlock(env, aid); if (blk) return blk; }
    if (act === 'like') {
      const ins = await rows(await sb(env, 'post_likes', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ post_id: id, aid }) }));
      if (!ins.length) return json(env, fmtPost(post));                        // already liked
      const [u] = await rows(await sb(env, 'rpc/inc_post', { method: 'POST', body: JSON.stringify({ p: id, col: 'likes' }) }));
      const nl = u?.likes ?? post.likes + 1;
      if (post.aid && post.aid !== aid && [10, 25, 50, 100, 250, 500].includes(nl)) await notify(env, post.aid, 'like_milestone', 'Your story reached ' + nl + ' likes', notifySnippet(post.content), 'post', id);
      return json(env, fmtPost({ ...post, likes: nl }));
    }
    if (act === 'comments') {
      const text = String(b.text || '').trim().slice(0, 200);
      if (text.length < 1) return json(env, { error: 'Write a comment' }, 400);
      if (hasContact(text)) return json(env, { error: 'Remove phone numbers, handles and links' }, 400);
      const ccCom = checkText(text, String(env.BLOCKED_NAMES || '').split(','));
      if (!ccCom.ok) return json(env, { error: 'Remove vulgar words and personal details' }, 400);
      const recent = await rows(await sb(env, `comments?select=id&aid=eq.${encodeURIComponent(aid)}&created_at=gte.${ago(3600e3)}&limit=30`));
      if (recent.length >= 30) return json(env, { error: 'Too many comments. Try again later.' }, 429);
      const [c] = await rows(await sb(env, 'comments', { method: 'POST', body: JSON.stringify({ post_id: id, aid, text }) }));
      if (post.aid && post.aid !== aid) await notify(env, post.aid, 'comment', 'New comment on your story', '\u201c' + notifySnippet(text) + '\u201d', 'post', id);
      return json(env, fmtPost({ ...post, comments: [...(post.comments || []), c || { text, created_at: new Date().toISOString() }] }));
    }
    if (act === 'report') {
      await sb(env, 'reports', { method: 'POST', body: JSON.stringify({ post_id: id, aid, reason: String(b.reason || '').slice(0, 200) }) });
      const reps = await rows(await sb(env, `reports?select=aid&post_id=eq.${id}`));
      if (new Set(reps.map((x) => x.aid)).size >= 3)                           // auto-hide after 3 different reporters
        await sb(env, `posts?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ hidden: true }) });
      return json(env, { ok: true });
    }
  }
  // Admin: verify / hide / unhide / delete / boost
  const a = path.match(/^\/api\/admin\/posts\/([0-9a-f-]{36})$/);
  if (a && req.method === 'POST') {
    if (!isAdmin(req, env)) return json(env, { error: 'Not allowed' }, 403);
    const b = await req.json().catch(() => ({}));
    await audit(env, 'post.' + String(b.action), 'post', a[1], null, ip);
    if (b.action === 'delete') { await sb(env, `posts?id=eq.${a[1]}`, { method: 'DELETE' }); return json(env, { ok: true }); }
    const patch = {};
    if (b.action === 'verify') patch.verified = true;
    if (b.action === 'hide') patch.hidden = true;
    if (b.action === 'unhide') patch.hidden = false;
    if (b.action === 'boost') patch.boosted_until = new Date(Date.now() + (Number(b.hours) || 24) * 3600e3).toISOString();
    if (!Object.keys(patch).length) return json(env, { error: 'Unknown action' }, 400);
    await sb(env, `posts?id=eq.${a[1]}`, { method: 'PATCH', body: JSON.stringify(patch) });
    return json(env, { ok: true });
  }
  return null;
}

