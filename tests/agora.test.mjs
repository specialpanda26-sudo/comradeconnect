import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { agoraToken } from '../backend/src/agora.js';
import { world } from './helpers.mjs';

const APP = '79e2fffbbb174dc68ef55905a227d9f8', CERT = 'a'.repeat(32);
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const hm = (k, m) => crypto.createHmac('sha256', k).update(m).digest();

test('agora token: 007 format, signature checks out, host can publish and watcher cannot', async () => {
  const env = { AGORA_APP_ID: APP, AGORA_APP_CERTIFICATE: CERT };
  const now = 1_800_000_000, salt = 123456;
  const t = await agoraToken(env, 'ccabc123', 'host', 3600, now, salt);
  assert.ok(t.startsWith('007'));
  const raw = zlib.inflateSync(Buffer.from(t.slice(3), 'base64'));
  const sigLen = raw.readUInt16LE(0), sig = raw.subarray(2, 2 + sigLen), info = raw.subarray(2 + sigLen);
  assert.equal(sigLen, 32);
  const key = hm(u32(salt), hm(u32(now), Buffer.from(CERT)));
  assert.ok(hm(key, info).equals(sig), 'signature must match what Agora recomputes');
  let o = 0; const idLen = info.readUInt16LE(o); o += 2; assert.equal(info.subarray(o, o + idLen).toString(), APP); o += idLen;
  assert.equal(info.readUInt32LE(o), now); assert.equal(info.readUInt32LE(o + 4), 3600); assert.equal(info.readUInt32LE(o + 8), salt); o += 12;
  assert.equal(info.readUInt16LE(o), 1); o += 2;
  assert.equal(info.readUInt16LE(o), 1); o += 2;
  assert.equal(info.readUInt16LE(o), 4); o += 2;
  const keys = []; for (let i = 0; i < 4; i++) { keys.push(info.readUInt16LE(o)); o += 6; }
  assert.deepEqual(keys, [1, 2, 3, 4]);
  const chLen = info.readUInt16LE(o); o += 2; assert.equal(info.subarray(o, o + chLen).toString(), 'ccabc123');
  const w = await agoraToken(env, 'ccabc123', 'audience', 3600, now, salt);
  const wi = zlib.inflateSync(Buffer.from(w.slice(3), 'base64')); assert.ok(wi.length < raw.length, 'a watcher token carries only the join privilege');
});

test('agora token: nothing is made without the App Certificate', async () => {
  assert.equal(await agoraToken({ AGORA_APP_ID: APP }, 'x', 'host'), null);
});

test('live token route: host gets a token, others get a watch token, wrong person is refused, no certificate = null', async () => {
  const w = world({ env: { AGORA_APP_ID: APP, AGORA_APP_CERTIFICATE: CERT } });
  try {
    const host = await w.user('h'), fan = await w.user('f');
    const s = await w.call('POST', '/api/live/start', { as: host, body: { title: 'Hi', native: true } });
    assert.equal(s.status, 201); const ch = s.data.channel;
    let r = await w.call('POST', '/api/live/token', { as: host, body: { channel: ch, host: true } });
    assert.equal(r.status, 200); assert.ok(String(r.data.token).startsWith('007'));
    r = await w.call('POST', '/api/live/token', { body: { channel: ch } });
    assert.equal(r.status, 200); assert.ok(String(r.data.token).startsWith('007'));
    r = await w.call('POST', '/api/live/token', { as: fan, body: { channel: ch, host: true } });
    assert.equal(r.status, 403, 'only the host may publish');
    r = await w.call('POST', '/api/live/token', { body: { channel: 'ccdoesnotexist' } });
    assert.equal(r.status, 404);
  } finally { w.restore(); }
  const w2 = world();
  try {
    const host = await w2.user('h');
    const s = await w2.call('POST', '/api/live/start', { as: host, body: { title: 'Hi', native: true } });
    const r = await w2.call('POST', '/api/live/token', { as: host, body: { channel: s.data.channel, host: true } });
    assert.equal(r.status, 200); assert.equal(r.data.token, null);
  } finally { w2.restore(); }
});
