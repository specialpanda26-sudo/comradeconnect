// Device lock (Section 2): one phone, one account.
// The Android app sends the phone's Android ID (the closest thing to a hardware ID an app is allowed to read). We only keep a keyed hash of it, never the raw value.
// A browser has no hardware ID, so the site sends a random id it keeps in the browser. That is weaker (clearing the browser resets it), so the real lock is the app.
// Turn it on with DEVICE_LOCK=1. DEVICE_MAX_ACCOUNTS (default 1) is how many accounts one device may create.
import { json, err, sb, rows, one, post, enc, H, isAdmin, audit, str } from './lib.js';

export const lockOn = (env) => String(env.DEVICE_LOCK || '') === '1';
const maxAccounts = (env) => Math.max(1, Math.min(10, Number(env.DEVICE_MAX_ACCOUNTS) || 1));

// The device this request came from: { hash, kind } or null when the client did not send one.
export async function deviceFrom(req, env) {
  const id = (req.headers.get('X-Device-Id') || '').trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) return null;
  const kind = req.headers.get('X-Device-Kind') === 'app' ? 'app' : 'web';
  return { hash: await H(env, 'dev:' + id), kind };
}
const bindings = async (env, hash) => rows(await sb(env, `account_devices?select=aid&device_hash=eq.${enc(hash)}&limit=50`));

// Before an account is created: null = go ahead, or an error Response.
export async function deviceGate(env, req) {
  if (!lockOn(env)) return null;
  const d = await deviceFrom(req, env);
  if (!d) return err(env, 'Please update the Comrade Connect app (or refresh the page) so we can check this device, then try again.', 400);
  if ((await bindings(env, d.hash)).length >= maxAccounts(env))
    return err(env, 'This device already has a Comrade Connect account. Sign in to it instead. If this is a mistake, contact support.', 403);
  return null;
}
// After the account row exists: claim the device for it. If two sign-ups raced and the device is over the limit, the newcomer is removed.
export async function deviceClaim(env, req, aid) {
  if (!lockOn(env)) return null;
  const d = await deviceFrom(req, env); if (!d) return null;
  await post(env, 'account_devices', { device_hash: d.hash, aid, kind: d.kind }, 'resolution=ignore-duplicates');
  const all = (await bindings(env, d.hash)).map((x) => x.aid);
  if (all.length > maxAccounts(env) && all.indexOf(aid) >= maxAccounts(env)) {
    await sb(env, `account_devices?aid=eq.${enc(aid)}`, { method: 'DELETE' });
    await sb(env, `profiles?aid=eq.${enc(aid)}`, { method: 'DELETE' });
    return err(env, 'This device already has a Comrade Connect account. Sign in to it instead.', 403);
  }
  return null;
}
// On sign-in: an older account on a device nobody owns yet becomes that device's account, so it cannot be used to make more.
export async function deviceBindIfFree(env, req, aid) {
  try {
    if (!lockOn(env)) return;
    const d = await deviceFrom(req, env); if (!d) return;
    if ((await bindings(env, d.hash)).length === 0) await post(env, 'account_devices', { device_hash: d.hash, aid, kind: d.kind }, 'resolution=ignore-duplicates');
  } catch (e) { /* never block a sign-in because of this */ }
}

// Admin: see which devices an account is tied to, and free them (a student who lost or reset a phone).
export async function deviceAdminRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/admin/devices')) return null;
  if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);
  if (path === '/api/admin/devices' && m === 'GET') {
    const aid = str(url.searchParams.get('aid'), 64);
    if (!aid) return err(env, 'Give an aid');
    const r = await rows(await sb(env, `account_devices?select=device_hash,kind,created_at&aid=eq.${enc(aid)}`));
    return json(env, { devices: r.map((x) => ({ device: x.device_hash.slice(0, 10), kind: x.kind, created_at: x.created_at })) });
  }
  if (path === '/api/admin/devices/release' && m === 'POST') {
    const b = await req.json().catch(() => ({})), aid = str(b.aid, 64);
    if (!aid) return err(env, 'Give an aid');
    await sb(env, `account_devices?aid=eq.${enc(aid)}`, { method: 'DELETE' });
    await audit(env, 'device_release', 'account', aid, null, ip);
    return json(env, { ok: true });
  }
  return err(env, 'Not found', 404);
}
