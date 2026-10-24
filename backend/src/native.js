// Live inside Comrade Connect (video by Agora, free plan) + profile pictures.
// The video itself never touches our server; we only keep the stream row, hearts, comments and viewers.
import { liveEmbed } from './media.js';
import { viewerCounts } from './live.js';
import { json, err, sb, rows, one, post, patch, enc, str, randHex, user, isAdmin, throttle, tooMany } from './lib.js';

const AVATAR = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;

export async function nativeRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;

  // Same list as before, plus: native streams carry a channel name instead of a link.
  if (path === '/api/live' && m === 'GET') {
    const r = await rows(await sb(env, 'live_streams?status=eq.live&order=created_at.desc&limit=10'));
    const vc = await viewerCounts(env, r.map((s) => s.id));
    return json(env, { streams: r.map((s) => {
      const nat = String(s.input_uid || '').startsWith('cc:');
      return { id: s.id, title: s.title, native: nat, channel: nat ? s.input_uid.slice(3) : null,
        watch_url: nat ? null : s.input_uid, embed_url: nat ? null : liveEmbed(s.input_uid),
        startedAt: Date.parse(s.created_at), viewers: vc[s.id] || 0, hearts: s.hearts || 0 };
    }) });
  }

  // Start a live from the phone's own camera. Anyone with an account can go live (admins too).
  if (path === '/api/live/start' && m === 'POST') {
    const b = await req.clone().json().catch(() => ({}));
    if (!b.native) return null;                       // link-style lives still use the old route
    let hostAid = 'admin';
    if (!isAdmin(req, env)) {
      const u = await user(req, env, true); if (u instanceof Response) return u;
      if (!(await throttle(env, ip, 'livestart', u.aid, 20, 40))) return tooMany(env);   // a banned or muted account is stopped by user() above
      hostAid = u.aid;
    }
    const title = str(b.title, 80) || 'Live', channel = 'cc' + randHex(8);
    await patch(env, `live_streams?host_aid=eq.${enc(hostAid)}&status=eq.live`, { status: 'ended', ended_at: new Date().toISOString() });
    const s = await one(await post(env, 'live_streams', { host_aid: hostAid, title, input_uid: 'cc:' + channel }));
    return s ? json(env, { id: s.id, channel, native: true }, 201) : err(env, 'Could not start', 500);
  }

  // Profile picture: a small square JPEG (about 192px) saved on the profile as text.
  if (path === '/api/me/avatar' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    return json(env, { avatar: u.avatar || null });
  }
  if (path === '/api/me/avatar' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const d = String((await req.json().catch(() => ({}))).data || '');
    if (d && (d.length > 70000 || !AVATAR.test(d))) return err(env, 'Use a small JPG photo');
    const res = await patch(env, `profiles?aid=eq.${enc(u.aid)}`, { avatar: d || null });
    if (!res.ok) return err(env, 'Could not save the photo. Ask the admin to run the avatar SQL.', 500);
    return json(env, { ok: true, avatar: d || null });
  }
  return null;
}
