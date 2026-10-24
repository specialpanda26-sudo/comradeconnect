// Live extras: viewer count, hearts and chat for a stream the host runs on YouTube / Facebook / TikTok / Twitch.
// The stream itself is not ours; we only add the people-count, the hearts and the comments around it.
import { json, err, sb, rows, one, post, patch, enc, str, int, ago, sha256Hex, throttle, tooMany, user, isAdmin, contactBlock } from './lib.js';

export const ONLINE_MS = 40e3;                 // a viewer counts as "watching" for 40 seconds after their last ping
export const HOST_STALE_MS = 60e3;            // the host phone pings every 15s; silent for 60s = the host left, so the live ends
const ID = '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';

// How many people are watching, for a list of streams (one query).
export async function viewerCounts(env, ids) {
  const out = {}; if (!ids.length) return out;
  const r = await rows(await sb(env, `live_viewers?select=stream_id&stream_id=in.(${ids.join(',')})&viewer=neq.host&seen_at=gte.${ago(ONLINE_MS)}&limit=5000`));
  for (const x of r) out[x.stream_id] = (out[x.stream_id] || 0) + 1;
  return out;
}

// Ends phone-camera lives whose host has gone quiet (closed the tab, lost signal, left the app). Returns the ids it ended.
export async function reapStale(env, list) {
  const out = new Set();
  const cand = (list || []).filter((s) => String(s.input_uid || '').startsWith('cc:') && Date.parse(s.created_at) < Date.now() - 90e3);
  if (!cand.length) return out;
  const ids = cand.map((s) => s.id);
  const alive = new Set((await rows(await sb(env, `live_viewers?select=stream_id&viewer=eq.host&stream_id=in.(${ids.join(',')})&seen_at=gte.${ago(HOST_STALE_MS)}&limit=100`))).map((x) => x.stream_id));
  for (const s of cand) if (!alive.has(s.id)) { out.add(s.id); await patch(env, `live_streams?id=eq.${s.id}&status=eq.live`, { status: 'ended', ended_at: new Date().toISOString() }); }
  return out;
}

export async function liveRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (m !== 'POST' || !path.startsWith('/api/live/')) return null;
  const body = async () => (await req.json().catch(() => ({})));
  let mm;

  // Every few seconds the phone calls this: it says "I am here", and gets back the count, hearts and new comments.
  if ((mm = path.match(new RegExp(`^/api/live/${ID}/ping$`)))) {
    const s = await one(await sb(env, `live_streams?select=id,status,hearts,input_uid,created_at&id=eq.${mm[1]}`)); if (!s) return err(env, 'Not found', 404);
    if (s.status === 'live' && (await reapStale(env, [s])).has(s.id)) s.status = 'ended';
    if (s.status !== 'live') return json(env, { status: 'ended', viewers: 0, hearts: s.hearts || 0, comments: [] });
    const b = await body(), v = str(b.v, 40).replace(/[^\w-]/g, '');
    if (v) await post(env, 'live_viewers', { stream_id: s.id, viewer: (await sha256Hex(ip + '|' + v)).slice(0, 24), seen_at: new Date().toISOString() }, 'resolution=merge-duplicates');
    const since = b.since && !Number.isNaN(Date.parse(b.since)) ? new Date(Date.parse(b.since)).toISOString() : null;
    const q = `live_comments?select=id,name,text,created_at&stream_id=eq.${s.id}&hidden=eq.false` + (since ? `&created_at=gt.${enc(since)}&order=created_at.asc&limit=50` : '&order=created_at.desc&limit=30');
    let cs = await rows(await sb(env, q)); if (!since) cs = cs.reverse();
    const viewers = (await viewerCounts(env, [s.id]))[s.id] || 0;
    const comment_count = (await rows(await sb(env, `live_comments?select=id&stream_id=eq.${s.id}&hidden=eq.false&limit=5000`))).length;
    return json(env, { status: 'live', viewers, hearts: s.hearts || 0, comment_count, comments: cs.map((c) => ({ id: c.id, name: c.name, text: c.text, at: c.created_at })) });
  }

  // The host phone says "I am still live" every 15 seconds. Stop hearing it and the live ends by itself.
  if ((mm = path.match(new RegExp(`^/api/live/${ID}/host-ping$`)))) {
    const admin = isAdmin(req, env); let aid = 'admin';
    if (!admin) { const u = await user(req, env, true); if (u instanceof Response) return u; aid = u.aid; }
    const s = await one(await sb(env, `live_streams?select=id,status,host_aid&id=eq.${mm[1]}`)); if (!s) return err(env, 'Not found', 404);
    if (s.status !== 'live') return json(env, { status: 'ended' });
    if (!admin && s.host_aid !== aid) return err(env, 'Not your stream', 403);
    await post(env, 'live_viewers', { stream_id: s.id, viewer: 'host', seen_at: new Date().toISOString() }, 'resolution=merge-duplicates');
    return json(env, { status: 'live' });
  }

  // A comment. Needs an account, like every other write. No phone numbers, handles or links.
  if ((mm = path.match(new RegExp(`^/api/live/${ID}/comment$`)))) {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body(), text = str(b.text, 140); if (!text) return err(env, 'Write something first');
    const blocked = contactBlock(env, text); if (blocked) return blocked;
    if (!(await throttle(env, ip, 'lcm', u.aid, 300))) return tooMany(env);
    const s = await one(await sb(env, `live_streams?select=id,status&id=eq.${mm[1]}`)); if (!s || s.status !== 'live') return err(env, 'This stream has ended', 404);
    const c = await one(await post(env, 'live_comments', { stream_id: s.id, aid: u.aid, name: u.handle || 'Comrade', text }, 'return=representation'));
    return c ? json(env, { id: c.id, name: c.name, text: c.text, at: c.created_at }, 201) : err(env, 'Could not send', 500);
  }

  // Hearts: anyone can send them. The phone batches taps, so one request carries up to 10.
  if ((mm = path.match(new RegExp(`^/api/live/${ID}/heart$`)))) {
    const n = int((await body()).n, 1, 10); if (!n) return err(env, 'Bad request');
    const s = await one(await sb(env, `live_streams?select=id,status&id=eq.${mm[1]}`)); if (!s || s.status !== 'live') return err(env, 'This stream has ended', 404);
    const total = await (await sb(env, 'rpc/live_heart', { method: 'POST', body: JSON.stringify({ p: s.id, n }) })).json().catch(() => null);
    return json(env, { hearts: typeof total === 'number' ? total : null });
  }

  // The host (or an admin) removes a comment from the screen.
  if ((mm = path.match(new RegExp(`^/api/live/${ID}/comment/${ID}/remove$`)))) {
    const admin = isAdmin(req, env); let aid = 'admin';
    if (!admin) { const u = await user(req, env, true); if (u instanceof Response) return u; aid = u.aid; }
    const s = await one(await sb(env, `live_streams?select=id,host_aid&id=eq.${mm[1]}`)); if (!s) return err(env, 'Not found', 404);
    if (!admin && s.host_aid !== aid) return err(env, 'Only the host can remove comments', 403);
    await patch(env, `live_comments?id=eq.${mm[2]}&stream_id=eq.${s.id}`, { hidden: true });
    return json(env, { ok: true });
  }
  return null;
}
