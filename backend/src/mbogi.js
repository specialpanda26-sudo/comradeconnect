// Mbogi Talk: group video meetings with a share code, like abc-defg-hij.
// The video and sound run on Agora (same account as Live). Here we keep only: the meeting row, who is in it, chat and reactions.
// Everyone in a meeting may publish, so every joiner gets a publishing token. Chat, reactions and raised hands travel through /ping (polled every ~3s).
import { agoraToken, hasAgoraCert } from './agora.js';
import { json, err, sb, rows, one, post, patch, enc, str, sha256Hex, throttle, tooMany, user, isAdmin, contactBlock, ago } from './lib.js';

export const MBOGI_MAX = 12;                    // people in one meeting (a phone cannot draw more video tiles than that)
export const MBOGI_ONLINE_MS = 12e3;            // a person counts as "in the meeting" for 12 seconds after their last ping
export const MBOGI_LIFE_MS = 24 * 3600e3;       // a meeting link stops working after 24 hours
export const REACTIONS = ['heart', 'clap', 'party', 'laugh', 'wow', 'sad', 'think', 'up', 'down'];
const LETTERS = 'abcdefghjkmnpqrstuvwxyz';      // no i, l, o: easy to read out loud
const CODE = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

export function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(10)), c = [...b].map((x) => LETTERS[x % LETTERS.length]).join('');
  return c.slice(0, 3) + '-' + c.slice(3, 7) + '-' + c.slice(7);
}
export const channelOf = (code) => 'mb' + code.replace(/-/g, '');
const clean = (c) => String(c || '').toLowerCase().replace(/[^a-z]/g, '');
// Accepts "abc-defg-hij", "abcdefghij", or a whole link that contains the code.
export function parseCode(raw) {
  const s = String(raw || '').toLowerCase(), m = s.match(/[a-z]{3}-[a-z]{4}-[a-z]{3}/); if (m) return m[0];
  const l = clean(s.split('?mbogi=').pop());
  return l.length === 10 ? l.slice(0, 3) + '-' + l.slice(3, 7) + '-' + l.slice(7) : '';
}

async function load(env, code) {
  const m = await one(await sb(env, `mbogi_meetings?select=code,host_aid,title,status,created_at&code=eq.${enc(code)}`));
  if (!m) return null;
  if (m.status === 'open' && Date.parse(m.created_at) < Date.now() - MBOGI_LIFE_MS) { m.status = 'ended'; await patch(env, `mbogi_meetings?code=eq.${enc(code)}`, { status: 'ended', ended_at: new Date().toISOString() }); }
  return m;
}
const active = async (env, code) => rows(await sb(env, `mbogi_people?select=viewer,aid,name,uid,hand&code=eq.${enc(code)}&seen_at=gte.${enc(ago(MBOGI_ONLINE_MS))}&order=seen_at.asc&limit=50`));

const NOT_ON = 'Mbogi Talk is not switched on yet. Run mbogi.sql';
let tablesOk = false;                                        // once the tables answer, we stop asking
async function tablesReady(env) {
  if (tablesOk) return true;
  for (const t of ['mbogi_meetings', 'mbogi_people', 'mbogi_events']) {
    const r = await sb(env, t + '?select=*&limit=1');
    if (r.ok) continue;
    const d = await r.json().catch(() => null);
    if (r.status === 404 || ['42P01', 'PGRST205', 'PGRST204', '42703'].includes(String((d && d.code) || ''))) return false;
  }
  tablesOk = true; return true;
}

