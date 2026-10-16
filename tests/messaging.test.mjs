import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
const fresh = async (t, o) => { const w = world(o); t.after(() => w.restore()); return w; };

test('messaging: start from a listing, inbox, unread, read receipts, no aid leaks', async (t) => {
  const w = await fresh(t);
  const s = await w.user('seller'), b = await w.user('buyer');
  await w.call('POST', '/api/me/handle', { as: s, body: { handle: 'SellerSam' } });
  const lid = await w.approvedListing(s, 900);
  const r = await w.call('POST', '/api/messages/send', { as: b, body: { listing_id: lid, body: 'Is it still available?' } });
  assert.equal(r.status, 201);
  const inbox = (await w.call('GET', '/api/messages/inbox', { as: s })).data.threads;
  assert.equal(inbox.length, 1); assert.equal(inbox[0].unread, 1); assert.equal(inbox[0].listing.id, lid);
  const bInbox = await w.call('GET', '/api/messages/inbox', { as: b });
  assert.equal(bInbox.data.threads[0].with, 'SellerSam');
  assert.ok(!JSON.stringify(inbox).includes(b.aid) && !JSON.stringify(bInbox.data).includes(s.aid), 'aids never leak to the other side');
  const tid = r.data.thread_id;
  const reply = await w.call('POST', '/api/messages/send', { as: s, body: { thread_id: tid, body: 'Yes, come to the gate' } });
  assert.equal(reply.status, 201); assert.equal(reply.data.thread_id, tid);
  assert.equal(w.db.rows('threads').length, 1, 'same conversation reused');
  const msgs = (await w.call('GET', `/api/messages/thread/${tid}`, { as: s })).data.messages;
  assert.equal(msgs.length, 2); assert.equal(msgs[0].mine, false); assert.equal(msgs[1].mine, true);
  assert.equal((await w.call('GET', '/api/messages/inbox', { as: s })).data.threads[0].unread, 0, 'reading marks as read');
  const again = await w.call('POST', '/api/messages/send', { as: b, body: { listing_id: lid, body: 'Great, thanks' } });
  assert.equal(again.data.thread_id, tid);
});

test('messaging: contact info, empty text, strangers, unknown targets, self-messaging', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b'), x = await w.user('x');
  const lid = await w.approvedListing(a, 500);
  assert.equal((await w.call('POST', '/api/messages/send', { as: b, body: { listing_id: lid, body: 'call 0712 345 678' } })).status, 400);
  assert.equal((await w.call('POST', '/api/messages/send', { as: b, body: { listing_id: lid, body: 'my insta: @cool_guy' } })).status, 400);
  assert.equal((await w.call('POST', '/api/messages/send', { as: b, body: { listing_id: lid, body: '   ' } })).status, 400);
  assert.equal((await w.call('POST', '/api/messages/send', { as: a, body: { listing_id: lid, body: 'hi me' } })).status, 404, 'cannot message yourself');
  assert.equal((await w.call('POST', '/api/messages/send', { as: b, body: { to_aid: 'nobody_here_1', body: 'hi' } })).status, 404);
  const ok = await w.call('POST', '/api/messages/send', { as: b, body: { listing_id: lid, body: 'hello' } });
  assert.equal((await w.call('GET', `/api/messages/thread/${ok.data.thread_id}`, { as: x })).status, 404, 'stranger cannot read');
  assert.equal((await w.call('POST', '/api/messages/send', { as: x, body: { thread_id: ok.data.thread_id, body: 'butting in' } })).status, 404);
  assert.equal((await w.call('POST', '/api/messages/send', { body: { listing_id: lid, body: 'no login' } })).status, 401);
});

