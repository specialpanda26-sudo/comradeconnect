// Agora token builder (AccessToken2, the "007" format) for the Live video.
// Needed when the Agora project has the "App Certificate" switched on: without a token Agora answers CAN_NOT_GET_GATEWAY_SERVER ("bad gateway").
// Set AGORA_APP_ID and AGORA_APP_CERTIFICATE on the server. If the certificate is not set, no token is made and the app joins without one.
const enc = new TextEncoder();
const u16 = (n) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; };
const u32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, true); return b; };
const cat = (...a) => { const o = new Uint8Array(a.reduce((s, x) => s + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const str = (s) => { const b = typeof s === 'string' ? enc.encode(s) : s; return cat(u16(b.length), b); };
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, msg));
}
async function deflate(bytes) {
  const cs = new CompressionStream('deflate');                     // zlib format, the same as Python zlib.compress
  const w = cs.writable.getWriter(); w.write(bytes); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
const b64 = (u) => { let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s); };

export const hasAgoraCert = (env) => !!String(env.AGORA_APP_CERTIFICATE || '').trim() && !!String(env.AGORA_APP_ID || env.CC_AGORA_ID || '').trim();

// role: 'host' may publish video and audio, anything else may only watch. ttl in seconds.
export async function agoraToken(env, channel, role, ttl = 6 * 3600, now = Math.floor(Date.now() / 1000), salt = crypto.getRandomValues(new Uint32Array(1))[0]) {
  const appId = String(env.AGORA_APP_ID || env.CC_AGORA_ID || '').trim(), cert = String(env.AGORA_APP_CERTIFICATE || '').trim();
  if (!appId || !cert) return null;
  const priv = role === 'host' ? [[1, ttl], [2, ttl], [3, ttl], [4, ttl]] : [[1, ttl]];     // 1 join, 2 publish audio, 3 publish video, 4 publish data
  const service = cat(u16(1), u16(priv.length), ...priv.map(([k, v]) => cat(u16(k), u32(v))), str(channel), str(''));   // uid '' = any uid
  const info = cat(str(appId), u32(now), u32(ttl), u32(salt), u16(1), service);
  let sign = await hmac(u32(now), enc.encode(cert));
  sign = await hmac(u32(salt), sign);
  const signature = await hmac(sign, info);
  return '007' + b64(await deflate(cat(str(signature), info)));
}
