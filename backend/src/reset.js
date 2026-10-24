// Forgot password, email only. The person types the email saved on their account (Me > Verification, or the
// student email they verified). A 6-digit code is emailed to it, then they choose a new password.
// We never store the address, only a keyed hash, so we hash what was typed and look the account up by that hash.
// Replies never reveal whether an account exists. Needs the mail settings (BREVO_API_KEY or RESEND_API_KEY, and MAIL_FROM).
import { json, err, sb, rows, one, post, patch, enc, H, tsEqual, randHex, throttle, bump, tooMany, ahead, hashPassword, isAdmin } from './lib.js';
import { mailReady, sendMailDetailed, mailDiagnosis } from './mail.js';
import { normStudentEmail, studentDomains, CODE_MINUTES, CODE_TRIES, markUsed, USED_MSG } from './trust.js';
import { passwordProblem } from './passwords.js';
import { normAnyEmail } from './recovery.js';

const OK_MSG = 'If that email is saved on an account, a code is on its way. Check your inbox and spam folder.';

// The account whose saved email (recovery email first, then verified student email) matches what was typed.
async function findByEmail(env, raw) {
  const e = normAnyEmail(raw); if (!e) return null;
  let p = null;
  for (const c of new Set([e.gmail, e.canon])) {                       // new hashing first, then the older one, so emails saved before still match
    const res = await sb(env, `profiles?recovery_email_hash=eq.${enc(await H(env, 'recemail:' + c))}&order=created_at.desc&limit=1`);
    if (!res.ok) console.error('reset: account lookup failed', res.status, 'run supabase/recovery-email.sql if the column recovery_email_hash is missing');
    p = await one(res); if (p) break;
  }
  const se = normStudentEmail(env, raw);
  if (!p && se) p = await one(await sb(env, `profiles?student_email_hash=eq.${enc(await H(env, 'stuemail:' + se.canon))}&limit=1`));
  return p ? { p, e } : { p: null, e };
}

