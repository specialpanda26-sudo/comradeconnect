import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
const fresh = async (t, o) => { const w = world(o); t.after(() => w.restore()); return w; };

test('notifications: a comment on your story notifies you, not the commenter, and hides who wrote it', async (t) => {
  const w = await fresh(t);
  const a = await w.user('author'), b = await w.user('commenter');
  const p = await w.call('POST', '/api/posts', { body: { aid: a.aid, content: 'Who has seen the new canteen menu', category: 'General' } });
  assert.equal(p.status, 201);
  const c = await w.call('POST', `/api/posts/${p.data._id}/comments`, { body: { aid: b.aid, text: 'It is on the notice board' } });
  assert.equal(c.status, 200);
  const mine = await w.call('GET', '/api/notifications', { as: a });
  assert.equal(mine.status, 200);
  assert.equal(mine.data.unread, 1);
  assert.equal(mine.data.items[0].kind, 'comment');
  assert.equal(mine.data.items[0].ref_id, p.data._id);
  assert.ok(!JSON.stringify(mine.data).includes(b.aid), 'the commenter is never named');
  assert.equal((await w.call('GET', '/api/notifications', { as: b })).data.unread, 0);
  // commenting on your own story makes no notification
  await w.call('POST', `/api/posts/${p.data._id}/comments`, { body: { aid: a.aid, text: 'Found it' } });
  assert.equal((await w.call('GET', '/api/notifications', { as: a })).data.items.length, 1);
});

test('notifications: mark one or all as read, and others cannot touch yours', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b');
  const p = await w.call('POST', '/api/posts', { body: { aid: a.aid, content: 'First post here', category: 'General' } });
  for (const t2 of ['one', 'two', 'three']) await w.call('POST', `/api/posts/${p.data._id}/comments`, { body: { aid: b.aid, text: 'comment ' + t2 } });
  let n = (await w.call('GET', '/api/notifications', { as: a })).data;
  assert.equal(n.unread, 3);
  await w.call('POST', '/api/notifications/read', { as: b, body: { all: true } });            // b cannot clear a's
  assert.equal((await w.call('GET', '/api/notifications', { as: a })).data.unread, 3);
  await w.call('POST', '/api/notifications/read', { as: a, body: { ids: [n.items[0].id] } });
  assert.equal((await w.call('GET', '/api/notifications', { as: a })).data.unread, 2);
  await w.call('POST', '/api/notifications/read', { as: a, body: { all: true } });
  n = (await w.call('GET', '/api/notifications', { as: a })).data;
  assert.equal(n.unread, 0); assert.equal(n.items.length, 3); assert.ok(n.items.every((x) => x.read));
  assert.equal((await w.call('GET', '/api/notifications')).status, 401, 'needs an account');
});

test('notifications: new events appear once, then clear when opened', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  const next = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10), past = new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10);
  await new Promise((r) => setTimeout(r, 5));
  w.db.rows('events').push({ id: crypto.randomUUID(), title: 'Career fair', starts_on: next, venue: 'Main hall', hidden: false, created_at: new Date().toISOString() });
  w.db.rows('events').push({ id: crypto.randomUUID(), title: 'Old gig', starts_on: past, venue: 'Gate', hidden: false, created_at: new Date().toISOString() });
  w.db.rows('events').push({ id: crypto.randomUUID(), title: 'Hidden one', starts_on: next, hidden: true, created_at: new Date().toISOString() });
  let n = (await w.call('GET', '/api/notifications', { as: a })).data;
  assert.deepEqual(n.events.map((e) => e.title), ['Career fair']);
  assert.equal(n.unread_total, 1);
  assert.equal((await w.call('GET', '/api/notifications?count=1', { as: a })).data.unread, 1);
  await w.call('POST', '/api/notifications/read', { as: a, body: { events: true } });
  n = (await w.call('GET', '/api/notifications', { as: a })).data;
  assert.equal(n.events.length, 0); assert.equal(n.unread_total, 0);
  w.db.rows('events').push({ id: crypto.randomUUID(), title: 'Open mic', starts_on: next, hidden: false, created_at: new Date(Date.now() + 1000).toISOString() });
  assert.deepEqual((await w.call('GET', '/api/notifications', { as: a })).data.events.map((e) => e.title), ['Open mic']);
});

test('notifications: referral joins, order for the seller, like milestones', async (t) => {
  const w = await fresh(t);
  const ref = await w.user('referrer'), friend = await w.user('friend'), seller = await w.user('seller'), buyer = await w.user('buyer');
  assert.equal((await w.call('POST', '/api/referral/attribute', { as: friend, body: { code: ref.code } })).status, 201);
  assert.equal((await w.call('GET', '/api/notifications', { as: ref })).data.items[0].kind, 'referral');
  const lid = await w.approvedListing(seller, 700);
  await w.buy(buyer, lid);
  const s = (await w.call('GET', '/api/notifications', { as: seller })).data.items;
  assert.equal(s[0].kind, 'order'); assert.equal(s[0].ref_type, 'order');
  const p = await w.call('POST', '/api/posts', { body: { aid: seller.aid, content: 'Milestone story here', category: 'General' } });
  for (let i = 0; i < 10; i++) { const u = await w.user('l' + i); await w.call('POST', `/api/posts/${p.data._id}/like`, { body: { aid: u.aid } }); }
  assert.ok((await w.call('GET', '/api/notifications', { as: seller })).data.items.some((x) => x.kind === 'like_milestone'));
});
