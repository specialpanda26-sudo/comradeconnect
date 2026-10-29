#!/data/data/com.termux/files/usr/bin/bash
# Comrade Connect: payment fixes, PART 1A of 2.
# Usage:  bash part1a.sh            (repo at ~/comradeconnect)   or   bash part1a.sh /path/to/repo
set -e
REPO="${1:-$HOME/comradeconnect}"
URL="https://github.com/specialpanda26-sudo/comradeconnect.git"
if [ ! -d "$REPO/.git" ]; then git clone "$URL" "$REPO"; fi
cd "$REPO"
git pull --rebase origin main || git pull --rebase origin master || true
mkdir -p backend/src tests

echo 'writing backend/src/finoq.js'
cat > backend/src/finoq.js <<'CC_EOF_1'
// FinoQ (PayHero) v2 wrapper. Pure HTTP, no DB writes.
export const finoqBase = (env) => String(env.PAYHERO_BASE_URL || 'https://backend.payhero.co.ke').replace(/\/+$/, '');
// No hardcoded fallback: a missing or bad channel id must fail loudly, never charge someone else's channel.
export const finoqChannel = (env) => { const n = Number(String(env.PAYHERO_CHANNEL_ID || '').trim()); return Number.isFinite(n) && n > 0 ? n : 0; };
export const finoqReady = (env) => !!(String(env.PAYHERO_API_KEY || '').trim() && String(env.PAYHERO_API_SECRET || '').trim() && finoqChannel(env));
export const finoqAuth = (env) => 'Basic ' + btoa(String(env.PAYHERO_API_KEY || '').trim() + ':' + String(env.PAYHERO_API_SECRET || '').trim());
export const finoqHead = (env) => ({ 'Content-Type': 'application/json', Authorization: finoqAuth(env) });
export const finoqCallback = (env) => String(env.CALLBACK_URL || env.PAYHERO_CALLBACK_URL || '').trim();
export const depRef = (id) => 'CC-DEP-' + String(id).replace(/[^0-9a-f-]/gi, '').toUpperCase();
export const wdlRef = (id) => 'CC-WDL-' + String(id).replace(/[^0-9a-f-]/gi, '').toUpperCase();

async function call(env, path, body, label) {
  const r = await fetch(finoqBase(env) + path, { method: 'POST', headers: finoqHead(env), body: JSON.stringify(body) })
    .catch((e) => { console.error('finoq: ' + label + ' failed to send', e && e.message); return null; });
  const t = r ? await r.json().catch(() => ({})) : {};
  if (!r || !r.ok) { console.error('finoq: ' + label + ' refused', r ? r.status : 'no response', JSON.stringify(t).slice(0, 300)); return { error: (t && (t.message || t.error)) || 'refused', status: r ? r.status : 0, data: t }; }
  return { ok: true, data: t };
}

export async function finoqStkPush(env, { amount, phone, ref }) {
  const body = { amount: Math.floor(Number(amount)), phone_number: phone, channel_id: finoqChannel(env), provider: 'm-pesa', external_reference: ref };
  const cb = finoqCallback(env);
  if (cb) body.callback_url = cb;
  return call(env, '/api/v2/payments', body, 'STK push');
}

// PayHero "Withdraw To Mobile": POST /api/v2/withdraw, channel 'mobile', payment_service 'b2c', network_code 63902 = M-Pesa.
export async function finoqPayout(env, { amount, phone, ref, narration }) {
  const body = { amount: Math.floor(Number(amount)), phone_number: phone, network_code: '63902', channel: 'mobile', payment_service: 'b2c', channel_id: finoqChannel(env), external_reference: ref, narration: String(narration || 'Comrade Connect Withdrawal').slice(0, 120) };
  const cb = finoqCallback(env); if (cb) body.callback_url = cb;
  const r = await call(env, '/api/v2/withdraw', body, 'payout');
  if (!r.ok) return r;
  const t = r.data, d = t && typeof t.data === 'object' && t.data ? t.data : t;
  return { ok: true, tx: String(d.merchant_reference || d.reference || d.checkout_request_id || d.transaction_id || d.transactionId || d.id || ref), data: t };
}

