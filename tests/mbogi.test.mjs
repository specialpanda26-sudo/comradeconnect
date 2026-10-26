import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
import { newCode, parseCode, channelOf } from '../backend/src/mbogi.js';
const fresh = async (t, o) => { const w = world(o); t.after(() => w.restore()); return w; };

test('meeting codes look like abc-defg-hij and can be read back from a link or typed loosely', () => {
  const c = newCode(); assert.match(c, /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
  assert.equal(parseCode('https://comradeconnect.co.ke/?mbogi=abc-defg-hij'), 'abc-defg-hij');
  assert.equal(parseCode(' ABCDEFGHIJ '), 'abc-defg-hij');
  assert.equal(parseCode('abc defg hij'), 'abc-defg-hij');
  assert.equal(parseCode('nope'), '');
  assert.equal(channelOf('abc-defg-hij'), 'mbabcdefghij');
});

test('create, look up, join, chat, react, raise hand, leave, end', async (t) => {
  const w = await fresh(t);
  const host = await w.user('h'), guest = await w.user('g');
  assert.equal((await w.call('POST', '/api/mbogi/create', { body: { title: 'Study group' } })).status, 401, 'needs an account');
  const c = await w.call('POST', '/api/mbogi/create', { as: host, body: { title: 'Study group' } });
  assert.equal(c.status, 201); const code = c.data.code; assert.match(code, /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
  const info = await w.call('GET', '/api/mbogi/' + code); assert.equal(info.data.title, 'Study group'); assert.equal(info.data.status, 'open'); assert.equal(info.data.count, 0);
  assert.equal((await w.call('GET', '/api/mbogi/zzz-zzzz-zzz')).status, 404);

  const j1 = await w.call('POST', `/api/mbogi/${code}/join`, { as: host, body: { v: 'tab1' } }); assert.equal(j1.status, 200); assert.equal(j1.data.host, true); assert.equal(j1.data.channel, channelOf(code));
  const j2 = await w.call('POST', `/api/mbogi/${code}/join`, { as: guest, body: { v: 'tab2' } }); assert.equal(j2.data.host, false);
  assert.equal((await w.call('GET', '/api/mbogi/' + code)).data.count, 2);

  assert.equal((await w.call('POST', `/api/mbogi/${code}/send`, { as: guest, body: { kind: 'chat', text: 'Niaje wasee' } })).status, 201);
  assert.equal((await w.call('POST', `/api/mbogi/${code}/send`, { as: guest, body: { kind: 'chat', text: 'call me 0712345678' } })).status, 400, 'contact details are blocked like everywhere else');
  assert.equal((await w.call('POST', `/api/mbogi/${code}/send`, { as: guest, body: { kind: 'react', text: 'clap' } })).status, 201);
  assert.equal((await w.call('POST', `/api/mbogi/${code}/send`, { as: guest, body: { kind: 'react', text: '<script>' } })).status, 400, 'only known reactions');

  const p = await w.call('POST', `/api/mbogi/${code}/ping`, { as: host, body: { v: 'tab1', uid: '12345', hand: true } });
  assert.equal(p.data.people.length, 2); assert.equal(p.data.events.length, 2);
  assert.equal(p.data.people.find((x) => x.me).hand, true); assert.equal(p.data.people.find((x) => x.me).uid, '12345'); assert.equal(p.data.people.find((x) => x.me).host, true);
  const last = p.data.events[1].at;
  const p2 = await w.call('POST', `/api/mbogi/${code}/ping`, { as: host, body: { v: 'tab1', since: last } }); assert.equal(p2.data.events.length, 0, 'only new events after "since"');

  assert.equal((await w.call('POST', `/api/mbogi/${code}/end`, { as: guest, body: {} })).status, 403, 'only the host ends it');
  await w.call('POST', `/api/mbogi/${code}/leave`, { as: guest, body: { v: 'tab2' } });
  assert.equal((await w.call('POST', `/api/mbogi/${code}/ping`, { as: host, body: { v: 'tab1' } })).data.people.length, 1);
  assert.equal((await w.call('POST', `/api/mbogi/${code}/end`, { as: host, body: {} })).status, 200);
  assert.equal((await w.call('POST', `/api/mbogi/${code}/join`, { as: guest, body: { v: 'tab2' } })).status, 410, 'cannot join an ended meeting');
  assert.equal((await w.call('GET', '/api/mbogi/' + code)).data.status, 'ended');
});

test('starting a new meeting ends the host\'s old one; a full meeting turns people away; the video token is issued when Agora keys exist', async (t) => {
  const w = await fresh(t, {}); w.env.AGORA_APP_ID = 'a'.repeat(32); w.env.AGORA_APP_CERTIFICATE = 'b'.repeat(32);
  const host = await w.user('h');
  const a = (await w.call('POST', '/api/mbogi/create', { as: host, body: {} })).data, b = (await w.call('POST', '/api/mbogi/create', { as: host, body: {} })).data;
  assert.equal((await w.call('GET', '/api/mbogi/' + a.code)).data.status, 'ended'); assert.equal((await w.call('GET', '/api/mbogi/' + b.code)).data.status, 'open');
  const j = await w.call('POST', `/api/mbogi/${b.code}/join`, { as: host, body: { v: 'x' } }); assert.match(j.data.token, /^007/);
  for (let i = 0; i < 11; i++) { const g = await w.user('g' + i); assert.equal((await w.call('POST', `/api/mbogi/${b.code}/join`, { as: g, body: { v: 'v' + i } })).status, 200); }
  const late = await w.user('late'); assert.equal((await w.call('POST', `/api/mbogi/${b.code}/join`, { as: late, body: { v: 'zz' } })).status, 409);
});
