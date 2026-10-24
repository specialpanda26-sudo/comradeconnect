// Seller ratings. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

test('ratings: only the buyer, only after release, once per order; averages show on listings', async (t) => {
  const w = world(); t.after(() => w.restore());
  const s = await w.user('s'), b = await w.user('b'), x = await w.user('x');
  const lid = await w.approvedListing(s, 1000);
  const { order } = await w.buy(b, lid);
  const rate = (as, stars, id = order.id) => w.call('POST', `/api/orders/${id}/rate`, { as, body: { stars } });
  assert.equal((await rate(b, 5)).status, 409, 'not released yet');
  assert.equal((await w.call('POST', `/api/orders/${order.id}/handed`, { as: s })).status, 200);
  assert.equal((await w.call('POST', `/api/orders/${order.id}/received`, { as: b })).status, 200);
  assert.equal((await rate(s, 5)).status, 404, 'seller cannot rate themselves');
  assert.equal((await rate(x, 5)).status, 404, 'strangers cannot rate');
  assert.equal((await rate(b, 9)).status, 400, 'stars 1 to 5');
  assert.equal((await rate(b, 4)).status, 200);
  assert.equal((await rate(b, 5)).status, 409, 'once per order');
  const mine = (await w.call('GET', '/api/orders/mine', { as: b })).data.orders.find((o) => o.id === order.id);
  assert.equal(mine.my_rating, 4);
  const sellerView = (await w.call('GET', '/api/orders/mine', { as: s })).data.orders.find((o) => o.id === order.id);
  assert.equal(sellerView.my_rating, undefined, 'seller does not get the buyer field');
  const list = (await w.call('GET', `/api/market/listings/${lid}`)).data;
  assert.deepEqual(list.seller.rating, { avg: 4, count: 1 });
  assert.ok(!JSON.stringify(list).includes(s.aid), 'seller aid never leaks');
});
