// M-Pesa payments. Other modules start payments with initPayment() and react through `hooks`.
// Three modes (env PAYMENT_MODE): "manual" (default, free: the buyer sends money to YOUR number/till/paybill and enters the M-Pesa code,
// you confirm it in the admin panel), "tinypesa" (automatic STK push; TinyPesa has its own fees) and "intasend" (automatic STK push through
// IntaSend; falls back to TinyPesa if IntaSend refuses and TinyPesa keys exist). Anything a gateway cannot prove lands in the admin "Confirm M-Pesa" queue.
import { getSettings } from './settings.js';
import { json, err, sb, rows, one, post, patch, enc, normPhone, ago, tsEqual, user, UUID, throttle, tooMany, bump } from './lib.js';
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
export const payMode = (env) => { const m = String(env.PAYMENT_MODE || 'manual').trim().toLowerCase(); return m === 'tinypesa' || m === 'intasend' ? m : 'manual'; };
export const manualMode = (env) => payMode(env) === 'manual';

// ---------- IntaSend ----------
// Docs: https://developers.intasend.com  (STK push: POST /api/v1/payment/mpesa-stk-push/, status: POST /api/v1/payment/status/, webhook "collection_event").
// Live host is payment.intasend.com, sandbox is sandbox.intasend.com. Set INTASEND_BASE_URL if IntaSend ever tells you to use another host.
const IS_PREFIX = 'is:';   // IntaSend invoice ids are stored in payments.request_id as "is:INVOICEID" so they are never confused with TinyPesa ids
export const intaKey = (env) => String(env.INTASEND_SECRET_KEY || '').trim();
// The publishable key (ISPubKey_...) is enough to COLLECT money (STK push + status check). The secret key is only needed for paying money OUT (seller payouts).
export const intaPub = (env) => String(env.INTASEND_PUBLISHABLE_KEY || '').trim();
export const intaReady = (env) => !!(intaKey(env) || intaPub(env));
export const intaBase = (env) => String(env.INTASEND_BASE_URL || (String(env.INTASEND_TEST || '') === '1' ? 'https://sandbox.intasend.com' : 'https://payment.intasend.com')).replace(/\/$/, '');
// Authorization is sent only when a secret key exists; with just the publishable key the key travels as public_key in the body (see intaBody).
export const intaHead = (env) => ({ 'Content-Type': 'application/json', ...(intaKey(env) ? { Authorization: 'Bearer ' + intaKey(env) } : {}) });
export const intaBody = (env, o) => ({ ...o, ...(intaPub(env) ? { public_key: intaPub(env) } : {}) });