// Reads PayHero's nested {response:{ExternalReference,Status,...}} AND flat snake_case formats.
export function parseFinoqWebhook(body) {
  const b = body && typeof body === 'object' ? body : {};
  const norm = (o) => { const m = {}; if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) m[k.toLowerCase().replace(/_/g, '')] = v; return m; };
  const nested = [b.response, b.data, b.transaction, b.payout].find((x) => x && typeof x === 'object');
  const inner = norm(nested), outer = norm(b);
  const get = (...keys) => { for (const src of [inner, outer]) for (const k of keys) { const v = src[k]; if (v !== undefined && v !== null && v !== '' && typeof v !== 'boolean') return v; } return undefined; };
  const status = String(get('status', 'transactionstatus', 'state') || '').trim().toUpperCase();
  const ref = String(get('externalreference', 'externalref') || '').trim();
  const amount = Number(get('amount', 'value') || 0);
  const phone = String(get('phonenumber', 'phone', 'msisdn', 'recipient') || '').replace(/\D/g, '');
  const receipt = String(get('mpesareceiptnumber', 'mpesareceipt', 'transactionid', 'reference', 'receipt', 'providerref', 'checkoutrequestid') || '').trim().toUpperCase();
  const code = Number(get('resultcode', 'failedcode') || 0) || null;
  return { status, ref, amount, phone, receipt, code,
    success: ['SUCCESS', 'COMPLETE', 'COMPLETED', 'PAID', 'CONFIRMED'].includes(status),
    failed: ['FAILED', 'FAILURE', 'CANCELED', 'CANCELLED', 'REJECTED', 'DECLINED', 'TIMEOUT'].includes(status) };
}
CC_EOF_1
echo 'writing backend/src/pay.js'
cat > backend/src/pay.js <<'CC_EOF_2'
// M-Pesa via FinoQ (PayHero) v2. Only the webhook marks payments paid/failed; all writes are conditional.
import { getSettings } from './settings.js';
import { json, err, sb, rows, one, post, patch, enc, normPhone, ago, tsEqual, user, UUID, bump } from './lib.js';
import { finoqReady, finoqStkPush, depRef, parseFinoqWebhook } from './finoq.js';
import { settleWithdrawal } from './payouts.js';

export const hooks = { onPaid: async () => {}, onFailed: async () => {} };

export const failReason = (code) => ({ 1: 'insufficient', 1032: 'cancelled', 1037: 'timeout', 2001: 'wrong_pin', 1001: 'busy', 1019: 'expired' }[Number(code)] || 'other');

export async function markFailed(env, filter, status, reason, code) {
  let res = await patch(env, filter, { status, fail_reason: reason, fail_code: code ?? null });
  if (!res.ok) res = await patch(env, filter, { status });
  return rows(res);
}

// retired gateways: inert stubs so other modules keep importing
export const tinyKeys = () => [];
export const payMode = () => 'finoq';
export const manualMode = () => false;
export const gatewayReady = (env) => ({ manual: false, tinypesa: false, intasend: false, finoq: finoqReady(env) });
export const gatewayFor = () => 'finoq';
export const intaKey = () => '', intaPub = () => '', intaBase = () => '', intaReady = () => false;
export const intaHead = () => ({ 'Content-Type': 'application/json' });
export const intaBody = (env, o) => o;
export async function settleIntasend() { return 'ignored'; }

export function manualInfo(env, p) {
  const to = String(env.MPESA_PAY_TO || ''), type = ['till', 'paybill'].includes(env.MPESA_PAY_TYPE) ? env.MPESA_PAY_TYPE : 'send', ref = 'CC' + String(p.id).slice(0, 8).toUpperCase();
  const steps = type === 'till' ? `M-Pesa > Lipa na M-Pesa > Buy Goods and Services > Till number ${to}`
    : type === 'paybill' ? `M-Pesa > Lipa na M-Pesa > Paybill > Business number ${to} > Account number ${ref}` : `M-Pesa > Send Money > ${to}`;
  return { type, pay_to: to, name: String(env.MPESA_PAY_NAME || ''), amount: p.amount, ref, steps };
}

// STK push. request_id is saved at insert so a fast webhook always finds the row.
export async function initPayment(env, ip, { aid, purpose, ref_id, amount, phone: rawPhone, boost_hours, credit_ksh, method, email }) {
  const phone = normPhone(rawPhone);
  amount = Math.floor(Number(amount));
  if (!finoqReady(env)) { console.error('payments: PAYHERO_API_KEY / PAYHERO_API_SECRET missing'); return { res: err(env, 'Payments are not set up yet', 503) }; }
  if (!phone || !(amount >= 1) || amount > 250000 || !aid) return { res: err(env, 'Check the phone number and amount') };
  // Daily caps so nobody can spam STK prompts at strangers: per account and per phone number.
  if (!(await bump(env, 'stk:aid:' + aid, Number(env.STK_DAILY_PER_ACCOUNT || 30))) || !(await bump(env, 'stk:phone:' + phone, Number(env.STK_DAILY_PER_PHONE || 10)))) return { res: err(env, 'Too many payment attempts today. Try again tomorrow.', 429) };
  const id = crypto.randomUUID(), ref = depRef(id);
  const pr = await post(env, 'payments', { id, request_id: ref, aid, purpose, ref_id: ref_id ? String(ref_id).slice(0, purpose === 'order' ? 600 : 100) : null, amount, phone, ip, boost_hours: boost_hours || null, ...(credit_ksh > 0 ? { credit_ksh } : {}) });
  const pj = await pr.json().catch(() => null);
  const row = Array.isArray(pj) ? pj[0] : null;
  if (!row) { console.error('payments: could not save row', pr.status, JSON.stringify(pj).slice(0, 300)); return { res: err(env, 'Server could not save the payment', 500) }; }
  const r = await finoqStkPush(env, { amount, phone, ref });
  if (!r || r.error) { await markFailed(env, `payments?id=eq.${row.id}`, 'failed', 'not_sent', null); return { res: err(env, 'Could not send the M-Pesa prompt. Try again.', 502) }; }
  return { id: row.id };
}

