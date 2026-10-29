// FinoQ (formerly PayHero) v2 API client. Pure HTTP + parsing: it never touches the database, so it is easy to test.
import { UUID } from './lib.js';

export const PH_PREFIX = 'ph:';
export const DEP = 'DEP_';
export const WD = 'WD_';
const clean = (v) => String(v ?? '').trim();

export const phBase = (env) => clean(env.PAYHERO_BASE_URL || 'https://backend.payhero.co.ke').replace(/\/+$/, '');
export const phReady = (env) => !!(clean(env.PAYHERO_API_KEY) && clean(env.PAYHERO_API_SECRET));
export const phChannel = (env) => Number(clean(env.PAYHERO_CHANNEL_ID)) || 14575;
export const phAuth = (env) => 'Basic ' + btoa(`${clean(env.PAYHERO_API_KEY)}:${clean(env.PAYHERO_API_SECRET)}`);
export const phSecret = (env) => clean(env.PAYHERO_WEBHOOK_SECRET);

export function phCallbackUrl(env) {
  const base = clean(env.CALLBACK_URL);
  if (!base) return '';
  const s = phSecret(env);
  return s ? base + (base.includes('?') ? '&' : '?') + 's=' + encodeURIComponent(s) : base;
}

async function call(env, method, path, body, timeoutMs = 25000) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(phBase(env) + path, {
      method, signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: phAuth(env) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text().catch(() => '');
    let data = {}; try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text.slice(0, 200) }; }
    return { ok: r.ok, status: r.status, data: data && typeof data === 'object' ? data : {}, network: false };
  } catch (e) {
    console.error('payhero: request failed', method, path, e && e.name === 'AbortError' ? 'timeout' : e && e.message);
    return { ok: false, status: 0, data: {}, network: true };
  } finally { clearTimeout(timer); }
}
const brief = (d) => JSON.stringify(d).slice(0, 200);

const OK = new Set(['SUCCESS', 'SUCCESSFUL', 'SUCCEEDED', 'COMPLETE', 'COMPLETED', 'PAID']);
const BAD = new Set(['FAILED', 'FAILURE', 'CANCELLED', 'CANCELED', 'REJECTED', 'EXPIRED', 'TIMEOUT', 'TIMED_OUT', 'ERROR', 'DECLINED', 'REVERSED']);

export function outcomeOf(status, resultCode) {
  const s = clean(typeof status === 'string' ? status : '').toUpperCase().replace(/[\s-]+/g, '_');
  const hasCode = resultCode !== undefined && resultCode !== null && resultCode !== '' && Number.isFinite(Number(resultCode));
  const code = hasCode ? Number(resultCode) : null;
  if (BAD.has(s) || (code !== null && code !== 0)) return 'failed';
  if (OK.has(s) || code === 0) return 'success';
  return 'pending';
}
const pick = (o, ...keys) => { for (const k of keys) if (o && o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; return undefined; };

export async function stkPush(env, { amount, phone, reference, name }) {
  const body = {
    amount: Math.floor(Number(amount)), phone_number: phone, channel_id: phChannel(env), provider: 'm-pesa', external_reference: reference,
    ...(phCallbackUrl(env) ? { callback_url: phCallbackUrl(env) } : {}), ...(name ? { customer_name: String(name).slice(0, 60) } : {}),
  };
  const r = await call(env, 'POST', '/api/v2/payments', body);
  const d = r.data, reference2 = clean(pick(d, 'reference', 'Reference', 'transaction_reference')), checkoutId = clean(pick(d, 'CheckoutRequestID', 'checkout_request_id', 'checkoutRequestId'));
  const accepted = r.ok && d.success !== false && String(d.success) !== 'false' && !!(reference2 || checkoutId || d.success === true || d.status);
  if (!accepted) console.error('payhero: STK push refused', r.network ? 'no response' : r.status, brief(d));
  return { ok: accepted, reference: reference2, checkoutId, status: clean(d.status), httpStatus: r.status, network: r.network };
}

export async function payout(env, { amount, phone, reference, narration }) {
  const body = {
    amount: Math.floor(Number(amount)), phone_number: phone, channel_id: phChannel(env), external_reference: reference,
    narration: String(narration || 'Comrade Connect Withdrawal').slice(0, 60), ...(phCallbackUrl(env) ? { callback_url: phCallbackUrl(env) } : {}),
  };
  const r = await call(env, 'POST', '/api/v2/payouts', body);
  const d = r.data, ref = clean(pick(d, 'reference', 'Reference', 'id', 'transaction_reference'));
  const accepted = r.ok && d.success !== false && String(d.success) !== 'false' && outcomeOf(d.status) !== 'failed';
  const refused = !accepted && !r.network && r.status >= 400 && r.status < 500;
  if (!accepted) console.error('payhero: payout not accepted', r.network ? 'no response' : r.status, brief(d));
  return { accepted, refused, reference: ref, httpStatus: r.status, network: r.network };
}

export async function transactionStatus(env, reference) {
  if (!clean(reference)) return { error: true };
  const r = await call(env, 'GET', '/api/v2/transaction-status?reference=' + encodeURIComponent(clean(reference)), undefined, 15000);
  if (!r.ok) return { error: true, httpStatus: r.status, network: r.network };
  const d = r.data && typeof r.data.data === 'object' && r.data.data ? r.data.data : r.data;
  const status = pick(d, 'status', 'Status', 'transaction_status');
  if (status === undefined) return { error: true, httpStatus: r.status };
  const amount = Number(pick(d, 'amount', 'Amount'));
  return { error: false, outcome: outcomeOf(status, pick(d, 'result_code', 'ResultCode')), amount: Number.isFinite(amount) ? amount : null,
    receipt: clean(pick(d, 'provider_reference', 'mpesa_receipt_number', 'MpesaReceiptNumber', 'third_party_reference', 'receipt')), code: pick(d, 'result_code', 'ResultCode') ?? null };
}

export function parseCallback(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const r = body.response && typeof body.response === 'object' ? body.response : body;
  const ext = clean(pick(r, 'ExternalReference', 'external_reference', 'externalReference') ?? pick(body, 'ExternalReference', 'external_reference'));
  const status = pick(r, 'Status', 'status', 'transaction_status') ?? (typeof body.status === 'string' ? body.status : undefined);
  const code = pick(r, 'ResultCode', 'result_code', 'resultCode');
  const amount = Number(pick(r, 'Amount', 'amount'));
  let kind = null, id = null;
  if (ext.startsWith(DEP)) { kind = 'deposit'; id = ext.slice(DEP.length); }
  else if (ext.startsWith(WD)) { kind = 'withdrawal'; id = ext.slice(WD.length); }
  if (id && !UUID.test(id)) { kind = null; id = null; }
  return {
    ext, kind, id, outcome: outcomeOf(status, code), status: clean(status).toUpperCase(), code: code === undefined ? null : Number(code),
    amount: Number.isFinite(amount) ? amount : null, receipt: clean(pick(r, 'MpesaReceiptNumber', 'mpesa_receipt_number', 'provider_reference', 'receipt')).toUpperCase(),
    phone: clean(pick(r, 'Phone', 'phone', 'phone_number')).replace(/\D/g, ''), checkoutId: clean(pick(r, 'CheckoutRequestID', 'checkout_request_id')),
    desc: clean(pick(r, 'ResultDesc', 'result_desc', 'message')).slice(0, 200),
  };
}
