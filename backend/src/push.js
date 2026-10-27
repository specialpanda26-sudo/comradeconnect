// Web Push: lets the phone show a notification even when the app is closed.
// Needs three settings: VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT.
// Everything here is best effort: a failed push never breaks the action that caused it.
import { json, err, sb, rows, one, post, enc, user, throttle, tooMany } from './lib.js';

const te = new TextEncoder();
const b64u = (buf) => { let s = ''; new Uint8Array(buf).forEach((c) => { s += String.fromCharCode(c); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s) => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const r = atob(s), o = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; };
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; a.forEach((x) => { o.set(x, p); p += x.length; }); return o; };
const hasKeys = (env) => !!(env.VAPID_PUBLIC && env.VAPID_PRIVATE);

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
  if (fcmTok.v && Date.now() < fcmTok.exp - 60000) return fcmTok.v;
  const der = unb64u(acc.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(te.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64u(te.encode(JSON.stringify({ iss: acc.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })));
  const sig = b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, te.encode(head + '.' + claims)));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + claims + '.' + sig });
  const d = await r.json();
  if (!d.access_token) throw new Error('FCM sign-in failed');
  fcmTok = { v: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 };
  return fcmTok.v;
}
export async function sendFcm(env, s, payload) {
  const acc = fcmAccount(env); if (!acc) return;
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${acc.project_id}/messages:send`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + (await fcmAccess(acc)), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { token: s.endpoint.slice(4), notification: { title: String(payload.title || 'Comrade Connect'), body: String(payload.body || '') }, data: { view: String(payload.view || ''), cat: String(payload.cat || '') }, android: { priority: 'HIGH', notification: { tag: String(payload.tag || 'cc') } } } })
  });
  const detail = r.ok ? '' : (await r.text().catch(() => '')).slice(0, 300);
  if (!r.ok) console.error('FCM send failed', r.status, detail);
  if (r.status === 404) await sb(env, `push_subs?endpoint=eq.${enc(s.endpoint)}`, { method: 'DELETE' });   // the app was removed from that phone
  return { ok: r.ok, status: r.status, detail };
}

async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}

// RFC 8291 (aes128gcm) encryption of the message for one phone.
export async function encryptPayload(sub, text) {
  const ua = unb64u(sub.p256dh), auth = unb64u(sub.auth);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(auth, secret, cat(te.encode('WebPush: info\0'), ua, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(te.encode(text), new Uint8Array([2]))));
  return cat(salt, new Uint8Array([0, 0, 0x10, 0]), new Uint8Array([asPub.length]), asPub, ct);
}

// VAPID: proves to the push service that the message comes from our server.
async function vapidAuth(env, endpoint) {
  const pub = unb64u(env.VAPID_PUBLIC);
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: env.VAPID_PRIVATE, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)) }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || 'mailto:support@comradeconnect.co.ke' })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(head + '.' + claims)));
  return 'vapid t=' + head + '.' + claims + '.' + b64u(sig) + ', k=' + env.VAPID_PUBLIC;
}

// ---- What each person wants to hear about (Me > Notifications, or the Alerts button in the bell). Everything is on until they switch it off. ----
export const PUSH_CATS = ['comments', 'live', 'events', 'orders', 'wallet', 'messages', 'updates'];
const KIND_CAT = { comment: 'comments', reel_comment: 'comments', clip_comment: 'comments', like_milestone: 'comments', story_view: 'comments', order: 'orders', gift: 'wallet', reward: 'wallet', referral: 'wallet', message: 'messages' };
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
  const subs = (await rows(await sb(env, 'push_subs?select=endpoint,aid&endpoint=like.fcm:*&limit=1500'))).filter((s) => s.aid && s.aid !== skipAid);
  if (!subs.length) return 0;
  let off = new Set();
  try { off = new Set((await rows(await sb(env, `notif_prefs?select=aid&prefs->>${cat}=eq.false&limit=5000`))).map((r) => r.aid)); } catch (e) { /* table not made yet: everyone is on */ }
  const to = subs.filter((s) => !off.has(s.aid));
  for (let i = 0; i < to.length; i += 25) await Promise.all(to.slice(i, i + 25).map((s) => sendFcm(env, s, payload).catch(() => null)));
  return to.length;
}
const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
export const announceLive = (env, hostAid, title) => within(broadcast(env, 'live', { title: 'Someone is live now', body: title && title !== 'Live' ? String(title).slice(0, 80) : 'Tap to watch', view: 'live', tag: 'live', cat: 'live' }, hostAid).catch(() => 0), 6000);
export const announceEvent = (env, ownerAid, title) => within(broadcast(env, 'events', { title: 'New event', body: String(title || '').slice(0, 80), view: 'bell', tag: 'event', cat: 'events' }, ownerAid).catch(() => 0), 6000);

// A new app version is out: one phone notification to everyone with the app. Asked for by the build (see android.yml).
// At most once every 12 hours unless force is true, so a day of small fixes does not spam anyone.
export async function announceUpdate(env, force) {
  let last = 0;
  try { const r = await one(await sb(env, 'notif_state?select=events_seen_at&aid=eq.__app_update')); last = r ? Date.parse(r.events_seen_at) || 0 : 0; } catch (e) {}
  if (!force && Date.now() - last < 12 * 3600e3) return { sent: 0, skipped: 'A new-version alert already went out in the last 12 hours. Send {"force":true} to send anyway.' };
  try { await sb(env, 'notif_state', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ aid: '__app_update', events_seen_at: new Date().toISOString() }) }); } catch (e) {}
  const subs = await rows(await sb(env, 'push_subs?select=aid&limit=5000'));
  const aids = [...new Set(subs.map((x) => x.aid).filter(Boolean))].slice(0, 2000);
  const payload = { title: 'Update available', body: 'A new version of Comrade Connect is ready. Tap to update.', view: 'update', tag: 'app-update' };
  for (let i = 0; i < aids.length; i += 20) await Promise.all(aids.slice(i, i + 20).map((x) => sendPush(env, x, payload)));
  return { sent: aids.length };
}

export async function pushRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/push')) return null;
  if (path === '/api/push/key' && m === 'GET') return json(env, { key: hasKeys(env) ? env.VAPID_PUBLIC : '', fcm: !!fcmAccount(env) });
  if (m !== 'POST') return null;
  const u = await user(req, env, true); if (u instanceof Response) return u;
  if (!(await throttle(env, ip, 'pushsub', u.aid, 30, 600))) return tooMany(env);
  const b = await req.json().catch(() => ({}));
  if (path === '/api/push/fcm' || path === '/api/push/fcm-remove') {
    const tk = String(b.token || '');
    if (!/^[\w:.\-]{20,400}$/.test(tk)) return err(env, 'Bad request');
    if (path === '/api/push/fcm') await post(env, 'push_subs', { endpoint: 'fcm:' + tk, aid: u.aid, p256dh: 'fcm', auth: 'fcm' }, 'resolution=merge-duplicates');
    else await sb(env, `push_subs?endpoint=eq.${enc('fcm:' + tk)}&aid=eq.${enc(u.aid)}`, { method: 'DELETE' });
    return json(env, { ok: true });
  }
  const ep = String(b.endpoint || '');
  if (!/^https:\/\/[^\s]{10,900}$/.test(ep)) return err(env, 'Bad request');
  if (path === '/api/push/subscribe') {
    return json(env, { ok: true, off: true });   // website push is switched off for good
    const k = b.keys || {};
    if (!k.p256dh || !k.auth || String(k.p256dh).length > 200 || String(k.auth).length > 60) return err(env, 'Bad request');
    await post(env, 'push_subs', { endpoint: ep, aid: u.aid, p256dh: String(k.p256dh), auth: String(k.auth) }, 'resolution=merge-duplicates');
    return json(env, { ok: true });
  }
  if (path === '/api/push/unsubscribe') {
    await sb(env, `push_subs?endpoint=eq.${enc(ep)}&aid=eq.${enc(u.aid)}`, { method: 'DELETE' });
    return json(env, { ok: true });
  }
  return null;
}