export async function credit(env, aid, delta, kind, ref, note, status = 'available') {
  const row = { aid, delta, kind, ref, note, status };
  for (let i = 0; i < 3; i++) {
    let res = null;
    try { res = await post(env, 'wallet_ledger', row, 'resolution=ignore-duplicates,return=representation'); } catch (e) { res = null; }
    if (res && res.ok) { const r = await rows(res); return r.length > 0 || i > 0; }
    if (res && res.status < 500) return false;
    await new Promise((ok) => setTimeout(ok, 250 * (i + 1)));
  }
  return false;
}

export const wantsWallet = (b) => !!b && (b.pay_with === 'wallet' || b.method === 'wallet');
async function walletBalance(env, aid) {
  const r = await sb(env, 'rpc/wallet_balance', { method: 'POST', body: JSON.stringify({ p: aid }) });
  const n = await r.json().catch(() => 0);
  return Number.isFinite(Number(n)) ? Number(n) : 0;
}
export async function payFromWallet(env, ip, { aid, purpose, ref_id, amount, boost_hours, note, before }) {
  amount = Math.floor(Number(amount));
  if (!aid || !(amount >= 1) || amount > 250000) return { res: err(env, 'Check the amount') };
  if ((await walletBalance(env, aid)) < amount) return { res: err(env, 'Not enough wallet balance. Deposit first or pay with M-Pesa.', 402) };
  const pid = crypto.randomUUID(), ref = 'pay:' + pid;
  const row = await one(await post(env, 'payments', { id: pid, aid, purpose, ref_id: ref_id ? String(ref_id).slice(0, purpose === 'order' ? 600 : 100) : null, amount, phone: 'wallet', ip, boost_hours: boost_hours || null, status: 'paid', receipt: 'WAL' + pid.replace(/-/g, '').slice(0, 12).toUpperCase(), paid_at: new Date().toISOString() }));
  if (!row) return { res: err(env, 'Could not start the payment', 500) };
  const undo = async () => { await patch(env, `wallet_ledger?kind=eq.purchase&ref=eq.${enc(ref)}`, { status: 'void' }); await patch(env, `payments?id=eq.${pid}`, { status: 'failed' }); };
  if (!(await credit(env, aid, -amount, 'purchase', ref, note || 'Paid from wallet'))) {
    await patch(env, `payments?id=eq.${pid}`, { status: 'failed' });
    return { res: err(env, 'Wallet payment is not ready yet. Nothing was charged.', 503) };
  }
  if ((await walletBalance(env, aid)) < 0) { await undo(); return { res: err(env, 'Not enough wallet balance', 402) }; }
  try { if (before) await before(row); await hooks.onPaid(env, row); }
  catch (e) { console.error('wallet pay: hook failed, voided', purpose, e && e.message); await undo(); return { res: err(env, 'Something went wrong. Nothing was charged.', 500) }; }
  return { id: pid };
}

// ----- deposit settlement (idempotent; late success after 'expired' still credits) -----
const OPEN = 'status=in.(pending,expired)';
async function settleDeposit(env, cb) {
  let p = null;
  if (cb.ref) [p] = await rows(await sb(env, `payments?request_id=eq.${enc(cb.ref)}&limit=1`));
  const idFromRef = String(cb.ref || '').replace(/^CC-DEP-/i, '');
  if (!p && UUID.test(idFromRef)) [p] = await rows(await sb(env, `payments?id=eq.${idFromRef}&limit=1`));
  if (!p) { console.log('finoq webhook: no deposit matches', cb.ref || '(no ref)'); return 'unknown'; }
  if (cb.success) {
    if (!['pending', 'expired'].includes(p.status)) return 'duplicate';
    // A success callback must name an amount at least as big as the price. A missing amount is NOT treated as fully paid.
    if (!(cb.amount > 0)) { console.error('finoq webhook: success without amount, not credited', p.id); return 'no_amount'; }
    // The prompt only went to p.phone, so a different payer number is suspicious (compare the last 9 digits).
    if (cb.phone && p.phone && p.phone !== 'wallet' && cb.phone.slice(-9) !== String(p.phone).replace(/\D/g, '').slice(-9)) { console.error('finoq webhook: phone mismatch, not credited', p.id); return 'phone_mismatch'; }
    if (cb.amount < p.amount) { const [u] = await rows(await patch(env, `payments?id=eq.${p.id}&${OPEN}`, { status: 'underpaid', checkout_id: cb.receipt || null })); if (u) await hooks.onFailed(env, u); return 'underpaid'; }
    const [upd] = await rows(await patch(env, `payments?id=eq.${p.id}&${OPEN}`, { status: 'paid', receipt: cb.receipt || null, checkout_id: cb.receipt || null, paid_at: new Date().toISOString() }));
    if (!upd) return 'duplicate';
    try { await hooks.onPaid(env, upd); }
    catch (e) {
      // Paid but not delivered: reopen the payment so a repeated callback (or an admin Approve) can deliver it. Never leave it stuck as 'paid'.
      console.error('finoq webhook: onPaid failed, reopening payment', upd.id, e && e.message);
      await patch(env, `payments?id=eq.${upd.id}&status=eq.paid`, { status: 'expired' });
      throw e;
    }
    return 'paid';
  }
  if (cb.failed) {
    if (p.status !== 'pending') return 'duplicate';
    const failed = await markFailed(env, `payments?id=eq.${p.id}&status=eq.pending`, 'failed', failReason(cb.code), cb.code);
    for (const x of failed) await hooks.onFailed(env, x);
    return failed.length ? 'failed' : 'duplicate';
  }
  return 'waiting';
}

