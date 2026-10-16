// Shared helpers for the Comrade Connect Worker.
export const enc = encodeURIComponent;
export const corsHeaders = (env) => ({
  'Access-Control-Allow-Origin': env.ALLOWED_ORIGINS || '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key, X-Aid, X-Token',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
});
export const json = (env, data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders(env) } });
export const err = (env, msg, status = 400) => json(env, { error: msg }, status);

export const sb = (env, path, opts = {}) =>
  fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  });
export const rows = async (res) => { const d = await res.json().catch(() => []); return Array.isArray(d) ? d : []; };
export const one = async (res) => (await rows(res))[0];
export const post = (env, table, body, prefer) => sb(env, table, { method: 'POST', headers: prefer ? { Prefer: prefer } : {}, body: JSON.stringify(body) });
export const patch = (env, q, body) => sb(env, q, { method: 'PATCH', body: JSON.stringify(body) });
export const inList = (a) => `in.(${a.map((x) => enc(x)).join(',')})`;
export const ago = (ms) => new Date(Date.now() - ms).toISOString();
export const ahead = (ms) => new Date(Date.now() + ms).toISOString();
export const DAY = 86400e3;

export const normPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  if (/^0[17]\d{8}$/.test(d)) return '254' + d.slice(1);
  if (/^254[17]\d{8}$/.test(d)) return d;
  return null;
};

// ---------- validation ----------
export const str = (v, max) => String(v ?? '').trim().slice(0, max);
export const int = (v, min, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ---------- contact-info filter (server side, used by every write endpoint) ----------
const WORDS = { zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' };
export const hasContact = (t) => {
  const raw = String(t || '').toLowerCase();
  const words = raw.replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g, (m) => WORDS[m]);
  const s = ' ' + words.replace(/[\s.\-_()+,/|*]/g, '') + ' ';
  return /(254|0)[17]\d{8}/.test(s)
    || /https?:|www\.|\.com|\.co\.ke|\.ke\b|wa\.me|t\.me|bit\.ly/.test(raw)
    || /@[a-z0-9_]{3,}/.test(raw)
    || /\b(whatsapp|telegram|insta(gram)?|snap(chat)?)\s*[:=]/.test(raw);
};
// Returns an error Response if any text has contact info, else null.
export const contactBlock = (env, ...texts) =>
  texts.some((x) => x && hasContact(x)) ? err(env, 'Remove phone numbers, handles and links') : null;

// ---------- hashing (HMAC with a secret pepper) ----------
const te = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export async function hmacRaw(keyBytes, msg) {
  const k = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, typeof msg === 'string' ? te.encode(msg) : msg));
}
export async function H(env, msg) {
  if (!env.HASH_PEPPER) throw new Error('HASH_PEPPER missing');
  return hex(await hmacRaw(te.encode(env.HASH_PEPPER), msg));
}
export async function sha256Hex(s) { return hex(await crypto.subtle.digest('SHA-256', te.encode(s))); }
export const tsEqual = (a, b) => {
  a = String(a); b = String(b);
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
};
export const randHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
// Codes are derived from the pepper + id so the DB alone can never reveal them, yet the buyer can re-read theirs.
export async function deriveCode(env, kind, id, digits) {
  const h = await H(env, `${kind}:${id}`);
  return String(parseInt(h.slice(0, 12), 16) % 10 ** digits).padStart(digits, '0');
}
export const codeHash = (env, kind, id, code) => H(env, `ch:${kind}:${id}:${code}`);

// ---------- rate limiting (daily counters in ai_usage) ----------
export async function bump(env, key, limit) {
  const day = new Date().toISOString().slice(0, 10);
  const [u] = await rows(await sb(env, `ai_usage?aid=eq.${enc(key)}&day=eq.${day}`));
  const used = u?.n || 0;
  if (used >= limit) return false;
  await sb(env, 'ai_usage', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ aid: key, day, n: used + 1 }) });
  return true;
}
// Per-account and per-IP daily limits for a named write action.
export async function throttle(env, ip, name, aid, perAid, perIp = perAid * 4) {
  if (!(await bump(env, `${name}:a:${aid}`, perAid))) return false;
  return bump(env, `${name}:i:${ip}`, perIp);
}
export const tooMany = (env) => err(env, 'Too many requests. Try again later.', 429);

// ---------- accounts ----------
// Returns the profile if X-Aid + X-Token match, else null.
export async function authProfile(req, env) {
  const aid = (req.headers.get('X-Aid') || '').slice(0, 64), tok = req.headers.get('X-Token') || '';
  if (!aid || !tok) return null;
  const p = await one(await sb(env, `profiles?aid=eq.${enc(aid)}&limit=1`));
  if (!p || !p.token_hash) return null;
  return tsEqual(p.token_hash, await H(env, 'tok:' + tok)) ? p : null;
}
export const isMuted = (p) => !!(p?.muted_until && new Date(p.muted_until) > new Date());
// Use: const u = await user(req, env, true); if (u instanceof Response) return u;
export async function user(req, env, write = false) {
  const p = await authProfile(req, env);
  if (!p) return err(env, 'Please sign in again', 401);
  if (p.banned) return err(env, 'This account is suspended', 403);
  if (write && isMuted(p)) return err(env, 'Your account is muted for now', 403);
  return p;
}
// For legacy aid-only routes (Feed): block banned or muted aids.
export async function standingBlock(env, aid) {
  const p = await one(await sb(env, `profiles?select=banned,muted_until&aid=eq.${enc(aid)}&limit=1`));
  if (p?.banned) return err(env, 'This account is suspended', 403);
  if (isMuted(p)) return err(env, 'Your account is muted for now', 403);
  return null;
}

// ---------- admin ----------
export const isAdmin = (req, env) => !!env.ADMIN_KEY && tsEqual(req.headers.get('X-Admin-Key') || '', env.ADMIN_KEY);
export async function audit(env, action, type, id, detail, ip) {
  await post(env, 'admin_audit_log', { actor: 'admin', action, target_type: type || null, target_id: id ? String(id) : null, detail: detail || null, ip: ip || null });
}