test('messaging: block, unblock, 24-hour mute, report with snapshot', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b');
  const lid = await w.approvedListing(a, 500);
  const first = await w.call('POST', '/api/messages/send', { as: b, body: { listing_id: lid, body: 'You are a scammer lol' } });
  const tid = first.data.thread_id, mid = first.data.message.id;
  // reporting
  assert.equal((await w.call('POST', '/api/messages/report', { as: b, body: { message_id: mid } })).status, 404, 'cannot report own message');
  assert.equal((await w.call('POST', '/api/messages/report', { as: a, body: { message_id: mid, reason: 'Abusive' } })).status, 200);
  const rep = w.db.rows('message_reports')[0];
  assert.equal(rep.snapshot, 'You are a scammer lol'); assert.equal(rep.reported_aid, b.aid); assert.equal(rep.status, 'open');
  assert.equal((await w.call('GET', '/api/admin/queue', { admin: true })).data.message_reports.length, 1);
  // mute
  const mu = await w.call('POST', '/api/messages/mute', { as: a, body: { thread_id: tid } });
  const hrs = (Date.parse(mu.data.muted_until) - Date.now()) / 36e5;
  assert.ok(hrs > 23.9 && hrs <= 24, 'about 24 hours');
  assert.equal((await w.call('GET', '/api/messages/inbox', { as: a })).data.threads[0].muted, true);
  assert.equal((await w.call('GET', '/api/messages/inbox', { as: b })).data.threads[0].muted, false, 'mute is private to the muter');
  w.db.rows('thread_mutes')[0].muted_until = new Date(Date.now() - 1000).toISOString();
  assert.equal((await w.call('GET', '/api/messages/inbox', { as: a })).data.threads[0].muted, false, 'mute expires');
  // block
  assert.equal((await w.call('POST', '/api/messages/block', { as: a, body: { thread_id: tid } })).status, 200);
  assert.equal((await w.call('POST', '/api/messages/block', { as: a, body: { thread_id: tid } })).status, 200, 'idempotent');
  const blocked = await w.call('POST', '/api/messages/send', { as: b, body: { thread_id: tid, body: 'please?' } });
  assert.equal(blocked.status, 403);
  assert.equal((await w.call('POST', '/api/messages/send', { as: b, body: { listing_id: lid, body: 'new thread?' } })).status, 403, 'no workaround through the listing');
  assert.equal((await w.call('POST', '/api/messages/send', { as: a, body: { thread_id: tid, body: 'hey' } })).status, 403, 'blocker must unblock first');
  assert.equal((await w.call('GET', '/api/messages/inbox', { as: a })).data.threads[0].blocked, true);
  await w.call('POST', '/api/messages/unblock', { as: a, body: { thread_id: tid } });
  assert.equal((await w.call('POST', '/api/messages/send', { as: b, body: { thread_id: tid, body: 'sorry' } })).status, 201);
});

test('messaging: rate limit and admin mute/ban stop sending', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b');
  const lid = await w.approvedListing(a, 500);
  let last;
  for (let i = 0; i < 82; i++) { last = await w.call('POST', '/api/messages/send', { as: b, body: { listing_id: lid, body: 'msg ' + i } }); if (last.status === 429) break; }
  assert.equal(last.status, 429);
  const c = await w.user('c');
  await w.call('POST', `/api/admin/users/${c.aid}`, { admin: true, body: { action: 'mute', hours: 24 } });
  assert.equal((await w.call('POST', '/api/messages/send', { as: c, body: { listing_id: lid, body: 'hello' } })).status, 403);
  assert.equal((await w.call('GET', '/api/messages/inbox', { as: c })).status, 200, 'muted users can still read');
  await w.call('POST', `/api/admin/users/${c.aid}`, { admin: true, body: { action: 'unmute' } });
  assert.equal((await w.call('POST', '/api/messages/send', { as: c, body: { listing_id: lid, body: 'hello' } })).status, 201);
});

test('Hearts: 18+ gate, interest, match creates a private chat, no author ids exposed', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b');
  assert.equal((await w.call('POST', '/api/c/hearts', { as: a, body: { content: 'Looking for a study buddy' } })).status, 403, 'needs 18+ confirmation');
  assert.equal((await w.call('GET', '/api/c/hearts', { as: a })).status, 403);
  for (const u of [a, b]) assert.equal((await w.call('POST', '/api/me/adult', { as: u, body: { confirm: true } })).status, 200);
  const pa = await w.call('POST', '/api/c/hearts', { as: a, body: { content: 'Coffee at the library?', zone: 'Main' } });
  const pb = await w.call('POST', '/api/c/hearts', { as: b, body: { content: 'Anyone for movies this weekend', zone: 'Main' } });
  assert.equal(pa.status, 201);
  assert.equal((await w.call('POST', '/api/c/hearts', { as: a, body: { content: 'call me 0712345678' } })).status, 400);
  assert.equal((await w.call('POST', `/api/c/hearts/${pb.data.id}/interest`, { as: b })).status, 400, 'own post');
  const list = await w.call('GET', '/api/c/hearts', { as: a });
  assert.ok(!JSON.stringify(list.data).includes(b.aid), 'no author ids');
  const i1 = await w.call('POST', `/api/c/hearts/${pb.data.id}/interest`, { as: a });
  assert.equal(i1.data.matched, false);
  const i2 = await w.call('POST', `/api/c/hearts/${pa.data.id}/interest`, { as: b });
  assert.equal(i2.data.matched, true); assert.ok(i2.data.thread_id);
  const inbox = (await w.call('GET', '/api/messages/inbox', { as: a })).data.threads;
  assert.equal(inbox.length, 1); assert.equal(inbox[0].unread, 1);
  assert.equal(w.db.rows('threads').length, 1);
  await w.call('POST', `/api/c/hearts/${pa.data.id}/interest`, { as: b });
  assert.equal(w.db.rows('threads').length, 1, 'repeating interest does not make new chats');
  assert.equal(w.db.rows('hearts_posts').every((p) => p.adult_only === undefined || p.adult_only === true), true);
});

