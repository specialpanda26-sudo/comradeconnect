// Automatic seller payouts through IntaSend "Send Money" (M-Pesa B2C). Off unless PAYOUT_MODE=intasend and INTASEND_SECRET_KEY are set,
// so nothing changes until you switch it on. Anything the automation cannot or should not send (small, large, over the daily limit,
// refused by IntaSend) simply stays in the admin "Withdrawals" queue exactly as before.
// Lifecycle: requested -> sending (claimed by ONE conditional update, so it can never be sent twice) -> paid | rejected (money returned).
import { sb, rows, patch, enc, ago } from './lib.js';
import { credit, intaReady, intaBase, intaHead } from './pay.js';

export const autoPayout = (env) => String(env.PAYOUT_MODE || 'manual').trim().toLowerCase() === 'intasend' && intaReady(env);
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };

// Called right after a withdrawal request is saved and the wallet debited. Returns 'sending' or 'manual'.
export async function trySendNow(env, w) {
  if (!autoPayout(env)) return 'manual';
  const net = w.net ?? w.amount;
  if (net < num(env.PAYOUT_AUTO_MIN, 1)) return 'manual';                       // M-Pesa B2C has its own minimum; tiny ones are paid by hand
  const today = await rows(await sb(env, `withdrawals?select=amount&aid=eq.${enc(w.aid)}&status=in.(sending,paid)&created_at=gte.${ago(24 * 3600e3)}`));
  if (today.reduce((s, x) => s + x.amount, 0) + w.amount > num(env.PAYOUT_AUTO_DAILY_MAX, 5000)) return 'manual';   // big amounts get a human look
  const [claimed] = await rows(await patch(env, `withdrawals?id=eq.${w.id}&status=eq.requested`, { status: 'sending' }));
  if (!claimed) return 'manual';
  const r = await fetch(`${intaBase(env)}/api/v1/send-money/initiate/`, {
    method: 'POST', headers: intaHead(env),
    body: JSON.stringify({ currency: 'KES', provider: 'MPESA-B2C', requires_approval: 'NO', transactions: [{ name: 'Comrade Connect seller', account: w.phone, amount: net, narrative: 'Wallet withdrawal' }] }),
  }).catch((e) => { console.error('payout: request failed', e && e.message); return null; });
  const t = r ? await r.json().catch(() => ({})) : {};
  if (r && r.ok && t.tracking_id) { await patch(env, `withdrawals?id=eq.${w.id}`, { payout_tracking: String(t.tracking_id) }); return 'sending'; }
  console.error('payout: IntaSend did not accept', w.id, r ? r.status : 'no response', JSON.stringify(t).slice(0, 200));
  // A clear refusal (4xx: no funds, not enabled...) means nothing was sent: back to the manual queue.
  // No answer or a 5xx is unclear: it stays "sending" and the checker below decides, so it is never sent twice.
  if (r && r.status >= 400 && r.status < 500) await patch(env, `withdrawals?id=eq.${w.id}&status=eq.sending`, { status: 'requested' });
  return r && r.status >= 400 && r.status < 500 ? 'manual' : 'sending';
}

// Ask IntaSend what happened to one "sending" withdrawal. Safe to call any number of times.
export async function settlePayout(env, w) {
  if (w.status !== 'sending') return 'ignored';
  if (!w.payout_tracking) {                                                       // we never learned a tracking id: do not guess, hand it to a human
    if (Date.parse(w.created_at) < Date.now() - 15 * 60e3) { await patch(env, `withdrawals?id=eq.${w.id}&status=eq.sending&payout_tracking=is.null`, { status: 'requested' }); return 'manual'; }
    return 'waiting';
  }
  const r = await fetch(`${intaBase(env)}/api/v1/send-money/status/`, { method: 'POST', headers: intaHead(env), body: JSON.stringify({ tracking_id: w.payout_tracking }) })
    .catch((e) => { console.error('payout: status request failed', e && e.message); return null; });
  const t = r && r.ok ? await r.json().catch(() => null) : null;
  const tx = t && Array.isArray(t.transactions) ? t.transactions[0] : null;
  const st = String(tx?.status || '').toLowerCase();
  if (st === 'successful' || st === 'complete' || st === 'completed') {
    const ref = String(tx.provider_reference || 'IS-' + w.payout_tracking).toUpperCase();
    let res = await patch(env, `withdrawals?id=eq.${w.id}&status=eq.sending`, { status: 'paid', payout_ref: ref, decided_by: 'auto', decided_at: new Date().toISOString() });
    if (res.status === 409) res = await patch(env, `withdrawals?id=eq.${w.id}&status=eq.sending`, { status: 'paid', payout_ref: 'IS-' + w.payout_tracking, decided_by: 'auto', decided_at: new Date().toISOString() });
    return 'paid';
  }
  if (st === 'failed') {
    const [x] = await rows(await patch(env, `withdrawals?id=eq.${w.id}&status=eq.sending`, { status: 'rejected', decided_by: 'auto', decided_at: new Date().toISOString() }));
    if (x) await credit(env, x.aid, x.amount, 'adjustment', 'wdrej:' + x.id, 'Payout failed, money returned');
    return 'failed';
  }
  return 'waiting';
}
export async function reconcilePayouts(env, aid) {
  if (!autoPayout(env)) return 0;
  const list = await rows(await sb(env, `withdrawals?select=*&status=eq.sending${aid ? `&aid=eq.${enc(aid)}` : ''}&order=created_at.asc&limit=25`));
  let n = 0; for (const w of list) if (['paid', 'failed', 'manual'].includes(await settlePayout(env, w))) n++;
  return n;
}
