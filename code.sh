#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd "${1:-$HOME/comradeconnect}"

if [ ! -f package.json ]; then
  echo "Error: package.json not found" >&2
  exit 1
fi

cat > tests/payouts.test.mjs <<'CC_PART2_FILE_01_END'
// FinoQ/PayHero automatic payouts: ambiguous outcomes must remain reserved and never be sent twice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

const ENV = {
  PAYHERO_API_KEY: 'k',
  PAYHERO_API_SECRET: 's',
  PAYHERO_CHANNEL_ID: '777',
  CALLBACK_URL: 'https://api.test/api/webhooks/payhero?s=cb-secret',
  PAYHERO_PAYOUTS_ENABLED: '1'
};

function fakePayHero(t, { send = 'ok' } = {}) {
  const real = globalThis.fetch;
  const seen = [];
  let statusNow = 'QUEUED';

  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (!u.includes('payhero.co.ke')) return real(url, init);

    const body = init.body ? JSON.parse(init.body) : {};
    seen.push({
      u,
      method: init.method || 'GET',
      body,
      auth: init.headers && init.headers.Authorization
    });

    if (u.includes('/api/v2/transaction-status')) {
      if (statusNow === 'ERROR') throw new Error('status unavailable');
      return new Response(JSON.stringify({
        success: true,
        status: statusNow,
        reference: new URL(u).searchParams.get('reference')
      }), { status: 200 });
    }

    if (u.endsWith('/api/v2/withdraw')) {
      if (send === 'refuse') {
        return new Response(JSON.stringify({ error: 'no funds' }), { status: 400 });
      }
      if (send === 'down') throw new Error('network');

      return new Response(JSON.stringify({
        success: true,
        status: 'QUEUED',
        reference: body.external_reference
      }), { status: 200 });
    }

    return new Response(JSON.stringify({
      success: true,
      status: 'QUEUED',
      reference: 'PHREF1',
      checkout_request_id: 'CHK1'
    }), { status: 200 });
  };

  t.after(() => { globalThis.fetch = real; });
  return { seen, setStatus: (v) => { statusNow = v; } };
}

const setup = async (t) => {
  const w = world({ env: ENV });
  t.after(() => w.restore());

  const fake = fakePayHero(t);
  const seller = await w.user('seller');
  const buyer = await w.user('buyer');
  const { order } = await w.buy(
    buyer,
    await w.approvedListing(seller, 1000)
  );

  await w.call('POST', `/api/orders/${order.id}/received`, { as: buyer });
  await w.call('POST', '/api/me/handle', {
    as: seller,
    body: { handle: 'Seller_One' }
  });

  w.row('profiles', (p) => p.aid === seller.aid).verified = true;

  return {
    w,
    seen: fake.seen,
    seller,
    setStatus: fake.setStatus
  };
};

const wd = (w, seller, amount = 100) =>
  w.call('POST', '/api/wallet/withdraw', {
    as: seller,
    body: { amount, phone: '0700111222' }
  });

const bal = async (w, s) =>
  (await w.call('GET', '/api/me', { as: s })).data.balance;

const age = (w) => {
  w.db.rows('withdrawals')[0].created_at =
    new Date(Date.now() - 31 * 60e3).toISOString();
};

test('payout: FinoQ withdraw uses b2c M-Pesa fields and webhook marks paid', async (t) => {
  const { w, seen, seller } = await setup(t);
  const r = await wd(w, seller);

  assert.equal(r.status, 201);
  assert.equal(r.data.status, 'sending');

  const send = seen.find((x) => x.u.endsWith('/api/v2/withdraw'));
  assert.equal(send.method, 'POST');
  assert.match(send.auth, /^Basic /);
  assert.deepEqual([
    send.body.channel,
    send.body.payment_service,
    send.body.network_code,
    send.body.channel_id,
    send.body.callback_url
  ], ['mobile', 'b2c', '63902', 777, ENV.CALLBACK_URL]);

  const id = w.db.rows('withdrawals')[0].id;
  await w.call('POST', '/api/webhooks/payhero?s=cb-secret', {
    body: {
      response: {
        ExternalReference: `CC-WDL-${id.toUpperCase()}`,
        Status: 'SUCCESS',
        MpesaReceiptNumber: 'ABC123'
      }
    }
  });

  assert.equal(w.db.rows('withdrawals')[0].status, 'paid');
});

test('payout recovery: SUCCESS marks a stuck withdrawal paid', async (t) => {
  const { w, seen, seller, setStatus } = await setup(t);
  setStatus('SUCCESS');
  await wd(w, seller);
  age(w);

  await w.cron();

  assert.equal(w.db.rows('withdrawals')[0].status, 'paid');
  assert.ok(seen.some((x) =>
    x.method === 'GET' &&
    x.u.includes('/api/v2/transaction-status?reference=')
  ));
});

test('payout recovery: FAILED rejects and refunds exactly once', async (t) => {
  const { w, seller, setStatus } = await setup(t);
  setStatus('FAILED');
  await wd(w, seller);
  age(w);

  await w.cron();
  await w.cron();

  assert.equal(w.db.rows('withdrawals')[0].status, 'rejected');
  assert.equal(await bal(w, seller), 970);
});

test('payout recovery: QUEUED stays sending without a second payout', async (t) => {
  const { w, seen, seller, setStatus } = await setup(t);
  setStatus('QUEUED');
  await wd(w, seller);
  age(w);

  await w.cron();
  await w.cron();

  assert.equal(w.db.rows('withdrawals')[0].status, 'sending');
  assert.equal(
    seen.filter((x) => x.u.endsWith('/api/v2/withdraw')).length,
    1
  );
});

test('payout recovery: status error keeps funds reserved', async (t) => {
  const { w, seen, seller, setStatus } = await setup(t);
  setStatus('ERROR');
  await wd(w, seller);
  age(w);

  await w.cron();

  assert.equal(w.db.rows('withdrawals')[0].status, 'sending');
  assert.equal(
    seen.filter((x) => x.u.endsWith('/api/v2/withdraw')).length,
    1
  );
});
CC_PART2_FILE_01_END
