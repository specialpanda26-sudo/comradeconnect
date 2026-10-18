// Trust and transparency: one public endpoint that states, from the live settings, how money is held, which gateway is used,
// every fee, the payout rules, the dispute process and the identity levels. The legal pages read it, so they can never
// disagree with what the server really does. Also: optional student-email verification (domain-checked, kept anonymous).
import { json, err, sb, rows, post, patch, enc, int, ahead, throttle, tooMany, user, tsEqual, H } from './lib.js';
import { getSettings, feeOf, withdrawFee, boostPlans } from './settings.js';
import { payMode, tinyKeys, manualMode } from './pay.js';
import { mailReady, sendMail } from './mail.js';

export const TRUST_UPDATED = '2026-10-18';
export const CODE_MINUTES = 15, CODE_TRIES = 5;

export const disputeHours = (env) => { const n = Number(env.DISPUTE_REVIEW_HOURS); return Number.isFinite(n) && n >= 1 && n <= 720 ? Math.floor(n) : 48; };
export const studentDomains = (env) => String(env.STUDENT_EMAIL_DOMAINS || 'kyu.ac.ke').split(',').map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);

// Accepts only a real-looking address whose domain IS a listed university domain or a subdomain of one.
// "kyu.ac.ke.evil.com" and "notkyu.ac.ke" are refused. canon is what we hash: +tags are dropped and every subdomain collapses
// to the listed domain, so one mailbox can only ever back one account.
export function normStudentEmail(env, v) {
  const raw = String(v || '').trim().toLowerCase();
  if (raw.length > 120 || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(raw)) return null;
  const [local0, domain] = raw.split('@');
  const dom = studentDomains(env).find((d) => domain === d || domain.endsWith('.' + d));
  const local = local0.split('+')[0];
  if (!dom || !local) return null;
  return { email: raw, canon: local + '@' + dom };
}
const maskEmail = (e) => { const [l, d] = e.split('@'); return (l.length > 2 ? l.slice(0, 2) : l.slice(0, 1)) + '***@' + d; };

const GATEWAYS = {
  manual: { name: 'M-Pesa sent directly to the operator', automatic: false },
  intasend: { name: 'IntaSend', automatic: true },
  tinypesa: { name: 'TinyPesa', automatic: true },
};

export async function trustInfo(env, amount = 1000) {
  const S = await getSettings(env), mode = payMode(env), tinyOk = tinyKeys(env).length > 0 && !!env.TINYPESA_USERNAME;
  const fee = feeOf(amount, S.platform_fee_percent), sellerGets = amount - fee, wFee = withdrawFee(sellerGets, S);
  return {
    updated: TRUST_UPDATED,
    operator: {
      name: String(env.OPERATOR_NAME || 'comradeconnect'), reg_no: String(env.OPERATOR_REG_NO || '') || null, odpc_no: String(env.ODPC_REG_NO || '') || null,
      address: String(env.OPERATOR_ADDRESS || 'Kerugoya, Kirinyaga, Kenya'), email: String(env.SUPPORT_EMAIL || 'support@comradeconnect.co.ke'), phone: String(env.SUPPORT_PHONE || '0720170794'),
    },
    payments: {
      mode, currency: 'KES', max_payment: 150000,
      gateway: { ...GATEWAYS[mode], fallback: mode === 'intasend' && tinyOk ? GATEWAYS.tinypesa.name : null },
      pay_type: manualMode(env) ? (['till', 'paybill'].includes(env.MPESA_PAY_TYPE) ? env.MPESA_PAY_TYPE : 'send') : null,
      pay_to_name: manualMode(env) ? String(env.MPESA_PAY_NAME || '') || null : null,
      unconfirmed_expiry_minutes: Number(env.PENDING_MINUTES || (manualMode(env) ? 90 : 30)),
    },
    fees: {
      platform_fee_percent: S.platform_fee_percent, buyer_fee_percent: 0,
      withdraw_min: S.withdraw_min, withdraw_fee_percent: S.withdraw_fee_percent, withdraw_fee_flat: S.withdraw_fee_flat,
      referral_reward: S.referral_reward, boost_plans: boostPlans(S),
      example: { sale: amount, fee, seller_receives: sellerGets, withdrawal_fee: wFee, seller_net_to_mpesa: Math.max(0, sellerGets - wFee) },
    },
    payouts: { method: 'M-Pesa, sent by our team to the number on your withdrawal request', manual: true, target_hours: Math.max(1, Math.floor(Number(env.PAYOUT_TARGET_HOURS) || 24)), cancel_until_paid: true },
    escrow: {
      auto_release_days: S.escrow_auto_release_days, code_attempt_limit: 5,
      release_by: ['buyer gives the 6-digit code to the seller', 'buyer taps "I received it"', 'automatic release if the buyer stays silent after "handed over"', 'admin decision after a dispute'],
    },
    disputes: { review_hours: disputeHours(env), decided_by: 'a Comrade Connect admin', outcomes: ['refund the buyer to the wallet', 'pay the seller'], appeal_email: String(env.SUPPORT_EMAIL || 'support@comradeconnect.co.ke') },
    identity: {
      levels: [
        { id: 'anonymous', label: 'Anonymous', needs: 'Nothing. Anyone, student or not, can join.' },
        { id: 'student', label: 'Verified student', needs: 'A working university email on an approved domain. Optional.' },
        { id: 'id', label: 'ID verified', needs: 'Photos of a student ID or national ID, checked by an admin. Needed to withdraw money.' },
      ],
      student_domains: studentDomains(env), student_email_available: mailReady(env),
      withdraw_requires_id: (env.WITHDRAW_REQUIRES_VERIFIED ?? '1') === '1',
    },
  };
}

