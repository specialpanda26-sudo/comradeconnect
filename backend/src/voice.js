// Voice notes: a short audio recording on a spill or in the live chat.
// The phone records, asks for a one-time upload URL, sends the file straight to storage, then posts the file's key with the spill or chat message.
// No new tables: the key travels inside the text as a marker like " [vn:voice/2026-10/abc....webm]" and is turned back into a playable link when read.
// Stored as video/webm or video/mp4 because that is what the media bucket allows; an <audio> player plays both.
import * as store from './storage.js';
import { mediaUrl, MEDIA_BUCKET } from './storage.js';
import { json, err, randHex, throttle, tooMany, user } from './lib.js';

export const VOICE_MAX_BYTES = 1.5 * 1048576;          // about 60 seconds of speech
const TYPES = { 'video/webm': 'webm', 'video/mp4': 'mp4' };
const KEY = /^voice\/\d{4}-\d{2}\/[0-9a-f]{24}\.(webm|mp4)$/;
const MARK = /\s*\[vn:(voice\/\d{4}-\d{2}\/[0-9a-f]{24}\.(?:webm|mp4))\]\s*$/;

// Anything that looks like a voice marker typed by a person is removed, so nobody can fake one.
export const stripMarkers = (t) => String(t == null ? '' : t).replace(/\[vn:[^\]]*\]/g, '').trim();

// { text, audio } from stored text. audio is the public link, or undefined when there is no voice note.
export function voiceOf(env, stored) {
  const s = String(stored == null ? '' : stored), m = s.match(MARK);
  return m ? { text: s.slice(0, m.index).trim(), audio: mediaUrl(env, m[1]) } : { text: s, audio: undefined };
}

// True only when the file really arrived, is small enough and starts like webm or mp4 audio.
export async function voiceCheck(env, key) {
  if (!KEY.test(String(key || ''))) return false;
  const h = await store.head(env, MEDIA_BUCKET(env), key);
  if (!h || !(h.size > 0) || h.size > VOICE_MAX_BYTES) return false;
  const t = store.sniff(await store.peek(env, MEDIA_BUCKET(env), key));
  return t === 'video/webm' || t === 'video/mp4';
}

export async function voiceRoutes(req, env, url, ip) {
  if (url.pathname !== '/api/voice/upload-url' || req.method !== 'POST') return null;
  const u = await user(req, env, true); if (u instanceof Response) return u;
  const b = await req.json().catch(() => ({})), ct = String(b.content_type || '').toLowerCase().split(';')[0].trim(), ext = TYPES[ct], bytes = Math.floor(Number(b.bytes));
  if (!ext) return err(env, 'Voice notes are not supported on this phone or browser');
  if (!(bytes > 0 && bytes <= VOICE_MAX_BYTES)) return err(env, 'That voice note is too long. Keep it under one minute.');
  if (!(await throttle(env, ip, 'voice', u.aid, 20, 60))) return tooMany(env);
  const key = `voice/${new Date().toISOString().slice(0, 7)}/${randHex(12)}.${ext}`;
  const upload_url = await store.signUpload(env, MEDIA_BUCKET(env), key);
  if (!upload_url) return err(env, 'File storage is not ready. Try again later.', 503);
  return json(env, { key, upload_url, content_type: ct }, 201);
}
