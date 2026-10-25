// Recovery email for ANY person (Gmail, Yahoo, university, anything). Optional. Used only for "Forgot password".
// We never keep the address, only a keyed hash. A 6-digit code proves the person owns it before it is saved.
import { json, err, sb, rows, post, patch, enc, H, tsEqual, throttle, tooMany, ahead, user } from './lib.js';
import { mailReady, sendMail, codeEmail } from './mail.js';
import { CODE_MINUTES, CODE_TRIES, CODE_SENDS, CODE_LIMIT_MSG, keepOld, hasHash, markUsed, USED_MSG } from './trust.js';

export function normAnyEmail(v) {
  const raw = String(v || '').trim().toLowerCase();
  if (raw.length > 120 || !/^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(raw)) return null;
  const [l0, domain] = raw.split('@'), local = l0.split('+')[0];
  if (!local) return null;
  // canon = how emails were hashed before (kept so saved emails still match). gmail = Gmail ignores dots, so a.b@gmail.com and ab@gmail.com are one mailbox.
  const gmail = /^(gmail|googlemail)\.com$/.test(domain) ? local.replace(/\./g, '') + '@gmail.com' : local + '@' + domain;
  // same = the typed address reaches the same mailbox as the saved form. Gmail ignores dots and +tags. Other providers may treat bob+x@ as a different mailbox, so a +tag there is NOT the same.
  return { email: raw, canon: local + '@' + domain, gmail, same: /^(gmail|googlemail)\.com$/.test(domain) || l0 === local };
}
const mask = (e) => { const [l, d] = e.split('@'); return (l.length > 2 ? l.slice(0, 2) : l.slice(0, 1)) + '***@' + d; };

export async function recoveryRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/me/recovery-email')) return null;
  const body = async () => (await req.json().catch(() => ({})));
  const u = await user(req, env, m !== 'GET'); if (u instanceof Response) return u;

  if (path === '/api/me/recovery-email' && m === 'GET') {
    const [v] = await rows(await sb(env, `recovery_email_codes?select=*&aid=eq.${enc(u.aid)}`));
    return json(env, { available: mailReady(env), has_email: !!u.recovery_email_hash, code_pending: !!(v && !v.used_at && Date.parse(v.expires_at) > Date.now()), code_used: !!(v && v.used_at) });
  }
  if (path === '/api/me/recovery-email/start' && m === 'POST') {
    if (!mailReady(env)) return err(env, 'Email is not switched on yet', 503);
    const e = normAnyEmail((await body()).email);
    if (!e) return err(env, 'Enter a real email address, for example name@gmail.com');
    const [cur] = await rows(await sb(env, `recovery_email_codes?select=*&aid=eq.${enc(u.aid)}`));
    if (cur && Date.now() - Date.parse(cur.sent_at) < 60e3) return err(env, 'Wait a minute before asking for another code', 429);
    if (!(await throttle(env, ip, 'recemail', u.aid, CODE_SENDS, 30))) return err(env, CODE_LIMIT_MSG, 429);
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1e6).padStart(6, '0');
    if (cur) await sb(env, `recovery_email_codes?aid=eq.${enc(u.aid)}`, { method: 'DELETE' });
    const saved = await post(env, 'recovery_email_codes', {
      aid: u.aid, email_hash: await H(env, 'recemail:' + e.gmail), code_hash: keepOld(cur, await H(env, `reccode:${u.aid}:${code}`), await H(env, 'recemail:' + e.gmail)),
      expires_at: ahead(CODE_MINUTES * 60e3), attempts: 0, sent_at: new Date().toISOString(),
    }, 'resolution=merge-duplicates,return=representation');
    if (!saved.ok) return err(env, 'Could not start. Run supabase/recovery-email.sql in Supabase first.', 500);
    const sent = await sendMail(env, {
      to: e.email, subject: 'Your Comrade Connect recovery email code',
      ...codeEmail(env, {
        name: u.handle ? '@' + u.handle : '', code, minutes: CODE_MINUTES, heading: 'Confirm your recovery email',
        lead: 'You asked to save this email as the recovery email for your Comrade Connect account. It is what lets you reset a forgotten password.',
        steps: ['Open Comrade Connect and go to Me, then Verification.', 'Type the 6-digit code above.', 'Your recovery email is saved and Forgot password will work.'],
        ignore: 'If you did not ask for this, you can ignore this email. Nothing is saved without the code.',
      }),
    });
    if (!sent) { await sb(env, `recovery_email_codes?aid=eq.${enc(u.aid)}`, { method: 'DELETE' }); return err(env, 'Could not send the email. Check the address and try again.', 502); }
    return json(env, { ok: true, sent_to: mask(e.email), expires_minutes: CODE_MINUTES });
  }
  if (path === '/api/me/recovery-email/confirm' && m === 'POST') {
    const code = String((await body()).code || '').replace(/\D/g, '');
    if (code.length !== 6) return err(env, 'The code has 6 digits');
    if (!(await throttle(env, ip, 'recemail2', u.aid, 30, 60))) return tooMany(env);   // rate limit on saving
    const [v] = await rows(await sb(env, `recovery_email_codes?aid=eq.${enc(u.aid)}`));
    if (!v) return err(env, 'Ask for a code first', 404);
    if (!v.used_at && Date.parse(v.expires_at) < Date.now()) { await sb(env, `recovery_email_codes?aid=eq.${enc(u.aid)}`, { method: 'DELETE' }); return err(env, 'That code expired. Ask for a new one.', 410); }
    if (v.attempts >= CODE_TRIES) return err(env, 'Too many wrong codes. Ask for a new one.', 429);
    const took = await rows(await patch(env, `recovery_email_codes?aid=eq.${enc(u.aid)}&attempts=eq.${v.attempts}`, { attempts: v.attempts + 1 }));
    if (!took.length) return err(env, 'Try again in a moment', 429);
    if (!hasHash(v.code_hash, await H(env, `reccode:${u.aid}:${code}`))) return err(env, `Wrong code. ${CODE_TRIES - 1 - v.attempts} tries left.`, 400);
    if (v.used_at) return err(env, USED_MSG, 410);
    const [taken] = await rows(await sb(env, `profiles?select=aid&recovery_email_hash=eq.${enc(v.email_hash)}&aid=neq.${enc(u.aid)}&limit=1`));
    if (taken) return err(env, 'Could not save that email. Try another one.', 400);   // one email, one account, so a reset by email is never ambiguous
    const res = await patch(env, `profiles?aid=eq.${enc(u.aid)}`, { recovery_email_hash: v.email_hash });
    if (!res.ok) return err(env, 'Could not save. Run supabase/recovery-email.sql in Supabase first.', 500);
    await markUsed(env, 'recovery_email_codes', u.aid);
    return json(env, { ok: true, has_email: true });
  }
  if (path === '/api/me/recovery-email/remove' && m === 'POST') {
    await patch(env, `profiles?aid=eq.${enc(u.aid)}`, { recovery_email_hash: null });
    await sb(env, `recovery_email_codes?aid=eq.${enc(u.aid)}`, { method: 'DELETE' });
    return json(env, { ok: true });
  }
  return null;
}
