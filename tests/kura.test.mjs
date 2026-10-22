import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

const SEASON = { id: 1, title: 'Campus Star Awards', tagline: 't', voting_open: true, entries_open: true, ends_at: new Date(Date.now() + 864e5).toISOString(), prize_title: '', prize_text: '', prizes: [],
  packs: [{ votes: 1, price: 10 }, { votes: 10, price: 100, popular: true }, { votes: 60, price: 500, bonus: 10 }],
  campuses: ['Kirinyaga University', 'Other'], divisions: [{ id: 'entertainment', name: 'Entertainment', categories: ['Singing', 'Dance'] }, { id: 'media', name: 'Media & Creators', categories: ['TikTok'] }] };

async function apply(w, who, over = {}) {
  const up = await w.call('POST', '/api/kura/photo-url', { as: who, body: { content_type: 'image/jpeg', bytes: 4000 } });
  assert.equal(up.status, 201);
  w.env.MEDIA.put(up.data.key, 4000);
  return w.call('POST', '/api/kura/apply', { as: who, body: { name: 'Star One', photo_key: up.data.key, campus: 'Kirinyaga University', gender: 'male', division: 'entertainment', category: 'Singing',
    tagline: 'Ready', bio: 'I sing', socials: { instagram: '@starone' }, phone: '0712345678', email: 'one@example.com', ...over } });
}

test('apply, admin approves, fan votes, votes count only after payment', async (t) => {
  const w = world(); t.after(w.restore); w.db.rows('kura_season').push({ ...SEASON });
  const a = await w.user('a'), fan = await w.user('fan');
  const r = await apply(w, a); assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal((await w.call('GET', '/api/kura/board')).data.total, 0);                                   // pending: not public yet
  const st = await w.call('POST', '/api/kura/status', { body: { email: 'ONE@example.com', phone: '0712345678' } });
  assert.equal(st.data.status, 'pending');
  const dup = await apply(w, await w.user('b')); assert.equal(dup.status, 409);                            // same email twice
  assert.equal((await w.call('POST', `/api/admin/kura/c/${r.data.id}`, { body: { action: 'approve' } })).status, 403);   // not admin
  assert.equal((await w.call('POST', `/api/admin/kura/c/${r.data.id}`, { admin: true, body: { action: 'approve' } })).status, 200);
  const board = await w.call('GET', '/api/kura/board'); assert.equal(board.data.items[0].rank, 1); assert.equal(board.data.counts.entertainment, 1);
  const v = await w.call('POST', '/api/kura/vote', { as: fan, body: { contestant_id: r.data.id, pack: 1, phone: '0711222333', name: 'Dad' } });
  assert.equal(v.status, 201, JSON.stringify(v.data)); assert.equal(v.data.amount, 100); assert.equal(v.data.votes, 10);
  assert.equal(w.row('kura_contestants', (c) => c.id === r.data.id).votes, 0);                              // not paid yet
  const pay = w.row('payments', (p) => p.id === v.data.id); assert.equal(pay.purpose, 'kura'); assert.equal(pay.amount, 100);
  await w.callback(pay);
  assert.equal(w.row('kura_contestants', (c) => c.id === r.data.id).votes, 10);
  await w.callback(pay);                                                                                    // a repeated callback never double counts
  assert.equal(w.row('kura_contestants', (c) => c.id === r.data.id).votes, 10);
  const pr = await w.call('GET', `/api/kura/c/${r.data.id}`, { as: fan });
  assert.equal(pr.data.rank, 1); assert.equal(pr.data.supporters[0].name, 'Dad'); assert.equal(pr.data.supporters[0].votes, 10); assert.equal(pr.data.contestant.socials.instagram.handle, 'starone');
  assert.equal(pr.data.contestant.email, undefined); assert.equal(pr.data.contestant.phone, undefined);
  const home = await w.call('GET', '/api/kura/home'); assert.equal(home.data.stats.votes, 10); assert.equal(home.data.top[0].name, 'Star One');
});

test('the browser cannot change the price, bad input is refused, closed voting stops sales', async (t) => {
  const w = world(); t.after(w.restore); w.db.rows('kura_season').push({ ...SEASON });
  const a = await w.user('a'), fan = await w.user('fan');
  const r = await apply(w, a); await w.call('POST', `/api/admin/kura/c/${r.data.id}`, { admin: true, body: { action: 'approve' } });
  const cheat = await w.call('POST', '/api/kura/vote', { as: fan, body: { contestant_id: r.data.id, pack: 2, amount: 1, price: 1, phone: '0711222333' } });
  assert.equal(w.row('payments', (p) => p.id === cheat.data.id).amount, 500);
  assert.equal((await w.call('POST', '/api/kura/vote', { as: fan, body: { contestant_id: r.data.id, pack: 9, phone: '0711222333' } })).status, 400);
  assert.equal((await w.call('POST', '/api/kura/vote', { as: fan, body: { contestant_id: r.data.id, pack: 0, phone: '0711222333', name: 'call 0711222333' } })).status, 400);
  assert.equal((await w.call('POST', '/api/kura/vote', { body: { contestant_id: r.data.id, pack: 0, phone: '0711222333' } })).status, 401);
  assert.equal((await apply(w, await w.user('c'), { email: 'x@example.com', bio: 'whatsapp 0711222333' })).status, 400);
  assert.equal((await apply(w, await w.user('d'), { email: 'y@example.com', category: 'TikTok' })).status, 400);   // TikTok is not in Entertainment
  await w.call('POST', '/api/admin/kura/season', { admin: true, body: { voting_open: false } });
  assert.equal((await w.call('POST', '/api/kura/vote', { as: fan, body: { contestant_id: r.data.id, pack: 0, phone: '0711222333' } })).status, 400);
});

