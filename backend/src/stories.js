// Stories (photos and short videos that disappear after 24 hours) and comments on clips and reels.
// Uploads reuse the media flow in media.js (kind story_photo or story_video). Nobody is ever named: each account gets a stable
// made-up alias, so people can follow a conversation without knowing who is behind it.
import * as store from './storage.js';
import { mediaUrl, MEDIA_BUCKET } from './storage.js';
import { json, err, sb, rows, one, post, patch, enc, inList, str, UUID, H, user, authProfile, throttle, tooMany, contactBlock, ago, DAY } from './lib.js';
import { notify, notifySnippet } from './notifications.js';
import { badgeKind } from './lib.js';

export const STORY_HOURS = 24;
const ADJ = ['Quiet', 'Swift', 'Bold', 'Calm', 'Sunny', 'Brave', 'Sharp', 'Gentle', 'Lucky', 'Witty', 'Kind', 'Wild', 'Clever', 'Chill', 'Bright', 'Steady'];
const ANI = ['Hippo', 'Gazelle', 'Heron', 'Leopard', 'Zebra', 'Ibis', 'Cheetah', 'Weaver', 'Giraffe', 'Serval', 'Oryx', 'Eagle', 'Mongoose', 'Impala', 'Flamingo', 'Buffalo'];
export async function alias(env, aid) {
  const h = await H(env, 'alias:' + aid);
  return ADJ[parseInt(h.slice(0, 2), 16) % 16] + ' ' + ANI[parseInt(h.slice(2, 4), 16) % 16];
}
const STORY_KINDS = 'story_photo,story_video';
const since = () => new Date(Date.now() - STORY_HOURS * 3600e3).toISOString();

