import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

// Fake TinyPesa + IntaSend so we can see which gateway a payment really went to.
function fakeGateways(t) {
  const real = globalThis.fetch, hits = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('tinypesa.com')) { hits.push('tinypesa'); return new Response(JSON.stringify({ success: 'true', request_id: 'TP' + hits.length }), { status: 200 }); }
    if (u.includes('intasend.com') && u.endsWith('/mpesa-stk-push/')) { hits.push('intasend'); return new Response(JSON.stringify({ invoice: { invoice_id: 'INV' + hits.length } }), { status: 201 }); }
    return real(url, init);
  };
  t.after(() => { globalThis.fetch = real; });
  return hits;
}
const ENV = { PAYMENT_MODE: 'intasend', INTASEND_SECRET_KEY: 'k', TINYPESA_API_KEY: 'tp', TINYPESA_USERNAME: 'link' };
const sendGift = async (w, slug) => (await w.call('POST', '/api/gift/send', { body: { c: slug, item: 'soda', phone: '0712345678' }, ip: '7.7.' + Math.floor(Math.random() * 200) + '.1' }));

test('gifts use TinyPesa by default even when the site default is IntaSend; the admin can switch them', async (t) => {
  const w = world({ env: ENV }); t.after(() => w.restore());
  const hits = fakeGateways(t), c = await w.user('c');
  await w.call('POST', '/api/me/gift', { as: c, body: { title: 'Molly', slug: 'molly' } });
  let r = await sendGift(w, 'molly'); assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(hits, ['tinypesa']);
  // a Market-style payment still follows the site default
  const u = await w.user('u');
  assert.equal((await w.call('POST', '/api/pay', { as: u, body: { purpose: 'topup', amount: 50, phone: '0712345678' } })).status, 200);
  assert.deepEqual(hits, ['tinypesa', 'intasend']);
  // admin panel: list, then switch gifts to IntaSend
  const g = await w.call('GET', '/api/admin/gateways', { admin: true });
  assert.equal(g.data.areas.find((a) => a.key === 'gift').value, 'tinypesa');
  assert.equal((await w.call('POST', '/api/admin/gateways', { admin: true, body: { values: { gift: 'intasend' } } })).status, 200);
  r = await sendGift(w, 'molly'); assert.equal(r.status, 200);
  assert.equal(hits[2], 'intasend');
  // bad input and no admin key are refused
  assert.equal((await w.call('POST', '/api/admin/gateways', { admin: true, body: { values: { gift: 'paypal' } } })).status, 400);
  assert.equal((await w.call('POST', '/api/admin/gateways', { body: { values: { gift: 'default' } } })).status, 403);
});

test('a gateway without keys is skipped: gifts fall back to the site default instead of failing', async (t) => {
  const w = world({ env: { PAYMENT_MODE: 'intasend', INTASEND_SECRET_KEY: 'k', TINYPESA_API_KEY: '', TINYPESA_USERNAME: '' } }); t.after(() => w.restore());
  const hits = fakeGateways(t), c = await w.user('c');
  await w.call('POST', '/api/me/gift', { as: c, body: { title: 'Molly', slug: 'molly' } });
  assert.equal((await sendGift(w, 'molly')).status, 200);
  assert.deepEqual(hits, ['intasend']);
});