test('failed payment adds nothing; follow toggles; closest race is reported', async (t) => {
  const w = world(); t.after(w.restore); w.db.rows('kura_season').push({ ...SEASON });
  const a = await w.user('a'), b = await w.user('b'), fan = await w.user('fan');
  const r1 = await apply(w, a), r2 = await apply(w, b, { name: 'Star Two', email: 'two@example.com' });
  for (const r of [r1, r2]) await w.call('POST', `/api/admin/kura/c/${r.data.id}`, { admin: true, body: { action: 'approve' } });
  const v = await w.call('POST', '/api/kura/vote', { as: fan, body: { contestant_id: r1.data.id, pack: 0, phone: '0711222333' } });
  await w.callback(w.row('payments', (p) => p.id === v.data.id), { code: 1032 });
  assert.equal(w.row('kura_contestants', (c) => c.id === r1.data.id).votes, 0);
  const v2 = await w.call('POST', '/api/kura/vote', { as: fan, body: { contestant_id: r1.data.id, pack: 0, phone: '0711222333' } });
  await w.callback(w.row('payments', (p) => p.id === v2.data.id));
  const home = await w.call('GET', '/api/kura/home'); assert.equal(home.data.closest[0].lead.name, 'Star One'); assert.equal(home.data.closest[0].gap, 2); assert.equal(home.data.closest[0].chaser.name, 'Star Two');
  const f1 = await w.call('POST', '/api/kura/follow', { as: fan, body: { contestant_id: r1.data.id } }); assert.deepEqual([f1.data.following, f1.data.followers], [true, 1]);
  const f2 = await w.call('POST', '/api/kura/follow', { as: fan, body: { contestant_id: r1.data.id } }); assert.deepEqual([f2.data.following, f2.data.followers], [false, 0]);
  const hid = await w.call('POST', `/api/admin/kura/c/${r2.data.id}`, { admin: true, body: { action: 'hide' } }); assert.equal(hid.status, 200);
  assert.equal((await w.call('GET', `/api/kura/c/${r2.data.id}`)).status, 404);
});

test('two competitions run side by side: own contestants, own boards, own voting switch', async (t) => {
  const w = world(); t.after(w.restore); w.db.rows('kura_season').push({ ...SEASON });
  const a = await w.user('a'), b = await w.user('b'), fan = await w.user('fan');
  const mk = await w.call('POST', '/api/admin/kura/season/new', { admin: true, body: { title: 'Miss Campus', copy_from: 1 } });
  assert.equal(mk.status, 201, JSON.stringify(mk.data)); assert.equal(mk.data.id, 2);
  assert.equal((await w.call('POST', '/api/admin/kura/season/new', { body: { title: 'x' } })).status, 403);
  const r1 = await apply(w, a);                                                                      // no season given: goes to the default one
  const r2 = await apply(w, b, { email: 'one@example.com', name: 'Star Two', season_id: 2 });        // same email, other competition: allowed
  assert.equal(r1.status, 201); assert.equal(r2.status, 201, JSON.stringify(r2.data));
  assert.equal(w.row('kura_contestants', (c) => c.id === r1.data.id).season_id, 1); assert.equal(w.row('kura_contestants', (c) => c.id === r2.data.id).season_id, 2);
  for (const r of [r1, r2]) await w.call('POST', `/api/admin/kura/c/${r.data.id}`, { admin: true, body: { action: 'approve' } });
  assert.equal((await w.call('GET', '/api/kura/board?season=1')).data.items.map((x) => x.name).join(), 'Star One');
  assert.equal((await w.call('GET', '/api/kura/board?season=2')).data.items.map((x) => x.name).join(), 'Star Two');
  const home = await w.call('GET', '/api/kura/home?season=2'); assert.equal(home.data.season.id, 2); assert.equal(home.data.seasons.length, 2); assert.equal(home.data.stats.contestants, 1);
  assert.equal((await w.call('POST', '/api/kura/vote', { as: fan, body: { contestant_id: r2.data.id, pack: 0, phone: '0711222333' } })).status, 400);   // competition 2 starts with voting off
  await w.call('POST', '/api/admin/kura/season', { admin: true, body: { id: 2, voting_open: true } });
  const v = await w.call('POST', '/api/kura/vote', { as: fan, body: { contestant_id: r2.data.id, pack: 0, phone: '0711222333' } }); assert.equal(v.status, 201, JSON.stringify(v.data));
  await w.callback(w.row('payments', (p) => p.id === v.data.id));
  assert.equal(w.row('kura_contestants', (c) => c.id === r2.data.id).votes, 1); assert.equal(w.row('kura_contestants', (c) => c.id === r1.data.id).votes, 0);
  const ad = await w.call('GET', '/api/admin/kura?season=2', { admin: true }); assert.equal(ad.data.contestants.length, 1); assert.equal(ad.data.money.paid, 10); assert.equal(ad.data.seasons.length, 2);
  assert.equal((await w.call('GET', '/api/admin/kura?season=1', { admin: true })).data.money.paid, 0);
  await w.call('POST', '/api/admin/kura/season', { admin: true, body: { id: 2, archived: true } });
  assert.equal((await w.call('GET', '/api/kura/home')).data.seasons.length, 1);                      // archived ones leave the voter picker
});
