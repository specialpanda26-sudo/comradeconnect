// Past papers and notes library. Comrades share a link (Google Drive, Mega, Dropbox, OneDrive) to a past paper, CAT, lecture notes
// or revision notes, filed by course code and year. We store only the link, so it costs no storage. Follows the campus like Land spots.
// Safety: only links from known file hosts are accepted, no phone numbers in the text, and 3 reports hide a post (see /api/report).
import { json, err, sb, rows, one, post, patch, enc, str, int, UUID, throttle, tooMany, user, authProfile, contactBlock } from './lib.js';
import { campusOf, isAllCampuses, campusOrHome, CAMPUS_IDS, DEFAULT_CAMPUS } from './campus.js';

export const PAPER_KINDS = ['Past paper', 'CAT', 'Lecture notes', 'Revision notes'];
const HOSTS = ['drive.google.com', 'docs.google.com', 'mega.nz', 'dropbox.com', 'onedrive.live.com', '1drv.ms'];
export function cleanLink(v) {
  let u; try { u = new URL(String(v || '').trim()); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || String(v).length > 300) return null;
  const h = u.hostname.toLowerCase().replace(/^www\./, '');
  return HOSTS.some((x) => h === x || h.endsWith('.' + x)) ? u.toString() : null;
}
const cleanCode = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
const pub = (r, me) => ({ id: r.id, campus: r.campus, kind: r.kind, courseCode: r.course_code, courseName: r.course_name || '', year: r.year, title: r.title, link: r.link, details: r.details || '', likes: r.likes || 0, createdAt: Date.parse(r.created_at), mine: !!me && me.aid === r.aid });

export async function paperRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/papers')) return null;
  const body = async () => (await req.json().catch(() => ({})));

  if (path === '/api/papers/meta' && m === 'GET') return json(env, { kinds: PAPER_KINDS, hosts: HOSTS });

  if (path === '/api/papers' && m === 'GET') {
    const me = req.headers.get('X-Token') ? await authProfile(req, env) : null;
    const all = isAllCampuses(req), sp = url.searchParams;
    const camp = all ? 'all' : (campusOf(req) || (CAMPUS_IDS.includes(sp.get('campus')) ? sp.get('campus') : DEFAULT_CAMPUS));
    let q = `papers?hidden=eq.false${all ? '' : '&campus=eq.' + camp}&order=course_code.asc,year.desc,likes.desc&limit=200`;
    const kind = sp.get('kind'); if (PAPER_KINDS.includes(kind)) q += '&kind=eq.' + enc(kind);
    const yr = int(sp.get('year'), 2000, 2100); if (yr) q += '&year=eq.' + yr;
    const code = cleanCode(sp.get('q')); if (code) q += `&or=(course_code.ilike.${enc('*' + code + '*')},title.ilike.${enc('*' + code + '*')},course_name.ilike.${enc('*' + code + '*')})`;
    const r = await rows(await sb(env, q));
    const mine = me && r.length ? new Set((await rows(await sb(env, `paper_likes?select=paper_id&aid=eq.${enc(me.aid)}&paper_id=in.(${r.map((x) => x.id).join(',')})`))).map((x) => x.paper_id)) : new Set();
    return json(env, { campus: camp, papers: r.map((x) => ({ ...pub(x, me), liked: mine.has(x.id) })) });
  }

  if (path === '/api/papers' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body();
    const kind = PAPER_KINDS.includes(b.kind) ? b.kind : 'Past paper';
    const course_code = cleanCode(b.course_code), course_name = str(b.course_name, 80), title = str(b.title, 100), details = str(b.details, 300);
    const year = int(b.year, 2000, new Date().getUTCFullYear() + 1);
    if (course_code.length < 3) return err(env, 'Add the course code, like MAT 110');
    if (!year) return err(env, 'Pick the year');
    if (title.length < 3) return err(env, 'Add a short title, like "Sem 1 main exam"');
    const link = cleanLink(b.link);
    if (!link) return err(env, 'Paste a share link from Google Drive, Mega, Dropbox or OneDrive (it must start with https)');
    const blk = contactBlock(env, course_name, title, details); if (blk) return blk;
    if (!(await throttle(env, ip, 'paper', u.aid, 10, 40))) return tooMany(env);
    const dup = await one(await sb(env, `papers?select=id&link=eq.${enc(link)}&hidden=eq.false`));
    if (dup) return err(env, 'That link is already in the library');
    const r = await one(await post(env, 'papers', { aid: u.aid, campus: campusOrHome(req), kind, course_code, course_name: course_name || null, year, title, link, details: details || null, ip }));
    return r ? json(env, pub(r, u), 201) : err(env, 'Could not save. Try again.', 500);
  }

  const mm = path.match(/^\/api\/papers\/([0-9a-f-]{36})\/(like|remove)$/);
  if (mm && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const id = mm[1], p = await one(await sb(env, `papers?id=eq.${id}&hidden=eq.false`));
    if (!p) return err(env, 'Not found', 404);
    if (mm[2] === 'remove') {
      if (p.aid !== u.aid) return err(env, 'Only the person who shared it can remove it', 403);
      await patch(env, `papers?id=eq.${id}`, { hidden: true }); return json(env, { ok: true });
    }
    const had = await rows(await sb(env, `paper_likes?select=aid&paper_id=eq.${id}&aid=eq.${enc(u.aid)}`));
    if (had.length) await sb(env, `paper_likes?paper_id=eq.${id}&aid=eq.${enc(u.aid)}`, { method: 'DELETE' });
    else await post(env, 'paper_likes', { paper_id: id, aid: u.aid }, 'resolution=ignore-duplicates,return=representation');
    const n = (await rows(await sb(env, `paper_likes?select=aid&paper_id=eq.${id}&limit=5000`))).length;
    await patch(env, `papers?id=eq.${id}`, { likes: n });
    return json(env, { liked: !had.length, likes: n });
  }
  return null;
}
