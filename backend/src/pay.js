// M-Pesa payments. Other modules start payments with initPayment() and react through `hooks`.
// Two modes (env PAYMENT_MODE): "manual" (default, free: the buyer sends money to YOUR number/till/paybill and enters the M-Pesa code,
// you confirm it in the admin panel) and "tinypesa" (automatic STK push; TinyPesa has its own fees).
import { getSettings } from './settings.js';
import { json, err, sb, rows, one, post, patch, enc, normPhone, ago, tsEqual, user, UUID, throttle, tooMany } from './lib.js';
// TinyPesa's current API: api. host, trailing slash, the link username in the query string, JSON body.
const TINYPESA_URL = 'https://api.tinypesa.com/api/v1/express/initialize/';
// Why an M-Pesa prompt failed, from Safaricom's ResultCode (TinyPesa forwards it). Shown to the buyer and in the admin panel.
const FAIL_BY_CODE = { 1: 'insufficient', 1032: 'cancelled', 1037: 'timeout', 2001: 'wrong_pin', 1001: 'busy', 1019: 'expired' };
export const failReason = (code) => FAIL_BY_CODE[Number(code)] || 'other';
// Mark payments failed/expired and record why. If the reason columns are not in the database yet, fall back to a plain status
// change so a payment is never left pending. Returns the updated rows.
export async function markFailed(env, filter, status, reason, code) {
  let res = await patch(env, filter, { status, fail_reason: reason, fail_code: code ?? null });
  if (!res.ok) res = await patch(env, filter, { status });
  return rows(res);
}
export const tinyKeys = (env) => {
  const link = String(env.TINYPESA_LINK_API_KEY || env.TINYPESA_API_KEY || '').trim();
  const account = String(env.TINYPESA_ACCOUNT_API_KEY || '').trim();
  return [link, account].filter((k, i, a) => k && a.indexOf(k) === i);
};
export const manualMode = (env) => String(env.PAYMENT_MODE || 'manual') !== 'tinypesa';
// What the buyer must do in manual mode. Shown in the app, never contains anything secret.
export function manualInfo(env, p) {
  const to = String(env.MPESA_PAY_TO || ''), type = ['till', 'paybill'].includes(env.MPESA_PAY_TYPE) ? env.MPESA_PAY_TYPE : 'send', ref = 'CC' + String(p.id).slice(0, 8).toUpperCase();
  const steps = type === 'till' ? `M-Pesa > Lipa na M-Pesa > Buy Goods and Services > Till number ${to}`
    : type === 'paybill' ? `M-Pesa > Lipa na M-Pesa > Paybill > Business number ${to} > Account number ${ref}` : `M-Pesa > Send Money > ${to}`;
  return { type, pay_to: to, name: String(env.MPESA_PAY_NAME || ''), amount: p.amount, ref, steps };
}
export const hooks = { onPaid: async () => {}, onFailed: async () => {} };   // filled in by index.js

