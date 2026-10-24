// "My work" gallery for Services: a washing-machine repair, a haircut, a cake. The owner adds up to 6 photos and 2 short videos
// (uploads go through /api/media/upload-url with kind service_photo or service_video). Anyone can see them in the service card.
import * as store from './storage.js';
import { mediaUrl, MEDIA_BUCKET } from './storage.js';
import { json, err, sb, rows, one, patch, enc, inList, UUID, throttle, tooMany, user } from './lib.js';

export const SERVICE_PHOTOS = 6, SERVICE_VIDEOS = 2, SERVICE_VIDEO_MB = 15;

// Adds `works: [{ id, type: 'photo'|'video', url }]` to each service in a list.
export async function decorateServices(env, items) {
  const ids = items.map((x) => x.id);
  const m = ids.length ? await rows(await sb(env, `media?select=id,service_id,kind,r2_key&kind=in.(service_photo,service_video)&status=eq.ready&service_id=${inList(ids)}&order=created_at.asc`)) : [];
  return items.map((x) => ({ ...x, works: m.filter((w) => w.service_id === x.id).map((w) => ({ id: w.id, type: w.kind === 'service_video' ? 'video' : 'photo', url: mediaUrl(env, w.r2_key) })) }));
}

export async function serviceWorkRoutes(req, env, url, ip) {
  const mm = url.pathname.match(/^\/api\/services\/work\/([0-9a-f-]{36})\/remove$/);
  if (!mm || req.method !== 'POST') return null;
  const u = await user(req, env, true); if (u instanceof Response) return u;
  if (!UUID.test(mm[1])) return err(env, 'Not found', 404);
  if (!(await throttle(env, ip, 'swremove', u.aid, 60, 240))) return tooMany(env);
  const w = await one(await sb(env, `media?id=eq.${mm[1]}&aid=eq.${enc(u.aid)}&kind=in.(service_photo,service_video)`));
  if (!w) return err(env, 'Not found', 404);
  await store.remove(env, MEDIA_BUCKET(env), w.r2_key);
  await patch(env, `media?id=eq.${w.id}`, { status: 'hidden' });
  return json(env, { ok: true });
}
