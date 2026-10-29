import { json, err, sb, rows, post, enc, user, throttle, tooMany, tsEqual, normPhone, int } from './lib.js';
import { initPayment, settlePayhero, gatewayReady } from './pay.js';
import { payoutProvider, payheroPaid, payheroFailed } from './payouts.js';
import { accountRoutes } from './account.js';
import { parseCallback, transactionStatus, phSecret, PH_PREFIX, DEP } from './payhero.js';

const ok = (env, extra = {}) => json(env, { ok: true, ...extra });

async function logEvent(env, ev, body) {
  try { await post(env, 'payhero_events', { event_key: [ev.ext, ev.outcome, ev.receipt || ev.checkoutId || ''].join('|'), kind: ev.kind, ref_id: ev.id, outcome: ev.outcome, payload: body }, 'resolution=ignore-duplicates,return=minimal'); }
  catch (e) { /* ignore */ }
}

export async function payheroRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;

  if (path === '/api/payhero/deposit' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    if (!gatewayReady(env).payhero) return err(env, 'M-Pesa deposits are not switched on yet', 503);
    if (!(await throttle(env, ip, 'phdep', u.aid, 15, 60))) return tooMany(env);
    const b = await req.json().catch(() => ({}));
    const amount = int(b.amount, 1, 250000), phone = normPhone(b.phone);
    if (!amount || !phone) return err(env, 'Check the amount (KES 1 to 250,000) and the phone number, like 0712345678');
    const r = await initPayment(env, ip, { aid: u.aid, purpose: 'topup', amount, phone, force: 'payhero' });
    if (r.res) return r.res;
    return json(env, { id: r.id, status: 'pending', reference: DEP + r.id, message: 'Check your phone and enter your M-Pesa PIN.' }, 201);
  }

  if (path === '/api/payhero/withdraw' && m === 'POST') {
    if (payoutProvider(env) !== 'payhero') return err(env, 'M-Pesa withdrawals through FinoQ are not switched on yet', 503);
    const inner = new URL(url); inner.pathname = '/api/wallet/withdraw';
    return accountRoutes(req, env, inner, ip);
  }

  if (path === '/api/webhooks/payhero' && m === 'POST') {
    if (!phSecret(env)) return new Response('not configured', { status: 503 });
    if (!tsEqual(url.searchParams.get('s') || '', phSecret(env))) return new Response('no', { status: 401 });
    const body = await req.json().catch(() => null);
    const ev = parseCallback(body);
    if (!ev) return err(env, 'Bad callback', 400);
    await logEvent(env, ev, body);
    if (!ev.kind) return ok(env, { ignored: 'unknown reference' });
    if (ev.outcome === 'pending') return ok(env, { waiting: true });

    const table = ev.kind === 'deposit' ? 'payments' : 'withdrawals';
    const [row] = await rows(await sb(env, `${table}?id=eq.${enc(ev.id)}&limit=1`));
    if (!row) return ok(env, { ignored: 'not found' });
    let r = ev;
    if (String(env.PAYHERO_VERIFY_WEBHOOK || '') === '1') {
      const tracking = ev.kind === 'deposit' ? row.request_id : row.payout_tracking;
      const st = await transactionStatus(env, String(tracking || '').startsWith(PH_PREFIX) ? String(tracking).slice(PH_PREFIX.length) : ev.ext);
      if (st.error) return json(env, { error: 'could not confirm' }, 502);
      if (st.outcome !== ev.outcome) return ok(env, { ignored: 'not confirmed' });
      r = { ...ev, amount: st.amount ?? ev.amount, receipt: st.receipt || ev.receipt };
    }

    if (ev.kind === 'deposit') {
      if (row.request_id && !String(row.request_id).startsWith(PH_PREFIX)) return ok(env, { ignored: 'not a FinoQ payment' });
      const result = await settlePayhero(env, row, r);
      return ok(env, { result });
    }
    const result = r.outcome === 'success' ? ((await payheroPaid(env, row, r.receipt)) ? 'paid' : 'ignored') : ((await payheroFailed(env, row)) ? 'refunded' : 'ignored');
    return ok(env, { result });
  }
  return null;
}