export async function mbogiRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/mbogi')) return null;
  if (!(await tablesReady(env))) return err(env, NOT_ON, 503);
  const body = async () => (await req.json().catch(() => ({})));

  // Start a meeting. Returns the code people type or the link they tap.
  if (path === '/api/mbogi/create' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    if (!(await throttle(env, ip, 'mbcreate', u.aid, 30, 60))) return tooMany(env);
    const b = await body(), title = str(b.title, 60) || ((u.handle || 'Comrade') + "'s Mbogi");
    const blocked = contactBlock(env, title); if (blocked) return blocked;
    await patch(env, `mbogi_meetings?host_aid=eq.${enc(u.aid)}&status=eq.open`, { status: 'ended', ended_at: new Date().toISOString() });   // one open meeting per host
    for (let i = 0; i < 5; i++) {
      const code = newCode(), r = await post(env, 'mbogi_meetings', { code, host_aid: u.aid, title }, 'return=representation');
      const row = await one(r); if (row) return json(env, { code, title, channel: channelOf(code) }, 201);
    }
    return err(env, 'Could not start the meeting. Try again.', 500);
  }

  // Anyone with the code can look at the meeting before joining (title, host, how many are in).
  let mm = path.match(/^\/api\/mbogi\/([a-z]{3}-[a-z]{4}-[a-z]{3})$/);
  if (mm && m === 'GET') {
    const mt = await load(env, mm[1]); if (!mt) return err(env, 'No meeting with that code', 404);
    const ppl = mt.status === 'open' ? await active(env, mt.code) : [];
    const h = await one(await sb(env, `profiles?select=handle&aid=eq.${enc(mt.host_aid)}`)).catch(() => null);
    return json(env, { code: mt.code, title: mt.title, status: mt.status, host: (h && h.handle) || 'Comrade', count: ppl.length, max: MBOGI_MAX });
  }

  mm = path.match(/^\/api\/mbogi\/([a-z]{3}-[a-z]{4}-[a-z]{3})\/(join|ping|send|leave|end)$/);
  if (!mm || m !== 'POST') return null;
  const code = mm[1], act = mm[2];
  const u = await user(req, env, true); if (u instanceof Response) return u;
  const mt = await load(env, code); if (!mt) return err(env, 'No meeting with that code', 404);
  const b = await body(), viewer = (await sha256Hex(u.aid + '|' + str(b.v, 40).replace(/[^\w-]/g, ''))).slice(0, 24), name = str(u.handle, 30) || 'Comrade';

  if (act === 'end') {
    if (mt.host_aid !== u.aid && !isAdmin(req, env)) return err(env, 'Only the host can end the meeting', 403);
    await patch(env, `mbogi_meetings?code=eq.${enc(code)}`, { status: 'ended', ended_at: new Date().toISOString() });
    return json(env, { ok: true });
  }
  if (act === 'leave') {
    await sb(env, `mbogi_people?code=eq.${enc(code)}&viewer=eq.${viewer}`, { method: 'DELETE' });
    return json(env, { ok: true });
  }
  if (mt.status !== 'open') return err(env, 'This meeting has ended', 410);

  if (act === 'join') {
    const ppl = await active(env, code);
    if (ppl.length >= MBOGI_MAX && !ppl.some((p) => p.viewer === viewer)) return err(env, `This meeting is full (${MBOGI_MAX} people)`, 409);
    await post(env, 'mbogi_people', { code, viewer, aid: u.aid, name, hand: false, seen_at: new Date().toISOString() }, 'resolution=merge-duplicates');
    const token = hasAgoraCert(env) ? await agoraToken(env, channelOf(code), 'host') : null;   // 'host' = may publish audio and video
    return json(env, { token, channel: channelOf(code), title: mt.title, host: mt.host_aid === u.aid, name, max: MBOGI_MAX });
  }

  if (act === 'ping') {
    const patchRow = { code, viewer, aid: u.aid, name, seen_at: new Date().toISOString() };
    if (b.uid != null) patchRow.uid = str(b.uid, 20).replace(/\D/g, '') || null;
    if (typeof b.hand === 'boolean') patchRow.hand = b.hand;
    await post(env, 'mbogi_people', patchRow, 'resolution=merge-duplicates');
    const since = b.since && !Number.isNaN(Date.parse(b.since)) ? new Date(Date.parse(b.since)).toISOString() : null;
    const q = `mbogi_events?select=id,kind,name,text,created_at&code=eq.${enc(code)}` + (since ? `&created_at=gt.${enc(since)}&order=created_at.asc&limit=60` : '&order=created_at.desc&limit=30');
    let ev = await rows(await sb(env, q)); if (!since) ev = ev.reverse();
    const ppl = await active(env, code);
    return json(env, { status: 'open', people: ppl.map((p) => ({ viewer: p.viewer, name: p.name, uid: p.uid, hand: !!p.hand, host: p.aid === mt.host_aid, me: p.viewer === viewer })),
      events: ev.map((e) => ({ id: e.id, kind: e.kind, name: e.name, text: e.text, at: e.created_at })) });
  }

  if (act === 'send') {
    const kind = b.kind === 'react' ? 'react' : 'chat';
    let text = str(b.text, 300);
    if (kind === 'react') { if (!REACTIONS.includes(text)) return err(env, 'Bad request'); if (!(await throttle(env, ip, 'mbreact', u.aid, 800, 2000))) return tooMany(env); }
    else {
      if (!text) return err(env, 'Write something first');
      const blocked = contactBlock(env, text); if (blocked) return blocked;
      if (!(await throttle(env, ip, 'mbchat', u.aid, 400, 1200))) return tooMany(env);
    }
    const e = await one(await post(env, 'mbogi_events', { code, kind, name, text }, 'return=representation'));
    return e ? json(env, { id: e.id, kind, name, text, at: e.created_at }, 201) : err(env, 'Could not send', 500);
  }
  return null;
}
