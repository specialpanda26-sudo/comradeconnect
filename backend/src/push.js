// Phone alerts for the Android app (Firebase Cloud Messaging). Website push is switched off for good.
// Needs one setting: FCM_SERVICE_ACCOUNT.
// Everything here is best effort: a failed push never breaks the action that caused it.
import { json, err, sb, rows, one, post, enc, user, throttle, tooMany } from './lib.js';

const te = new TextEncoder();
const b64u = (buf) => { let s = ''; new Uint8Array(buf).forEach((c) => { s += String.fromCharCode(c); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s) => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const r = atob(s), o = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; };


// ---- Android app (Firebase Cloud Messaging) ----
// Needs FCM_SERVICE_ACCOUNT: the Firebase service account JSON (pasted as is, or as base64).
function fcmAccount(env) {
  try {
    const raw = String(env.FCM_SERVICE_ACCOUNT || '').trim(); if (!raw) return null;
    const j = JSON.parse(raw[0] === '{' ? raw : atob(raw));
    return j.client_email && j.private_key && j.project_id ? j : null;
  } catch (e) { return null; }
}
let fcmTok = { v: '', exp: 0 };
async function fcmAccess(acc) {
  const ck = acc.client_email + ':' + String(acc.private_key).slice(-40);
  if (fcmTok.v && fcmTok.k === ck && Date.now() < fcmTok.exp - 60000) return fcmTok.v;
  const der = unb64u(acc.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(te.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64u(te.encode(JSON.stringify({ iss: acc.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })));
  const sig = b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, te.encode(head + '.' + claims)));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + claims + '.' + sig });
  const d = await r.json();
  if (!d.access_token) throw new Error('FCM sign-in failed' + (d.error ? ': ' + d.error + (d.error_description ? ' (' + d.error_description + ')' : '') : ''));
  fcmTok = { v: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000, k: ck };
  return fcmTok.v;
}
// cc-fix6: what each phone receives. App versions that carry the native notification service saved their token as 'fcm2':
// they get a data-only message (title and text inside data) and build the grouped / chat-style notification themselves.
// Older app versions keep the plain banner so nobody loses notifications while they update.
const dstr = (v, n) => String(v == null ? '' : v).slice(0, n);
export function fcmMessage(s, payload) {
  const p = payload || {}, token = String(s.endpoint || '').slice(4);
  const title = dstr(p.title || 'Comrade Connect', 80), text = dstr(p.body, 240);
  const data = { view: dstr(p.view, 24), cat: dstr(p.cat, 16), kind: dstr(p.kind, 24), ref_type: dstr(p.ref_type, 24), ref_id: dstr(p.ref_id, 64) };
  if (s.p256dh !== 'fcm2') {
    return { message: { token, notification: { title, body: text }, data, android: { priority: 'HIGH', notification: { tag: dstr(p.tag || 'cc', 40), channel_id: 'cc_alerts', color: '#101422', notification_priority: 'PRIORITY_HIGH', visibility: 'PUBLIC', default_sound: true, default_vibrate_timings: true } } } };
  }
  const cid = dstr(p.cid, 80), rep = dstr(p.rep, 40);
  const android = { priority: 'HIGH', ttl: dstr(p.ttl || '86400s', 12) };
  if (rep) android.collapse_key = rep;                       // live and app-update replace each other; chats and orders never collapse
  return { message: { token, data: { ...data, cc: '2', cid, rep, sender: dstr(p.sender, 40), title, body: text, ts: String(Date.now()) }, android,
    apns: { headers: { 'apns-priority': '10' }, payload: { aps: { alert: { title, body: text }, sound: 'default', 'thread-id': dstr(cid || rep || p.cat || 'cc', 64) } } } } };
}
export async function sendFcm(env, s, payload) {
  const acc = fcmAccount(env); if (!acc) return;
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${acc.project_id}/messages:send`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + (await fcmAccess(acc)), 'Content-Type': 'application/json' },
    body: JSON.stringify(fcmMessage(s, payload))
  });
  const detail = r.ok ? '' : (await r.text().catch(() => '')).slice(0, 300);
  if (!r.ok) console.error('FCM send failed', r.status, detail);
  if (r.status === 404) await sb(env, `push_subs?endpoint=eq.${enc(s.endpoint)}`, { method: 'DELETE' });   // the app was removed from that phone
  return { ok: r.ok, status: r.status, detail };
}

// ---- cc-pushcheck: find out which link in the chain is broken (phone > server > Firebase) ----
// GET /api/push/status[?deep=1]  what the server knows about this account and its Firebase key
// POST /api/push/test {delay?}    sends one real test alert to this account's phones and says exactly what Firebase answered
const LAST_TEST = new Map();   // aid -> last test result (one API instance, see render.yaml)
const tail = (s) => '...' + String(s || '').slice(-6);
function fcmErr(detail) {
  let j = null; try { j = JSON.parse(detail); } catch (e) { /* not JSON */ }
  const e = (j && j.error) || {}, det = Array.isArray(e.details) ? e.details.find((x) => x && x.errorCode) : null;
  return { code: String((det && det.errorCode) || e.status || ''), message: String(e.message || detail || '').slice(0, 240) };
}
export function fcmHint(status, detail) {
  if (status === 200) return 'Firebase accepted it.';
  const { code, message } = fcmErr(detail);
  if (code === 'SENDER_ID_MISMATCH') return 'The phone address was made by a DIFFERENT Firebase project than the key on Render. google-services.json in the GitHub build and FCM_SERVICE_ACCOUNT on Render must come from the SAME Firebase project. Fix one of them, rebuild the app, open it and sign in again.';
  if (code === 'UNREGISTERED' || status === 404) return 'Firebase no longer knows this phone address (the app was reinstalled or its data was cleared). Open the app, sign in, and tap Allow alerts again.';
  if (/has not been used|is disabled|SERVICE_DISABLED/i.test(message)) return 'The Firebase Cloud Messaging API is switched off for this project. In Google Cloud console open APIs and Services, search "Firebase Cloud Messaging API" and press Enable.';
  if (code === 'PERMISSION_DENIED' || status === 403) return 'The key on Render is not allowed to send. In Firebase open Project settings > Service accounts > Generate new private key, and paste the whole file into FCM_SERVICE_ACCOUNT on Render.';
  if (code === 'UNAUTHENTICATED' || status === 401) return 'Firebase refused the key on Render. Generate a new private key in Firebase and paste the whole file into FCM_SERVICE_ACCOUNT again.';
  if (code === 'INVALID_ARGUMENT' || status === 400) return 'Firebase says this phone address is not valid. Open the app and tap Allow alerts again.';
  if (code === 'QUOTA_EXCEEDED' || status === 429) return 'Firebase is limiting sends for a moment. Try again in a minute.';
  if (status >= 500) return 'Firebase had a problem on its side. Try again in a minute.';
  return 'Firebase refused it (' + status + '). ' + message;
}
const signinHint = (e) => 'Render could not sign in to Firebase with FCM_SERVICE_ACCOUNT (' + String((e && e.message) || e).slice(0, 160) + '). The key is wrong, was deleted, or the server clock is off. Generate a new private key in Firebase and paste the whole file again.';
const noKeyHint = (env) => String(env.FCM_SERVICE_ACCOUNT || '').trim()
  ? 'FCM_SERVICE_ACCOUNT is set on Render but is not a usable key. It must be the whole JSON file from Firebase (Project settings > Service accounts > Generate new private key); it has to contain client_email, private_key and project_id. Paste it again with nothing cut off.'
  : 'FCM_SERVICE_ACCOUNT is not set on Render. In Firebase open Project settings > Service accounts > Generate new private key, then paste the whole file into the FCM_SERVICE_ACCOUNT environment variable on Render and redeploy.';
async function phonesOf(env, aid) {
  return (await rows(await sb(env, `push_subs?select=endpoint,p256dh&aid=eq.${enc(aid)}&limit=20`))).filter((x) => String(x.endpoint || '').startsWith('fcm:'));
}
export async function pushTest(env, aid) {
  const acc = fcmAccount(env);
  let out;
  if (!acc) out = { ok: false, step: 'server_key', message: noKeyHint(env), devices: [] };
  else {
    const subs = await phonesOf(env, aid);
    if (!subs.length) out = { ok: false, step: 'no_phone', message: 'This account has no phone saved on the server. Open the Android app, sign in, tap Allow alerts, then test again.', devices: [] };
    else {
      const payload = { title: 'Test alert', body: 'If you can read this, phone alerts work.', view: 'bell', tag: 'cc-test', kind: 'test', ref_type: 'test', rep: 'cc-test', ttl: '300s' };
      const devices = [];
      for (const s of subs) {
        const d = { phone: tail(s.endpoint), app: s.p256dh === 'fcm2' ? 'new' : 'old' };
        try {
          const r = await sendFcm(env, s, payload);
          Object.assign(d, { ok: !!(r && r.ok), status: r ? r.status : 0, hint: r ? fcmHint(r.status, r.detail) : noKeyHint(env) });
        } catch (e) { Object.assign(d, { ok: false, status: 0, hint: signinHint(e) }); }
        devices.push(d);
      }
      const ok = devices.some((d) => d.ok);
      out = { ok, step: ok ? 'sent' : 'firebase', message: ok ? 'Firebase accepted the test alert.' : (devices[0] && devices[0].hint) || 'Firebase refused the test alert.', devices };
    }
  }
  out.at = Date.now();
  LAST_TEST.set(aid, out);
  return out;
}

// ---- What each person wants to hear about (Me > Notifications, or the Alerts button in the bell). Everything is on until they switch it off. ----
export const PUSH_CATS = ['comments', 'live', 'events', 'orders', 'wallet', 'messages', 'updates'];
const KIND_CAT = { comment: 'comments', reel_comment: 'comments', clip_comment: 'comments', like_milestone: 'comments', live_comment: 'comments', story_view: 'comments', order: 'orders', listing: 'orders', payout: 'wallet', /* cc-fix1 */ gift: 'wallet', reward: 'wallet', referral: 'wallet', message: 'messages', payment: 'wallet', club: 'orders' };
export const catOfKind = (k) => KIND_CAT[k] || 'updates';
export const cleanPrefs = (src) => { const o = {}; PUSH_CATS.forEach((c) => { o[c] = !(src && typeof src === 'object' && src[c] === false); }); return o; };
async function prefsOf(env, aid) {
  try { const r = await one(await sb(env, `notif_prefs?select=prefs&aid=eq.${enc(aid)}`)); return cleanPrefs(r && r.prefs); } catch (e) { return cleanPrefs(null); }
}

// Sends one notification to the phones this person allowed (the Android app). Website push is switched off for good:
// any old browser subscription is deleted the next time we meet it. A person who switched this kind off hears nothing.
export async function sendPush(env, aid, payload) {
  try {
    if (!aid) return;
    if (payload && payload.cat && !(await prefsOf(env, aid))[payload.cat]) return;
    const subs = await rows(await sb(env, `push_subs?select=endpoint,p256dh,auth&aid=eq.${enc(aid)}&limit=10`));
    if (!subs.length) return;
    await Promise.all(subs.map(async (s) => {
      try {
        if (s.endpoint.startsWith('fcm:')) { await sendFcm(env, s, payload); return; }
        await sb(env, `push_subs?endpoint=eq.${enc(s.endpoint)}`, { method: 'DELETE' });
      } catch (e) { console.error('push to one phone failed', e && e.message); }
    }));
  } catch (e) { console.error('push failed', e && e.message); }
}

// One notification to every app phone whose owner has this kind switched on (new live, new event). Best effort, never throws.
async function broadcast(env, cat, payload, skipAid) {
  const subs = (await rows(await sb(env, 'push_subs?select=endpoint,aid,p256dh&endpoint=like.fcm:*&limit=1500'))).filter((s) => s.aid && s.aid !== skipAid);
  if (!subs.length) return 0;
  let off = new Set();
  try { off = new Set((await rows(await sb(env, `notif_prefs?select=aid&prefs->>${cat}=eq.false&limit=5000`))).map((r) => r.aid)); } catch (e) { /* table not made yet: everyone is on */ }
  const to = subs.filter((s) => !off.has(s.aid));
  let ok = 0;   // cc-fix10
  for (let i = 0; i < to.length; i += 25) await Promise.all(to.slice(i, i + 25).map((s) => sendFcm(env, s, payload).then((r) => { if (r && r.ok) ok++; }).catch((e) => { console.error('broadcast send failed', e && e.message); })));
  console.log('broadcast ' + cat + ': phones=' + subs.length + ' switched_off=' + (subs.length - to.length) + ' accepted=' + ok);
  return to.length;
}
const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
export const announceLive = (env, hostAid, title, streamId) => within(broadcast(env, 'live', { title: 'Someone is live now', body: title && title !== 'Live' ? String(title).slice(0, 80) : 'Tap to watch', view: 'live', tag: 'live', cat: 'live', kind: 'live', ref_type: 'live', ref_id: streamId || '', rep: 'live', ttl: '1800s' }, hostAid).catch(() => 0), 6000);
export const announceEvent = (env, ownerAid, title) => within(broadcast(env, 'events', { title: 'New event', body: String(title || '').slice(0, 80), view: 'bell', tag: 'event', cat: 'events', kind: 'event', ref_type: 'event' }, ownerAid).catch(() => 0), 6000);

const LIVE_C = new Map();   // cc-fix10
export const announceLiveComment = (env, hostAid, streamId, text) => {
  try {
    if (!hostAid || hostAid === 'admin' || Date.now() - (LIVE_C.get(streamId) || 0) < 15000) return Promise.resolve();
    LIVE_C.set(streamId, Date.now()); if (LIVE_C.size > 500) LIVE_C.clear();
    return sendPush(env, hostAid, { title: 'New comment on your live', body: String(text || 'Someone commented').slice(0, 100), view: 'live', tag: 'live-comment', cat: 'comments', kind: 'live_comment', ref_type: 'live', ref_id: streamId, rep: 'livec-' + String(streamId).slice(0, 8), ttl: '300s' });
  } catch (e) { return Promise.resolve(); }
};
export const announceNotice = (env, title, body) => within(broadcast(env, 'updates', { title: String(title || 'Notice').slice(0, 80), body: String(body || '').slice(0, 160) || 'Tap to read', view: 'bell', tag: 'notice', cat: 'updates', kind: 'notice', ref_type: 'notice' }).catch(() => 0), 6000);

// A new app version is out: one phone notification to everyone with the app. Asked for by the build (see android.yml).
// At most once every 12 hours unless force is true, so a day of small fixes does not spam anyone.
export async function announceUpdate(env, force) {
  let last = 0;
  try { const r = await one(await sb(env, 'notif_state?select=events_seen_at&aid=eq.__app_update')); last = r ? Date.parse(r.events_seen_at) || 0 : 0; } catch (e) {}
  if (!force && Date.now() - last < 12 * 3600e3) return { sent: 0, skipped: 'A new-version alert already went out in the last 12 hours. Send {"force":true} to send anyway.' };
  try { await sb(env, 'notif_state', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ aid: '__app_update', events_seen_at: new Date().toISOString() }) }); } catch (e) {}
  const subs = await rows(await sb(env, 'push_subs?select=aid&limit=5000'));
  const aids = [...new Set(subs.map((x) => x.aid).filter(Boolean))].slice(0, 2000);
  const payload = { title: 'Update available', body: 'A new version of Comrade Connect is ready. Tap to update.', view: 'update', tag: 'app-update', kind: 'update', rep: 'app-update' };
  for (let i = 0; i < aids.length; i += 20) await Promise.all(aids.slice(i, i + 20).map((x) => sendPush(env, x, payload)));
  return { sent: aids.length };
}

export async function pushRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/push')) return null;
  if (path === '/api/push/key' && m === 'GET') return json(env, { key: '', fcm: !!fcmAccount(env) });
  if (path === '/api/push/status' && m === 'GET') {   // cc-pushcheck
    const u = await user(req, env); if (u instanceof Response) return u;
    if (!(await throttle(env, ip, 'pushstat', u.aid, 60, 600))) return tooMany(env);
    const acc = fcmAccount(env);
    const out = { fcm: !!acc, project: acc ? acc.project_id : null, key_ok: null, hint: '', phones: (await phonesOf(env, u.aid)).map((x) => ({ phone: tail(x.endpoint), app: x.p256dh === 'fcm2' ? 'new' : 'old' })), prefs: await prefsOf(env, u.aid), last_test: LAST_TEST.get(u.aid) || null };
    if (!acc) out.hint = noKeyHint(env);
    else if (url.searchParams.get('deep')) { try { await fcmAccess(acc); out.key_ok = true; } catch (e) { out.key_ok = false; out.hint = signinHint(e); } }
    return json(env, out);
  }
  if (m !== 'POST') return null;
  const u = await user(req, env, true); if (u instanceof Response) return u;
  if (!(await throttle(env, ip, 'pushsub', u.aid, 30, 600))) return tooMany(env);
  const b = await req.json().catch(() => ({}));
  if (path === '/api/push/test') {   // cc-pushcheck
    if (!(await throttle(env, ip, 'pushtest', u.aid, 12, 600))) return tooMany(env);
    const delay = Math.min(20, Math.max(0, Math.floor(Number(b.delay) || 0)));
    if (!delay) return json(env, await pushTest(env, u.aid));
    LAST_TEST.delete(u.aid);   // sent a few seconds later, so the person can close the app first; the answer is on /api/push/status
    setTimeout(() => { pushTest(env, u.aid).catch((e) => console.error('push test failed', e && e.message)); }, delay * 1000);
    return json(env, { ok: true, scheduled: delay });
  }
  if (path === '/api/push/fcm' || path === '/api/push/fcm-remove') {
    const tk = String(b.token || '');
    if (!/^[\w:.\-]{20,400}$/.test(tk)) return err(env, 'Bad request');
    if (path === '/api/push/fcm') await post(env, 'push_subs', { endpoint: 'fcm:' + tk, aid: u.aid, p256dh: b.v === 2 ? 'fcm2' : 'fcm', auth: 'fcm' }, 'resolution=merge-duplicates');
    else await sb(env, `push_subs?endpoint=eq.${enc('fcm:' + tk)}&aid=eq.${enc(u.aid)}`, { method: 'DELETE' });
    return json(env, { ok: true });
  }
  const ep = String(b.endpoint || '');
  if (!/^https:\/\/[^\s]{10,900}$/.test(ep)) return err(env, 'Bad request');
  if (path === '/api/push/subscribe') {
    return json(env, { ok: true, off: true });   // website push is switched off for good; nothing is saved
  }
  if (path === '/api/push/unsubscribe') {
    await sb(env, `push_subs?endpoint=eq.${enc(ep)}&aid=eq.${enc(u.aid)}`, { method: 'DELETE' });
    return json(env, { ok: true });
  }
  return null;
}