test('polls: exactly one vote per person, options validated, closed polls refuse votes', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b');
  assert.equal((await w.call('POST', '/api/c/polls', { as: a, body: { question: 'Best canteen?', options: ['Only one'] } })).status, 400);
  assert.equal((await w.call('POST', '/api/c/polls', { as: a, body: { question: 'Best canteen?', options: ['A', 'a'] } })).status, 400);
  assert.equal((await w.call('POST', '/api/c/polls', { as: a, body: { question: 'Best canteen?', options: ['A', 'call 0712345678'] } })).status, 400);
  const p = await w.call('POST', '/api/c/polls', { as: a, body: { question: 'Best canteen?', options: ['Main', 'Hostel'] } });
  assert.equal(p.status, 201);
  assert.equal((await w.call('POST', `/api/c/polls/${p.data.id}/vote`, { as: b, body: { option: 7 } })).status, 400);
  const v1 = await w.call('POST', `/api/c/polls/${p.data.id}/vote`, { as: b, body: { option: 1 } });
  assert.deepEqual(v1.data.counts, [0, 1]);
  assert.equal((await w.call('POST', `/api/c/polls/${p.data.id}/vote`, { as: b, body: { option: 0 } })).status, 409);
  const par = await Promise.all([1, 2, 3].map(() => w.call('POST', `/api/c/polls/${p.data.id}/vote`, { as: a, body: { option: 0 } })));
  assert.equal(par.filter((r) => r.status === 200).length, 1, 'parallel votes count once');
  const list = (await w.call('GET', '/api/c/polls', { as: b })).data.items[0];
  assert.deepEqual(list.counts, [1, 1]); assert.equal(list.voted, 1);
  w.db.rows('polls')[0].closes_at = new Date(Date.now() - 1000).toISOString();
  const c = await w.user('c');
  assert.equal((await w.call('POST', `/api/c/polls/${p.data.id}/vote`, { as: c, body: { option: 0 } })).status, 409);
});

test('community content: create, list, filters, rate limits, reports auto-hide at 3 different reporters', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  const room = await w.call('POST', '/api/c/rooms', { as: a, body: { title: 'Room near gate', details: 'KES 3000', rent: 3000, zone: 'Gate A', kind: 'offering' } });
  assert.equal(room.status, 201); assert.equal(room.data.mine, true); assert.equal(room.data.aid, undefined);
  assert.equal((await w.call('POST', '/api/c/rooms', { as: a, body: { title: 'x' } })).status, 400);
  assert.equal((await w.call('POST', '/api/c/rooms', { as: a, body: { title: 'Room', details: 'whatsapp: me' } })).status, 400);
  const n = (await w.call('GET', '/api/c/rooms?zone=Gate%20A')).data.items.length, n2 = (await w.call('GET', '/api/c/rooms?zone=Other')).data.items.length;
  assert.deepEqual([n, n2], [1, 0]);
  for (const [path, body] of [['hostels', { name: 'Sunrise Hostel', rating: 4, rent: 5000, review: 'Clean' }], ['services', { title: 'Laptop repair', category: 'Tech' }], ['wifi', { place: 'Library 2F' }], ['tips', { unit: 'SMA 101', tip: 'Start past papers early' }], ['groups', { name: 'Calculus crew', unit: 'MAT 110' }]])
    assert.equal((await w.call('POST', '/api/c/' + path, { as: a, body })).status, 201, path);
  let r; for (let i = 0; i < 6; i++) r = await w.call('POST', '/api/c/rooms', { as: a, body: { title: 'Room number ' + i } });
  assert.equal(r.status, 429, 'rooms limited to 5 per day');
  // reports
  const id = room.data.id, rs = [await w.user('r1'), await w.user('r2'), await w.user('r3')];
  for (let i = 0; i < 3; i++) { await w.call('POST', '/api/report', { as: rs[i], body: { type: 'room', id, reason: 'spam' } }); await w.call('POST', '/api/report', { as: rs[i], body: { type: 'room', id } }); }
  assert.equal(w.db.rows('content_reports').length, 3, 'same person cannot report twice');
  assert.equal((await w.call('GET', '/api/c/rooms')).data.items.some((x) => x.id === id), false, 'hidden after 3 different reports');
  const q = (await w.call('GET', '/api/admin/queue', { admin: true })).data;
  assert.equal(q.content_reports.length, 3);
  await w.call('POST', `/api/admin/reports/content/${q.content_reports[0].id}`, { admin: true, body: { action: 'dismiss', unhide: true } });
  assert.equal((await w.call('GET', '/api/c/rooms')).data.items.some((x) => x.id === id), true, 'admin can restore');
});

