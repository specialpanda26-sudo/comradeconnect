// Paid posts: money talk costs a fee set by admin rules; the post stays hidden until paid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

const fresh = async (t) => { const w = world(); t.after(() => w.restore()); return w; };
const rule = (w, b) => w.call('POST', '/api/admin/post-rules', { admin: true, body: b });
const spill = (w, u, content) => w.call('POST', '/api/posts', { as: u, body: { aid: u.aid, content, category: 'General', zone: '' } });
const visible = async (w) => (await w.call('GET', '/api/posts?limit=20')).data.posts.map((p) => p.content);

test('a post that matches a rule must pay; the fee comes from the admin rule', async (t) => {
  const w = await fresh(t); const u = await w.user('u');
  assert.equal((await rule(w, { label: 'Data sellers', words: 'data, bundles, {money}', fee: 25 })).status, 201);
  const r = await spill(w, u, 'Data bundles at the cheapest, 1GB for 20 bob');
  assert.equal(r.status, 402); assert.equal(r.data.payment_required, true); assert.equal(r.data.fee, 25);
  assert.deepEqual(await visible(w), [], 'not visible before payment');
  assert.equal((await spill(w, u, 'Who else is tired of the queue at the library?')).status, 201, 'normal talk is free');
});

test('paying publishes it; the amount cannot be chosen by the phone', async (t) => {
  const w = await fresh(t); const u = await w.user('u'), o = await w.user('o');
  await rule(w, { label: 'Money', words: 'airtime', fee: 25 });
  const r = await spill(w, u, 'Selling airtime at a discount');
  const bad = await w.call('POST', '/api/pay', { as: o, body: { purpose: 'spillfee', ref_id: r.data.post_id, phone: '0712345678', amount: 1 } });
  assert.equal(bad.status, 404, "someone else's post cannot be paid for");
  const pay = await w.call('POST', '/api/pay', { as: u, body: { purpose: 'spillfee', ref_id: r.data.post_id, phone: '0712345678', amount: 1 } });
  assert.equal(pay.status, 200, JSON.stringify(pay.data));
  const p = w.row('payments', (x) => x.id === pay.data.id);
  assert.equal(p.amount, 25, 'server sets the fee');
  await w.callback(p);
  assert.deepEqual(await visible(w), ['Selling airtime at a discount']);
  assert.equal(w.row('posts', (x) => x.id === r.data.post_id).fee_pending, 0);
});

test('highest matching rule wins, off rules are ignored, admin can change and delete', async (t) => {
  const w = await fresh(t); const u = await w.user('u');
  await rule(w, { label: 'Rule A', words: 'bundle', fee: 25 });
  const b = (await rule(w, { label: 'Rule B', words: 'reseller', fee: 60 })).data.rule;
  assert.equal((await spill(w, u, 'reseller with a bundle')).data.fee, 60);
  await w.call('POST', `/api/admin/post-rules/${b.id}`, { admin: true, body: { active: false } });
  assert.equal((await spill(w, u, 'reseller with a bundle')).data.fee, 25);
  await w.call('POST', `/api/admin/post-rules/${b.id}`, { admin: true, body: { active: true, fee: 40 } });
  assert.equal((await spill(w, u, 'reseller with a bundle')).data.fee, 40);
  await w.call('POST', `/api/admin/post-rules/${b.id}`, { admin: true, body: { action: 'delete' } });
  assert.equal((await spill(w, u, 'reseller only')).status, 201);
});

test('rules are admin only and validated; whole words only', async (t) => {
  const w = await fresh(t); const u = await w.user('u');
  assert.equal((await w.call('POST', '/api/admin/post-rules', { as: u, body: { label: 'x', words: 'data', fee: 25 } })).status, 403);
  for (const bad of [{ label: 'x', words: 'data', fee: 0 }, { label: 'x', words: '', fee: 25 }, { label: 'x', words: 'data', fee: 2.5 }])
    assert.equal((await rule(w, bad)).status, 400, JSON.stringify(bad));
  await rule(w, { label: 'Data', words: 'data, {money}', fee: 25 });
  assert.equal((await spill(w, u, 'My database class was long')).status, 201, '"data" inside "database" does not count');
  assert.equal((await spill(w, u, 'It costs 50 bob')).status, 402);
  assert.equal((await spill(w, u, 'This is DATA for everyone')).status, 402, 'case does not matter');
});

test('unpaid drafts are thrown away after a day', async (t) => {
  const w = await fresh(t); const u = await w.user('u');
  await rule(w, { label: 'Data', words: 'data', fee: 25 });
  const r = await spill(w, u, 'data offers');
  w.row('posts', (x) => x.id === r.data.post_id).created_at = new Date(Date.now() - 25 * 3600e3).toISOString();
  await w.cron();
  assert.equal(w.db.rows('posts').length, 0);
});