// Safety net (15-min cron): expire unanswered STK pushes AND run the failed cleanup (points back, stock back, notices).
export async function reconcileDeposits(env) {
  const expired = await markFailed(env, `payments?status=eq.pending&created_at=lt.${ago(15 * 60e3)}`, 'expired', 'no_response', null);
  for (const p of expired) await hooks.onFailed(env, p);
  return expired.length;
}
export const reconcileIntasend = reconcileDeposits;   // old name, kept so index.js and old imports still work

export async function payRoutes(req, env, url, ip) {
  const path = url.pathname;
  if (path === '/api/pay/methods' && req.method === 'GET') return json(env, { mpesa: true });

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
      amount = three ? S.boost_price_3d : S.boost_price; boost_hours = three ? 72 : 24;
    } else {
      amount = Math.floor(Number(amount));
      if (!(amount >= 1) || amount > 250000) return err(env, 'Check the amount');
      if (b.purpose === 'spillfee' && !UUID.test(String(ref_id || ''))) return err(env, 'Pick a post');
    }
    if (wantsWallet(b)) {
      const r = await payFromWallet(env, ip, { aid: u.aid, purpose: b.purpose, ref_id, amount, boost_hours, note: 'Paid from wallet' });
      return r.res || json(env, { id: r.id });
    }
    const r = await initPayment(env, ip, { aid: u.aid, purpose: b.purpose, ref_id, amount, phone: b.phone, boost_hours });
    return r.res || json(env, { id: r.id });
  }

  // Webhook. The secret is REQUIRED: set PAYHERO_CALLBACK_SECRET and end CALLBACK_URL with ?s=<secret>.
  if (path === '/api/webhooks/payhero' && req.method === 'POST') {
    if (!env.PAYHERO_CALLBACK_SECRET || !tsEqual(url.searchParams.get('s') || '', env.PAYHERO_CALLBACK_SECRET)) return new Response('no', { status: 403 });
    const body = await req.json().catch(() => ({}));
    const cb = parseFinoqWebhook(body);
    console.log('finoq webhook:', cb.ref || '(no ref)', cb.status || '?', 'amount', cb.amount || '?');
    if (!cb.ref) return json(env, { ok: true });
    let result;
    try { result = cb.ref.startsWith('CC-WDL-') ? await settleWithdrawal(env, cb) : await settleDeposit(env, cb); }
    catch (e) { console.error('finoq webhook: settle failed', cb.ref, e && e.message); return json(env, { ok: false, error: 'retry' }, 500); }
    return json(env, { ok: true, result });
  }

  if (path === '/api/pay/confirm' && req.method === 'POST') return err(env, 'Payments are confirmed automatically now', 400);

  if (path === '/api/pay/status' && req.method === 'GET') {
    const id = url.searchParams.get('id') || '';
    if (!UUID.test(id)) return err(env, 'bad id');
    const readP = async () => {
      let sr = await sb(env, `payments?id=eq.${id}&select=id,status,receipt,amount,purpose,fail_reason`);
      if (!sr.ok) sr = await sb(env, `payments?id=eq.${id}&select=id,status,receipt,amount,purpose`);
      return (await rows(sr))[0];
    };
    const p = await readP();
    if (!p) return json(env, { status: 'unknown' });
    const out = { status: p.status, receipt: p.receipt, amount: p.amount };
    if (p.fail_reason) out.reason = p.fail_reason;
    if (p.purpose === 'order' && p.status === 'paid') { const os = await rows(await sb(env, `orders?select=id&payment_id=eq.${id}`)); out.order_id = os[0]?.id || null; out.order_ids = os.map((x) => x.id); }
    return json(env, out);
  }
  return null;
}
CC_EOF_2
echo 'writing backend/src/payouts.js'
cat > backend/src/payouts.js <<'CC_EOF_3'
// Wallet withdrawals via FinoQ B2C. Wallet is debited at request time; webhook decides paid or refund.
import { sb, rows, patch, enc, ago, UUID } from './lib.js';
import { credit } from './pay.js';
import { finoqReady, finoqPayout, wdlRef } from './finoq.js';
import { notify } from './notifications.js';

