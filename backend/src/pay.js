// M-Pesa via FinoQ (PayHero) v2. Only the webhook marks payments paid/failed; all writes are conditional.
import { getSettings } from './settings.js';
import { json, err, sb, rows, one, post, patch, enc, normPhone, ago, tsEqual, user, UUID } from './lib.js';
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
    const good = !cb.amount || cb.amount >= p.amount;
    if (!good) { const [u] = await rows(await patch(env, `payments?id=eq.${p.id}&${OPEN}`, { status: 'underpaid', checkout_id: cb.receipt || null })); if (u) await hooks.onFailed(env, u); return 'underpaid'; }
    const [upd] = await rows(await patch(env, `payments?id=eq.${p.id}&${OPEN}`, { status: 'paid', receipt: cb.receipt || null, checkout_id: cb.receipt || null, paid_at: new Date().toISOString() }));
    if (upd) await hooks.onPaid(env, upd);
    return upd ? 'paid' : 'duplicate';
  }
  if (cb.failed) {
    if (p.status !== 'pending') return 'duplicate';
    const failed = await markFailed(env, `payments?id=eq.${p.id}&status=eq.pending`, 'failed', failReason(cb.code), cb.code);
    for (const x of failed) await hooks.onFailed(env, x);
    return failed.length ? 'failed' : 'duplicate';
  }
  return 'waiting';
}

// Safety net (15-min cron): expire unanswered STK pushes.
export async function reconcileIntasend(env) {
  const stale = await rows(await sb(env, `payments?select=id&status=eq.pending&created_at=lt.${ago(15 * 60e3)}&limit=100`));
  let n = 0;
  for (const p of stale) { const [x] = await rows(await patch(env, `payments?id=eq.${p.id}&status=eq.pending`, { status: 'expired' })); if (x) n++; }
  return n;
}

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
    const result = cb.ref.startsWith('CC-WDL-') ? await settleWithdrawal(env, cb) : await settleDeposit(env, cb);
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