test('groups: capacity, wifi votes upsert, tip likes once, zone ratings average', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b'), c = await w.user('c');
  const g = await w.call('POST', '/api/c/groups', { as: a, body: { name: 'Tiny group', max_members: 2 } });
  assert.equal((await w.call('POST', `/api/c/groups/${g.data.id}/join`, { as: a })).data.members, 1);
  assert.equal((await w.call('POST', `/api/c/groups/${g.data.id}/join`, { as: b })).data.members, 2);
  assert.equal((await w.call('POST', `/api/c/groups/${g.data.id}/join`, { as: c })).status, 409);
  await w.call('POST', `/api/c/groups/${g.data.id}/leave`, { as: a });
  assert.equal((await w.call('POST', `/api/c/groups/${g.data.id}/join`, { as: c })).status, 200);
  const wf = await w.call('POST', '/api/c/wifi', { as: a, body: { place: 'Library' } });
  assert.equal((await w.call('POST', `/api/c/wifi/${wf.data.id}/vote`, { as: b, body: { value: 5 } })).status, 400);
  await w.call('POST', `/api/c/wifi/${wf.data.id}/vote`, { as: b, body: { value: -1 } });
  const v = await w.call('POST', `/api/c/wifi/${wf.data.id}/vote`, { as: b, body: { value: 1 } });
  assert.equal(v.data.score, 1); assert.equal(v.data.votes, 1, 'changing a vote does not add a second');
  const tip = await w.call('POST', '/api/c/tips', { as: a, body: { tip: 'Sleep before exams' } });
  await w.call('POST', `/api/c/tips/${tip.data.id}/like`, { as: b }); const l2 = await w.call('POST', `/api/c/tips/${tip.data.id}/like`, { as: b });
  assert.equal(l2.data.likes, 1);
  await w.call('POST', '/api/c/zones/rate', { as: a, body: { zone: 'Town', safety: 4, noise: 2, value: 5 } });
  await w.call('POST', '/api/c/zones/rate', { as: b, body: { zone: 'Town', safety: 2, noise: 4, value: 3 } });
  await w.call('POST', '/api/c/zones/rate', { as: b, body: { zone: 'Town', safety: 2, noise: 4, value: 3 } });
  const z = (await w.call('GET', '/api/c/zones')).data.zones[0];
  assert.deepEqual([z.ratings, z.safety, z.noise, z.value], [2, 3, 3, 4]);
});

test('feed still works and respects mute/ban (regression)', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  const p = await w.call('POST', '/api/posts', { body: { aid: a.aid, content: 'Hello campus', category: 'General' } });
  assert.ok([200, 201].includes(p.status), 'post created: ' + p.status + JSON.stringify(p.data));
  const list = await w.call('GET', '/api/posts');
  assert.equal(list.status, 200); assert.ok(JSON.stringify(list.data).includes('Hello campus'));
  assert.equal((await w.call('POST', '/api/posts', { body: { aid: a.aid, content: 'Call 0712345678 now', category: 'General' } })).status, 400);
  await w.call('POST', `/api/admin/users/${a.aid}`, { admin: true, body: { action: 'ban' } });
  assert.equal((await w.call('POST', '/api/posts', { body: { aid: a.aid, content: 'Still here?', category: 'General' } })).status, 403);
});

