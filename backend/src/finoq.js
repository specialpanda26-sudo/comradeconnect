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
  const body = { amount: Math.floor(Number(amount)), phone_number: phone, network_code: '63902', channel: 'mobile', payment_service: 'b2c', external_reference: ref, narration: String(narration || 'Comrade Connect Withdrawal').slice(0, 120) };
  // Payouts send a channel_id only if PAYHERO_PAYOUT_CHANNEL_ID is set (the STK channel is a Till, not a payout wallet).
  const pch = Number(String(env.PAYHERO_PAYOUT_CHANNEL_ID || '').trim()); if (Number.isFinite(pch) && pch > 0) body.channel_id = pch;
  const cb = finoqCallback(env); if (cb) body.callback_url = cb;
  const r = await call(env, '/api/v2/withdraw', body, 'payout');
  if (!r.ok) return r;
  const t = r.data, d = t && typeof t.data === 'object' && t.data ? t.data : t;
  return { ok: true, tx: String(d.merchant_reference || d.reference || d.checkout_request_id || d.transaction_id || d.transactionId || d.id || ref), data: t };
}


// Query PayHero before recovering an old withdrawal. Unknown status is never treated as failure.
export async function finoqStatus(env, reference) {
  if (!String(reference || '').trim()) {
    return { ok: false, status: '', success: false, failed: false, data: {} };
  }
  let r;
  try {
    const url = finoqBase(env) + '/api/v2/transaction-status?reference=' + encodeURIComponent(String(reference));
    r = await fetch(url, {
      method: 'GET',
      headers: { Authorization: finoqAuth(env), Accept: 'application/json' }
    });
  } catch (e) {
    console.error('finoq: transaction-status request failed', e && e.message);
    return { ok: false, status: '', success: false, failed: false, data: {} };
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('finoq: transaction-status refused', r.status, JSON.stringify(data).slice(0, 300));
    return { ok: false, status: '', success: false, failed: false, data };
  }
  const parsed = parseFinoqWebhook(data);
  return { ok: true, status: parsed.status, success: parsed.success, failed: parsed.failed, data };
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
