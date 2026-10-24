// File storage on Supabase Storage (free plan, no card). Replaces Cloudflare R2.
// Two buckets, created by supabase/schema.sql: a PUBLIC one (clips, listing photos) and a PRIVATE one (ID photos).
// The Worker uses the service key; browsers only ever get a one-time signed upload URL.
import { sbKeyHeaders } from './lib.js';
const base = (env) => String(env.SUPABASE_URL || '').replace(/\/$/, '') + '/storage/v1';
const hdr = (env, extra = {}) => ({ ...sbKeyHeaders(env), ...extra });
const encPath = (key) => String(key).split('/').map(encodeURIComponent).join('/');

export const MEDIA_BUCKET = (env) => env.MEDIA_BUCKET || 'cc-media';
export const PRIVATE_BUCKET = (env) => env.PRIVATE_BUCKET || 'cc-private';

// Public address of a file in the public bucket.
export const mediaUrl = (env, key) =>
  `${env.MEDIA_PUBLIC_URL ? String(env.MEDIA_PUBLIC_URL).replace(/\/$/, '') : `${base(env)}/object/public/${MEDIA_BUCKET(env)}`}/${key}`;

// One-time upload URL (valid 2 hours, cannot overwrite an existing file). The browser sends the file with PUT + FormData.
export async function signUpload(env, bucket, key) {
  const r = await fetch(`${base(env)}/object/upload/sign/${bucket}/${encPath(key)}`, { method: 'POST', headers: hdr(env, { 'Content-Type': 'application/json' }), body: '{}' }).catch(() => null);
  const d = r && r.ok ? await r.json().catch(() => null) : null;
  if (!d || !d.url) return null;
  if (/^https?:/.test(d.url)) return d.url;
  if (d.url.startsWith('/storage/v1')) return String(env.SUPABASE_URL).replace(/\/$/, '') + d.url;
  return base(env) + d.url;
}

// { size, type } or null when the file is not there.
export async function head(env, bucket, key) {
  const r = await fetch(`${base(env)}/object/info/${bucket}/${encPath(key)}`, { headers: hdr(env) }).catch(() => null);
  if (!r || !r.ok) return null;
  const d = await r.json().catch(() => null);
  if (!d) return null;
  const size = Number(d.size ?? d.metadata?.size ?? d.metadata?.contentLength ?? NaN);
  return { size: Number.isFinite(size) ? size : 0, type: String(d.content_type ?? d.metadata?.mimetype ?? '') };
}

// First n bytes of a file (to check it really is what it claims). Never downloads the whole thing.
export async function peek(env, bucket, key, n = 16) {
  const r = await fetch(`${base(env)}/object/${bucket}/${encPath(key)}`, { headers: hdr(env, { Range: `bytes=0-${n - 1}` }) }).catch(() => null);
  if (!r || !r.ok || !r.body) return null;
  const reader = r.body.getReader(), got = [];
  let len = 0;
  while (len < n) { const { value, done } = await reader.read(); if (done) break; got.push(value); len += value.length; }
  reader.cancel().catch(() => {});
  const out = new Uint8Array(Math.min(len, n)); let o = 0;
  for (const c of got) { for (let i = 0; i < c.length && o < out.length; i++) out[o++] = c[i]; }
  return out;
}

// Whole file as a stream (admin ID photo view only).
export async function download(env, bucket, key) {
  const r = await fetch(`${base(env)}/object/${bucket}/${encPath(key)}`, { headers: hdr(env) }).catch(() => null);
  return r && r.ok ? { body: r.body, type: r.headers.get('Content-Type') || '' } : null;
}

export async function remove(env, bucket, key) {
  await fetch(`${base(env)}/object/${bucket}/${encPath(key)}`, { method: 'DELETE', headers: hdr(env) }).catch(() => {});
}

// What the first bytes say the file is. Returns a mime type or null.
export function sniff(b) {
  if (!b || b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'video/mp4';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm';
  return null;
}
