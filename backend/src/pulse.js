import { json, err, sb, rows, post, enc, str, int, throttle, tooMany, user, authProfile } from './lib.js';
import { campusOrHome } from './campus.js';

const today = () => Math.floor(Date.now() / 864e5);

export async function pulseRoutes(req, env, url, ip) {
  const p = url.pathname, m = req.method;
  if (p !== '/api/pulse' && !p.startsWith('/api/pulse/')) return null;
  const camp = campusOrHome(req);

  if (p === '/api/pulse' && m === 'GET') {
    const d = today();
    const votes = await rows(await sb(env, `pulse_votes?select=opt,aid&day=eq.${d}&campus=eq.${enc(camp)}&limit=5000`));
    const counts = [0, 0, 0];
    for (const v of votes) if (v.opt >= 0 && v.opt < 3) counts[v.opt]++;
    const me = req.headers.get('X-Token') ? await authProfile(req, env) : null;
    const mv = me ? votes.find((v) => v.aid === me.aid) : null;
    const zones = {};
    for (const r of await rows(await sb(env, `pulse_ratings?select=zone,water,security,wifi&campus=eq.${enc(camp)}&limit=5000`))) {
      const z = (zones[r.zone] ||= { Water: [0, 0], Security: [0, 0], Wifi: [0, 0] });
      z.Water[0] += r.water; z.Water[1]++; z.Security[0] += r.security; z.Security[1]++; z.Wifi[0] += r.wifi; z.Wifi[1]++;
    }
    return json(env, { poll: { day: d, counts, mine: mv ? mv.opt : null }, zones });
  }

  if (p === '/api/pulse/vote' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    if (!(await throttle(env, ip, 'pvote', u.aid, 20, 100))) return tooMany(env);
    const b = await req.json().catch(() => ({})), opt = int(b.opt, 0, 2);
    if (opt === null) return err(env, 'Pick an answer');
    const res = await post(env, 'pulse_votes', { day: today(), aid: u.aid, campus: camp, opt }, 'resolution=ignore-duplicates,return=representation');
    if (!res.ok) return err(env, 'Voting is not ready yet. Ask the admin to run the pulse SQL.', 503);
    if (!(await rows(res)).length) return err(env, 'You already voted today', 409);
    return json(env, { ok: true }, 201);
  }

  if (p === '/api/pulse/rate' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    if (!(await throttle(env, ip, 'prate', u.aid, 20, 100))) return tooMany(env);
    const b = await req.json().catch(() => ({})), zone = str(b.zone, 40);
    const water = int(b.water, 1, 5), security = int(b.security, 1, 5), wifi = int(b.wifi, 1, 5);
    if (!zone || !water || !security || !wifi) return err(env, 'Pick a score for water, security and wifi');
    const res = await post(env, 'pulse_ratings', { campus: camp, zone, aid: u.aid, water, security, wifi }, 'resolution=ignore-duplicates,return=representation');
    if (!res.ok) return err(env, 'Ratings are not ready yet. Ask the admin to run the pulse SQL.', 503);
    if (!(await rows(res)).length) return err(env, 'You already rated this zone', 409);
    return json(env, { ok: true }, 201);
  }
  return null;
}
