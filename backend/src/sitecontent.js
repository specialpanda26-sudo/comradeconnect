// Site editor: lets the admin change the words, links, banner, switches and extra styling of the public site
// without touching code. Values live in the `site_content` table; an empty value means "use the built-in text".
// Public read: GET /api/site-content. Admin read/write: GET and POST /api/admin/site-content (X-Admin-Key).
import { json, err, sb, rows, post, str, isAdmin, audit } from './lib.js';

const HTTPS = /^https:\/\/[^\s<>"']+$/i;
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

// kind: text | link | email | flag | css.  group/label/help are shown in the admin panel.
export const FIELDS = {
  banner_on: { kind: 'flag', group: 'Announcement banner', label: 'Show the banner', help: 'A thin message bar at the top of every page.' },
  banner_text: { kind: 'text', max: 160, group: 'Announcement banner', label: 'Banner message', help: 'Example: Fresher bash this Friday. Tickets in Club.' },
  banner_link: { kind: 'link', group: 'Announcement banner', label: 'Banner link (optional)', help: 'Must start with https://' },

  notice_on: { kind: 'flag', group: 'Notification bell', label: 'Show a notification', help: 'Every visitor sees a red dot on the bell until they open it. Use it for maintenance or news.' },
  notice_title: { kind: 'text', max: 60, group: 'Notification bell', label: 'Notification title', help: 'Example: Maintenance tonight' },
  notice_text: { kind: 'text', max: 300, group: 'Notification bell', label: 'Notification message', multi: true, help: 'Example: The Market will be down from 10pm to 11pm.' },

  chip_1: { kind: 'text', max: 40, group: 'Home countdown chips', label: 'Chip 1', help: 'Small pill under the Spill it card. Example: CATs in 12 days. Empty = hidden.' },
  chip_2: { kind: 'text', max: 40, group: 'Home countdown chips', label: 'Chip 2', help: 'Example: Semester ends in 6 weeks' },
  chip_3: { kind: 'text', max: 40, group: 'Home countdown chips', label: 'Chip 3', help: 'Example: Strike watch: 0 days' },

  hero_greeting: { kind: 'text', max: 60, group: 'Home page words', label: 'Greeting above the title', help: 'Built-in: Niaje comrade,' },
  hero_title: { kind: 'text', max: 120, group: 'Home page words', label: 'Main title', help: 'Built-in: Spill it. Nobody will know it was you.' },
  hero_text: { kind: 'text', max: 400, group: 'Home page words', label: 'Paragraph under the title', multi: true },
  cta_primary: { kind: 'text', max: 40, group: 'Home page words', label: 'Main button text', help: 'Built-in: Drop Tea / Spill Secret' },
  cta_tour: { kind: 'text', max: 40, group: 'Home page words', label: 'Tour button text', help: 'Built-in: Take the 1-minute tour' },
  live_intro: { kind: 'text', max: 300, group: 'Home page words', label: 'Words at the top of Live', multi: true },
  footer_text: { kind: 'text', max: 300, group: 'Home page words', label: 'Footer message', multi: true },

  social_whatsapp: { kind: 'link', group: 'Links and contact', label: 'WhatsApp link' },
  social_instagram: { kind: 'link', group: 'Links and contact', label: 'Instagram link' },
  social_tiktok: { kind: 'link', group: 'Links and contact', label: 'TikTok link' },
  social_x: { kind: 'link', group: 'Links and contact', label: 'X link' },
  social_youtube: { kind: 'link', group: 'Links and contact', label: 'YouTube link' },
  social_telegram: { kind: 'link', group: 'Links and contact', label: 'Telegram link' },
  social_facebook: { kind: 'link', group: 'Links and contact', label: 'Facebook link' },
  social_website: { kind: 'link', group: 'Links and contact', label: 'Website link' },
  contact_email: { kind: 'email', group: 'Links and contact', label: 'Contact email' },

  welcome_title: { kind: 'text', max: 60, group: 'Welcome bonus message', label: 'Title', help: 'Shown to a new account that gets the welcome bonus. Built-in: Welcome to Comrade Connect' },
  welcome_text: { kind: 'text', max: 160, group: 'Welcome bonus message', label: 'Message', multi: true, help: 'Type {amount} where the KSh amount should go. Built-in: KSh {amount} was added to your wallet.' },

  min_app_build: { kind: 'text', max: 6, group: 'App updates', label: 'Oldest app build allowed', help: 'The last number of the app version: version 1.0.57 is build 57. Phones with an older build see "Update required" and cannot use the app until they update. Empty = nobody is forced. Only enter a build that is already released, and only phones that already have this update can be forced.' },
  update_text: { kind: 'text', max: 200, group: 'App updates', label: 'Words on the update-required screen', multi: true, help: 'Built-in: This version is too old and no longer works. Please update to keep using Comrade Connect.' },

  getapp_on: { kind: 'flag', group: 'Get the app (website only)', label: 'Show a "Get the app" card to website visitors', help: 'A small card above the menu bar. It is never shown inside the app. Closing it hides it for 3 days.' },
  getapp_text: { kind: 'text', max: 120, group: 'Get the app (website only)', label: 'Card words', help: 'Built-in: Get the free app: faster, with phone alerts.' },

  lock_image: { kind: 'link', max: 500, group: 'App look', label: 'Lock screen picture', help: 'Photo behind the lock screen. Tap Upload and choose a picture from your phone. Empty = plain dark colour.' },
  lock_greeting: { kind: 'text', max: 40, group: 'App look', label: 'Lock screen greeting', help: 'Built-in: Welcome back!' },

  hide_videos: { kind: 'flag', group: 'Switch parts off', label: 'Hide Videos' },
  hide_live: { kind: 'flag', group: 'Switch parts off', label: 'Hide Live' },
  hide_market: { kind: 'flag', group: 'Switch parts off', label: 'Hide Market' },
  hide_rewards: { kind: 'flag', group: 'Switch parts off', label: 'Hide Rewards' },
  maintenance_on: { kind: 'flag', group: 'Maintenance', label: 'Show a "back soon" cover', help: 'Visitors see the message below instead of the app. Use it while you fix something.' },
  maintenance_text: { kind: 'text', max: 300, group: 'Maintenance', label: 'Maintenance message', multi: true },

  custom_css: { kind: 'css', max: 4000, group: 'Advanced styling', label: 'Extra CSS', help: 'Applied on top of the site design. Colours, sizes, hiding things. Leave empty for the normal look.', multi: true },
};

// Returns the clean value ('' = cleared) or { error }.
export function cleanField(key, v) {
  const f = FIELDS[key];
  if (!f) return { error: 'Unknown field: ' + key };
  if (f.kind === 'flag') return v === true || v === 1 || v === '1' || v === 'true' ? '1' : '';
  const s = str(v, f.max || 200);
  if (!s) return '';
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s)) return { error: f.label + ': unsupported characters' };
  if (f.kind === 'link') return HTTPS.test(s) ? s : { error: f.label + ' must start with https://' };
  if (f.kind === 'email') return EMAIL.test(s) ? s : { error: f.label + ': enter a real email address' };
  if (f.kind === 'css') {
    if (/<|@import|javascript:|expression\s*\(|behavior\s*:/i.test(s)) return { error: 'Extra CSS cannot contain tags, @import or scripts' };
    return s;
  }
  if (/[<>]/.test(s)) return { error: f.label + ': please remove < and >' };
  return s;
}