// Sends the M-Pesa prompt. api_ref is OUR payment id, so every webhook and status answer names the payment it belongs to. Returns the invoice or null.
async function intaPush(env, row, phone, amount) {
  const body = intaBody(env, { amount, phone_number: phone, api_ref: row.id });
  const r = await fetch(`${intaBase(env)}/api/v1/payment/mpesa-stk-push/`, { method: 'POST', headers: intaHead(env), body: JSON.stringify(body) })
    .catch((e) => { console.error('intasend: request failed', e && e.message); return null; });
  const t = r ? await r.json().catch(() => ({})) : {};
  if (!r || !r.ok || !t || !t.invoice || !t.invoice.invoice_id) { console.error('intasend: STK push refused', r ? r.status : 'no response', JSON.stringify(t).slice(0, 200)); return null; }
  return t.invoice;
}
// The truth about one invoice, straight from IntaSend with our secret key. A webhook is never believed on its own.
export async function intaStatus(env, invoiceId) {
  const r = await fetch(`${intaBase(env)}/api/v1/payment/status/`, { method: 'POST', headers: intaHead(env), body: JSON.stringify(intaBody(env, { invoice_id: invoiceId })) })
    .catch((e) => { console.error('intasend: status request failed', e && e.message); return null; });
  const t = r && r.ok ? await r.json().catch(() => null) : null;
  return t && t.invoice && typeof t.invoice === 'object' ? t.invoice : null;
}
// Apply a VERIFIED invoice (from intaStatus) to our payment row. Safe to call many times: every write is conditional on the current status.
// Returns 'paid' | 'underpaid' | 'failed' | 'parked' | 'duplicate' | 'mismatch' | 'ignored' | 'waiting'.
export async function settleIntasend(env, p, inv) {
  const state = String(inv.state || '').toUpperCase();
  if (inv.api_ref && String(inv.api_ref) !== String(p.id)) return 'mismatch';
  if (state === 'COMPLETE') {
    const value = Number(inv.value), cur = String(inv.currency || 'KES').toUpperCase();
    const receipt = String(inv.mpesa_reference || inv.provider_ref || 'IS-' + inv.invoice_id).toUpperCase();
    const good = cur === 'KES' && value >= p.amount;
    if (p.status === 'expired' || p.status === 'failed') {
      // The money arrived after we gave up (expired, or we had already shown "failed"). Do not pay out automatically (the order or stock was already released): a person approves it.
      if (good) await patch(env, `payments?id=eq.${p.id}&status=eq.${p.status}`, { status: 'submitted', receipt, checkout_id: inv.invoice_id });
      return good ? 'parked' : 'ignored';
    }
    if (p.status !== 'pending') return 'ignored';
    const res = await patch(env, `payments?id=eq.${p.id}&status=eq.pending`,
      good ? { status: 'paid', receipt, checkout_id: inv.invoice_id, paid_at: new Date().toISOString() } : { status: 'underpaid', checkout_id: inv.invoice_id });
    if (res.status === 409) { console.error('intasend: receipt already used, payment left pending', receipt); return 'duplicate'; }
    const [upd] = await rows(res);
    if (upd) { if (good) await hooks.onPaid(env, upd); else await hooks.onFailed(env, upd); }
    return good ? 'paid' : 'underpaid';
  }
  if (state === 'FAILED' || state === 'CANCELED' || (state === 'RETRY' && (inv.failed_code || inv.failed_reason))) {   // cancelled, wrong PIN, no balance...
    const code = Number(inv.failed_code) || null;
    const failed = await markFailed(env, `payments?id=eq.${p.id}&status=eq.pending`, 'failed', failReason(code), code);
    for (const x of failed) await hooks.onFailed(env, x);
    return failed.length ? 'failed' : 'ignored';
  }
  return 'waiting';   // PENDING, PROCESSING, RETRY, PARTIAL
}
// Safety net for missed webhooks (run by the 15-minute cron): ask IntaSend about every recent IntaSend payment we have not closed.
export async function reconcileIntasend(env) {
  if (payMode(env) !== 'intasend' || !intaReady(env)) return 0;
  const list = (await rows(await sb(env, `payments?select=*&status=in.(pending,expired,failed)&request_id=not.is.null&created_at=gte.${ago(24 * 3600e3)}&order=created_at.desc&limit=100`)))
    .filter((p) => String(p.request_id).startsWith(IS_PREFIX)).slice(0, 25);
  let changed = 0;
  for (const p of list) {
    const inv = await intaStatus(env, String(p.request_id).slice(IS_PREFIX.length));
    if (!inv) continue;
    const r = await settleIntasend(env, p, inv);
    if (['paid', 'underpaid', 'failed', 'parked'].includes(r)) changed++;
  }
  return changed;
}
// ---------- Card payments (IntaSend hosted checkout: the buyer types the card on IntaSend's own page, card numbers never touch our server) ----------
// Needs INTASEND_PUBLISHABLE_KEY. Optional: INTASEND_CARD_TARIFF (BUSINESS-PAYS = we pay the card fee, CUSTOMER-PAYS = the buyer does), SITE_URL, CARD_PAYMENTS=0 to switch cards off.
const CARD_PREFIX = 'ic:';
export const cardReady = (env) => payMode(env) === 'intasend' && !!intaPub(env) && String(env.CARD_PAYMENTS ?? '1') !== '0';
const siteUrl = (env) => String(env.SITE_URL || 'https://comradeconnect.co.ke').replace(/\/$/, '');
async function intaCheckout(env, row, email) {
  const tariff = String(env.INTASEND_CARD_TARIFF || 'BUSINESS-PAYS').toUpperCase() === 'CUSTOMER-PAYS' ? 'CUSTOMER-PAYS' : 'BUSINESS-PAYS';
  const body = intaBody(env, { amount: row.amount, currency: 'KES', method: 'CARD-PAYMENT', api_ref: row.id, first_name: 'Comrade', last_name: 'Connect',
    email, host: siteUrl(env), redirect_url: siteUrl(env) + '/pay-done.html', card_tarrif: tariff, comment: 'Comrade Connect payment' });
  const r = await fetch(`${intaBase(env)}/api/v1/checkout/`, { method: 'POST', headers: intaHead(env), body: JSON.stringify(body) })
    .catch((e) => { console.error('intasend: checkout request failed', e && e.message); return null; });
  const t = r ? await r.json().catch(() => ({})) : {};
  if (!r || !r.ok || !t || !t.url || !t.id) { console.error('intasend: card checkout refused', r ? r.status : 'no response', JSON.stringify(t).slice(0, 200)); return null; }
  if (!/^https:\/\//.test(String(t.url))) return null;
  return { id: String(t.id), url: String(t.url) };
}

// What the buyer must do in manual mode. Shown in the app, never contains anything secret.
export function manualInfo(env, p) {
  const to = String(env.MPESA_PAY_TO || ''), type = ['till', 'paybill'].includes(env.MPESA_PAY_TYPE) ? env.MPESA_PAY_TYPE : 'send', ref = 'CC' + String(p.id).slice(0, 8).toUpperCase();
  const steps = type === 'till' ? `M-Pesa > Lipa na M-Pesa > Buy Goods and Services > Till number ${to}`
    : type === 'paybill' ? `M-Pesa > Lipa na M-Pesa > Paybill > Business number ${to} > Account number ${ref}` : `M-Pesa > Send Money > ${to}`;
  return { type, pay_to: to, name: String(env.MPESA_PAY_NAME || ''), amount: p.amount, ref, steps };
}
export const hooks = { onPaid: async () => {}, onFailed: async () => {} };   // filled in by index.js

// Starts an STK push. Returns { id } or { res } (an error Response).
export async function initPayment(env, ip, { aid, purpose, ref_id, amount, phone: rawPhone, boost_hours, credit_ksh, method, email: rawEmail }) {
  const card = method === 'card';
  if (card && !cardReady(env)) return { res: err(env, 'Card payments are not switched on yet. Pay with M-Pesa.', 400) };
  const phone = normPhone(rawPhone) || (card ? 'card' : null);
  amount = Math.floor(Number(amount));
  const mode = payMode(env), tinyOk = tinyKeys(env).length > 0 && !!env.TINYPESA_USERNAME;
  if (mode === 'manual' && !env.MPESA_PAY_TO) return { res: err(env, 'Payments are not set up yet', 503) };
  if (mode === 'tinypesa' && !tinyOk) { console.error('payments: PAYMENT_MODE=tinypesa but TINYPESA_API_KEY or TINYPESA_USERNAME is empty on this service'); return { res: err(env, 'Payments are not set up yet', 503) }; }
  if (mode === 'intasend' && !intaReady(env) && !tinyOk) { console.error('payments: PAYMENT_MODE=intasend but neither INTASEND_PUBLISHABLE_KEY nor INTASEND_SECRET_KEY is set on this service'); return { res: err(env, 'Payments are not set up yet', 503) }; }
  if (!phone || !(amount >= 1) || amount > 250000 || !aid) return { res: err(env, 'Check the phone number and amount') };
  const pr = await post(env, 'payments', { aid, purpose, ref_id: ref_id ? String(ref_id).slice(0, 100) : null, amount, phone, ip, boost_hours: boost_hours || null, ...(credit_ksh > 0 ? { credit_ksh } : {}) });
  const pj = await pr.json().catch(() => null);
  const row = Array.isArray(pj) ? pj[0] : null;
  if (!row) { console.error('payments: could not save the payment row (is supabase/schema.sql fully run?)', pr.status, JSON.stringify(pj).slice(0, 300)); return { res: err(env, 'Server could not save the payment', 500) }; }
  if (card) {
    const email = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(String(rawEmail || '')) ? String(rawEmail).trim() : 'noreply+' + String(row.id).slice(0, 8) + '@comradeconnect.co.ke';
    const c = await intaCheckout(env, row, email);
    if (c) { await patch(env, `payments?id=eq.${row.id}`, { request_id: CARD_PREFIX + c.id }); return { id: row.id, url: c.url }; }
    await markFailed(env, `payments?id=eq.${row.id}`, 'failed', 'not_sent', null);
    return { res: err(env, 'Could not open the card page. Try again or pay with M-Pesa.', 502) };
  }
  if (mode === 'manual') return { id: row.id };       // no prompt is sent: the app shows manualInfo() and asks for the M-Pesa code
  if (mode === 'intasend' && intaReady(env)) {
    const inv = await intaPush(env, row, phone, amount);
    if (inv) { await patch(env, `payments?id=eq.${row.id}`, { request_id: IS_PREFIX + inv.invoice_id }); return { id: row.id }; }
    if (!tinyOk) {
      await markFailed(env, `payments?id=eq.${row.id}`, 'failed', 'not_sent', null);
      return { res: err(env, 'Could not send the M-Pesa prompt. Try again.', 502) };
    }
    console.error('intasend: prompt refused, falling back to TinyPesa for payment', row.id);
  }
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

  // Which ways to pay are switched on (the app shows the card option only when this says so).
  if (path === '/api/pay/methods' && req.method === 'GET') return json(env, { mpesa: true, card: cardReady(env) });

  // Generic payment: only boosts and top-ups. Orders, club and tickets have their own endpoints that fix the amount server-side.
  if (path === '/api/pay' && req.method === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await req.json().catch(() => ({}));
    if (b.purpose !== 'boost' && b.purpose !== 'topup' && b.purpose !== 'spillfee') return err(env, 'Use the order, club or ticket checkout for that', 400);
    let amount = b.amount, ref_id = b.ref_id, boost_hours = null;
    if (b.purpose === 'boost') {
      if (!UUID.test(String(ref_id || ''))) return err(env, 'Pick a post to boost');
      const [pst] = await rows(await sb(env, `posts?select=id&id=eq.${ref_id}&hidden=eq.false`));
      if (!pst) return err(env, 'Post not found', 404);
      const S = await getSettings(env);
      const three = b.plan === '3d' || (b.plan === undefined && S.boost_price_3d !== S.boost_price && Number(b.amount) === S.boost_price_3d);
      amount = three ? S.boost_price_3d : S.boost_price; boost_hours = three ? 72 : 24;   // the phone's price is never trusted
    }
    if (b.purpose === 'spillfee') {                                  // the fee was fixed by the server when the post was saved
      if (!UUID.test(String(ref_id || ''))) return err(env, 'Post not found', 404);
      const [pst] = await rows(await sb(env, `posts?select=id,fee_pending&id=eq.${ref_id}&aid=eq.${encodeURIComponent(u.aid)}&hidden=eq.true&fee_pending=gt.0`));
      if (!pst) return err(env, 'That post is not waiting for payment', 404);
      amount = pst.fee_pending;
    }
    const r = await initPayment(env, ip, { aid: u.aid, purpose: b.purpose, ref_id, amount, phone: b.phone, boost_hours, method: b.method, email: b.email });
    return r.res || json(env, { id: r.id, url: r.url });
  }

  // IntaSend webhook. In the IntaSend dashboard: Settings > Webhooks > New. Endpoint https://YOUR-API-HOST/api/intasend/webhook,
  // Challenge = the same string as INTASEND_WEBHOOK_CHALLENGE, event = collection_event. The webhook only says "look at this invoice":
  // we ask IntaSend for the real state with our key before touching any money.
  if (path === '/api/intasend/webhook' && req.method === 'POST') {
    if (!env.INTASEND_WEBHOOK_CHALLENGE) return new Response('not configured', { status: 503 });
    const b = await req.json().catch(() => ({}));
    if (!tsEqual(String(b.challenge ?? ''), env.INTASEND_WEBHOOK_CHALLENGE)) return new Response('no', { status: 401 });
    if (b.topic && b.topic !== 'collection_event') return json(env, { ok: true });
    const invoiceId = String(b.invoice_id || '').trim();
    const state = String(b.state || '').toUpperCase();
    if (!invoiceId || !state || state === 'PENDING' || state === 'PROCESSING') return json(env, { ok: true });   // nothing to decide yet
    const ref = String(b.api_ref || '');
    let p = null;
    if (UUID.test(ref)) [p] = await rows(await sb(env, `payments?id=eq.${ref}&limit=1`));
    if (!p) [p] = await rows(await sb(env, `payments?request_id=eq.${enc(IS_PREFIX + invoiceId)}&limit=1`));
    if (!p) { console.log('intasend webhook: no payment matches invoice', invoiceId); return json(env, { ok: true }); }
    if (p.request_id && !String(p.request_id).startsWith(CARD_PREFIX) && p.request_id !== IS_PREFIX + invoiceId) { console.log('intasend webhook: invoice does not belong to this payment', invoiceId); return json(env, { ok: true }); }
    const inv = await intaStatus(env, invoiceId);
    if (!inv) { console.error('intasend webhook: could not confirm invoice with IntaSend', invoiceId); return json(env, { error: 'could not confirm' }, 502); }   // shows as failed in IntaSend, replay it later
    console.log('intasend webhook:', invoiceId, inv.state, await settleIntasend(env, p, inv));
    return json(env, { ok: true });
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
    const readP = async () => {
      let sr = await sb(env, `payments?id=eq.${id}&select=id,status,receipt,amount,purpose,fail_reason`);
      if (!sr.ok) sr = await sb(env, `payments?id=eq.${id}&select=id,status,receipt,amount,purpose`);   // reason column not added yet
      return (await rows(sr))[0];
    };
    let p = await readP();
    // IntaSend: if the webhook is late, ask IntaSend directly (from 8 s after the prompt, at most 40 times per payment).
    if (p && p.status === 'pending' && payMode(env) === 'intasend' && intaReady(env)) {
      const [full] = await rows(await sb(env, `payments?id=eq.${id}&select=*`));
      if (full && String(full.request_id || '').startsWith(IS_PREFIX) && Date.now() - Date.parse(full.created_at) > 8e3 && (await bump(env, 'isck:' + id, 40))) {
        const inv = await intaStatus(env, full.request_id.slice(IS_PREFIX.length));
        if (inv && (await settleIntasend(env, full, inv)) !== 'waiting') p = await readP();
      }
    }
    if (!p) return json(env, { status: 'unknown' });
    const out = { status: p.status, receipt: p.receipt, amount: p.amount };
    if (p.fail_reason) out.reason = p.fail_reason;
    if (manualMode(env) && p.status === 'pending') out.manual = manualInfo(env, p);
    if (p.purpose === 'order' && p.status === 'paid') { const [o] = await rows(await sb(env, `orders?select=id&payment_id=eq.${id}`)); out.order_id = o?.id || null; }
    return json(env, out);
  }
  return null;
}
