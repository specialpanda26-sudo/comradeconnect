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