const CACHE = new WeakMap(), TTL = 10e3;
export async function getContent(env) {
  const c = CACHE.get(env);
  if (c && Date.now() - c.at < TTL) return c.vals;
  const vals = {};
  try {
    for (const r of await rows(await sb(env, 'site_content?select=key,value'))) {
      if (FIELDS[r.key] && typeof r.value === 'string' && r.value !== '') vals[r.key] = r.value;
    }
  } catch (e) { /* table not created yet: the built-in site shows */ }
  CACHE.set(env, { at: Date.now(), vals });
  return vals;
}

export async function siteContentRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (path === '/api/site-content' && m === 'GET') {
    const res = json(env, { content: await getContent(env) });
    res.headers.set('Cache-Control', 'public, max-age=30');
    return res;
  }
  if (path !== '/api/admin/site-content') return null;
  if (!isAdmin(req, env)) return err(env, 'Wrong admin key', 403);
  if (m === 'GET') {
    const cur = await getContent(env);
    return json(env, { fields: Object.entries(FIELDS).map(([key, f]) => ({ key, kind: f.kind, group: f.group, label: f.label, help: f.help || '', max: f.max || 0, multi: !!f.multi, value: cur[key] || '' })) });
  }
  if (m !== 'POST') return err(env, 'Not found', 404);
  const input = (await req.json().catch(() => ({}))).values;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return err(env, 'Nothing to save');
  const cur = await getContent(env), out = {};
  for (const [k, v] of Object.entries(input)) {
    const c = cleanField(k, v);
    if (c && typeof c === 'object') return err(env, c.error);
    if (c !== (cur[k] || '')) out[k] = c;
  }
  for (const [k, v] of Object.entries(out)) {
    const res = await post(env, 'site_content', { key: k, value: v, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=representation');
    if (!res.ok) {
      const t = await res.text().catch(() => ''); console.error('site_content save failed', res.status, t.slice(0, 300));
      return err(env, /does not exist|schema cache|relation|PGRST20/i.test(t) ? 'The site_content table is missing in Supabase. Run the catch-up SQL in the Supabase SQL editor, then save again.' : 'Could not save (' + res.status + '): ' + t.slice(0, 140), 500);
    }
  }
  CACHE.delete(env);
  if (Object.keys(out).length) await audit(env, 'site.update', 'site_content', null, { keys: Object.keys(out) }, ip);
  return json(env, { ok: true, changed: Object.keys(out).length });
}
