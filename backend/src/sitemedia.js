// Landing page pictures + per-tab background pictures. Adds fields to the Site editor and an admin-only upload route.
import { FIELDS } from './sitecontent.js';
import { json, err, randHex, isAdmin } from './lib.js';
import * as store from './storage.js';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const G = 'Landing & backgrounds';
const add = {
  landing_off: { kind: 'flag', group: G, label: 'Turn OFF the landing page', help: 'Skips the page people see before logging in.' },
  landing_brand: { kind: 'flag', group: G, label: 'Show logo and name over the pictures', help: 'Off by default: when you upload pictures, they replace the logo and the Comrade Connect name.' },
  landing_captions: { kind: 'text', max: 600, multi: true, group: G, label: 'Slide words', help: 'One slide per line: Title | small text' },
  landing_cta: { kind: 'text', max: 30, group: G, label: 'Main button text', help: 'Built-in: Get started' },
  landing_login_q: { kind: 'text', max: 50, group: G, label: 'Words before Log in', help: 'Built-in: Already have an account?' },
};
for (let i = 1; i <= 5; i++) add['landing_img_' + i] = { kind: 'link', max: 500, group: G, label: 'Landing picture ' + i };
for (const k of ['all', 'feed', 'videos', 'live', 'market', 'explore', 'rewards', 'me']) add['bg_' + k] = { kind: 'link', max: 500, group: G, label: 'Background: ' + k };
for (const k of ['main', 'header', 'loader', 'lock', 'landing', 'welcome', 'receipt', 'popups']) add['logo_' + k] = { kind: 'link', max: 500, group: 'Logos', label: 'Logo: ' + k };
Object.assign(FIELDS, add);

export async function siteMediaRoutes(req, env, url) {
  if (url.pathname !== '/api/admin/site-upload-url' || req.method !== 'POST') return null;
  if (!isAdmin(req, env)) return err(env, 'Wrong admin key', 403);
  const b = await req.json().catch(() => ({})), ext = TYPES[String(b.content_type || '').toLowerCase()];
  if (!ext) return err(env, 'Picture must be JPG, PNG or WebP');
  const key = `site/${randHex(12)}.${ext}`, upload_url = await store.signUpload(env, store.MEDIA_BUCKET(env), key);
  if (!upload_url) return err(env, 'File storage is not ready', 503);
  return json(env, { key, upload_url, url: store.mediaUrl(env, key) }, 201);
}
