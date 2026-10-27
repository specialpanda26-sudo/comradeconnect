import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

test('website push stays off: subscribing saves nothing', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('webpush1');
  const r = await w.call('POST', '/api/push/subscribe', { as: u, body: { endpoint: 'https://push.example.com/abcdefghij', keys: { p256dh: 'x', auth: 'y' } } });
  assert.equal(r.status, 200);
  assert.equal(r.data.off, true);
  assert.equal(w.db.rows('push_subs').length, 0, 'no browser subscription may be stored');
});

test('push key route: no VAPID key, and fcm says whether Firebase is set up', async (t) => {
  const w = world(); t.after(() => w.restore());
  const a = await w.call('GET', '/api/push/key');
  assert.equal(a.status, 200);
  assert.equal(a.data.key, '');
  assert.equal(a.data.fcm, false);
});

test('an old browser subscription is deleted the next time a notification is sent, nothing is sent to it', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('webpush2');
  w.db.rows('push_subs').push({ aid: u.aid, endpoint: 'https://push.example.com/old-browser-sub', p256dh: 'x', auth: 'y' });
  const { sendPush } = await import('../backend/src/push.js');
  await sendPush(w.env, u.aid, { title: 'Hello', body: 'Test' });
  assert.equal(w.db.rows('push_subs').length, 0, 'the old browser row is removed');
});
