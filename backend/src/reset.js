// Forgot password: a 6-digit code is emailed to the student email the person verified earlier (Me > Verification).
// We never store that address, only a keyed hash, so the person types it again and we compare hashes.
// Replies never reveal whether an account or email exists. Needs the mail settings (BREVO_API_KEY or RESEND_API_KEY, and MAIL_FROM).
import { json, err, sb, rows, one, post, patch, enc, str, H, tsEqual, randHex, throttle, tooMany, ahead, hashPassword } from './lib.js';
import { mailReady, sendMail } from './mail.js';
import { normStudentEmail, studentDomains, CODE_MINUTES, CODE_TRIES } from './trust.js';
import { passwordProblem } from './passwords.js';
import { normAnyEmail } from './recovery.js';

const OK_MSG = 'If that username and student email match an account, a code is on its way.';

async function findProfile(env, who) {
  let p = who ? await one(await sb(env, `profiles?aid=eq.${enc(who)}`)) : null;
  if (!p && /^[A-Za-z0-9_]{3,20}$/.test(who)) {
    p = await one(await sb(env, `profiles?handle=eq.${enc(who)}`));
    if (!p) { try { const c = await one(await sb(env, `profiles?handle=ilike.${enc(who.replace(/_/g, '\\_'))}`)); if (c && String(c.handle).toLowerCase() === who.toLowerCase()) p = c; } catch (e) { /* no case-insensitive match */ } }
  }
  return p;
}

export async function resetRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/auth/reset')) return null;
  const body = async () => (await req.json().catch(() => ({})));

  if (path === '/api/auth/reset/available' && m === 'GET') return json(env, { available: mailReady(env), domains: studentDomains(env) });

  // Step 1: ask for a code.
  if (path === '/api/auth/reset/start' && m === 'POST') {
    if (!mailReady(env)) return err(env, 'Password reset by email is not switched on yet', 503);
    const b = await body(), who = str(b.who || b.handle || b.aid, 64);
    if (!who) return err(env, 'Enter your username or account ID');
    if (!(await throttle(env, ip, 'pwreset', who.toLowerCase(), 5, 15))) return tooMany(env);
    const e = normAnyEmail(b.email);
    if (!e) return err(env, 'Enter the email address you saved on your account');
    const se = normStudentEmail(env, b.email);
    const p = await findProfile(env, who);
    const match = !!p && !p.banned && ((!!p.recovery_email_hash && tsEqual(p.recovery_email_hash, await H(env, 'recemail:' + e.canon)))
      || (!!se && !!p.student_email_hash && tsEqual(p.student_email_hash, await H(env, 'stuemail:' + se.canon))));
    if (match) {
      const [cur] = await rows(await sb(env, `password_resets?select=sent_at&aid=eq.${enc(p.aid)}`));
      if (!cur || Date.now() - Date.parse(cur.sent_at) >= 60e3) {
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1e6).padStart(6, '0');
        const saved = await post(env, 'password_resets', {
          aid: p.aid, code_hash: await H(env, `pwcode:${p.aid}:${code}`), expires_at: ahead(CODE_MINUTES * 60e3), attempts: 0, sent_at: new Date().toISOString(),
        }, 'resolution=merge-duplicates,return=representation');
        if (!saved.ok) return err(env, 'Could not start the reset. Run supabase/password-reset.sql in Supabase first.', 500);
        const sent = await sendMail(env, {
          to: e.email, subject: 'Your Comrade Connect password reset code',
          text: `Your Comrade Connect password reset code is ${code}\n\nIt works for ${CODE_MINUTES} minutes. Type it in the app, then choose a new password.\nIf you did not ask for this, ignore this email: your password stays the same.\nNever share this code with anyone.`,
        });
        if (!sent) { await sb(env, `password_resets?aid=eq.${enc(p.aid)}`, { method: 'DELETE' }); return err(env, 'Could not send the email. Try again in a moment.', 502); }
      }
    }
    return json(env, { ok: true, message: OK_MSG, expires_minutes: CODE_MINUTES });
  }

  // Step 2: code + new password. Wrong guesses are counted with an optimistic lock so parallel guesses cannot beat the limit.
  if (path === '/api/auth/reset/confirm' && m === 'POST') {
    const b = await body(), who = str(b.who || b.handle || b.aid, 64), code = String(b.code || '').replace(/\D/g, ''), pw = String(b.password || '').slice(0, 100);
    if (!who) return err(env, 'Enter your username or account ID');
    if (!(await throttle(env, ip, 'pwreset2', who.toLowerCase(), 10, 30))) return tooMany(env);
    if (code.length !== 6) return err(env, 'The code has 6 digits');
    const BAD = 'Wrong code, or it expired. Ask for a new one.';
    const p = await findProfile(env, who);
    if (!p || p.banned) return err(env, BAD, 400);
    const [v] = await rows(await sb(env, `password_resets?aid=eq.${enc(p.aid)}`));
    if (!v) return err(env, BAD, 400);
    if (Date.parse(v.expires_at) < Date.now()) { await sb(env, `password_resets?aid=eq.${enc(p.aid)}`, { method: 'DELETE' }); return err(env, BAD, 400); }
    if (v.attempts >= CODE_TRIES) return err(env, 'Too many wrong codes. Ask for a new one.', 429);
    const took = await rows(await patch(env, `password_resets?aid=eq.${enc(p.aid)}&attempts=eq.${v.attempts}`, { attempts: v.attempts + 1 }));
    if (!took.length) return err(env, 'Try again in a moment', 429);
    if (!tsEqual(v.code_hash, await H(env, `pwcode:${p.aid}:${code}`))) return err(env, `Wrong code. ${CODE_TRIES - 1 - v.attempts} tries left.`, 400);
    const weak = await passwordProblem(env, pw, p.handle); if (weak) return err(env, weak);
    const token = randHex(24);
    const res = await patch(env, `profiles?aid=eq.${enc(p.aid)}`, { recovery_hash: await hashPassword(pw), token_hash: await H(env, 'tok:' + token) });   // a new token cuts off any other phone
    if (!res.ok) return err(env, 'Could not save the new password', 500);
    await sb(env, `password_resets?aid=eq.${enc(p.aid)}`, { method: 'DELETE' });
    return json(env, { ok: true, aid: p.aid, token });
  }
  return null;
}