// Starts an STK push. Returns { id } or { res } (an error Response).
export async function initPayment(env, ip, { aid, purpose, ref_id, amount, phone: rawPhone, boost_hours }) {
  const phone = normPhone(rawPhone);
  amount = Math.floor(Number(amount));
  if (manualMode(env) && !env.MPESA_PAY_TO) return { res: err(env, 'Payments are not set up yet', 503) };
  if (!manualMode(env) && (!tinyKeys(env).length || !env.TINYPESA_USERNAME)) { console.error('payments: PAYMENT_MODE=tinypesa but TINYPESA_API_KEY or TINYPESA_USERNAME is empty on this service'); return { res: err(env, 'Payments are not set up yet', 503) }; }
  if (!phone || !(amount >= 1) || amount > 150000 || !aid) return { res: err(env, 'Check the phone number and amount') };
  // Rate limits so nobody can spam STK prompts to other people's phones through your account
  const byPhone = await rows(await sb(env, `payments?select=id&phone=eq.${phone}&created_at=gte.${ago(10 * 60e3)}&limit=10`));
  const byIp = await rows(await sb(env, `payments?select=id&ip=eq.${enc(ip)}&created_at=gte.${ago(60 * 60e3)}&limit=20`));
  if (byPhone.length >= 3 || byIp.length >= 8) return { res: err(env, 'Too many attempts. Wait a few minutes and try again.', 429) };
  const pr = await post(env, 'payments', { aid, purpose, ref_id: ref_id ? String(ref_id).slice(0, 100) : null, amount, phone, ip, boost_hours: boost_hours || null });
  const pj = await pr.json().catch(() => null);
  const row = Array.isArray(pj) ? pj[0] : null;
  if (!row) { console.error('payments: could not save the payment row (is supabase/schema.sql fully run?)', pr.status, JSON.stringify(pj).slice(0, 300)); return { res: err(env, 'Server could not save the payment', 500) }; }
  if (manualMode(env)) return { id: row.id };       // no prompt is sent: the app shows manualInfo() and asks for the M-Pesa code
  let r = null, t = {};
  for (const key of tinyKeys(env)) {
    r = await fetch(`${TINYPESA_URL}?username=${enc(env.TINYPESA_USERNAME)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ApiKey: key },
      body: JSON.stringify({ amount, msisdn: phone }),
    }).catch((e) => { console.error('tinypesa: request failed', e && e.message); return null; });
    t = r ? await r.json().catch(() => ({})) : {};
    if (r && r.status !== 401 && r.status !== 403) break;
    console.error('tinypesa: key refused (' + (r ? r.status : 'no response') + '), trying the next key');
  }
  if (!r || !r.ok || String(t.success) === 'false' || !(t.request_id || String(t.success) === 'true')) {
    console.error('tinypesa: initialize refused', r ? r.status : 'no response', JSON.stringify(t).slice(0, 200));
    await markFailed(env, `payments?id=eq.${row.id}`, 'failed', 'not_sent', null);
    return { res: err(env, 'Could not send the M-Pesa prompt. Try again.', 502) };
  }
  await patch(env, `payments?id=eq.${row.id}`, { request_id: t.request_id || null });
  return { id: row.id };
}

// Credit a wallet (idempotent per kind+ref). Returns true if a new row was written.
export async function credit(env, aid, delta, kind, ref, note, status = 'available') {
  const r = await rows(await post(env, 'wallet_ledger', { aid, delta, kind, ref, note, status }, 'resolution=ignore-duplicates,return=representation'));
  return r.length > 0;
}

export async function payRoutes(req, env, url, ip) {
  const path = url.pathname;

  // Generic payment: only boosts and top-ups. Orders, club and tickets have their own endpoints that fix the amount server-side.
  if (path === '/api/pay' && req.method === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await req.json().catch(() => ({}));
    if (b.purpose !== 'boost' && b.purpose !== 'topup') return err(env, 'Use the order, club or ticket checkout for that', 400);
    let amount = b.amount, ref_id = b.ref_id, boost_hours = null;
    if (b.purpose === 'boost') {
      if (!UUID.test(String(ref_id || ''))) return err(env, 'Pick a post to boost');
      const [pst] = await rows(await sb(env, `posts?select=id&id=eq.${ref_id}&hidden=eq.false`));
      if (!pst) return err(env, 'Post not found', 404);
      const S = await getSettings(env);
      const three = b.plan === '3d' || (b.plan === undefined && S.boost_price_3d !== S.boost_price && Number(b.amount) === S.boost_price_3d);
      amount = three ? S.boost_price_3d : S.boost_price; boost_hours = three ? 72 : 24;   // the phone's price is never trusted
    }
    const r = await initPayment(env, ip, { aid: u.aid, purpose: b.purpose, ref_id, amount, phone: b.phone, boost_hours });
    return r.res || json(env, { id: r.id });
  }

  // TinyPesa callback. Set in the TinyPesa dashboard: https://YOUR-WORKER.workers.dev/api/tinypesa/callback?s=CALLBACK_SECRET
  if (path === '/api/tinypesa/callback' && req.method === 'POST') {
    if (!env.CALLBACK_SECRET || !tsEqual(url.searchParams.get('s') || '', env.CALLBACK_SECRET)) return new Response('no', { status: 403 });
    const body = await req.json().catch(() => ({}));
    // TinyPesa forwards the Safaricom result. Find it even when it is wrapped in another object.
    const findCb = (o, d = 0) => { if (!o || typeof o !== 'object' || d > 3) return null; if (o.stkCallback) return o.stkCallback; for (const v of Object.values(o)) { const r = findCb(v, d + 1); if (r) return r; } return null; };
    const cb = findCb(body);
    console.log('tinypesa callback:', cb ? `ResultCode=${cb.ResultCode} checkout=${String(cb.CheckoutRequestID || '').slice(0, 14)}` : 'UNRECOGNISED shape ' + JSON.stringify(body).slice(0, 400));
    if (!cb) return json(env, { ok: true });
    const checkout = String(cb.CheckoutRequestID || '');
    if (cb.ResultCode !== 0) {
      const reason = failReason(cb.ResultCode);
      let failed = checkout ? await markFailed(env, `payments?request_id=eq.${enc(checkout)}&status=eq.pending`, 'failed', reason, cb.ResultCode) : [];
      if (!failed.length) {
        // A failure callback has no phone or amount, and TinyPesa's request id may differ from Safaricom's CheckoutRequestID.
        // If exactly one payment is waiting and it started in the last 5 minutes, it is the one. Otherwise do nothing (the cron expires it).
        const recent = await rows(await sb(env, `payments?select=id&status=eq.pending&created_at=gte.${ago(5 * 60e3)}&limit=2`));
        if (recent.length === 1) failed = await markFailed(env, `payments?id=eq.${recent[0].id}&status=eq.pending`, 'failed', reason, cb.ResultCode);
      }
      for (const p of failed) await hooks.onFailed(env, p);
      return json(env, { ok: true });
    }
    const items = cb.CallbackMetadata?.Item || [];
    const get = (n) => items.find((i) => i.Name === n)?.Value;
    const amount = Number(get('Amount')), receipt = String(get('MpesaReceiptNumber') || ''), phone = String(get('PhoneNumber') || '').replace(/\D/g, '');
    // Match by request id first; otherwise the newest pending payment with the same phone and amount.
    let [p] = checkout ? await rows(await sb(env, `payments?status=eq.pending&request_id=eq.${enc(checkout)}&limit=1`)) : [];
    if (!p && phone && amount) [p] = await rows(await sb(env, `payments?status=eq.pending&phone=eq.${phone}&amount=eq.${amount}&order=created_at.desc&limit=1`));
    if (!p && receipt && amount > 0) {
      // The money moved but we had already expired this payment (callback arrived late). Do not lose it:
      // park it in the admin "Confirm M-Pesa" queue (status submitted) so a person can approve it.
      let [late] = checkout ? await rows(await sb(env, `payments?status=eq.expired&request_id=eq.${enc(checkout)}&limit=1`)) : [];
      if (!late && phone) [late] = await rows(await sb(env, `payments?status=eq.expired&phone=eq.${phone}&amount=eq.${amount}&created_at=gte.${ago(24 * 3600e3)}&order=created_at.desc&limit=1`));
      if (late && amount >= late.amount) await patch(env, `payments?id=eq.${late.id}&status=eq.expired`, { status: 'submitted', receipt, checkout_id: checkout });
    }
    if (!p && !receipt) console.log('tinypesa callback: no pending payment matched');
    if (p) {
      const good = amount >= p.amount && !!receipt;
      const upd = await rows(await patch(env, `payments?id=eq.${p.id}&status=eq.pending`,
        good ? { status: 'paid', receipt, checkout_id: checkout, paid_at: new Date().toISOString() } : { status: 'underpaid', checkout_id: checkout }));
      if (upd.length) { if (good) await hooks.onPaid(env, upd[0]); else await hooks.onFailed(env, upd[0]); }
    }
    return json(env, { ok: true });
  }

  // Manual mode: the buyer sends the M-Pesa confirmation code after paying. An admin checks it against the M-Pesa message and confirms.
  // The code can be corrected until the admin decides. A code can only ever be used once.
  if (path === '/api/pay/confirm' && req.method === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    if (!manualMode(env)) return err(env, 'Payments are confirmed automatically', 400);
    const b = await req.json().catch(() => ({}));
    const code = String(b.code || '').toUpperCase().replace(/[\s-]/g, '');
    if (!UUID.test(String(b.id || ''))) return err(env, 'bad id');
    if (!/^[A-Z0-9]{10}$/.test(code)) return err(env, 'The M-Pesa code has 10 letters and numbers, like SJK7ABC123');
    if (!(await throttle(env, ip, 'payconfirm', u.aid, 10, 40))) return tooMany(env);
    const res = await patch(env, `payments?id=eq.${b.id}&aid=eq.${enc(u.aid)}&status=in.(pending,submitted)`, { status: 'submitted', receipt: code });
    if (res.status === 409) return err(env, 'That M-Pesa code was already used', 409);
    const [p] = await rows(res);
    return p ? json(env, { ok: true, status: 'submitted' }) : err(env, 'This payment is no longer waiting for a code', 404);
  }

  // Frontend polls this (also returns the order id once an order purchase is confirmed)
  if (path === '/api/pay/status' && req.method === 'GET') {
    const id = url.searchParams.get('id') || '';
    if (!UUID.test(id)) return err(env, 'bad id');
    let sr = await sb(env, `payments?id=eq.${id}&select=id,status,receipt,amount,purpose,fail_reason`);
    if (!sr.ok) sr = await sb(env, `payments?id=eq.${id}&select=id,status,receipt,amount,purpose`);   // reason column not added yet
    const [p] = await rows(sr);
    if (!p) return json(env, { status: 'unknown' });
    const out = { status: p.status, receipt: p.receipt, amount: p.amount };
    if (p.fail_reason) out.reason = p.fail_reason;
    if (manualMode(env) && p.status === 'pending') out.manual = manualInfo(env, p);
    if (p.purpose === 'order' && p.status === 'paid') { const [o] = await rows(await sb(env, `orders?select=id&payment_id=eq.${id}`)); out.order_id = o?.id || null; }
    return json(env, out);
  }
  return null;
}
