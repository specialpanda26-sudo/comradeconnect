// Media (clips, listing photos), ID verification uploads, and Live (a link to a stream hosted on YouTube, Facebook, TikTok or Twitch).
import * as store from './storage.js';
import { viewerCounts } from './live.js';
import { mediaUrl, MEDIA_BUCKET, PRIVATE_BUCKET } from './storage.js';
import { isWholesaler } from './wholesale.js';
import { getSettings } from './settings.js';
import { HOSTEL_PHOTOS } from './hostels.js';
import { json, err, sb, rows, one, post, patch, enc, inList, str, int, UUID, randHex, throttle, tooMany, user, authProfile, isAdmin, ahead, DAY } from './lib.js';

const VERIFY_ROLES = ['Student', 'Class rep', 'Student leader', 'Club official', 'Hostel rep', 'Lecturer or staff', 'Local seller'];
const OFFICIAL_ROLES = ['Class rep', 'Hostel rep'];       // these also need a group link an admin can check
const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const VIDEO_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm' };
const limits = (env) => ({ photo: 5 * 1048576, clip: Number(env.CLIP_MAX_MB || 25) * 1048576 });

export async function mediaRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!/^\/api\/(media|clips|verify|live)/.test(path)) return null;
  const body = async () => (await req.json().catch(() => ({})));

  // ---- 1) ask for a signed upload URL (the browser then sends the file straight to Supabase Storage) ----
  if (path === '/api/media/upload-url' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body(), kind = b.kind, ct = String(b.content_type || '').toLowerCase(), bytes = int(b.bytes, 1, 1e9);
    if (!['clip', 'listing_photo', 'video', 'hostel_photo'].includes(kind)) return err(env, 'Unknown media type');
    const photo = kind === 'listing_photo' || kind === 'hostel_photo', ext = (photo ? PHOTO_TYPES : VIDEO_TYPES)[ct];
    if (!ext) return err(env, photo ? 'Photos must be JPG, PNG or WebP' : 'Videos must be MP4 or WebM');
    if (!bytes || bytes > (photo ? limits(env).photo : limits(env).clip)) return err(env, `File too large (max ${photo ? 5 : Number(env.CLIP_MAX_MB || 25)} MB)`);
    let listing_id = null, hostel_id = null;
    if (kind === 'hostel_photo') {                                   // room photos: only the caretaker who posted the vacancy
      if (!UUID.test(String(b.hostel_id || ''))) return err(env, 'Pick a hostel');
      const h = await one(await sb(env, `hostels?select=id&id=eq.${b.hostel_id}&aid=eq.${enc(u.aid)}&hidden=eq.false`));
      if (!h) return err(env, 'Hostel not found', 404);
      const have = await rows(await sb(env, `media?select=id&hostel_id=eq.${h.id}&kind=eq.hostel_photo&status=in.(pending,ready)`));
      if (have.length >= HOSTEL_PHOTOS) return err(env, `Up to ${HOSTEL_PHOTOS} photos per hostel`, 400);
      hostel_id = h.id;
    } else if (photo) {
      if (!UUID.test(String(b.listing_id || ''))) return err(env, 'Pick a listing');
      const l = await one(await sb(env, `listings?select=id&id=eq.${b.listing_id}&seller_aid=eq.${enc(u.aid)}&status=in.(pending,approved)`));
      if (!l) return err(env, 'Listing not found', 404);
      const have = await rows(await sb(env, `media?select=id&listing_id=eq.${l.id}&kind=eq.listing_photo&status=in.(pending,ready)`));
      const cap = isWholesaler(u) ? (await getSettings(env)).wholesale_photos : 5;
      if (have.length >= cap) return err(env, isWholesaler(u) ? `Up to ${cap} photos per listing` : 'Up to 5 photos per listing. Wholesalers can add more.', 400);
      listing_id = l.id;
    }
    if (!(await throttle(env, ip, 'upload:' + kind, u.aid, photo ? 30 : 5, photo ? 100 : 20))) return tooMany(env);
    const key = `${kind}/${new Date().toISOString().slice(0, 7)}/${randHex(12)}.${ext}`;
    const mres = await post(env, 'media', { aid: u.aid, kind, r2_key: key, content_type: ct, bytes, caption: str(b.caption, 140) || null, listing_id, ...(hostel_id ? { hostel_id } : {}) });
    const mtext = await mres.text().catch(() => ''); let row = null; try { const d = JSON.parse(mtext); row = Array.isArray(d) ? d[0] : null; } catch (e) {}
    if (!row) { console.error('media insert failed', mres.status, mtext.slice(0, 400)); return err(env, 'Could not start the upload', 500); }
    const upload_url = await store.signUpload(env, MEDIA_BUCKET(env), key);
    if (!upload_url) { await patch(env, `media?id=eq.${row.id}`, { status: 'hidden' }); return err(env, 'File storage is not ready. Try again later.', 503); }
    return json(env, { id: row.id, upload_url, content_type: ct, expires_in: 7200 }, 201);
  }
  // ---- 2) tell us the upload finished; we check the real file in storage ----
  let mm = path.match(/^\/api\/media\/([0-9a-f-]{36})\/complete$/);
  if (mm && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const row = await one(await sb(env, `media?id=eq.${mm[1]}&aid=eq.${enc(u.aid)}&status=eq.pending`));
    if (!row) return err(env, 'Upload not found', 404);
    const head = await store.head(env, MEDIA_BUCKET(env), row.r2_key);
    if (!head) return err(env, 'The file did not arrive. Try again.', 409);
    const max = row.kind === 'listing_photo' || row.kind === 'hostel_photo' ? limits(env).photo : limits(env).clip;
    if (head.size > max) { await store.remove(env, MEDIA_BUCKET(env), row.r2_key); await patch(env, `media?id=eq.${row.id}`, { status: 'hidden' }); return err(env, 'File too large', 413); }
    // The first bytes must match the type that was declared, so a renamed script or document is never published.
    if (store.sniff(await store.peek(env, MEDIA_BUCKET(env), row.r2_key)) !== row.content_type) { await store.remove(env, MEDIA_BUCKET(env), row.r2_key); await patch(env, `media?id=eq.${row.id}`, { status: 'hidden' }); return err(env, 'That file is not a real ' + (row.kind === 'listing_photo' || row.kind === 'hostel_photo' ? 'photo' : 'video'), 415); }
    await patch(env, `media?id=eq.${row.id}`, { status: 'ready', bytes: head.size });
    return json(env, { id: row.id, url: mediaUrl(env, row.r2_key), status: 'ready' });
  }

  // ---- clips ----
  if (path === '/api/clips' && m === 'GET') {
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1), limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit')) || 8));
    const r = await rows(await sb(env, `media?kind=in.(clip,video)&status=eq.ready&order=created_at.desc&limit=${limit + 1}&offset=${(page - 1) * limit}`));
    const list = r.slice(0, limit), me = req.headers.get('X-Token') ? await authProfile(req, env) : null;
    const liked = me && list.length ? await rows(await sb(env, `media_likes?select=media_id&aid=eq.${enc(me.aid)}&media_id=${inList(list.map((x) => x.id))}`)) : [];
    return json(env, { clips: list.map((x) => ({ id: x.id, url: mediaUrl(env, x.r2_key), kind: x.kind, caption: x.caption, likes: x.likes, liked: liked.some((l) => l.media_id === x.id), mine: !!me && me.aid === x.aid, createdAt: Date.parse(x.created_at) })), hasMore: r.length > limit });
  }
  mm = path.match(/^\/api\/clips\/([0-9a-f-]{36})\/like$/);
  if (mm && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    if (!(await throttle(env, ip, 'cliplike', u.aid, 200, 800))) return tooMany(env);
    const c = await one(await sb(env, `media?id=eq.${mm[1]}&status=eq.ready`)); if (!c) return err(env, 'Not found', 404);
    const ins = await rows(await post(env, 'media_likes', { media_id: c.id, aid: u.aid }, 'resolution=ignore-duplicates,return=representation'));
    if (!ins.length) return json(env, { likes: c.likes, liked: true });
    const r = await sb(env, 'rpc/inc_likes', { method: 'POST', body: JSON.stringify({ t: 'media', p: c.id }) });
    return json(env, { likes: await r.json().catch(() => c.likes + 1), liked: true });
  }

  // ---- ID verification (private bucket, image deleted after the decision) ----
  if (path === '/api/verify/upload-url' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body(), ct = String(b.content_type || '').toLowerCase(), ext = PHOTO_TYPES[ct], bytes = int(b.bytes, 1, 1e9);
    if (!ext || ext === 'webp') return err(env, 'Use a JPG or PNG photo');
    if (!bytes || bytes > limits(env).photo) return err(env, 'Photo too large (max 5 MB)');
    if (!(await throttle(env, ip, 'verifyup', u.aid, 5, 20))) return tooMany(env);
    const key = `verif/${randHex(16)}.${ext}`;
    const upload_url = await store.signUpload(env, PRIVATE_BUCKET(env), key);
    if (!upload_url) return err(env, 'File storage is not ready. Try again later.', 503);
    return json(env, { r2_key: key, upload_url, content_type: ct, expires_in: 7200 });
  }
  if (path === '/api/verify/submit' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body(), key = String(b.r2_key || ''), name = str(b.full_name, 80);
    if (!/^verif\/[0-9a-f]{32}\.(jpg|png)$/.test(key) || name.length < 3) return err(env, 'Add your full name and a photo of your ID');
    const role = b.role === undefined || b.role === '' ? 'Student' : String(b.role);
    if (!VERIFY_ROLES.includes(role)) return err(env, 'Pick a role from the list');
    const idNo = str(b.id_number, 30);
    if (idNo && !/^[A-Za-z0-9\/ .-]{3,30}$/.test(idNo)) return err(env, 'The admission or staff number has odd characters');
    const link = str(b.group_link, 200);
    if (OFFICIAL_ROLES.includes(role) && !/^https?:\/\/\S+\.\S+$/.test(link)) return err(env, 'Paste the link to your group so an admin can check your role');
    if (link && !/^https?:\/\/\S+\.\S+$/.test(link)) return err(env, 'That group link does not look right');
    const bc = ['match', 'mismatch', 'unread', 'unsupported', 'none'].includes(b.barcode) ? b.barcode : 'none';
    if (!(await store.head(env, PRIVATE_BUCKET(env), key))) return err(env, 'The photo did not arrive. Try again.', 409);
    if (!['image/jpeg', 'image/png'].includes(store.sniff(await store.peek(env, PRIVATE_BUCKET(env), key)))) { await store.remove(env, PRIVATE_BUCKET(env), key); return err(env, 'That file is not a JPG or PNG photo', 415); }
    const open = await one(await sb(env, `verifications?select=id&aid=eq.${enc(u.aid)}&status=eq.pending`));
    if (open) return err(env, 'You already have a request waiting for review', 409);
    if (u.verified && (role === 'Student' || role === 'Local seller')) return err(env, 'Your ID is already verified', 409);
    const v = await one(await post(env, 'verifications', { aid: u.aid, r2_key: key, full_name: name, claimed_role: role, id_number: idNo || null, group_link: link || null, barcode_check: bc, purge_after: ahead(30 * DAY) }));
    return v ? json(env, { id: v.id, status: 'pending' }, 201) : err(env, 'Could not save', 500);
  }
  if (path === '/api/verify/status' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const v = await one(await sb(env, `verifications?select=status,decision_note,claimed_role,barcode_check,created_at&aid=eq.${enc(u.aid)}&order=created_at.desc&limit=1`));
    return json(env, { verified: !!u.verified, badge: u.badge || null, request: v || null });
  }

  // ---- Live: the host streams on YouTube / Facebook / TikTok / Twitch (free) and pastes the live link here. Hosts: admin key, or a profile with role club_admin/admin ----
  if (path === '/api/live' && m === 'GET') {
    const r = await rows(await sb(env, 'live_streams?status=eq.live&order=created_at.desc&limit=10'));
    const vc = await viewerCounts(env, r.map((s) => s.id));
    return json(env, { streams: r.map((s) => ({ id: s.id, title: s.title, watch_url: s.input_uid, embed_url: liveEmbed(s.input_uid), startedAt: Date.parse(s.created_at), viewers: vc[s.id] || 0, hearts: s.hearts || 0 })) });
  }
  if (path === '/api/live/start' && m === 'POST') {
    let hostAid = 'admin';
    if (!isAdmin(req, env)) { const u = await user(req, env, true); if (u instanceof Response) return u; if (!(await throttle(env, ip, 'livestart', u.aid, 20, 40))) return tooMany(env); hostAid = u.aid; }   // anyone with an account can go live
    const b = await body(), title = str(b.title, 80) || 'Live', link = liveLink(b.url);
    if (!link) return err(env, 'Paste the live link from YouTube, Facebook, TikTok or Twitch (it must start with https://)');
    await patch(env, `live_streams?host_aid=eq.${enc(hostAid)}&status=eq.live`, { status: 'ended', ended_at: new Date().toISOString() });
    const s = await one(await post(env, 'live_streams', { host_aid: hostAid, title, input_uid: link }));   // input_uid now holds the watch link
    return s ? json(env, { id: s.id, watch_url: link, embed_url: liveEmbed(link) }, 201) : err(env, 'Could not start', 500);
  }
  mm = path.match(/^\/api\/live\/([0-9a-f-]{36})\/end$/);
  if (mm && m === 'POST') {
    const admin = isAdmin(req, env); let aid = 'admin';
    if (!admin) { const u = await user(req, env, true); if (u instanceof Response) return u; aid = u.aid; }
    const s = await one(await sb(env, `live_streams?id=eq.${mm[1]}&status=eq.live`)); if (!s) return err(env, 'Not found', 404);
    if (!admin && s.host_aid !== aid) return err(env, 'Not your stream', 403);
    await patch(env, `live_streams?id=eq.${s.id}&status=eq.live`, { status: 'ended', ended_at: new Date().toISOString() });
    return json(env, { ok: true });
  }
  return null;
}

