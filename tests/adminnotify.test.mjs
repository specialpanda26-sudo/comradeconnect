import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

const mine = async (w, u) => (await w.call('GET', '/api/notifications', { as: u })).data;

test('admin decisions reach the person: ID approved, ID rejected', async (t) => {
  const w = world(); t.after(() => w.restore());
  const a = await w.user('a'), b = await w.user('b');
  const vid = () => crypto.randomUUID();
  const v1 = { id: vid(), aid: a.aid, status: 'pending', claimed_role: 'Student', created_at: new Date().toISOString() };
  const v2 = { id: vid(), aid: b.aid, status: 'pending', claimed_role: 'Student', created_at: new Date().toISOString() };
  w.db.rows('verifications').push(v1, v2);
  assert.equal((await w.call('POST', `/api/admin/verifications/${v1.id}`, { admin: true, body: { action: 'approve' } })).status, 200);
  assert.equal((await w.call('POST', `/api/admin/verifications/${v2.id}`, { admin: true, body: { action: 'reject', note: 'Photo is blurry' } })).status, 200);
  const na = await mine(w, a), nb = await mine(w, b);
  assert.equal(na.items[0].kind, 'verification'); assert.match(na.items[0].title, /verified/i);
  assert.equal(nb.items[0].body, 'Photo is blurry');
});

test('admin mute, unmute, ban and role change notify the person', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('u');
  for (const body of [{ action: 'mute', hours: 2 }, { action: 'unmute' }, { action: 'ban' }, { action: 'unban' }, { action: 'role', role: 'seller' }])
    assert.equal((await w.call('POST', `/api/admin/users/${u.aid}`, { admin: true, body })).status, 200);
  const n = await mine(w, u);
  assert.equal(n.items.length, 5);
  assert.ok(n.items.every((x) => x.kind === 'account'));
});

test('club order collected notifies the buyer', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('u');
  const id = crypto.randomUUID();
  w.db.rows('club_orders').push({ id, club: 'default', aid: u.aid, qty: 1, amount: 100, status: 'paid', created_at: new Date().toISOString() });
  assert.equal((await w.call('POST', `/api/admin/club/orders/${id}/collect`, { admin: true })).status, 200);
  assert.equal((await mine(w, u)).items[0].title, 'Order collected');
});

test('admin can add someone to the club by handle, and they are told', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('joiner');
  w.db.rows('profiles').find((p) => p.aid === u.aid).handle = 'Joiner';
  assert.equal((await w.call('POST', '/api/admin/joins/add', { admin: true, body: { kind: 'club', handle: '@joiner' } })).status, 200);
  assert.ok(w.db.rows('club_members').some((m) => m.aid === u.aid && m.status === 'active'));
  assert.equal((await mine(w, u)).items[0].kind, 'club');
  assert.equal((await w.call('POST', '/api/admin/joins/add', { admin: true, body: { kind: 'club', handle: 'ghost' } })).status, 400);
  assert.equal((await w.call('POST', '/api/admin/joins/add', { body: { kind: 'club', handle: 'joiner' } })).status, 403);
});

test('phone alert to club members only skips everyone else', async (t) => {
  const w = world(); t.after(() => w.restore());
  const a = await w.user('a'), b = await w.user('b');
  w.db.rows('push_subs').push({ aid: a.aid, endpoint: 'fcm:aaaaaaaaaaaaaaaaaaaaaaaa' }, { aid: b.aid, endpoint: 'fcm:bbbbbbbbbbbbbbbbbbbbbbbb' });
  w.db.rows('club_members').push({ club: 'default', aid: a.aid, status: 'active' });
  const r = await w.call('POST', '/api/admin/push/send', { admin: true, body: { title: 'Club meet', body: 'Friday 5pm', audience: 'club' } });
  assert.equal(r.data.accounts, 1);
  assert.equal((await mine(w, a)).items.length, 1);
  assert.equal((await mine(w, b)).items.length, 0);
});

test('admin-created event and notice are announced to phones (push is best effort)', async (t) => {
  const w = world(); t.after(() => w.restore());
  const r1 = await w.call('POST', '/api/admin/events', { admin: true, body: { title: 'Career fair', date: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10) } });
  const r2 = await w.call('POST', '/api/admin/notices', { admin: true, body: { title: 'Exam timetable', body: 'Out now' } });
  assert.equal(r1.status, 201); assert.equal(r2.status, 201);
});
