// Accounts, wallet, withdrawals and referrals.
import { json, err, sb, rows, one, post, patch, enc, str, int, UUID, H, tsEqual, randHex, throttle, bump, tooMany, user, authProfile, contactBlock, ahead, ago, DAY, hashPassword, checkPassword, goodPassword } from './lib.js';
import { credit } from './pay.js';
import { badgeKind, reservedHandle } from './lib.js';
import { getSettings, withdrawFee, publicConfig } from './settings.js';
import { trySendNow, reconcilePayouts } from './payouts.js';
import { notify, notifyAdmins } from './notifications.js';
import { passwordProblem } from './passwords.js';
import { deviceGate, deviceClaim, deviceBindIfFree } from './device.js';
import { normAnyEmail } from './recovery.js';

// Welcome bonus: credited once per account (the ref makes a second credit impossible). Never breaks signup.
async function welcomeBonus(env, aid) {
  try {
    const n = Math.floor(Number((await getSettings(env)).signup_bonus) || 0);
    if (n < 1) return;
    if (await credit(env, aid, n, 'adjustment', 'welcome:' + aid, 'Welcome bonus')) await notify(env, aid, 'reward', 'Welcome to Comrade Connect', 'KSh ' + n + ' was added to your wallet.', 'wallet', null);
  } catch (e) { console.error('welcome bonus failed', e && e.message); }
}

export async function balance(env, aid) {
  const r = await sb(env, 'rpc/wallet_balance', { method: 'POST', body: JSON.stringify({ p: aid }) });
  const n = await r.json().catch(() => 0);
  return Number.isFinite(Number(n)) ? Number(n) : 0;
}

// Referral rewards become spendable only after the refund window (unlock_at) and only if the order was not refunded.
export async function unlockReferrals(env, aid) {
  const q = `referrals?status=eq.pending&unlock_at=lte.${new Date().toISOString()}` + (aid ? `&referrer_aid=eq.${enc(aid)}` : '') + '&limit=100';
  let n = 0;
  for (const r of await rows(await sb(env, q))) {
    const o = r.order_id ? await one(await sb(env, `orders?select=status,dispute_status&id=eq.${r.order_id}`)) : null;
    if (!o || o.status === 'refunded') { await patch(env, `referrals?id=eq.${r.id}&status=eq.pending`, { status: 'void' }); continue; }
    if (o.status === 'disputed' || o.dispute_status === 'open') continue;          // wait for the dispute to end
    const done = await rows(await patch(env, `referrals?id=eq.${r.id}&status=eq.pending`, { status: 'unlocked' }));
    if (done.length) { await credit(env, r.referrer_aid, r.reward, 'referral', r.id, 'Referral reward'); await notify(env, r.referrer_aid, 'reward', 'Referral reward unlocked', 'KSh ' + r.reward + ' was added to your wallet.', 'referral', null); n++; }
  }
  return n;
}

const RELAY = new Map();   // state -> { cred, at }  (one API instance, see render.yaml)
// Verify a Google ID token with Google's tokeninfo endpoint. Returns { sub } or null.
async function googleVerify(env, credential) {
  if (!env.GOOGLE_CLIENT_ID || !credential) return null;
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
    if (!r.ok) return null;
    const g = await r.json();
    const okIss = g.iss === 'accounts.google.com' || g.iss === 'https://accounts.google.com';
    if (!g.sub || g.aud !== env.GOOGLE_CLIENT_ID || !okIss || Number(g.exp) * 1000 < Date.now()) return null;
    return { sub: String(g.sub), email: String(g.email || ''), emailVerified: g.email_verified === true || g.email_verified === 'true' };
  } catch (e) { return null; }
}
// Google already proved the person owns this email, so it becomes their recovery email for "Forgot password" with no code needed.
// It never replaces an email the person chose themselves, never blocks sign-in, and is skipped if another account already uses it.
async function saveGoogleRecoveryEmail(env, aid, g) {
  try {
    if (!g || !g.email || !g.emailVerified) return;
    const e = normAnyEmail(g.email); if (!e) return;
    const [cur] = await rows(await sb(env, `profiles?select=recovery_email_hash&aid=eq.${enc(aid)}`));
    if (!cur || cur.recovery_email_hash) return;
    const h = await H(env, 'recemail:' + e.gmail);
    const [taken] = await rows(await sb(env, `profiles?select=aid&recovery_email_hash=eq.${enc(h)}&aid=neq.${enc(aid)}&limit=1`));
    if (taken) return;
    await patch(env, `profiles?aid=eq.${enc(aid)}`, { recovery_email_hash: h });
  } catch (e) { console.error('google recovery email: could not save'); }
}
// A guest account with orders, listings or money must not be silently abandoned.
async function hasActivity(env, aid) {
  if ((await balance(env, aid)) !== 0) return true;
  for (const col of ['buyer_aid', 'seller_aid'])
    if ((await rows(await sb(env, `orders?select=id&${col}=eq.${enc(aid)}&limit=1`))).length) return true;
  return (await rows(await sb(env, `listings?select=id&seller_aid=eq.${enc(aid)}&limit=1`))).length > 0;
}