export async function resetRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;

  // Admin only: send a test email and show exactly what the mail provider answered. Use it when reset codes do not arrive.
  //   curl -X POST $API/api/admin/mail-test -H "X-Admin-Key: $ADMIN_KEY" -H "Content-Type: application/json" -d '{"to":"you@gmail.com"}'
  if (path === '/api/admin/mail-test' && (m === 'POST' || m === 'GET')) {
    if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);
    const diag = mailDiagnosis(env);
    if (m === 'GET') return json(env, diag);
    const to = normAnyEmail((await req.json().catch(() => ({}))).to);
    if (!to) return err(env, 'Send {"to":"your@email.com"}');
    const r = await sendMailDetailed(env, { to: to.email, subject: 'Comrade Connect mail test', text: 'If you can read this, the mail settings work. Check the spam folder if it was not in your inbox.' });
    return json(env, { ...diag, sent: r.ok, provider_status: r.status, provider_says: r.detail || (r.ok ? 'accepted' : '') }, r.ok ? 200 : 502);
  }
  if (!path.startsWith('/api/auth/reset')) return null;
  const body = async () => (await req.json().catch(() => ({})));

  if (path === '/api/auth/reset/available' && m === 'GET') return json(env, { available: mailReady(env), domains: studentDomains(env) });

  // Step 1: ask for a code.
  if (path === '/api/auth/reset/start' && m === 'POST') {
    if (!mailReady(env)) return err(env, 'Password reset by email is not switched on yet', 503);
    const b = await body(), e0 = normAnyEmail(b.email);
    if (!e0) return err(env, 'Enter the email address saved on your account');
    if (!(await throttle(env, ip, 'pwreset', e0.canon + '|' + ip, 5, 15))) return tooMany(env);
    if (!(await bump(env, 'pwresetall:a:' + e0.canon, 30))) return tooMany(env);
    const { p, e } = await findByEmail(env, b.email);
    if (!p) console.log('reset: no account has that email saved (nothing sent)');
    else if (p.banned) console.log('reset: account is banned (nothing sent)');
    if (p && !p.banned) {
      const [cur] = await rows(await sb(env, `password_resets?select=sent_at&aid=eq.${enc(p.aid)}`));
      if (cur && Date.now() - Date.parse(cur.sent_at) < 60e3) console.log('reset: asked again within a minute (nothing sent)');
      if (!cur || Date.now() - Date.parse(cur.sent_at) >= 60e3) {
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1e6).padStart(6, '0');
        if (cur) await sb(env, `password_resets?aid=eq.${enc(p.aid)}`, { method: 'DELETE' });
        const saved = await post(env, 'password_resets', {
          aid: p.aid, code_hash: await H(env, `pwcode:${p.aid}:${code}`), expires_at: ahead(CODE_MINUTES * 60e3), attempts: 0, sent_at: new Date().toISOString(),
        }, 'resolution=merge-duplicates,return=representation');
        if (!saved.ok) return err(env, 'Could not start the reset. Run supabase/password-reset.sql in Supabase first.', 500);
        const mailed = await sendMailDetailed(env, {
          to: e.email, subject: 'Your Comrade Connect password reset code',
          text: `Your Comrade Connect password reset code is ${code}\n\nIt works for ${CODE_MINUTES} minutes. Type it in the app, then choose a new password.\nIf you did not ask for this, ignore this email: your password stays the same.\nNever share this code with anyone.`,
        });
        if (!mailed.ok) { await sb(env, `password_resets?aid=eq.${enc(p.aid)}`, { method: 'DELETE' }); return err(env, 'Could not send the email. Try again in a moment.', 502); }
      }
    }
    return json(env, { ok: true, message: OK_MSG, expires_minutes: CODE_MINUTES });
  }

  // Step 2: email + code + new password. Wrong guesses are counted with an optimistic lock so parallel guesses cannot beat the limit.
  if (path === '/api/auth/reset/confirm' && m === 'POST') {
    const b = await body(), e0 = normAnyEmail(b.email), code = String(b.code || '').replace(/\D/g, ''), pw = String(b.password || '').slice(0, 100);
    if (!e0) return err(env, 'Enter the email address saved on your account');
    if (!(await throttle(env, ip, 'pwreset2', e0.canon + '|' + ip, 10, 30))) return tooMany(env);
    if (!(await bump(env, 'pwreset2all:a:' + e0.canon, 100))) return tooMany(env);
    if (code.length !== 6) return err(env, 'The code has 6 digits');
    const BAD = 'Wrong code, or it expired. Ask for a new one.';
    const { p } = await findByEmail(env, b.email);
    if (!p || p.banned) return err(env, BAD, 400);
    const [v] = await rows(await sb(env, `password_resets?aid=eq.${enc(p.aid)}`));
    if (!v) return err(env, BAD, 400);
    if (!v.used_at && Date.parse(v.expires_at) < Date.now()) { await sb(env, `password_resets?aid=eq.${enc(p.aid)}`, { method: 'DELETE' }); return err(env, BAD, 400); }
    if (v.attempts >= CODE_TRIES) return err(env, 'Too many wrong codes. Ask for a new one.', 429);
    const took = await rows(await patch(env, `password_resets?aid=eq.${enc(p.aid)}&attempts=eq.${v.attempts}`, { attempts: v.attempts + 1 }));
    if (!took.length) return err(env, 'Try again in a moment', 429);
    if (!tsEqual(v.code_hash, await H(env, `pwcode:${p.aid}:${code}`))) return err(env, `Wrong code. ${CODE_TRIES - 1 - v.attempts} tries left.`, 400);
    if (v.used_at) return err(env, USED_MSG, 410);   // only someone who typed the real code learns it was used
    if (b.check) {   // page step 2: the code is right. Show the username, put the try back, and keep the code alive for the password step
      await patch(env, `password_resets?aid=eq.${enc(p.aid)}&attempts=eq.${v.attempts + 1}`, { attempts: v.attempts });
      return json(env, { ok: true, verified: true, handle: p.handle || null });
    }
    const weak = await passwordProblem(env, pw, p.handle); if (weak) return err(env, weak);
    const token = randHex(24);
    const res = await patch(env, `profiles?aid=eq.${enc(p.aid)}`, { recovery_hash: await hashPassword(pw), token_hash: await H(env, 'tok:' + token) });   // a new token cuts off any other phone
    if (!res.ok) return err(env, 'Could not save the new password', 500);
    await markUsed(env, 'password_resets', p.aid);
    return json(env, { ok: true, aid: p.aid, token });
  }
  return null;
}