export const autoPayout = (env) => String(env.PAYHERO_PAYOUTS_ENABLED ?? '1') !== '0' && finoqReady(env);
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };

async function giveBack(env, w, note) {
  const [x] = await rows(await patch(env, `withdrawals?id=eq.${w.id}&status=in.(requested,sending)`, { status: 'rejected', decided_by: 'auto', decided_at: new Date().toISOString() }));
  if (x) await credit(env, x.aid, x.amount, 'adjustment', 'wdrej:' + x.id, note);
}

export async function trySendNow(env, w) {
  if (!autoPayout(env)) return 'manual';
  const net = w.net ?? w.amount;
  if (net < num(env.PAYOUT_AUTO_MIN, 10)) { await giveBack(env, w, 'Withdrawal below the M-Pesa minimum, money returned'); return 'toosmall'; }
  const today = await rows(await sb(env, `withdrawals?select=amount&aid=eq.${enc(w.aid)}&status=in.(sending,paid)&created_at=gte.${ago(24 * 3600e3)}`));
  if (today.reduce((s, x) => s + x.amount, 0) + w.amount > num(env.PAYOUT_AUTO_DAILY_MAX, 150000)) { await giveBack(env, w, 'Daily withdrawal limit reached, money returned'); return 'limit'; }
  const [claimed] = await rows(await patch(env, `withdrawals?id=eq.${w.id}&status=eq.requested`, { status: 'sending' }));
  if (!claimed) return 'manual';
  const ref = wdlRef(w.id);
  const r = await finoqPayout(env, { amount: net, phone: w.phone, ref, narration: 'Comrade Connect Withdrawal' });
  if (r && r.ok) { await patch(env, `withdrawals?id=eq.${w.id}`, { payout_tracking: r.tx || ref }); return 'sending'; }
  console.error('payout: FinoQ did not accept', w.id, r && r.status, r && r.error);
  if (r && r.status >= 400 && r.status < 500) { await giveBack(env, w, 'Payout could not be sent, money returned'); return 'refused'; }
  return 'sending';
}

// Matches 'sending' AND 'requested', so a late webhook can't lead to a second manual payout.
export async function settleWithdrawal(env, cb) {
  let w = null;
  if (cb.ref) [w] = await rows(await sb(env, `withdrawals?payout_tracking=eq.${enc(cb.ref)}&limit=1`));
  if (!w && cb.receipt) [w] = await rows(await sb(env, `withdrawals?payout_tracking=eq.${enc(cb.receipt)}&limit=1`));
  if (!w && cb.ref) { const id = String(cb.ref).replace(/^CC-WDL-/i, ''); if (UUID.test(id)) [w] = await rows(await sb(env, `withdrawals?id=eq.${id}&limit=1`)); }
  if (!w) { console.log('finoq webhook: no withdrawal matches', cb.ref || '(no ref)'); return 'unknown'; }
  const OPEN = 'status=in.(sending,requested)';
  if (cb.success) {
    const [x] = await rows(await patch(env, `withdrawals?id=eq.${w.id}&${OPEN}`, { status: 'paid', payout_ref: cb.receipt || w.payout_tracking || null, decided_by: 'finoq', decided_at: new Date().toISOString() }));
    if (x) await notify(env, w.aid, 'payout', 'Withdrawal sent', 'KSh ' + (w.net || w.amount) + ' was sent to your M-Pesa.', 'withdrawal', w.id);
    return x ? 'paid' : 'duplicate';
  }
  if (cb.failed) {
    const [x] = await rows(await patch(env, `withdrawals?id=eq.${w.id}&${OPEN}`, { status: 'rejected', decided_by: 'finoq', decided_at: new Date().toISOString() }));
    if (x) { await credit(env, x.aid, x.amount, 'adjustment', 'wdrej:' + x.id, 'Payout failed, money returned'); await notify(env, x.aid, 'payout', 'Withdrawal failed', 'KSh ' + x.amount + ' was returned to your wallet.', 'withdrawal', x.id); }
    return x ? 'failed' : 'duplicate';
  }
  return 'waiting';
}

