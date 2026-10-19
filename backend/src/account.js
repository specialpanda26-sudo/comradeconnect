// Accounts, wallet, withdrawals and referrals.
import { json, err, sb, rows, one, post, patch, enc, str, int, UUID, H, tsEqual, randHex, throttle, tooMany, user, authProfile, contactBlock, ahead, ago, DAY, hashPassword, checkPassword, goodPassword } from './lib.js';
import { credit } from './pay.js';
import { getSettings, withdrawFee, publicConfig } from './settings.js';
import { trySendNow, reconcilePayouts } from './payouts.js';

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
    if (done.length) { await credit(env, r.referrer_aid, r.reward, 'referral', r.id, 'Referral reward'); n++; }
  }
  return n;
}

// Verify a Google ID token with Google's tokeninfo endpoint. Returns { sub } or null.
async function googleVerify(env, credential) {
  if (!env.GOOGLE_CLIENT_ID || !credential) return null;
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
    if (!r.ok) return null;
    const g = await r.json();
    const okIss = g.iss === 'accounts.google.com' || g.iss === 'https://accounts.google.com';
    if (!g.sub || g.aud !== env.GOOGLE_CLIENT_ID || !okIss || Number(g.exp) * 1000 < Date.now()) return null;
    return { sub: String(g.sub) };
  } catch (e) { return null; }
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
    const token = randHex(24), recovery = randHex(6).toUpperCase(), refcode = randHex(4).toUpperCase();
    if (b.password !== undefined && b.password !== null && b.password !== '') {       // the person chose a username and a password: no random code
      const handle = str(b.handle, 20), pw = String(b.password);
      if (!/^[A-Za-z0-9_]{3,20}$/.test(handle)) return err(env, 'Username: 3 to 20 letters, numbers or _');
      const blk = contactBlock(env, handle); if (blk) return blk;
      if (!goodPassword(pw, handle)) return err(env, 'Password: 8 to 100 characters, and not the same as your username');
      const res = await post(env, 'profiles', { aid, handle, token_hash: await H(env, 'tok:' + token), recovery_hash: await hashPassword(pw), referral_code: refcode });
      if (res.status === 409) return err(env, 'That username is already taken', 409);
      if (!res.ok) return err(env, 'Could not create the account', 500);
      return json(env, { aid, handle, token, referral_code: refcode }, 201);
    }
    const res = await post(env, 'profiles', { aid, token_hash: await H(env, 'tok:' + token), recovery_hash: await H(env, `rec:${aid}:${recovery}`), referral_code: refcode });
    if (res.status === 409) return err(env, 'This account already exists. Use your recovery code.', 409);
    if (!res.ok) return err(env, 'Could not create the account', 500);
    return json(env, { aid, token, recovery_code: recovery, referral_code: refcode }, 201);
  }
  // One-tap Google sign-in. Creates an account, links Google to the guest account on this phone, or signs in to the linked account.
  if (path === '/api/auth/google' && m === 'POST') {
    if (!env.GOOGLE_CLIENT_ID) return err(env, 'Google sign-in is not set up yet', 503);
    if (!(await throttle(env, ip, 'google', ip, 20, 20))) return tooMany(env);
    const g = await googleVerify(env, str((await body()).credential, 4000));
    if (!g) return err(env, 'Google sign-in failed. Try again.', 401);
    const cur = await authProfile(req, env);                       // guest account already on this phone, if any
    const token = randHex(24), tokHash = await H(env, 'tok:' + token);
    const existing = await one(await sb(env, `profiles?google_sub=eq.${enc(g.sub)}&limit=1`));
    if (existing) {
      if (existing.banned) return err(env, 'This account is suspended', 403);
      if (cur && cur.aid !== existing.aid && (await hasActivity(env, cur.aid)))
        return err(env, 'This phone has a guest account with orders or money. Restore it with its recovery code first.', 409);
      await patch(env, `profiles?aid=eq.${enc(existing.aid)}`, { token_hash: tokHash });
      return json(env, { aid: existing.aid, token });
    }
    if (cur && !cur.banned && !cur.google_sub) {                    // keep the guest account and its history
      const res = await patch(env, `profiles?aid=eq.${enc(cur.aid)}`, { google_sub: g.sub, token_hash: tokHash });
      if (res.status === 409) return err(env, 'This Google account is already in use', 409);
      return json(env, { aid: cur.aid, token, linked: true });
    }
    const aid = 'u_' + randHex(8), refcode = randHex(4).toUpperCase();
    const res = await post(env, 'profiles', { aid, token_hash: tokHash, google_sub: g.sub, referral_code: refcode });
    if (!res.ok) return err(env, 'Could not create the account', 500);
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
    if (!(await throttle(env, ip, 'recover', who.toLowerCase() || 'x', 10, 30))) return tooMany(env);
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
    return json(env, { aid, token });
  }

  if (path === '/api/me' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    return json(env, { aid: u.aid, handle: u.handle, points: u.points, verified: u.verified, student_verified: !!u.student_verified, badge: u.badge || null, role: u.role, adult_confirmed: u.adult_confirmed, referral_code: u.referral_code, balance: await balance(env, u.aid) });
  }
  if (path === '/api/me/handle' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const handle = str((await body()).handle, 20);
    if (!/^[A-Za-z0-9_]{3,20}$/.test(handle)) return err(env, 'Handle: 3 to 20 letters, numbers or _');
    const blk = contactBlock(env, handle); if (blk) return blk;
    const res = await patch(env, `profiles?aid=eq.${enc(u.aid)}`, { handle });
    if (res.status === 409) return err(env, 'That handle is taken', 409);
    return json(env, { handle });
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
    return json(env, { balance: await balance(env, u.aid), ledger, withdrawals: wd, rules: publicConfig(await getSettings(env)) });
  }
  if (path === '/api/wallet/withdraw' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    if ((env.WITHDRAW_REQUIRES_VERIFIED ?? '1') === '1' && !u.verified) return err(env, 'Verify your ID before withdrawing', 403);
    const b = await body(), S = await getSettings(env); const amount = int(b.amount, S.withdraw_min, S.withdraw_max);
    const phone = String(b.phone || '').replace(/\D/g, '');
    const norm = /^0[17]\d{8}$/.test(phone) ? '254' + phone.slice(1) : /^254[17]\d{8}$/.test(phone) ? phone : null;
    if (!amount || !norm) return err(env, `Check the amount (KES ${S.withdraw_min} to ${S.withdraw_max}) and phone number`);
    if ((await balance(env, u.aid)) < amount) return err(env, 'Not enough available balance');
    const fee = withdrawFee(amount, S);
    const w = await one(await post(env, 'withdrawals', { aid: u.aid, amount, phone: norm, fee, net: amount - fee }));
    if (!w) return err(env, 'Could not save the request', 500);
    await credit(env, u.aid, -amount, 'withdrawal', w.id, 'Withdrawal request');
    if ((await balance(env, u.aid)) < 0) {                      // two requests raced: undo this one
      await patch(env, `wallet_ledger?kind=eq.withdrawal&ref=eq.${w.id}`, { status: 'void' });
      await patch(env, `withdrawals?id=eq.${w.id}`, { status: 'rejected' });
      return err(env, 'Not enough available balance');
    }
    const how = await trySendNow(env, w).catch((e) => { console.error('payout error', e && e.message); return 'manual'; });
    if (how === 'toosmall') return err(env, 'That is below the smallest amount M-Pesa can send. Your money is still in your wallet.');
    if (how === 'limit') return err(env, 'You have reached the daily withdrawal limit. Your money is still in your wallet. Try again tomorrow.');
    if (how === 'refused') return err(env, 'We could not send to M-Pesa right now. Your money is still in your wallet. Please try again in a few minutes.', 502);
    return json(env, { id: w.id, status: how === 'sending' ? 'sending' : 'requested', fee, net: amount - fee }, 201);
  }
  // The seller can take back a request the admin has not paid yet. One conditional UPDATE, so cancel and "paid" can never both win.
  const wc = path.match(/^\/api\/wallet\/withdraw\/([0-9a-f-]{36})\/cancel$/);
  if (wc && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const [w] = await rows(await patch(env, `withdrawals?id=eq.${wc[1]}&aid=eq.${enc(u.aid)}&status=eq.requested`, { status: 'rejected', decided_by: 'user', decided_at: new Date().toISOString() }));
    if (!w) return err(env, 'This request was already handled', 409);
    await credit(env, w.aid, w.amount, 'adjustment', 'wdrej:' + w.id, 'Withdrawal cancelled, money returned');
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
