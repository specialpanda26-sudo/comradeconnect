// Automatic seller payouts through IntaSend "Send Money" (M-Pesa B2C). ON by default as soon as INTASEND_SECRET_KEY is set
// (set PAYOUT_MODE=manual to switch it off). No admin is involved: anything IntaSend refuses, or that is under the minimum or over the
// daily limit, is rejected on the spot and the money goes straight back to the wallet. Only an UNCLEAR answer (no reply from IntaSend)
// is held as "sending" and checked later, so nothing is ever sent twice.
// Lifecycle: requested -> sending (claimed by ONE conditional update, so it can never be sent twice) -> paid | rejected (money returned).
import { sb, rows, patch, enc, ago } from './lib.js';
import { credit, intaKey, intaBase, intaHead } from './pay.js';

export const autoPayout = (env) => String(env.PAYOUT_MODE || 'intasend').trim().toLowerCase() !== 'manual' && !!intaKey(env);   // paying OUT needs the secret key; the publishable key cannot send money
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };

// Reject a request on the spot and return the money (one conditional update, so it can only happen once).
async function giveBack(env, w, note) {
  const [x] = await rows(await patch(env, `withdrawals?id=eq.${w.id}&status=in.(requested,sending)`, { status: 'rejected', decided_by: 'auto', decided_at: new Date().toISOString() }));
  if (x) await credit(env, x.aid, x.amount, 'adjustment', 'wdrej:' + x.id, note);
}
// Called right after a withdrawal request is saved and the wallet debited.
// Returns 'sending' | 'manual' (automatic payouts are off) | 'toosmall' | 'limit' | 'refused' (the last three: money already returned).
export async function trySendNow(env, w) {
  if (!autoPayout(env)) return 'manual';
  const net = w.net ?? w.amount;
  if (net < num(env.PAYOUT_AUTO_MIN, 10)) { await giveBack(env, w, 'Withdrawal below the M-Pesa minimum, money returned'); return 'toosmall'; }
  const today = await rows(await sb(env, `withdrawals?select=amount&aid=eq.${enc(w.aid)}&status=in.(sending,paid)&created_at=gte.${ago(24 * 3600e3)}`));
  if (today.reduce((s, x) => s + x.amount, 0) + w.amount > num(env.PAYOUT_AUTO_DAILY_MAX, 150000)) { await giveBack(env, w, 'Daily withdrawal limit reached, money returned'); return 'limit'; }
  const [claimed] = await rows(await patch(env, `withdrawals?id=eq.${w.id}&status=eq.requested`, { status: 'sending' }));
  if (!claimed) return 'manual';
  const r = await fetch(`${intaBase(env)}/api/v1/send-money/initiate/`, {
    method: 'POST', headers: intaHead(env),
    body: JSON.stringify({ currency: 'KES', provider: 'MPESA-B2C', requires_approval: 'NO', transactions: [{ name: 'Comrade Connect seller', account: w.phone, amount: net, narrative: 'Wallet withdrawal' }] }),
  }).catch((e) => { console.error('payout: request failed', e && e.message); return null; });
  const t = r ? await r.json().catch(() => ({})) : {};
  if (r && r.ok && t.tracking_id) { await patch(env, `withdrawals?id=eq.${w.id}`, { payout_tracking: String(t.tracking_id) }); return 'sending'; }
  console.error('payout: IntaSend did not accept', w.id, r ? r.status : 'no response', JSON.stringify(t).slice(0, 200));
  // A clear refusal (4xx: no funds, not enabled...) means nothing was sent: the money goes straight back to the wallet.
  // No answer or a 5xx is unclear: it stays "sending" and the checker below decides, so it is never sent twice.
  if (r && r.status >= 400 && r.status < 500) { await giveBack(env, w, 'Payout could not be sent, money returned'); return 'refused'; }
  return 'sending';
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