export async function settlePayout(env, w) {
  if (w.status !== 'sending') return 'ignored';
  if (Date.parse(w.created_at) > Date.now() - 30 * 60e3) return 'waiting';
  const [x] = await rows(await patch(env, `withdrawals?id=eq.${w.id}&status=eq.sending`, { status: 'requested' }));
  return x ? 'manual' : 'ignored';
}
export async function reconcilePayouts(env, aid) {
  const list = await rows(await sb(env, `withdrawals?select=*&status=eq.sending${aid ? `&aid=eq.${enc(aid)}` : ''}&order=created_at.asc&limit=25`));
  let n = 0; for (const w of list) if ((await settlePayout(env, w)) === 'manual') n++;
  return n;
}
CC_EOF_3
echo 'writing backend/src/index.js'
cat > backend/src/index.js <<'CC_EOF_4'
// Comrade Connect API (Cloudflare Worker). All secrets live here, never in the HTML.
import { json, err, corsHeaders, sb, rows, patch, ago, enc } from './lib.js';
import { feedRoutes } from './feed.js';
import { payRoutes, hooks, manualMode, markFailed, reconcileIntasend } from './pay.js';
import { accountRoutes, unlockReferrals } from './account.js';
import { passkeyRoutes } from './passkeys.js';
import { deviceAdminRoutes } from './device.js';
import { ratingRoutes } from './ratings.js';
import { pulseRoutes } from './pulse.js';
import { marketRoutes, createOrderFromPayment, autoReleaseOrders } from './market.js';
import { messageRoutes } from './messages.js';
import { campusRoutes } from './campus.js';
import { zoneSuggestRoutes } from './zonesuggest.js';
import { contentRoutes } from './content.js';
import { hostelRoutes, caretakerPaid } from './hostels.js';
import { mediaRoutes } from './media.js';
import { liveRoutes } from './live.js';
import { voiceRoutes } from './voice.js';
import { nativeRoutes } from './native.js';
import { mbogiRoutes } from './mbogi.js';
import { pushRoutes } from './push.js';
import { supportRoutes } from './support.js';
import { clubRoutes, clubPaid, ticketPaid, restoreClubOrder, expireClubOrders } from './club.js';
import { myEventRoutes } from './myevents.js';
import { wholesaleRoutes, extendWholesale } from './wholesale.js';
import { credit } from './pay.js';
import { adminRoutes } from './admin.js';
import { kuraRoutes, kuraPaid, kuraFailed } from './kura.js';
import { adminUserRoutes } from './admin-users.js';
import { adminJoinRoutes } from './admin-joins.js';
import { adminCleanRoutes } from './admin-clean.js';
import { adminServiceRoutes } from './admin-services.js';
import { adminPushRoutes } from './admin-push.js';
import { settingsRoutes } from './settings.js';
import { siteContentRoutes } from './sitecontent.js';
import { siteMediaRoutes } from './sitemedia.js';
import { trustRoutes } from './trust.js';
import { resetRoutes } from './reset.js';
import { giftRoutes, giftPaid, giftFailed } from './gifts.js';
import { recoveryRoutes } from './recovery.js';
import { lostFoundRoutes } from './lostfound.js';
import { paperRoutes } from './papers.js';
import { serviceWorkRoutes } from './serviceworks.js';
import { pointsRoutes } from './points.js';
import { notificationRoutes, notify } from './notifications.js';
import { engageRoutes } from './engage.js';
import { reconcilePayouts } from './payouts.js';
import { postRuleRoutes, dropUnpaidDrafts } from './postrules.js';
import { sqlRoutes } from './sqlpanel.js';
import { giveBack } from './points.js';
import { pruneMedia } from './media.js';
import { storyRoutes, pruneStories } from './stories.js';
import * as store from './storage.js';
import { PRIVATE_BUCKET } from './storage.js';

