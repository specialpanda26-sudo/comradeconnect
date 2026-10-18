import { MockDB, installFetch, FakeBucket } from './mockdb.js';
import worker, { runCron } from '../backend/src/index.js';

export function world(opts = {}) {
  const db = new MockDB(), SB = 'https://sb.test';
  const f = installFetch(db, SB, opts);
  const env = { SUPABASE_URL: SB, SUPABASE_SERVICE_KEY: 'svc', ADMIN_KEY: 'admin-secret-key', HASH_PEPPER: 'test-pepper', CALLBACK_SECRET: 'cb-secret', TINYPESA_API_KEY: 'tp', TINYPESA_USERNAME: 'link',
    PAYMENT_MODE: 'tinypesa', MPESA_PAY_TO: '0700000000', MPESA_PAY_NAME: 'Test Shop', MEDIA_BUCKET: 'media-bucket', PRIVATE_BUCKET: 'private-bucket', MEDIA_PUBLIC_URL: 'https://media.test', PLATFORM_FEE_PERCENT: '3', REFERRAL_REWARD: '20', ...opts.env };
  env.MEDIA = new FakeBucket(); env.PRIVATE = new FakeBucket();
  f.buckets['media-bucket'] = env.MEDIA; f.buckets['private-bucket'] = env.PRIVATE;   // the fake Supabase Storage serves these two buckets
  let ipn = 0;
  const w = {
    db, env, calls: f.calls, restore: f.restore,
    async call(method, path, { body, as, admin, ip } = {}) {
      const headers = { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip || '10.0.0.' + (as?.ipn || 1) };
      if (as) { headers['X-Aid'] = as.aid; headers['X-Token'] = as.token; }
      if (admin) headers['X-Admin-Key'] = admin === true ? env.ADMIN_KEY : admin;
      const res = await worker.fetch(new Request('https://api.test' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
      return { status: res.status, data: await res.json().catch(() => null), res };
    },
    async user(name) {                                   // register a new account; each gets its own IP so rate limits don't collide
      const r = await w.call('POST', '/api/auth/register', { body: name ? { aid: 'acct_' + name + '_' + Math.random().toString(36).slice(2, 8) } : {}, ip: '9.9.' + (++ipn) + '.1' });
      return { aid: r.data.aid, token: r.data.token, recovery: r.data.recovery_code, code: r.data.referral_code, ipn: ++ipn + 10 };
    },
    async cron() { return runCron(env); },
    row: (t, f) => db.rows(t).find(f),
    // simulate TinyPesa calling us back
    async callback(payment, { amount, receipt, code = 0, secret = 'cb-secret' } = {}) {
      const body = { Body: { stkCallback: { CheckoutRequestID: payment.request_id, ResultCode: code, CallbackMetadata: code === 0 ? { Item: [{ Name: 'Amount', Value: amount ?? payment.amount }, { Name: 'MpesaReceiptNumber', Value: receipt || 'RCP' + Math.random().toString(36).slice(2, 9).toUpperCase() }, { Name: 'PhoneNumber', Value: Number(payment.phone) }] } : undefined } } };
      return w.call('POST', '/api/tinypesa/callback?s=' + secret, { body });
    },
    // seller lists, admin approves; returns listing id
    async approvedListing(seller, price = 1000, title = 'Calculator Casio') {
      const l = await w.call('POST', '/api/market/listings', { as: seller, body: { title, description: 'Good condition', price, category: 'Electronics', zone: 'Town', contact_phone: '0722000111' } });
      const a = await w.call('POST', `/api/admin/listings/${l.data.id}`, { admin: true, body: { action: 'approve' } });
      if (a.status !== 200) throw new Error('approve failed ' + JSON.stringify(a.data));
      return l.data.id;
    },
    // buyer pays; returns { order, payment }
    async buy(buyer, listingId, phone = '07' + String(Math.floor(Math.random() * 1e8)).padStart(8, '1')) {
      const r = await w.call('POST', '/api/market/buy', { as: buyer, body: { listing_id: listingId, phone } });
      if (r.status !== 200) throw new Error('buy failed ' + JSON.stringify(r.data));
      const payment = w.row('payments', (p) => p.id === r.data.id);
      await w.callback(payment);
      return { payment, order: w.row('orders', (o) => o.payment_id === payment.id) };
    },
  };
  return w;
}
