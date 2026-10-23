// Pure decision rules for escrow edge cases. Does NOT move money:
// your existing payment code acts on the decision this returns.
export const REFUND_WINDOW_MS = 7 * 24 * 3600 * 1000;
export const CODE_GRACE_MS = 48 * 3600 * 1000;

// order: { status, created_at, handed_over_at, code_entered_at, dispute_opened_at }
// status: funded | handed_over | completed | disputed | released | refunded
export function nextEscrowStep(order, now = Date.now()) {
  const t = v => (v ? new Date(v).getTime() : null);
  const s = order.status;
  if (['completed', 'released', 'refunded'].includes(s) || order.code_entered_at) {
    return { step: 'none', note: 'Order already settled.' };
  }
  if (s === 'disputed' || order.dispute_opened_at) {
    return { step: 'admin_review', note: 'Both sides submit evidence; admin decides.' };
  }
  const handed = t(order.handed_over_at);
  if (s === 'handed_over' && handed && now - handed > CODE_GRACE_MS) {
    return { step: 'release_to_seller', note: 'Buyer took the item, never typed the code or disputed within 48h.' };
  }
  const created = t(order.created_at);
  if (s === 'funded' && created && now - created > REFUND_WINDOW_MS) {
    return { step: 'refund_buyer', note: 'Seller never handed over within 7 days.' };
  }
  return { step: 'wait', note: 'Within the allowed window.' };
}

export function canOpenDispute(order, now = Date.now()) {
  if (['completed', 'released', 'refunded'].includes(order.status)) return false;
  const start = new Date(order.handed_over_at || order.created_at).getTime();
  return now - start <= REFUND_WINDOW_MS;
}