// What to do after a payment is confirmed or fails, by purpose.
hooks.onPaid = async (env, p) => {
  if (p.purpose === 'order') await createOrderFromPayment(env, p);
  else if (p.purpose === 'club') await clubPaid(env, p);
  else if (p.purpose === 'ticket') await ticketPaid(env, p);
  else if (p.purpose === 'boost') await boostPost(env, p);
  else if (p.purpose === 'spillfee') await patch(env, `posts?id=eq.${p.ref_id}&fee_pending=gt.0`, { hidden: false, fee_pending: 0, created_at: new Date().toISOString() });   // paid: the spill goes live
  else if (p.purpose === 'topup') {
    if (await credit(env, p.aid, p.amount, 'topup', 'pay:' + p.id, 'Wallet deposit')) await notify(env, p.aid, 'wallet', 'Deposit received', 'KSh ' + p.amount + ' was added to your wallet.', 'wallet', p.id);
    else { const [had] = await rows(await sb(env, `wallet_ledger?select=id&kind=eq.topup&ref=eq.${enc('pay:' + p.id)}&limit=1`)); if (!had) throw new Error('wallet credit failed'); }   // already credited = fine; never credited = let the payment be retried
  }
  else if (p.purpose === 'wholesale') await extendWholesale(env, p.aid);
  else if (p.purpose === 'caretaker') await caretakerPaid(env, p);
  else if (p.purpose === 'kura') await kuraPaid(env, p);
  else if (p.purpose === 'gift') await giftPaid(env, p);
  if (p.aid && p.purpose === 'boost') await notify(env, p.aid, 'payment', 'Your post is boosted', 'KSh ' + p.amount + ' was received. More people will see your post.', 'post', p.ref_id);
  if (p.aid && p.purpose === 'spillfee') await notify(env, p.aid, 'payment', 'Your spill is live', 'KSh ' + p.amount + ' was received and your post is now public.', 'post', p.ref_id);
};
// A boost adds time on top of any boost still running.
async function boostPost(env, p) {
  const [cur] = await rows(await sb(env, `posts?select=boosted_until&id=eq.${p.ref_id}`));
  const start = Math.max(Date.now(), cur && cur.boosted_until ? Date.parse(cur.boosted_until) : 0);
  await patch(env, `posts?id=eq.${p.ref_id}`, { boosted_until: new Date(start + (p.boost_hours || 24) * 3600e3).toISOString() });
}
hooks.onFailed = async (env, p) => {
  if (p.purpose === 'club') await restoreClubOrder(env, p.ref_id);
  if (p.purpose === 'kura') await kuraFailed(env, p);
  if (p.purpose === 'gift') await giftFailed(env, p);
  if (p.credit_ksh > 0) await giveBack(env, p.aid, 'pay:' + p.id);   // a failed payment returns the points
  if (p.aid && !String(p.aid).startsWith('gift:')) await notify(env, p.aid, 'payment', 'Payment not completed', 'Your payment of KSh ' + p.amount + ' was not completed. If you paid by M-Pesa, check the code and try again.', 'payment', p.id);
};

const ROUTES = [supportRoutes, pulseRoutes, campusRoutes, zoneSuggestRoutes, lostFoundRoutes, paperRoutes, serviceWorkRoutes, engageRoutes, storyRoutes, notificationRoutes, pushRoutes, settingsRoutes, trustRoutes, resetRoutes, recoveryRoutes, giftRoutes, siteContentRoutes, siteMediaRoutes, feedRoutes, payRoutes, passkeyRoutes, deviceAdminRoutes, accountRoutes, pointsRoutes, wholesaleRoutes, ratingRoutes, marketRoutes, messageRoutes, hostelRoutes, contentRoutes, nativeRoutes, mbogiRoutes, liveRoutes, voiceRoutes, mediaRoutes, clubRoutes, myEventRoutes, kuraRoutes, adminUserRoutes, adminJoinRoutes, adminCleanRoutes, adminServiceRoutes, adminPushRoutes, postRuleRoutes, sqlRoutes, adminRoutes];

async function handle(req, env) {
  const url = new URL(req.url);
  const ip = req.headers.get('CF-Connecting-IP') || req.headers.get('True-Client-IP') || (req.headers.get('X-Forwarded-For') || '').split(',')[0].trim() || 'unknown';
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(env) });
  for (const r of ROUTES) { const res = await r(req, env, url, ip); if (res) return res; }
  if (url.pathname === '/api/ai' && req.method === 'POST') return aiRoute(req, env, ip);
  if (url.pathname.startsWith('/api/')) return err(env, 'Not found', 404);
  return json(env, { ok: true, service: 'comrade-connect-api' });
}

