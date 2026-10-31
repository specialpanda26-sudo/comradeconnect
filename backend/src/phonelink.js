// Link a WhatsApp number to an account with a 6-digit code sent by the bot.
// We keep only a keyed hash of the number (one number = one account) and a keyed hash of the code. Never the code itself.
// Same pattern as the recovery email code in recovery.js. Never logs numbers or codes, never returns a full number.
import { json, err, sb, rows, one, post, patch, enc, bump, ahead, H, tsEqual, user } from './lib.js';
import { normPhone } from './promo.js';
import { getSettings } from './settings.js';
import { notify } from './notifications.js';
import { welcomeBonus } from './account.js';

const CODE_MINUTES = 10, CODE_TRIES = 5, RESEND_SECONDS = 60, PER_ACCOUNT_HOUR = 3, PER_IP_HOUR = 5;
const UNAVAILABLE = 'WhatsApp is not available right now. Please try again later.';
const codeText = (code) => `Comrade Connect code: ${code}. It works for ${CODE_MINUTES} minutes. Never share it with anyone, even if they say they are from us.`;

// Hourly limits. bump() counts per day, so the hour goes into the key (old rows are tidied by the cron).
const hourKey = () => new Date().toISOString().slice(0, 13);
const hourly = (env, name, id, limit) => bump(env, `${name}:${id}:${hourKey()}`, limit);
const dead = (env, aid) => sb(env, `phone_codes?aid=eq.${enc(aid)}`, { method: 'DELETE' });

export async function phoneLinkRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/me/phone')) return null;
  const u = await user(req, env, m !== 'GET'); if (u instanceof Response) return u;

  // Only "linked" and the last 4 digits. Never the full number.
  if (path === '/api/me/phone' && m === 'GET') {
    const l = await one(await sb(env, `phone_links?select=last4,verified_at&aid=eq.${enc(u.aid)}&limit=1`));
    return json(env, { linked: !!(l && l.verified_at), last4: l && l.verified_at ? l.last4 || '' : '' });
  }

  if (path === '/api/me/phone/send' && m === 'POST') {
    const b = await req.json().catch(() => ({}));
    const phone = normPhone(b.phone);
    if (!phone) return err(env, 'Enter a Kenyan WhatsApp number like 0712345678');
    const ph = await H(env, 'phone:' + phone);
    // One number, one account. Say it before sending anything.
    const other = await one(await sb(env, `phone_links?select=aid&phone_hash=eq.${enc(ph)}&aid=neq.${enc(u.aid)}&limit=1`));
    if (other) return err(env, 'This number is already linked to another account', 409);
    const cur = await one(await sb(env, `phone_codes?select=sent_at&aid=eq.${enc(u.aid)}&limit=1`));
    if (cur && Date.now() - Date.parse(cur.sent_at) < RESEND_SECONDS * 1000) return err(env, `Wait ${RESEND_SECONDS} seconds before asking for another code`, 429);
    if (!(await hourly(env, 'phsend:a', u.aid, PER_ACCOUNT_HOUR)) || !(await hourly(env, 'phsend:i', ip, PER_IP_HOUR))) return err(env, 'Too many codes. Try again in an hour.', 429);
    if (typeof env.waSend !== 'function') return err(env, UNAVAILABLE, 503);

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1e6).padStart(6, '0');
    const saved = await post(env, 'phone_codes', {
      aid: u.aid, phone_hash: ph, code_hash: await H(env, `phcode:${u.aid}:${ph}:${code}`),
      expires_at: ahead(CODE_MINUTES * 60e3), attempts: 0, sent_at: new Date().toISOString(), last4: phone.slice(-4),
    }, 'resolution=merge-duplicates,return=minimal');
    if (!saved.ok) return err(env, 'Could not start. Ask the admin to run supabase/phone-link.sql first.', 500);

    let sent; try { sent = await env.waSend(phone, codeText(code)); } catch (e) { sent = { ok: false, detail: 'error' }; }
    if (!sent || !sent.ok) {
      await dead(env, u.aid);                             // no usable code is left behind when the message did not go out
      if (sent && sent.detail === 'not on WhatsApp') return err(env, 'That number is not on WhatsApp. Check it and try again.', 400);
      return err(env, UNAVAILABLE, 503);
    }
    return json(env, { ok: true, expires_minutes: CODE_MINUTES, resend_seconds: RESEND_SECONDS, last4: phone.slice(-4) });
  }

  if (path === '/api/me/phone/verify' && m === 'POST') {
    const code = String((await req.json().catch(() => ({}))).code || '').replace(/\D/g, '');
    if (code.length !== 6) return err(env, 'The code has 6 digits');
    if (!(await hourly(env, 'phver:a', u.aid, 20)) || !(await hourly(env, 'phver:i', ip, 40))) return err(env, 'Too many tries. Try again later.', 429);
    const v = await one(await sb(env, `phone_codes?select=*&aid=eq.${enc(u.aid)}&limit=1`));
    if (!v) return err(env, 'Ask for a code first', 404);
    if (Date.parse(v.expires_at) < Date.now()) { await dead(env, u.aid); return err(env, 'That code expired. Ask for a new one.', 410); }
    if (v.attempts >= CODE_TRIES) { await dead(env, u.aid); return err(env, 'Too many wrong codes. Ask for a new one.', 429); }
    // Count the try first, and only if nobody else counted it at the same moment (stops two fast guesses sharing one try).
    const took = await rows(await patch(env, `phone_codes?aid=eq.${enc(u.aid)}&attempts=eq.${v.attempts}`, { attempts: v.attempts + 1 }));
    if (!took.length) return err(env, 'Try again in a moment', 429);
    if (!tsEqual(v.code_hash, await H(env, `phcode:${u.aid}:${v.phone_hash}:${code}`))) {
      const left = CODE_TRIES - (v.attempts + 1);
      if (left <= 0) { await dead(env, u.aid); return err(env, 'Too many wrong codes. Ask for a new one.', 429); }
      return err(env, `Wrong code. ${left} ${left === 1 ? 'try' : 'tries'} left.`, 400);
    }
    // Right code. If the account had a different number before, its WhatsApp-offers choice no longer applies to the new one.
    const before = await one(await sb(env, `phone_links?select=phone_hash&aid=eq.${enc(u.aid)}&limit=1`));
    const saved = await post(env, 'phone_links', {
      aid: u.aid, phone_hash: v.phone_hash, phone_enc: null, last4: v.last4 || null, verified_at: new Date().toISOString(),
    }, 'resolution=merge-duplicates,return=minimal');
    if (saved.status === 409) { await dead(env, u.aid); return err(env, 'This number is already linked to another account', 409); }
    if (!saved.ok) return err(env, 'Could not save. Ask the admin to run supabase/phone-link.sql first.', 500);
    if (before && before.phone_hash !== v.phone_hash) await patch(env, `promo_contacts?aid=eq.${enc(u.aid)}`, { wa_ok: false, wa_phone: null }).catch(() => null);   // columns arrive with promo.sql; failing here is fine
    await dead(env, u.aid);
    await notify(env, u.aid, 'verification', 'WhatsApp number linked', 'Your WhatsApp number is now linked to your account.', 'verification', null);
    if ((await getSettings(env)).phone_required === 1) await welcomeBonus(env, u.aid, true);   // same ref as signup, so it can never pay twice
    return json(env, { ok: true, linked: true });
  }
  return null;
}
