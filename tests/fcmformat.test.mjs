import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
import { fcmMessage } from '../backend/src/push.js';

test('fcm: a new-app phone (fcm2) gets a data-only message with the text inside data', () => {
  const m = fcmMessage({ endpoint: 'fcm:tok', p256dh: 'fcm2' }, { title: 'New anonymous message', body: 'hi there', view: 'message', kind: 'message', ref_type: 'thread', ref_id: 'abc', cid: 'thread:abc', sender: 'Anonymous', cat: 'messages' }).message;
  assert.equal(m.token, 'tok');
  assert.equal(m.notification, undefined);
  assert.equal(m.data.cc, '2');
  assert.equal(m.data.title, 'New anonymous message');
  assert.equal(m.data.body, 'hi there');
  assert.equal(m.data.cid, 'thread:abc');
  assert.equal(m.data.sender, 'Anonymous');
  assert.equal(m.android.collapse_key, undefined);
  Object.values(m.data).forEach((v) => assert.equal(typeof v, 'string'));
  assert.equal(m.apns.payload.aps.alert.body, 'hi there');
});

test('fcm: live and app-update replace each other, nothing else collapses', () => {
  const live = fcmMessage({ endpoint: 'fcm:tok', p256dh: 'fcm2' }, { title: 'Someone is live now', body: 'x', view: 'live', rep: 'live', ttl: '1800s' }).message;
  assert.equal(live.android.collapse_key, 'live');
  assert.equal(live.android.ttl, '1800s');
  const ord = fcmMessage({ endpoint: 'fcm:tok', p256dh: 'fcm2' }, { title: 'You have a new order', body: 'x', view: 'orders', kind: 'order', ref_type: 'order', ref_id: '1' }).message;
  assert.equal(ord.android.collapse_key, undefined);
});

test('fcm: an older app (fcm) still gets the plain banner, with the channel and tag as before', () => {
  const m = fcmMessage({ endpoint: 'fcm:old', p256dh: 'fcm' }, { title: 'T', body: 'B', view: 'bell', tag: 'x' }).message;
  assert.equal(m.notification.title, 'T');
  assert.equal(m.notification.body, 'B');
  assert.equal(m.android.notification.channel_id, 'cc_alerts');
  assert.equal(m.android.notification.tag, 'x');
  assert.equal(m.data.view, 'bell');
});

test('fcm: registering with v:2 marks the phone as new-app, without it as old', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('pushy');
  const tok = 'T'.repeat(40);
  let r = await w.call('POST', '/api/push/fcm', { as: u, body: { token: tok } });
  assert.equal(r.status, 200);
  assert.equal(w.db.rows('push_subs').find((x) => x.endpoint === 'fcm:' + tok).p256dh, 'fcm');
  r = await w.call('POST', '/api/push/fcm', { as: u, body: { token: tok, v: 2 } });
  assert.equal(r.status, 200);
  assert.equal(w.db.rows('push_subs').find((x) => x.endpoint === 'fcm:' + tok).p256dh, 'fcm2');
});
