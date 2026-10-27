import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { world } from './helpers.mjs';
import { fcmHint } from '../backend/src/push.js';

// a real RSA key so the server can sign its Google sign-in; Google itself is faked
const pem = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const KEY = JSON.stringify({ client_email: 'svc@proj.iam.gserviceaccount.com', private_key: pem, project_id: 'proj-1' });

function fakeGoogle(t, { oauth = { access_token: 'tok', expires_in: 3600 }, fcm = { status: 200, body: '{}' } } = {}) {
  const real = globalThis.fetch, sent = [];
  globalThis.fetch = async (u, o) => {
    const url = String(u && u.url ? u.url : u);
    if (url.startsWith('https://oauth2.googleapis.com/')) return new Response(JSON.stringify(oauth), { status: 200 });
    if (url.startsWith('https://fcm.googleapis.com/')) { sent.push(JSON.parse(o.body)); return new Response(fcm.body, { status: fcm.status }); }
    return real(u, o);
  };
  t.after(() => { globalThis.fetch = real; });
  return sent;
}
const phone = (w, u, tk, v = 'fcm2') => w.db.rows('push_subs').push({ aid: u.aid, endpoint: 'fcm:' + tk, p256dh: v, auth: 'fcm' });

test('status: no Firebase key on the server says so in plain words', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('ps1');
  const r = await w.call('GET', '/api/push/status', { as: u });
  assert.equal(r.status, 200);
  assert.equal(r.data.fcm, false);
  assert.match(r.data.hint, /FCM_SERVICE_ACCOUNT is not set on Render/);
  assert.deepEqual(r.data.phones, []);
  assert.equal((await w.call('GET', '/api/push/status')).status, 401, 'needs sign-in');
});

test('status: a broken key is told apart from a missing key', async (t) => {
  const w = world(); t.after(() => w.restore());
  w.env.FCM_SERVICE_ACCOUNT = '{"nope":1}';
  const u = await w.user('ps2');
  const r = await w.call('GET', '/api/push/status', { as: u });
  assert.equal(r.data.fcm, false);
  assert.match(r.data.hint, /is set on Render but is not a usable key/);
});

test('status: deep check signs in to Google and lists this account\'s phones only', async (t) => {
  const w = world(); t.after(() => w.restore());
  fakeGoogle(t); w.env.FCM_SERVICE_ACCOUNT = KEY;
  const u = await w.user('ps3'), other = await w.user('ps3b');
  phone(w, u, 'A'.repeat(40)); phone(w, other, 'B'.repeat(40));
  const r = await w.call('GET', '/api/push/status?deep=1', { as: u });
  assert.equal(r.data.fcm, true); assert.equal(r.data.project, 'proj-1'); assert.equal(r.data.key_ok, true);
  assert.equal(r.data.phones.length, 1); assert.equal(r.data.phones[0].app, 'new');
  assert.ok(!JSON.stringify(r.data).includes('AAAAAAAAAAAAAAAA'), 'the full phone address is never returned');
});

test('status: deep check reports a key Google refuses', async (t) => {
  const w = world(); t.after(() => w.restore());
  const pem2 = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
  fakeGoogle(t, { oauth: { error: 'invalid_grant', error_description: 'Invalid JWT Signature.' } });
  w.env.FCM_SERVICE_ACCOUNT = JSON.stringify({ client_email: 'other@proj.iam.gserviceaccount.com', private_key: pem2, project_id: 'proj-2' });
  const u = await w.user('ps4');
  const r = await w.call('GET', '/api/push/status?deep=1', { as: u });
  assert.equal(r.data.key_ok, false);
  assert.match(r.data.hint, /could not sign in to Firebase/); assert.match(r.data.hint, /invalid_grant/);
});

test('test: no key on the server, and no phone saved, are different answers', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('pt1');
  let r = await w.call('POST', '/api/push/test', { as: u, body: {} });
  assert.equal(r.data.ok, false); assert.equal(r.data.step, 'server_key');
  fakeGoogle(t); w.env.FCM_SERVICE_ACCOUNT = KEY;
  r = await w.call('POST', '/api/push/test', { as: u, body: {} });
  assert.equal(r.data.step, 'no_phone');
});

test('test: Firebase accepts it, the message reaches the phone as a data message the app understands', async (t) => {
  const w = world(); t.after(() => w.restore());
  const sent = fakeGoogle(t); w.env.FCM_SERVICE_ACCOUNT = KEY;
  const u = await w.user('pt2'); phone(w, u, 'C'.repeat(40));
  const r = await w.call('POST', '/api/push/test', { as: u, body: {} });
  assert.equal(r.data.ok, true); assert.equal(r.data.step, 'sent'); assert.equal(r.data.devices.length, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].message.data.kind, 'test'); assert.equal(sent[0].message.data.cc, '2');
  const s = await w.call('GET', '/api/push/status', { as: u });
  assert.equal(s.data.last_test.ok, true, 'the last test is remembered for the status screen');
});

test('test: a project mix-up (wrong Firebase project) is named', async (t) => {
  const w = world(); t.after(() => w.restore());
  fakeGoogle(t, { fcm: { status: 403, body: JSON.stringify({ error: { code: 403, message: 'SenderId mismatch', status: 'PERMISSION_DENIED', details: [{ errorCode: 'SENDER_ID_MISMATCH' }] } }) } });
  w.env.FCM_SERVICE_ACCOUNT = KEY;
  const u = await w.user('pt3'); phone(w, u, 'D'.repeat(40));
  const r = await w.call('POST', '/api/push/test', { as: u, body: {} });
  assert.equal(r.data.ok, false); assert.equal(r.data.step, 'firebase');
  assert.match(r.data.message, /DIFFERENT Firebase project/);
});

test('test: a dead phone address is removed and the person is told to open the app again', async (t) => {
  const w = world(); t.after(() => w.restore());
  fakeGoogle(t, { fcm: { status: 404, body: JSON.stringify({ error: { code: 404, status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }) } });
  w.env.FCM_SERVICE_ACCOUNT = KEY;
  const u = await w.user('pt4'); phone(w, u, 'E'.repeat(40));
  const r = await w.call('POST', '/api/push/test', { as: u, body: {} });
  assert.match(r.data.message, /Allow alerts again/);
  assert.equal(w.db.rows('push_subs').length, 0);
});

test('test: a delayed test answers at once and reports later on the status route', async (t) => {
  const w = world(); t.after(() => w.restore());
  fakeGoogle(t); w.env.FCM_SERVICE_ACCOUNT = KEY;
  const u = await w.user('pt5'); phone(w, u, 'F'.repeat(40));
  const r = await w.call('POST', '/api/push/test', { as: u, body: { delay: 1 } });
  assert.equal(r.data.scheduled, 1);
  assert.equal((await w.call('GET', '/api/push/status', { as: u })).data.last_test, null, 'not sent yet');
  await new Promise((res) => setTimeout(res, 1600));
  assert.equal((await w.call('GET', '/api/push/status', { as: u })).data.last_test.ok, true);
});

test('hints cover the usual Firebase answers', () => {
  assert.match(fcmHint(403, JSON.stringify({ error: { message: 'Firebase Cloud Messaging API has not been used in project 1 before or it is disabled.', status: 'PERMISSION_DENIED' } })), /switched off/);
  assert.match(fcmHint(401, '{}'), /refused the key/);
  assert.match(fcmHint(503, ''), /on its side/);
});