test('messaging from a post: room, feed story, service; author never revealed; same chat reused; own/hidden/unknown refused', async (t) => {
  const w = await fresh(t);
  const a = await w.user('author'), b = await w.user('reader');
  await w.call('POST', '/api/me/handle', { as: a, body: { handle: 'RoomOwner' } });
  const room = await w.call('POST', '/api/c/rooms', { as: a, body: { kind: 'offering', title: 'Single room Kerugoya', rent: 4000, zone: 'Kerugoya' } });
  assert.equal(room.status, 201);
  const r1 = await w.call('POST', '/api/messages/send', { as: b, body: { ref_type: 'room', ref_id: room.data.id, body: 'Is it still free?' } });
  assert.equal(r1.status, 201, JSON.stringify(r1.data));
  const r2 = await w.call('POST', '/api/messages/send', { as: b, body: { ref_type: 'room', ref_id: room.data.id, body: 'Can I see it Saturday?' } });
  assert.equal(r2.data.thread_id, r1.data.thread_id, 'same post, same chat');
  assert.equal(JSON.stringify(r1.data).includes(a.aid), false, 'author aid never sent to the reader');
  const inboxA = await w.call('GET', '/api/messages/inbox', { as: a });
  assert.equal(inboxA.data.threads.length, 1); assert.equal(inboxA.data.threads[0].unread, 2);
  assert.equal(inboxA.data.threads[0].listing.title, 'Single room Kerugoya');
  assert.equal(inboxA.data.threads[0].listing.id, room.data.id);
  // a different post by the same author is a separate chat
  const room2 = await w.call('POST', '/api/c/rooms', { as: a, body: { kind: 'offering', title: 'Bedsitter Kutus', rent: 6000, zone: 'Kutus' } });
  const r3 = await w.call('POST', '/api/messages/send', { as: b, body: { ref_type: 'room', ref_id: room2.data.id, body: 'And this one?' } });
  assert.notEqual(r3.data.thread_id, r1.data.thread_id);
  // own post, unknown type, bad id, hearts (only from a match), missing post
  assert.equal((await w.call('POST', '/api/messages/send', { as: a, body: { ref_type: 'room', ref_id: room.data.id, body: 'Hi me' } })).status, 404);
  assert.equal((await w.call('POST', '/api/messages/send', { as: b, body: { ref_type: 'hearts', ref_id: room.data.id, body: 'Hi' } })).status, 404);
  assert.equal((await w.call('POST', '/api/messages/send', { as: b, body: { ref_type: 'room', ref_id: 'nope', body: 'Hi' } })).status, 404);
  assert.equal((await w.call('POST', '/api/messages/send', { as: b, body: { ref_type: 'room', ref_id: '11111111-1111-4111-8111-111111111111', body: 'Hi' } })).status, 404);
  // contact info still blocked
  assert.equal((await w.call('POST', '/api/messages/send', { as: b, body: { ref_type: 'room', ref_id: room.data.id, body: 'call 0712345678' } })).status, 400);
  // hidden post
  w.db.rows('rooms').find((x) => x.id === room2.data.id).hidden = true;
  assert.equal((await w.call('POST', '/api/messages/send', { as: b, body: { ref_type: 'room', ref_id: room2.data.id, body: 'Still there?' } })).status, 404);
  // blocked reader cannot message again through a post
  const th = r1.data.thread_id;
  await w.call('POST', '/api/messages/block', { as: a, body: { thread_id: th } });
  assert.equal((await w.call('POST', '/api/messages/send', { as: b, body: { ref_type: 'room', ref_id: room.data.id, body: 'Hello?' } })).status, 403);
  // service and Feed story
  const c = await w.user('c');
  const sv = await w.call('POST', '/api/c/services', { as: a, body: { title: 'Quick print point', category: 'Printing' } });
  assert.equal((await w.call('POST', '/api/messages/send', { as: b, body: { ref_type: 'service', ref_id: sv.data.id, body: 'Open now?' } })).status, 403, 'b is blocked by a');
  assert.equal((await w.call('POST', '/api/messages/send', { as: c, body: { ref_type: 'service', ref_id: sv.data.id, body: 'Open now?' } })).status, 201);
  await w.call('POST', '/api/posts', { body: { aid: a.aid, content: 'Hostel water is back', category: 'HostelTea' } });
  const feed = (await w.call('GET', '/api/posts')).data;
  const story = (feed.posts || feed.items || feed)[0];
  const sid = story._id || story.id;
  const fs = await w.call('POST', '/api/messages/send', { as: c, body: { ref_type: 'post', ref_id: sid, body: 'Which hostel?' } });
  assert.equal(fs.status, 201, JSON.stringify(fs.data));
  assert.equal((await w.call('GET', '/api/messages/inbox', { as: a })).data.threads.some((x) => x.listing && x.listing.title === 'Hostel water is back'), true);
});