// ---- Live links ----
const LIVE_HOSTS = /^(www\.|m\.)?(youtube\.com|youtu\.be|facebook\.com|fb\.watch|tiktok\.com|vm\.tiktok\.com|twitch\.tv)$/i;
export function liveLink(v) {
  let u; try { u = new URL(String(v || '').trim()); } catch { return null; }
  if (u.protocol !== 'https:' || !LIVE_HOSTS.test(u.hostname) || u.username || u.password) return null;
  return u.toString().slice(0, 300);
}
// Only YouTube links can be shown inside the app; the others open in their own app.
export function liveEmbed(link) {
  try {
    const u = new URL(link); let id = null;
    if (/youtu\.be$/i.test(u.hostname)) id = u.pathname.slice(1);
    else if (/youtube\.com$/i.test(u.hostname)) id = u.searchParams.get('v') || (u.pathname.match(/^\/(live|embed)\/([\w-]{6,20})/) || [])[2];
    return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch { return null; }
}

// ---- Free-plan housekeeping (called from the cron): stay under the 1 GB storage limit ----
export async function pruneMedia(env) {
  const out = { stale: 0, pruned: 0 };
  // uploads that were never completed
  const stale = await rows(await sb(env, `media?select=id,r2_key&status=eq.pending&created_at=lte.${new Date(Date.now() - 24 * 3600e3).toISOString()}&limit=50`));
  for (const x of stale) { await store.remove(env, MEDIA_BUCKET(env), x.r2_key); await patch(env, `media?id=eq.${x.id}`, { status: 'hidden' }); }
  out.stale = stale.length;
  // oldest clips go first when the total is over budget (photos are small and are kept)
  const budget = Number(env.MEDIA_BUDGET_MB || 800) * 1048576;
  const ready = await rows(await sb(env, 'media?select=id,r2_key,bytes,kind&status=eq.ready&order=created_at.asc&limit=5000'));
  let total = ready.reduce((n, x) => n + Number(x.bytes || 0), 0);
  for (const x of ready) {
    if (total <= budget || out.pruned >= 20) break;
    if (x.kind === 'listing_photo' || x.kind === 'hostel_photo') continue;
    await store.remove(env, MEDIA_BUCKET(env), x.r2_key);
    await patch(env, `media?id=eq.${x.id}`, { status: 'hidden' });
    total -= Number(x.bytes || 0); out.pruned++;
  }
  return out;
}
