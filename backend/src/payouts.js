// Wallet withdrawals via FinoQ B2C. Wallet is debited at request time; webhook decides paid or refund.
import { sb, rows, patch, enc, ago, UUID } from './lib.js';
import { credit } from './pay.js';
import { finoqReady, finoqPayout, finoqStatus, wdlRef } from './finoq.js';
import { notify, notifyAdmins } from './notifications.js';

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
  const ref = wdlRef(w.id);
  // Save our own reference at the moment of claiming, so a withdrawal can always be traced even if PayHero never answers.
  const [claimed] = await rows(await patch(env, `withdrawals?id=eq.${w.id}&status=eq.requested`, { status: 'sending', payout_tracking: ref }));
  if (!claimed) return 'manual';
  const r = await finoqPayout(env, { amount: net, phone: w.phone, ref, narration: 'Comrade Connect Withdrawal' });
  if (r && r.ok) { await patch(env, `withdrawals?id=eq.${w.id}`, { payout_tracking: r.tx || ref }); return 'sending'; }
  console.error('payout: FinoQ did not accept', w.id, r && r.status, r && r.error);
  if (r && r.status >= 400 && r.status < 500) { await patch(env, `withdrawals?id=eq.${w.id}&status=eq.sending`, { status: 'requested' }); return 'manual'; }   // refused by the provider: keep the money reserved and let an admin pay it
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

// A withdrawal stuck in 'sending' for hours is handed to an admin. Money stays reserved; the admin checks the PayHero dashboard BEFORE paying by hand.
async function toManual(env, w, why) {
  const [x] = await rows(await patch(env, `withdrawals?id=eq.${w.id}&status=eq.sending`, { status: 'requested', decided_by: 'stale' }));
  if (!x) return 'ignored';
  console.error('payout: handed to admin,', why, w.id);
  await notifyAdmins(env, 'withdraw_request', 'Withdrawal needs checking', 'KSh ' + (w.net || w.amount) + ' to ' + w.phone + ' has been sending for hours. Check PayHero first; pay by hand only if it was NOT sent.', 'withdrawal_request', w.id).catch(() => {});
  return 'manual';
}
const STALE_MS = 6 * 3600e3;
export async function settlePayout(env, w) {
  if (w.status !== 'sending') return 'ignored';
  if (Date.parse(w.created_at) > Date.now() - 30 * 60e3) return 'waiting';

  const ref = String(w.payout_tracking || '').trim();
  if (!ref) {
    if (Date.parse(w.created_at) < Date.now() - STALE_MS) return toManual(env, w, 'no tracking reference');
    return 'waiting';
  }

  const status = await finoqStatus(env, ref);
  if (!status.ok) {
    if (Date.parse(w.created_at) < Date.now() - STALE_MS) return toManual(env, w, 'status could not be verified');
    return 'waiting';
  }

  if (status.success) {
    const [x] = await rows(await patch(
      env,
      `withdrawals?id=eq.${w.id}&status=eq.sending`,
      {
        status: 'paid',
        payout_ref: ref,
        decided_by: 'finoq_status',
        decided_at: new Date().toISOString()
      }
    ));
    if (x) {
      await notify(env, x.aid, 'payout', 'Withdrawal sent',
        'KSh ' + (x.net || x.amount) + ' was confirmed by M-Pesa.',
        'withdrawal', x.id);
    }
    return x ? 'paid' : 'ignored';
  }

  if (status.failed) {
    const [x] = await rows(await patch(
      env,
      `withdrawals?id=eq.${w.id}&status=eq.sending`,
      {
        status: 'rejected',
        decided_by: 'finoq_status',
        decided_at: new Date().toISOString()
      }
    ));
    if (x) {
      await credit(env, x.aid, x.amount, 'adjustment', 'wdrej:' + x.id,
        'PayHero confirmed payout failure; money returned');
      await notify(env, x.aid, 'payout', 'Withdrawal failed',
        'KSh ' + x.amount + ' was returned to your wallet.',
        'withdrawal', x.id);
    }
    return x ? 'failed' : 'ignored';
  }

  console.error('payout: PayHero reports an unresolved status; leaving withdrawal sending',
    w.id, status.status || '(empty status)');
  if (Date.parse(w.created_at) < Date.now() - 24 * 3600e3) return toManual(env, w, 'unresolved status ' + (status.status || 'empty'));
  return 'waiting';
}
export async function reconcilePayouts(env, aid) {
  const list = await rows(await sb(env, `withdrawals?select=*&status=eq.sending${aid ? `&aid=eq.${enc(aid)}` : ''}&order=created_at.asc&limit=25`));
  let n = 0; for (const w of list) if ((await settlePayout(env, w)) === 'manual') n++;
  return n;
}