export async function accountRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/auth/') && !path.startsWith('/api/me') && !path.startsWith('/api/wallet') && !path.startsWith('/api/referral')) return null;
  const body = async () => (await req.json().catch(() => ({})));

  // Create an account. The token proves this device owns the aid; the recovery code is shown once and stored hashed.
  if (path === '/api/auth/register' && m === 'POST') {
    if (!(await throttle(env, ip, 'register', ip, 20, 20))) return tooMany(env);
    const b = await body();
    let aid = str(b.aid, 64);
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(aid)) aid = 'u_' + randHex(8);
    if (await one(await sb(env, `profiles?select=aid&aid=eq.${enc(aid)}`))) return err(env, 'This account already exists. Use your recovery code.', 409);
    const dg = await deviceGate(env, req); if (dg) return dg;
    const token = randHex(24), recovery = randHex(6).toUpperCase(), refcode = randHex(4).toUpperCase();
    if (b.password !== undefined && b.password !== null && b.password !== '') {       // the person chose a username and a password: no random code
      const handle = str(b.handle, 20), pw = String(b.password);
      if (!/^[A-Za-z0-9_]{3,20}$/.test(handle)) return err(env, 'Username: 3 to 20 letters, numbers or _');
      if (reservedHandle(env, handle)) return err(env, 'That username is reserved. Please choose another.', 403);
      const blk = contactBlock(env, handle); if (blk) return blk;
      const weak1 = await passwordProblem(env, pw, handle); if (weak1) return err(env, weak1);
      const res = await post(env, 'profiles', { aid, handle, token_hash: await H(env, 'tok:' + token), recovery_hash: await hashPassword(pw), referral_code: refcode });
      if (res.status === 409) return err(env, 'That username is already taken', 409);
      if (!res.ok) return err(env, 'Could not create the account', 500);
      const dc = await deviceClaim(env, req, aid); if (dc) return dc;
      await welcomeBonus(env, aid);
      return json(env, { aid, handle, token, referral_code: refcode }, 201);
    }
    const res = await post(env, 'profiles', { aid, token_hash: await H(env, 'tok:' + token), recovery_hash: await H(env, `rec:${aid}:${recovery}`), referral_code: refcode });
    if (res.status === 409) return err(env, 'This account already exists. Use your recovery code.', 409);
    if (!res.ok) return err(env, 'Could not create the account', 500);
    const dc2 = await deviceClaim(env, req, aid); if (dc2) return dc2;
    await welcomeBonus(env, aid);
    return json(env, { aid, token, recovery_code: recovery, referral_code: refcode }, 201);
  }
  // Google sign-in relay for the Android app. The callback page drops the Google sign-in here, keyed by the secret "state" that only the app knows,
  // and the app collects it once (about 3 minutes max). It is the backup way back when Android blocks the app link from the browser tab.
  if (path === '/api/auth/relay') {
    const nowMs = Date.now();
    for (const [k, v] of RELAY) if (nowMs - v.at > 180000) RELAY.delete(k);
    if (RELAY.size > 2000) RELAY.clear();
    if (m === 'POST') {
      if (!(await throttle(env, ip, 'relay', ip, 30, 30))) return tooMany(env);
      const rb = await body(), st = str(rb.state, 64), cred = str(rb.credential, 4000);
      if (!/^[a-f0-9]{32}$/.test(st) || !cred) return err(env, 'Bad request', 400);
      if (!(await googleVerify(env, cred))) return err(env, 'Google sign-in failed. Try again.', 401);
      RELAY.set(st, { cred, at: nowMs });
      return json(env, { ok: true });
    }
    if (m === 'GET') {
      const st = String(url.searchParams.get('state') || '').slice(0, 64);
      if (!/^[a-f0-9]{32}$/.test(st)) return err(env, 'Bad request', 400);
      const hit = RELAY.get(st);
      if (!hit) return json(env, { ready: false });
      RELAY.delete(st);
      return json(env, { ready: true, credential: hit.cred });
    }
  }
  // One-tap Google sign-in. Creates an account, links Google to the guest account on this phone, or signs in to the linked account.
  if (path === '/api/auth/google' && m === 'POST') {
    if (!env.GOOGLE_CLIENT_ID) return err(env, 'Google sign-in is not set up yet', 503);
    if (!(await throttle(env, ip, 'google', ip, 20, 20))) return tooMany(env);
    const gb = await body(), mode = gb.mode === 'link' ? 'link' : 'signin';
    const g = await googleVerify(env, str(gb.credential, 4000));
    if (!g) return err(env, 'Google sign-in failed. Try again.', 401);
    const cur = await authProfile(req, env);                       // guest account already on this phone, if any
    const token = randHex(24), tokHash = await H(env, 'tok:' + token);
    const existing = await one(await sb(env, `profiles?google_sub=eq.${enc(g.sub)}&limit=1`));
    if (existing) {
      if (existing.banned) return err(env, 'This account is suspended', 403);
      if (cur && cur.aid !== existing.aid && (await hasActivity(env, cur.aid)))
        return err(env, 'This phone has a guest account with orders or money. Restore it with its recovery code first.', 409);
      await patch(env, `profiles?aid=eq.${enc(existing.aid)}`, { token_hash: tokHash });
      await deviceBindIfFree(env, req, existing.aid);
      await saveGoogleRecoveryEmail(env, existing.aid, g);
      return json(env, { aid: existing.aid, token });
    }
    // Sign-in picks the account you chose. The guest account on this phone is only adopted when you asked to add Google to it (mode link) or it already holds orders, money or listings.
    if (cur && !cur.banned && !cur.google_sub && (mode === 'link' || (await hasActivity(env, cur.aid)))) {
      const res = await patch(env, `profiles?aid=eq.${enc(cur.aid)}`, { google_sub: g.sub, token_hash: tokHash });
      if (res.status === 409) return err(env, 'This Google account is already in use', 409);
      await saveGoogleRecoveryEmail(env, cur.aid, g);
      return json(env, { aid: cur.aid, token, linked: true });
    }
    const dg2 = await deviceGate(env, req); if (dg2) return dg2;
    const aid = 'u_' + randHex(8), refcode = randHex(4).toUpperCase();
    const res = await post(env, 'profiles', { aid, token_hash: tokHash, google_sub: g.sub, referral_code: refcode });
    if (!res.ok) return err(env, 'Could not create the account', 500);
    const dc3 = await deviceClaim(env, req, aid); if (dc3) return dc3;
    await welcomeBonus(env, aid);
    await saveGoogleRecoveryEmail(env, aid, g);
    return json(env, { aid, token, referral_code: refcode, created: true }, 201);
  }
  // Sign out: the token this phone was using stops working (a new one is made by Google sign-in or the recovery code).
  if (path === '/api/auth/logout' && m === 'POST') {
    const p = await authProfile(req, env);
    if (p) await patch(env, `profiles?aid=eq.${enc(p.aid)}`, { token_hash: await H(env, 'tok:' + randHex(24)) });
    return json(env, { ok: true });
  }
  // Get a new token with the recovery code (also rotates the token, so a lost device is cut off).
  if (path === '/api/auth/recover' && m === 'POST') {
    const b = await body(); const who = str(b.aid || b.handle || b.username, 64), raw = String(b.password ?? b.recovery_code ?? '').slice(0, 100);   // account ID or username; recovery code or password
    const whoKey = who.toLowerCase() || 'x';
    if (!(await throttle(env, ip, 'recover', whoKey + '|' + ip, 15, 60))) return tooMany(env);
    if (!(await bump(env, 'recoverall:' + whoKey, 200))) return tooMany(env);
    let p = who ? await one(await sb(env, `profiles?aid=eq.${enc(who)}`)) : null;
    if (!p && /^[A-Za-z0-9_]{3,20}$/.test(who)) {                                    // not an account ID: try it as a username
      p = await one(await sb(env, `profiles?handle=eq.${enc(who)}`));
      if (!p) { const c = await one(await sb(env, `profiles?handle=ilike.${enc(who.replace(/_/g, '\\_'))}`)); if (c && String(c.handle).toLowerCase() === who.toLowerCase()) p = c; }
    }
    const ok = !!(p && p.recovery_hash) && (String(p.recovery_hash).startsWith('pw1:') ? await checkPassword(p.recovery_hash, raw) : tsEqual(p.recovery_hash, await H(env, `rec:${p.aid}:${raw.trim().toUpperCase().slice(0, 40)}`)));
    if (!ok) return err(env, 'Wrong account or recovery code', 401);
    if (p.banned) return err(env, 'This account is suspended', 403);
    const aid = p.aid, token = randHex(24);
    await patch(env, `profiles?aid=eq.${enc(aid)}`, { token_hash: await H(env, 'tok:' + token) });
    await deviceBindIfFree(env, req, aid);
    return json(env, { aid, token });
  }

  if (path === '/api/me' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const pw = await one(await sb(env, `profiles?select=recovery_hash&aid=eq.${enc(u.aid)}`));
    return json(env, { has_password: !!(pw && String(pw.recovery_hash || '').startsWith('pw1:')), aid: u.aid, handle: u.handle, points: u.points, verified: u.verified, student_verified: !!u.student_verified, badge: u.badge || null, badge_kind: badgeKind(u), role: u.role, adult_confirmed: u.adult_confirmed, referral_code: u.referral_code, balance: await balance(env, u.aid) });
  }
  if (path === '/api/me/handle' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const handle = str((await body()).handle, 20);
    if (!/^[A-Za-z0-9_]{3,20}$/.test(handle)) return err(env, 'Handle: 3 to 20 letters, numbers or _');
    if (reservedHandle(env, handle, u)) return err(env, 'That name is reserved. Please choose another.', 403);
    const blk = contactBlock(env, handle); if (blk) return blk;
    const res = await patch(env, `profiles?aid=eq.${enc(u.aid)}`, { handle });
    if (res.status === 409) return err(env, 'That handle is taken', 409);
    return json(env, { handle });
  }
  // Choose your own username and password (for guest and Google accounts), or change them. Changing needs the current password.
  if (path === '/api/me/credentials' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    if (!(await throttle(env, ip, 'cred', u.aid, 10, 30))) return tooMany(env);
    const b = await body(), handle = str(b.handle, 20), pw = String(b.password || '');
    if (!/^[A-Za-z0-9_]{3,20}$/.test(handle)) return err(env, 'Username: 3 to 20 letters, numbers or _');
    if (reservedHandle(env, handle, u)) return err(env, 'That username is reserved. Please choose another.', 403);
    const blk = contactBlock(env, handle); if (blk) return blk;
    const weak2 = await passwordProblem(env, pw, handle); if (weak2) return err(env, weak2);
    const cur = await one(await sb(env, `profiles?select=recovery_hash&aid=eq.${enc(u.aid)}`));
    if (cur && String(cur.recovery_hash || '').startsWith('pw1:') && !(await checkPassword(cur.recovery_hash, String(b.current || '').slice(0, 100)))) return err(env, 'Your current password is wrong', 403);
    const res = await patch(env, `profiles?aid=eq.${enc(u.aid)}`, { handle, recovery_hash: await hashPassword(pw) });
    if (res.status === 409) return err(env, 'That username is already taken', 409);
    if (!res.ok) return err(env, 'Could not save. Try again.', 500);
    return json(env, { ok: true, handle, has_password: true });
  }
  if (path === '/api/me/adult' && m === 'POST') {       // self-declaration only; this is not age verification
    const u = await user(req, env, true); if (u instanceof Response) return u;
    if ((await body()).confirm !== true) return err(env, 'Confirm that you are 18 or older');
    await patch(env, `profiles?aid=eq.${enc(u.aid)}`, { adult_confirmed: true });
    return json(env, { ok: true });
  }

  // ---------- wallet ----------
  if (path === '/api/wallet' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    await reconcilePayouts(env, u.aid).catch(() => {});          // pick up the result of automatic payouts
    const ledger = await rows(await sb(env, `wallet_ledger?select=delta,kind,status,note,created_at&aid=eq.${enc(u.aid)}&order=created_at.desc&limit=50`));
    // History = everything except rejected. A rejected one is sent only for 3 days so the phone can announce "money returned" once; the screen never lists it.
    const cols = 'id,amount,fee,net,status,payout_ref,created_at', a = enc(u.aid);
    const wd = [...await rows(await sb(env, `withdrawals?select=${cols}&aid=eq.${a}&status=neq.rejected&order=created_at.desc&limit=20`)),
      ...await rows(await sb(env, `withdrawals?select=${cols}&aid=eq.${a}&status=eq.rejected&decided_at=gte.${ago(3 * DAY)}&order=created_at.desc&limit=5`))]
      .sort((x, y) => (x.created_at < y.created_at ? 1 : -1));
    return json(env, { balance: await balance(env, u.aid), ledger, withdrawals: wd, rules: publicConfig(await getSettings(env), env) });
  }
  if (path === '/api/wallet/stats' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const list = await rows(await sb(env, `wallet_ledger?select=delta,kind,status,note,created_at&aid=eq.${enc(u.aid)}&status=neq.void&created_at=gte.${enc(ago(90 * DAY))}&order=created_at.desc&limit=1000`));
    return json(env, { balance: await balance(env, u.aid), ledger: list });
  }
  if (path === '/api/wallet/stats' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const list = await rows(await sb(env, `wallet_ledger?select=delta,kind,status,note,created_at&aid=eq.${enc(u.aid)}&status=neq.void&created_at=gte.${enc(ago(90 * DAY))}&order=created_at.desc&limit=1000`));
    return json(env, { balance: await balance(env, u.aid), ledger: list });
  }
  if (path === '/api/wallet/withdraw' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    if ((env.WITHDRAW_REQUIRES_VERIFIED ?? '1') === '1' && !u.verified) return err(env, 'Verify your ID before withdrawing', 403);
    const b = await body(), S = await getSettings(env);   // cc-phase5: every refusal says exactly why and what to change
    const phone = String(b.phone || '').replace(/\D/g, '');
    const norm = /^0[17]\d{8}$/.test(phone) ? '254' + phone.slice(1) : /^254[17]\d{8}$/.test(phone) ? phone : null;
    const want = Math.floor(Number(b.amount));
    if (!norm) return err(env, 'Enter a Safaricom or Airtel number like 0712345678.');
    if (!(want > 0)) return err(env, 'Enter the amount you want to withdraw, in whole shillings.');
    const have = await balance(env, u.aid), netMin = publicConfig(S, env).payout_net_min;
    let lowest = Math.max(1, S.withdraw_min);                    // smallest amount that is allowed AND leaves at least netMin after the fee
    while (lowest < S.withdraw_max && lowest - withdrawFee(lowest, S) < netMin && lowest < S.withdraw_min + netMin * 2 + S.withdraw_fee_flat + 60) lowest++;
    if (want < lowest) return err(env, 'The lowest you can withdraw is KSh ' + lowest + (lowest > S.withdraw_min ? ' (M-Pesa must be able to send at least KSh ' + netMin + ' after the fee)' : '') + '. You asked for KSh ' + want + '.' + (have < lowest ? ' Your wallet has KSh ' + have + ', so add KSh ' + (lowest - have) + ' more first.' : ''));
    if (want > S.withdraw_max) return err(env, 'The most you can withdraw in one go is KSh ' + S.withdraw_max + '. Withdraw that or less.');
    if (have < want) return err(env, 'Your wallet has KSh ' + have + ', which is KSh ' + (want - have) + ' short of KSh ' + want + '. Withdraw KSh ' + have + ' or less.');
    const amount = want;
    const fee = withdrawFee(amount, S);
    const w = await one(await post(env, 'withdrawals', { aid: u.aid, amount, phone: norm, fee, net: amount - fee }));
    if (!w) return err(env, 'Could not save the request', 500);
    if (!(await credit(env, u.aid, -amount, 'withdrawal', w.id, 'Withdrawal request'))) {   // debit not saved: never send money out for it
      await patch(env, `withdrawals?id=eq.${w.id}`, { status: 'rejected' });
      return err(env, 'We could not process that right now. Nothing was taken from your wallet. Please try again.', 503);
    }
    if ((await balance(env, u.aid)) < 0) {                      // two requests raced: undo this one
      await patch(env, `wallet_ledger?kind=eq.withdrawal&ref=eq.${w.id}`, { status: 'void' });
      await patch(env, `withdrawals?id=eq.${w.id}`, { status: 'rejected' });
      return err(env, 'Not enough available balance');
    }
    const how = await trySendNow(env, w).catch((e) => { console.error('payout error', e && e.message); return 'manual'; });
    if (how === 'manual') await notifyAdmins(env, 'withdraw_request', 'New withdrawal request', 'KSh ' + (amount - fee) + ' to ' + norm + '. Send it by M-Pesa, then mark it Paid or Rejected.', 'withdrawal_request', w.id);   // cc-fix11
    if (how === 'toosmall') return err(env, 'That is below the smallest amount M-Pesa can send. Your money is still in your wallet.');
    if (how === 'limit') return err(env, 'You have reached the limit of KSh ' + publicConfig(S, env).payout_daily_max + ' in any 24 hours. Your money is still in your wallet. Try again later, the limit frees up as older withdrawals pass 24 hours.');
    if (how === 'refused') return err(env, 'We could not send to M-Pesa right now. Your money is still in your wallet. Please try again in a few minutes.', 502);
    await notify(env, u.aid, 'payout', how === 'sending' ? 'Withdrawal on its way' : 'Withdrawal requested', 'KSh ' + (amount - fee) + ' to ' + norm.replace(/^254/, '0') + (how === 'sending' ? ' is being sent to your M-Pesa.' : ' was requested. We will send it by M-Pesa soon.'), 'withdrawal', w.id);
    return json(env, { id: w.id, status: how === 'sending' ? 'sending' : 'requested', fee, net: amount - fee }, 201);
  }
  // The seller can take back a request the admin has not paid yet. One conditional UPDATE, so cancel and "paid" can never both win.
  const wc = path.match(/^\/api\/wallet\/withdraw\/([0-9a-f-]{36})\/cancel$/);
  if (wc && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const [w] = await rows(await patch(env, `withdrawals?id=eq.${wc[1]}&aid=eq.${enc(u.aid)}&status=eq.requested`, { status: 'rejected', decided_by: 'user', decided_at: new Date().toISOString() }));
    if (!w) return err(env, 'This request was already handled', 409);
    await credit(env, w.aid, w.amount, 'adjustment', 'wdrej:' + w.id, 'Withdrawal cancelled, money returned');
    await notify(env, w.aid, 'payout', 'Withdrawal cancelled', 'KSh ' + w.amount + ' is back in your wallet.', 'withdrawal', w.id);
    return json(env, { ok: true });
  }

  // ---------- referrals ----------
  if (path === '/api/referral/attribute' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const code = str((await body()).code, 12).toUpperCase();
    if (!(await throttle(env, ip, 'refattr', u.aid, 5, 20))) return tooMany(env);
    const ref = code ? await one(await sb(env, `profiles?select=aid&referral_code=eq.${enc(code)}`)) : null;
    if (!ref || ref.aid === u.aid) return err(env, 'Invalid referral code', 404);
    const paid = await rows(await sb(env, `orders?select=id&buyer_aid=eq.${enc(u.aid)}&limit=1`));
    if (paid.length) return err(env, 'Referral codes only work before your first purchase', 400);
    const res = await post(env, 'referrals', { referrer_aid: ref.aid, referred_aid: u.aid, reward: (await getSettings(env)).referral_reward });
    if (res.status === 409) return err(env, 'You already used a referral code', 409);
    if (res.ok) await notify(env, ref.aid, 'referral', 'A friend joined with your code', 'Your reward unlocks after their first Market purchase and the refund window.', 'referral', null);
    return json(env, { ok: true }, 201);
  }
  if (path === '/api/referral/me' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    await unlockReferrals(env, u.aid);
    const mine = await rows(await sb(env, `referrals?select=status,reward,unlock_at&referrer_aid=eq.${enc(u.aid)}`));
    const by = await one(await sb(env, `referrals?select=id&referred_aid=eq.${enc(u.aid)}`));
    return json(env, {
      code: u.referral_code, referred_by_someone: !!by,
      pending: mine.filter((r) => r.status === 'pending').length,
      unlocked: mine.filter((r) => r.status === 'unlocked').length,
      earned: mine.filter((r) => r.status === 'unlocked').reduce((s, r) => s + r.reward, 0),
      unlock_days: Number(env.REFERRAL_UNLOCK_DAYS || 7),
    });
  }
  return null;
}
