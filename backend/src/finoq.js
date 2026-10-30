// FinoQ (PayHero) v2 wrapper. Pure HTTP, no DB writes.
export const finoqBase = (env) => String(env.PAYHERO_BASE_URL || 'https://api.finoq.africa').replace(/\/+$/, '');
export const finoqChannel = (env) => { const n = Number(String(env.PAYHERO_CHANNEL_ID || '').trim()); return Number.isFinite(n) && n > 0 ? n : 0; };
export const finoqAccount = (env) => { const n = Number(String(env.PAYHERO_ACCOUNT_ID || '').trim()); return Number.isFinite(n) && n > 0 ? n : 0; };
export const finoqReady = (env) => !!(String(env.PAYHERO_API_KEY || '').trim() && String(env.PAYHERO_API_SECRET || '').trim() && finoqChannel(env));
export const finoqAuth = (env) => 'Basic ' + btoa(String(env.PAYHERO_API_KEY || '').trim() + ':' + String(env.PAYHERO_API_SECRET || '').trim());
export const finoqHead = (env) => ({ 'Content-Type': 'application/json', Authorization: finoqAuth(env) });
export const finoqCallback = (env) => String(env.CALLBACK_URL || env.PAYHERO_CALLBACK_URL || '').trim();
export const depRef = (id) => 'CC-DEP-' + String(id).replace(/[^0-9a-f-]/gi, '').toUpperCase();
export const wdlRef = (id) => 'CC-WDL-' + String(id).replace(/[^0-9a-f-]/gi, '').toUpperCase();
const localPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('254') ? '0' + d.slice(3) : d; };

async function call(env, path, body, label) {
  const r = await fetch(finoqBase(env) + path, { method: 'POST', headers: finoqHead(env), body: JSON.stringify(body) })
    .catch((e) => { console.error('finoq: ' + label + ' failed to send', e && e.message); return null; });
  const raw = r ? await r.text().catch(() => '') : '';
  let t = {}; try { t = raw ? JSON.parse(raw) : {}; } catch (e) { t = { raw: raw.slice(0, 300) }; }
  if (!r || !r.ok) { console.error('finoq: ' + label + ' refused', r ? r.status : 'no response', JSON.stringify(t).slice(0, 300)); return { error: (t && (t.error_message || t.message || t.error)) || 'refused', status: r ? r.status : 0, data: t }; }
  return { ok: true, data: t };
}

export async function finoqStkPush(env, { amount, phone, ref }) {
  const body = { amount: Math.floor(Number(amount)), phone_number: localPhone(phone), channel_id: finoqChannel(env), provider: 'm-pesa', external_reference: ref };
  const acc = finoqAccount(env); if (acc) body.account_id = acc;
  const cb = finoqCallback(env);
  if (cb) body.callback_url = cb;
  return call(env, '/api/v2/payments', body, 'STK push');
}

// Docs: POST /api/v2/withdraw, channel 'phone', recipient_type 'MSISDN', account_id required.
export async function finoqPayout(env, { amount, phone, ref, narration }) {
  const acc = finoqAccount(env);
  if (!acc) { console.error('finoq: PAYHERO_ACCOUNT_ID is not set, payout not sent'); return { error: 'PAYHERO_ACCOUNT_ID not set', status: 400, data: {} }; }
  const p = localPhone(phone);
  const body = { external_reference: ref, account_id: acc, amount: Math.floor(Number(amount)), phone_number: p, account_number: p, network_code: '63902', channel: 'phone', recipient_type: 'MSISDN' };
  const cb = finoqCallback(env); if (cb) body.callback_url = cb;
  const r = await call(env, '/api/v2/withdraw', body, 'payout');
  if (!r.ok) return r;
  const t = r.data, d = t && typeof t.data === 'object' && t.data ? t.data : t;
  return { ok: true, tx: String(d.merchant_reference || d.reference || d.checkout_request_id || d.transaction_id || d.transactionId || d.id || ref), data: t };
}

// Docs: POST /api/global/transaction-status { request_id }. Unknown status is never treated as failure.
export async function finoqStatus(env, reference) {
  const none = { ok: false, status: '', success: false, failed: false, data: {} };
  if (!String(reference || '').trim()) return none;
  let r;
  try {
    r = await fetch(finoqBase(env) + '/api/global/transaction-status', { method: 'POST', headers: finoqHead(env), body: JSON.stringify({ request_id: String(reference) }) });
  } catch (e) { console.error('finoq: transaction-status request failed', e && e.message); return none; }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('finoq: transaction-status refused', r.status, JSON.stringify(data).slice(0, 300)); return { ...none, data }; }
  const parsed = parseFinoqWebhook(data);
  return { ok: true, status: parsed.status, success: parsed.success, failed: parsed.failed, data };
}

// Reads nested {response:{...}} AND flat snake_case callbacks (status, external_reference, provider_reference, ...).
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
  const receipt = String(get('providerreference', 'mpesareceiptnumber', 'mpesareceipt', 'transactionid', 'reference', 'receipt', 'providerref', 'checkoutrequestid') || '').trim().toUpperCase();
  const code = Number(get('resultcode', 'failedcode') || 0) || null;
  return { status, ref, amount, phone, receipt, code,
    success: ['SUCCESS', 'COMPLETE', 'COMPLETED', 'PAID', 'CONFIRMED'].includes(status),
    failed: ['FAILED', 'FAILURE', 'CANCELED', 'CANCELLED', 'REJECTED', 'DECLINED', 'TIMEOUT'].includes(status) };
}
