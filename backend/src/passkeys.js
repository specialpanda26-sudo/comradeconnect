// Passkeys (WebAuthn): sign in with the phone's fingerprint, face or screen lock instead of a password.
// Section 1 of the passkey + device-lock work. No libraries: only the Web Crypto API that Workers and Node 20 already have.
// What we keep per passkey: the credential id and the PUBLIC key. The private key never leaves the person's phone or password manager.
import { json, err, sb, rows, one, post, patch, enc, str, randHex, H, tsEqual, throttle, tooMany, user, authProfile, audit } from './lib.js';
import { deviceBindIfFree } from './device.js';

const te = new TextEncoder(), td = new TextDecoder();
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => { s = String(s || '').replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
const sha256 = async (data) => new Uint8Array(await crypto.subtle.digest('SHA-256', data));
const eqBytes = (a, b) => a.length === b.length && tsEqual(b64u(a), b64u(b));
const MAX_PER_ACCOUNT = 10, CHALLENGE_MS = 5 * 60e3;

// ---------- settings ----------
export const rpId = (env) => String(env.PASSKEY_RP_ID || 'comradeconnect.co.ke').toLowerCase();
const origins = (env) => String(env.PASSKEY_ORIGINS || `https://${rpId(env)},https://www.${rpId(env)}`).split(',').map((x) => x.trim().replace(/\/$/, '')).filter(Boolean);

// ---------- challenges: signed by the server, so nothing has to be stored; each one works once, for 5 minutes ----------
const USED = new Map();   // nonce -> expiry (one API instance, see render.yaml)
async function makeChallenge(env, purpose, aid) {
  const nonce = randHex(16), ts = Date.now();
  const mac = await H(env, `pkc:${purpose}:${aid}:${nonce}:${ts}`);
  return b64u(te.encode(`${nonce}.${ts}.${mac}`));
}
async function checkChallenge(env, challenge, purpose, aid) {
  let parts; try { parts = td.decode(unb64u(challenge)).split('.'); } catch (e) { return false; }
  if (parts.length !== 3) return false;
  const [nonce, ts, mac] = parts, t = Number(ts);
  if (!/^[0-9a-f]{32}$/.test(nonce) || !Number.isFinite(t) || Date.now() - t > CHALLENGE_MS || t > Date.now() + 60e3) return false;
  if (!tsEqual(mac, await H(env, `pkc:${purpose}:${aid}:${nonce}:${ts}`))) return false;
  const now = Date.now();
  for (const [k, v] of USED) if (v < now) USED.delete(k);
  if (USED.has(nonce)) return false;
  USED.set(nonce, t + CHALLENGE_MS + 60e3);
  return true;
}

// ---------- a tiny CBOR reader (enough for WebAuthn: maps, arrays, ints, byte and text strings) ----------
function cbor(buf, start = 0) {
  let o = start; const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const read = () => {
    if (o >= buf.length) throw new Error('cbor end');
    const ib = buf[o++], mt = ib >> 5, ai = ib & 31; let n = ai;
    if (ai === 24) n = buf[o++]; else if (ai === 25) { n = dv.getUint16(o); o += 2; } else if (ai === 26) { n = dv.getUint32(o); o += 4; } else if (ai > 26) throw new Error('cbor size');
    if (mt === 0) return n;
    if (mt === 1) return -1 - n;
    if (mt === 2 || mt === 3) { if (o + n > buf.length) throw new Error('cbor len'); const s = buf.slice(o, o + n); o += n; return mt === 3 ? td.decode(s) : s; }
    if (mt === 4) { const a = []; for (let i = 0; i < n; i++) a.push(read()); return a; }
    if (mt === 5) { const m = new Map(); for (let i = 0; i < n; i++) { const k = read(); m.set(k, read()); } return m; }
    if (mt === 7) return n === 20 ? false : n === 21 ? true : null;
    throw new Error('cbor type');
  };
  return { value: read(), end: o };
}

// ---------- reading what the phone sends ----------
function parseAuthData(ad) {
  if (ad.length < 37) throw new Error('short authData');
  const out = { rpIdHash: ad.slice(0, 32), flags: ad[32], signCount: new DataView(ad.buffer, ad.byteOffset + 33, 4).getUint32(0) };
  out.up = !!(out.flags & 1); out.uv = !!(out.flags & 4); out.at = !!(out.flags & 64);
  if (out.at) {
    if (ad.length < 55) throw new Error('short authData');
    const len = (ad[53] << 8) | ad[54];
    if (len < 1 || len > 1023 || ad.length < 55 + len) throw new Error('bad credential id');
    out.credId = ad.slice(55, 55 + len);
    out.coseKey = cbor(ad, 55 + len).value;
  }
  return out;
}
function coseToJwk(k) {
  if (!(k instanceof Map)) throw new Error('bad key');
  const kty = k.get(1), alg = k.get(3);
  if (kty === 2 && alg === -7 && k.get(-1) === 1 && k.get(-2)?.length === 32 && k.get(-3)?.length === 32)
    return { alg: -7, jwk: { kty: 'EC', crv: 'P-256', x: b64u(k.get(-2)), y: b64u(k.get(-3)) } };
  if (kty === 3 && alg === -257 && k.get(-1)?.length >= 256 && k.get(-2)?.length)
    return { alg: -257, jwk: { kty: 'RSA', n: b64u(k.get(-1)), e: b64u(k.get(-2)), alg: 'RS256' } };
  throw new Error('unsupported key type');
}
// WebAuthn gives an ECDSA signature in DER form; Web Crypto wants the plain 64 bytes r||s.
function derToRaw(der) {
  let o = 2; if (der[0] !== 0x30) throw new Error('bad signature');
  if (der[1] & 0x80) o = 2 + (der[1] & 0x7f);
  const part = () => { if (der[o++] !== 0x02) throw new Error('bad signature'); let n = der[o++]; let v = der.slice(o, o + n); o += n; while (v.length > 32 && v[0] === 0) v = v.slice(1); const r = new Uint8Array(32); r.set(v, 32 - v.length); return r; };
  const r = part(), s = part(); const out = new Uint8Array(64); out.set(r, 0); out.set(s, 32); return out;
}
async function clientCheck(env, clientDataB64, type, purpose, aid) {
  const raw = unb64u(clientDataB64); let cd; try { cd = JSON.parse(td.decode(raw)); } catch (e) { return null; }
  if (cd.type !== type || cd.crossOrigin === true) return null;
  if (!origins(env).includes(String(cd.origin || '').replace(/\/$/, ''))) return null;
  if (!(await checkChallenge(env, cd.challenge, purpose, aid))) return null;
  return raw;
}
const rpHashOk = async (env, h) => eqBytes(h, await sha256(te.encode(rpId(env))));

const pubRow = (p) => ({ id: p.id, name: p.name || 'Passkey', created_at: p.created_at, last_used_at: p.last_used_at || null });

export async function passkeyRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/passkey/')) return null;
  const body = async () => (await req.json().catch(() => ({})));

  // ---- add a passkey to the signed-in account ----
  if (path === '/api/passkey/register/options' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    if (!(await throttle(env, ip, 'pkreg', u.aid, 20, 60))) return tooMany(env);
    const mine = await rows(await sb(env, `passkeys?select=id&aid=eq.${enc(u.aid)}`));
    if (mine.length >= MAX_PER_ACCOUNT) return err(env, `You can keep up to ${MAX_PER_ACCOUNT} passkeys. Remove one first.`);
    return json(env, { publicKey: {
      challenge: await makeChallenge(env, 'reg', u.aid),
      rp: { id: rpId(env), name: 'Comrade Connect' },
      user: { id: b64u(te.encode(u.aid)), name: u.handle || u.aid, displayName: u.handle || 'Comrade' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
      excludeCredentials: mine.map((x) => ({ type: 'public-key', id: x.id })),
      attestation: 'none', timeout: 60000,
    } });
  }
  if (path === '/api/passkey/register/verify' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    if (!(await throttle(env, ip, 'pkregv', u.aid, 20, 60))) return tooMany(env);
    const b = await body(), resp = b.response || {};
    const bad = () => err(env, 'We could not confirm this passkey. Please try again.', 400);
    try {
      if (!(await clientCheck(env, resp.clientDataJSON, 'webauthn.create', 'reg', u.aid))) return bad();
      const att = cbor(unb64u(resp.attestationObject)).value;
      const ad = parseAuthData(att.get('authData'));
      if (!(await rpHashOk(env, ad.rpIdHash)) || !ad.up || !ad.uv || !ad.at) return bad();
      const id = b64u(ad.credId);
      if (b.id && b.id !== id) return bad();
      const { alg, jwk } = coseToJwk(ad.coseKey);
      const mine = await rows(await sb(env, `passkeys?select=id&aid=eq.${enc(u.aid)}`));
      if (mine.length >= MAX_PER_ACCOUNT) return err(env, `You can keep up to ${MAX_PER_ACCOUNT} passkeys. Remove one first.`);
      const name = str(b.name, 40) || 'Passkey';
      const res = await post(env, 'passkeys', { id, aid: u.aid, public_key: JSON.stringify(jwk), alg, sign_count: ad.signCount, name });
      if (res.status === 409) return err(env, 'This passkey is already saved', 409);
      if (!res.ok) return err(env, 'Could not save the passkey. Ask the admin to run the passkeys SQL.', 500);
      return json(env, { ok: true, id, name }, 201);
    } catch (e) { return bad(); }
  }

  // ---- sign in with a passkey (no password, no recovery code) ----
  if (path === '/api/passkey/login/options' && m === 'POST') {
    if (!(await throttle(env, ip, 'pklogo', ip, 60, 60))) return tooMany(env);
    return json(env, { publicKey: { challenge: await makeChallenge(env, 'login', ''), rpId: rpId(env), userVerification: 'required', allowCredentials: [], timeout: 60000 } });
  }
  if (path === '/api/passkey/login/verify' && m === 'POST') {
    if (!(await throttle(env, ip, 'pklogv', ip, 30, 60))) return tooMany(env);
    const b = await body(), resp = b.response || {};
    const bad = () => err(env, 'Passkey sign-in failed. Try again or use your password.', 401);
    try {
      const id = str(b.id, 1400);
      const pk = id ? await one(await sb(env, `passkeys?id=eq.${enc(id)}&limit=1`)) : null;
      if (!pk) return bad();
      if (resp.userHandle && td.decode(unb64u(resp.userHandle)) !== pk.aid) return bad();
      const cdRaw = await clientCheck(env, resp.clientDataJSON, 'webauthn.get', 'login', '');
      if (!cdRaw) return bad();
      const adRaw = unb64u(resp.authenticatorData), ad = parseAuthData(adRaw);
      if (!(await rpHashOk(env, ad.rpIdHash)) || !ad.up || !ad.uv) return bad();
      const signed = new Uint8Array([...adRaw, ...(await sha256(cdRaw))]), sig = unb64u(resp.signature), jwk = JSON.parse(pk.public_key);
      let ok;
      if (pk.alg === -7) ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']), derToRaw(sig), signed);
      else ok = await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']), sig, signed);
      if (!ok) return bad();
      const old = Number(pk.sign_count || 0);
      if ((old > 0 || ad.signCount > 0) && ad.signCount <= old) return bad();   // a counter that does not go up means a copied passkey
      const p = await one(await sb(env, `profiles?aid=eq.${enc(pk.aid)}&limit=1`));
      if (!p) return bad();
      if (p.banned) return err(env, 'This account is suspended', 403);
      const token = randHex(24);
      await patch(env, `profiles?aid=eq.${enc(p.aid)}`, { token_hash: await H(env, 'tok:' + token) });
      await patch(env, `passkeys?id=eq.${enc(pk.id)}`, { sign_count: ad.signCount, last_used_at: new Date().toISOString() });
      await deviceBindIfFree(env, req, p.aid);
      return json(env, { aid: p.aid, token });
    } catch (e) { return bad(); }
  }

  // ---- list and remove (signed in) ----
  if (path === '/api/passkey/list' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    return json(env, { passkeys: (await rows(await sb(env, `passkeys?select=id,name,created_at,last_used_at&aid=eq.${enc(u.aid)}&order=created_at.asc`))).map(pubRow) });
  }
  if (path === '/api/passkey/delete' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const id = str((await body()).id, 1400);
    const gone = await rows(await sb(env, `passkeys?id=eq.${enc(id)}&aid=eq.${enc(u.aid)}`, { method: 'DELETE' }));
    return json(env, { ok: true });
  }
  return err(env, 'Not found', 404);
}