// Free AI. Fixed system prompt, per-IP and global daily caps so the free quota can't be drained.
import { bump } from './lib.js';
const SUPPORT_PROMPT = 'You are the support helper for Comrade Connect, a campus app for university students across Kenya (Kirinyaga, UoN, KU, JKUAT, Moi and many more). Comrade Connect is built and run by Ogolla Tech. The developers are Christian N. and Peter M. If anyone asks who owns, founded or runs the app, say exactly that and never name anyone else as the owner or CEO. Answer in the language the student uses (English, Swahili or Sheng) in 4 short sentences or fewer. Facts you may use: Market payments are held in escrow; the buyer gets a 6-digit code and gives it to the seller only after checking the item, then the seller is paid; if the buyer says nothing after the seller marks it handed over, the seller is paid automatically after a few days; to dispute, open the order in Market and tap Report a problem before giving the code, and an admin refunds the buyer or pays the seller; refunds go to the in-app wallet; the seller pays a small fee; lost phone: Me > Restore an account with the account ID and recovery code; posts with phone numbers, links, handles or off-site payment requests are blocked; verification: Me > Verification. Never ask for or accept passwords, PINs, recovery codes or handover codes, and tell users never to share them. You cannot see accounts or move money. For payment or account problems point to the Contact tab or comradeconnect.co.ke/contact.html. If you do not know, say so; never invent policies, prices or promises. About the company: Comrade Connect is built and run by Ogolla Tech. Comrade Connect is built and run by Ogolla Tech. The developers are Christian N. and Peter M. Support email: support@comradeconnect.co.ke. If asked who owns, runs, founded or is the CEO of Comrade Connect, give exactly these facts. Never name any other person as CEO, owner or founder, and never guess about people; if asked about someone else, say you do not have that information.';
const BASE_PROMPT = 'You are a friendly assistant for Kenyan university students. You work inside Comrade Connect, built by Ogolla Tech. Keep answers short and safe. About the company: Comrade Connect is built and run by Ogolla Tech. Comrade Connect is built and run by Ogolla Tech. The developers are Christian N. and Peter M. Support email: support@comradeconnect.co.ke. If asked who owns, runs, founded or is the CEO of Comrade Connect, give exactly these facts. Never name any other person as CEO, owner or founder, and never guess about people; if asked about someone else, say you do not have that information.';
function aiContents(b, prompt) {
  const past = b.mode === 'support' && Array.isArray(b.history) ? b.history.slice(-6).filter((h) => h && typeof h.t === 'string') : [];
  const c = past.map((h) => ({ role: h.r === 'u' ? 'user' : 'model', parts: [{ text: h.t.slice(0, 800) }] }));
  while (c.length && c[0].role !== 'user') c.shift();
  return [...c, { role: 'user', parts: [{ text: prompt }] }];
}
async function aiRoute(req, env, ip) {
  const b = await req.json().catch(() => ({}));
  const prompt = String(b.prompt || '').slice(0, 1500);
  if (!prompt) return err(env, 'Missing prompt');
  if (!(await bump(env, 'ip:' + ip, Number(env.AI_DAILY_LIMIT || 20)))) return err(env, 'Daily AI limit reached', 429);
  if (!(await bump(env, 'global', Number(env.AI_GLOBAL_LIMIT || 1000)))) return err(env, 'AI is busy today, try tomorrow', 429);
  const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.AI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: b.mode === 'support' ? SUPPORT_PROMPT : BASE_PROMPT }] },
      contents: aiContents(b, prompt),
    }),
  });
  const d = await g.json().catch(() => ({}));
  return json(env, { text: d?.candidates?.[0]?.content?.parts?.[0]?.text || 'AI is busy, try again.' });
}

// Cron (every 15 min): auto-release, referral unlocks, expire stale payments/stock, purge ID images, end old streams, tidy counters.
export async function runCron(env) {
  const out = {};
  const step = (name, p) => p.catch((e) => { console.error('cron step failed:', name, e && e.message); return -1; });   // one failing step must not stop the rest
  out.released = await step('release', autoReleaseOrders(env));
  out.referrals = await step('referrals', unlockReferrals(env));
  out.clubExpired = await step('club', expireClubOrders(env));
  out.unpaidDrafts = await dropUnpaidDrafts(env).catch(() => -1);
  out.payouts = await reconcilePayouts(env).catch((e) => { console.error('payout reconcile error', e && e.message); return -1; });
  out.intasendChecked = await reconcileIntasend(env).catch((e) => { console.error('intasend reconcile error', e && e.message); return -1; });   // before expiring, so a paid prompt is never expired by mistake
  const stale = await markFailed(env, `payments?status=eq.pending&created_at=lte.${ago(Number(env.PENDING_MINUTES || (manualMode(env) ? 90 : 30)) * 60e3)}`, 'expired', 'no_response', null);
  for (const p of stale) await hooks.onFailed(env, p);
  out.expiredPayments = stale.length;
  const purge = await rows(await sb(env, `verifications?select=id,r2_key&r2_key=not.is.null&purge_after=lte.${new Date().toISOString()}&status=neq.pending&limit=50`));
  for (const v of purge) { await store.remove(env, PRIVATE_BUCKET(env), v.r2_key); await patch(env, `verifications?id=eq.${v.id}`, { r2_key: null }); }
  out.purged = purge.length;
  out.media = await pruneMedia(env);
  out.stories = await pruneStories(env).catch(() => -1);
  await patch(env, `live_streams?status=eq.live&created_at=lte.${ago(8 * 3600e3)}`, { status: 'ended', ended_at: new Date().toISOString() });
  await sb(env, `live_viewers?seen_at=lt.${ago(3600e3)}`, { method: 'DELETE' });
  await sb(env, `live_comments?created_at=lt.${ago(3 * 86400e3)}`, { method: 'DELETE' });
  await sb(env, `ai_usage?day=lt.${new Date(Date.now() - 3 * 86400e3).toISOString().slice(0, 10)}`, { method: 'DELETE' });
  return out;
}

export { handle };
export default {
  async fetch(req, env) {
    try { return await handle(req, env); }
    catch (e) { console.error('worker error', e && e.message); return json(env, { error: 'Server error' }, 500); }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(runCron(env).catch((e) => console.error('cron error', e && e.message))); },
};
CC_EOF_4
echo "=== PART 1A complete successfully! Now run bash part1b.sh ==="