export async function storyRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/stories') && !/^\/api\/clips\/[0-9a-f-]{36}\/comments/.test(path)) return null;
  const body = async () => (await req.json().catch(() => ({})));

  // ---- the tray: everyone's live stories, grouped by person ----
  if (path === '/api/stories' && m === 'GET') {
    const me = req.headers.get('X-Token') ? await authProfile(req, env) : null;
    const r = await rows(await sb(env, `media?kind=in.(${STORY_KINDS})&status=eq.ready&created_at=gte.${enc(since())}&order=created_at.asc&limit=300`));
    if (!r.length) return json(env, { groups: [] });
    const aids = [...new Set(r.map((x) => x.aid))];
    const profs = await rows(await sb(env, `profiles?select=aid,banned,verified,badge,role,student_verified&aid=${inList(aids)}`));
    const bad = new Set(profs.filter((p) => p.banned).map((p) => p.aid));
    const ok = r.filter((x) => !bad.has(x.aid));
    const ids = ok.map((x) => x.id);
    const seen = me && ids.length ? await rows(await sb(env, `story_views?select=media_id&viewer_aid=eq.${enc(me.aid)}&media_id=${inList(ids)}`)) : [];
    const seenSet = new Set(seen.map((s) => s.media_id));
    const mineIds = me ? ok.filter((x) => x.aid === me.aid).map((x) => x.id) : [];
    const viewRows = mineIds.length ? await rows(await sb(env, `story_views?select=media_id&media_id=${inList(mineIds)}&limit=5000`)) : [];
    const groups = new Map();
    for (const x of ok) {
      if (!groups.has(x.aid)) groups.set(x.aid, { aid: x.aid, items: [] });
      groups.get(x.aid).items.push({
        id: x.id, url: mediaUrl(env, x.r2_key), type: x.kind === 'story_video' ? 'video' : 'image', caption: x.caption || '', at: Date.parse(x.created_at),
        seen: seenSet.has(x.id) || (!!me && me.aid === x.aid), ...(me && me.aid === x.aid ? { views: viewRows.filter((v) => v.media_id === x.id).length } : {}),
      });
    }
    const out = [];
    for (const g of groups.values()) {
      const p = profs.find((q) => q.aid === g.aid) || {}, mine = !!me && me.aid === g.aid;
      out.push({ alias: mine ? 'Your story' : await alias(env, g.aid), mine, verified: !!p.verified, badge: p.badge || null, kind: badgeKind(p), items: g.items, seen: g.items.every((i) => i.seen), latest: g.items[g.items.length - 1].at });
    }
    out.sort((a, b) => (b.mine - a.mine) || ((a.seen ? 1 : 0) - (b.seen ? 1 : 0)) || (b.latest - a.latest));
    return json(env, { groups: out, hours: STORY_HOURS });
  }

  let mm = path.match(/^\/api\/stories\/([0-9a-f-]{36})\/view$/);
  if (mm && m === 'POST') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const s = await one(await sb(env, `media?id=eq.${mm[1]}&kind=in.(${STORY_KINDS})&status=eq.ready&created_at=gte.${enc(since())}`));
    if (!s) return err(env, 'This story has ended', 404);
    if (s.aid !== u.aid) await post(env, 'story_views', { media_id: s.id, viewer_aid: u.aid }, 'resolution=ignore-duplicates,return=representation');
    return json(env, { ok: true });
  }
  mm = path.match(/^\/api\/stories\/([0-9a-f-]{36})\/remove$/);
  if (mm && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const s = await one(await sb(env, `media?id=eq.${mm[1]}&aid=eq.${enc(u.aid)}&kind=in.(${STORY_KINDS})&status=eq.ready`));
    if (!s) return err(env, 'Not found', 404);
    await patch(env, `media?id=eq.${s.id}`, { status: 'hidden' });
    await store.remove(env, MEDIA_BUCKET(env), s.r2_key);
    return json(env, { ok: true });
  }

  // ---- comments on clips and reels ----
  mm = path.match(/^\/api\/clips\/([0-9a-f-]{36})\/comments$/);
  if (mm && m === 'GET') {
    const me = req.headers.get('X-Token') ? await authProfile(req, env) : null;
    const clip = await one(await sb(env, `media?select=id,aid&id=eq.${mm[1]}&status=eq.ready`)); if (!clip) return err(env, 'Not found', 404);
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1), limit = 30;
    const r = await rows(await sb(env, `media_comments?media_id=eq.${clip.id}&hidden=eq.false&order=created_at.asc&limit=${limit + 1}&offset=${(page - 1) * limit}`));
    const list = r.slice(0, limit), cache = {};
    const out = [];
    for (const c of list) { cache[c.aid] ||= await alias(env, c.aid); out.push({ id: c.id, text: c.text, alias: cache[c.aid], creator: c.aid === clip.aid, mine: !!me && me.aid === c.aid, can_remove: !!me && (me.aid === c.aid || me.aid === clip.aid), at: Date.parse(c.created_at) }); }
    return json(env, { comments: out, hasMore: r.length > limit });
  }
  if (mm && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const clip = await one(await sb(env, `media?id=eq.${mm[1]}&status=eq.ready&kind=in.(clip,video)`)); if (!clip) return err(env, 'Not found', 404);
    const text = str((await body()).text, 200);
    if (!text) return err(env, 'Write a comment');
    const blk = contactBlock(env, text); if (blk) return blk;
    if (!(await throttle(env, ip, 'clipcomment', u.aid, 60, 200))) return tooMany(env);
    const c = await one(await post(env, 'media_comments', { media_id: clip.id, aid: u.aid, text }));
    if (!c) return err(env, 'Could not post your comment. Try again.', 500);
    if (clip.aid !== u.aid) await notify(env, clip.aid, 'reel_comment', 'New comment on your reel', '“' + notifySnippet(text) + '”', 'clip', clip.id);
    const count = (await rows(await sb(env, `media_comments?select=id&media_id=eq.${clip.id}&hidden=eq.false&limit=5000`))).length;
    return json(env, { comment: { id: c.id, text: c.text, alias: await alias(env, u.aid), creator: clip.aid === u.aid, mine: true, can_remove: true, at: Date.parse(c.created_at) }, count }, 201);
  }
  mm = path.match(/^\/api\/clips\/([0-9a-f-]{36})\/comments\/([0-9a-f-]{36})\/remove$/);
  if (mm && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const clip = await one(await sb(env, `media?select=id,aid&id=eq.${mm[1]}`)), c = await one(await sb(env, `media_comments?id=eq.${mm[2]}&media_id=eq.${mm[1]}&hidden=eq.false`));
    if (!clip || !c) return err(env, 'Not found', 404);
    if (c.aid !== u.aid && clip.aid !== u.aid) return err(env, 'Not allowed', 403);
    await patch(env, `media_comments?id=eq.${c.id}`, { hidden: true });
    return json(env, { ok: true });
  }
  return null;
}

// Cron: stories are gone after 24 hours. The file is deleted too, which keeps the free storage small.
export async function pruneStories(env) {
  const old = await rows(await sb(env, `media?select=id,r2_key&kind=in.(${STORY_KINDS})&status=in.(ready,pending)&created_at=lt.${enc(since())}&limit=100`));
  for (const s of old) { await store.remove(env, MEDIA_BUCKET(env), s.r2_key); await patch(env, `media?id=eq.${s.id}`, { status: 'hidden' }); }
  await sb(env, `story_views?created_at=lt.${enc(new Date(Date.now() - 3 * DAY).toISOString())}`, { method: 'DELETE' });
  return old.length;
}