export async function trustRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (path === '/api/trust' && m === 'GET') {
    const a = int(url.searchParams.get('amount') || 1000, 1, 150000) || 1000;
    return json(env, await trustInfo(env, a));
  }
  if (!path.startsWith('/api/verify/email')) return null;
  const body = async () => (await req.json().catch(() => ({})));

  if (path === '/api/verify/email/status' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const [v] = await rows(await sb(env, `email_verifications?select=expires_at&aid=eq.${enc(u.aid)}`));
    return json(env, { student_verified: !!u.student_verified, since: u.student_verified_at || null, available: mailReady(env), domains: studentDomains(env), code_pending: !!(v && Date.parse(v.expires_at) > Date.now()) });
  }

  // Step 1: send a 6-digit code. We store only a keyed hash of the email and of the code, never the address itself.
  if (path === '/api/verify/email/start' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    if (!mailReady(env)) return err(env, 'Student email verification is not switched on yet', 503);
    if (u.student_verified) return err(env, 'Your student email is already verified', 409);
    const e = normStudentEmail(env, (await body()).email);
    if (!e) return err(env, 'Use your university email, ending in ' + studentDomains(env).map((d) => '@' + d).join(' or '));
    if (!(await throttle(env, ip, 'stuemail', u.aid, 5, 15))) return tooMany(env);
    const [cur] = await rows(await sb(env, `email_verifications?select=sent_at&aid=eq.${enc(u.aid)}`));
    if (cur && Date.now() - Date.parse(cur.sent_at) < 60e3) return err(env, 'Wait a minute before asking for another code', 429);
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1e6).padStart(6, '0');
    const saved = await post(env, 'email_verifications', {
      aid: u.aid, email_hash: await H(env, 'stuemail:' + e.canon), code_hash: await H(env, `stucode:${u.aid}:${code}`),
      expires_at: ahead(CODE_MINUTES * 60e3), attempts: 0, sent_at: new Date().toISOString(),
    }, 'resolution=merge-duplicates,return=representation');
    if (!saved.ok) return err(env, 'Could not start verification. Run the newest SQL (end of supabase/schema.sql) in Supabase first.', 500);
    const sent = await sendMail(env, {
      to: e.email, subject: 'Your Comrade Connect student code',
      text: `Your Comrade Connect code is ${code}\n\nIt works for ${CODE_MINUTES} minutes. Type it in the app to confirm you are a student.\nIf you did not ask for this, ignore this email: nothing happens without the code.\nNever share this code with anyone.`,
    });
    if (!sent) { await sb(env, `email_verifications?aid=eq.${enc(u.aid)}`, { method: 'DELETE' }); return err(env, 'Could not send the email. Check the address and try again.', 502); }
    return json(env, { ok: true, sent_to: maskEmail(e.email), expires_minutes: CODE_MINUTES });
  }

  // Step 2: check the code. Wrong guesses are counted with an optimistic lock so parallel guesses cannot beat the limit.
  if (path === '/api/verify/email/confirm' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const code = String((await body()).code || '').replace(/\D/g, '');
    if (code.length !== 6) return err(env, 'The code has 6 digits');
    const [v] = await rows(await sb(env, `email_verifications?aid=eq.${enc(u.aid)}`));
    if (!v) return err(env, 'Ask for a code first', 404);
    if (Date.parse(v.expires_at) < Date.now()) { await sb(env, `email_verifications?aid=eq.${enc(u.aid)}`, { method: 'DELETE' }); return err(env, 'That code expired. Ask for a new one.', 410); }
    if (v.attempts >= CODE_TRIES) return err(env, 'Too many wrong codes. Ask for a new one.', 429);
    const took = await rows(await patch(env, `email_verifications?aid=eq.${enc(u.aid)}&attempts=eq.${v.attempts}`, { attempts: v.attempts + 1 }));
    if (!took.length) return err(env, 'Try again in a moment', 429);
    if (!tsEqual(v.code_hash, await H(env, `stucode:${u.aid}:${code}`))) return err(env, `Wrong code. ${CODE_TRIES - 1 - v.attempts} tries left.`, 400);
    const res = await patch(env, `profiles?aid=eq.${enc(u.aid)}`, { student_verified: true, student_verified_at: new Date().toISOString(), student_email_hash: v.email_hash });
    if (res.status === 409) return err(env, 'That student email is already linked to another account', 409);
    if (!res.ok) return err(env, 'Could not save. Run the newest SQL (end of supabase/schema.sql) in Supabase first.', 500);
    await sb(env, `email_verifications?aid=eq.${enc(u.aid)}`, { method: 'DELETE' });
    return json(env, { ok: true, student_verified: true });
  }

  // Remove the badge and forget the email fingerprint (privacy: the user can always take it back).
  if (path === '/api/verify/email/unlink' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    await patch(env, `profiles?aid=eq.${enc(u.aid)}`, { student_verified: false, student_verified_at: null, student_email_hash: null });
    return json(env, { ok: true });
  }
  return null;
}
