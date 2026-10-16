import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
const fresh = async (t, o) => { const w = world(o); t.after(() => w.restore()); return w; };
const u8 = (n) => 'x'.repeat(n);

test('media: signed Supabase upload URL, upload check, size cap, clips list and one like per person', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b');
  assert.equal((await w.call('POST', '/api/media/upload-url', { as: a, body: { kind: 'clip', content_type: 'application/pdf', bytes: 1000 } })).status, 400);
  assert.equal((await w.call('POST', '/api/media/upload-url', { as: a, body: { kind: 'clip', content_type: 'video/mp4', bytes: 900 * 1048576 } })).status, 400, 'too big');
  const up = await w.call('POST', '/api/media/upload-url', { as: a, body: { kind: 'clip', content_type: 'video/mp4', bytes: 2e6, caption: 'Graduation vibes' } });
  assert.equal(up.status, 201);
  const url = new URL(up.data.upload_url);
  assert.equal(url.origin, 'https://sb.test'); assert.ok(url.pathname.startsWith('/storage/v1/object/upload/sign/media-bucket/clip/'));
  assert.equal(url.searchParams.get('token'), 'tok123'); assert.ok(!up.data.upload_url.includes('svc'), 'service key never in the URL');
  assert.equal((await w.call('POST', `/api/media/${up.data.id}/complete`, { as: a })).status, 409, 'file never arrived');
  assert.equal((await w.call('GET', '/api/clips')).data.clips.length, 0, 'pending clips are not listed');
  const row = w.db.rows('media')[0];
  w.env.MEDIA.put(row.r2_key, 2e6);
  assert.equal((await w.call('POST', `/api/media/${up.data.id}/complete`, { as: b })).status, 404, 'only the owner can complete');
  const done = await w.call('POST', `/api/media/${up.data.id}/complete`, { as: a });
  assert.equal(done.status, 200); assert.equal(done.data.url, 'https://media.test/' + row.r2_key);
  assert.equal(new URL((await w.call('GET', '/api/clips')).data.clips[0].url).host, 'media.test');
  const clips = (await w.call('GET', '/api/clips', { as: b })).data.clips;
  assert.equal(clips.length, 1); assert.equal(clips[0].liked, false);
  await w.call('POST', `/api/clips/${clips[0].id}/like`, { as: b });
  const l2 = await w.call('POST', `/api/clips/${clips[0].id}/like`, { as: b });
  assert.equal(l2.data.likes, 1, 'one like per person');
  assert.equal((await w.call('GET', '/api/clips', { as: b })).data.clips[0].liked, true);
  // someone lies about size
  const up2 = await w.call('POST', '/api/media/upload-url', { as: a, body: { kind: 'clip', content_type: 'video/mp4', bytes: 1000 } });
  w.env.MEDIA.put(w.db.rows('media')[1].r2_key, 200 * 1048576);
  assert.equal((await w.call('POST', `/api/media/${up2.data.id}/complete`, { as: a })).status, 413);
  assert.equal(await w.env.MEDIA.head(w.db.rows('media')[1].r2_key), null, 'oversize object deleted');
  // a file that is not really a video (wrong first bytes) is refused and deleted
  const up3 = await w.call('POST', '/api/media/upload-url', { as: a, body: { kind: 'clip', content_type: 'video/mp4', bytes: 1000 } });
  w.env.MEDIA.put(w.db.rows('media')[2].r2_key, 1000, new TextEncoder().encode('<script>alert(1)</script>'));
  assert.equal((await w.call('POST', `/api/media/${up3.data.id}/complete`, { as: a })).status, 415);
  assert.equal(await w.env.MEDIA.head(w.db.rows('media')[2].r2_key), null, 'disguised file deleted');
  assert.equal(w.db.rows('media')[2].status, 'hidden');
});

test('media housekeeping: abandoned uploads are cleaned up and the oldest clips go when storage is over budget', async (t) => {
  const w = await fresh(t, { env: { MEDIA_BUDGET_MB: '10' } });
  const a = await w.user('a');
  const clip = async (mb) => { const r = await w.call('POST', '/api/media/upload-url', { as: a, body: { kind: 'clip', content_type: 'video/mp4', bytes: mb * 1048576 } }); const row = w.db.rows('media').find((x) => x.id === r.data.id); w.env.MEDIA.put(row.r2_key, mb * 1048576); return { r, row }; };
  const c1 = await clip(6), c2 = await clip(6);
  for (const c of [c1, c2]) assert.equal((await w.call('POST', `/api/media/${c.r.data.id}/complete`, { as: a })).status, 200);
  c1.row.created_at = new Date(Date.now() - 5 * 86400e3).toISOString();
  const abandoned = await clip(1); abandoned.row.created_at = new Date(Date.now() - 2 * 86400e3).toISOString();
  const r = await w.cron();
  assert.equal(r.media.stale, 1); assert.equal(r.media.pruned, 1);
  assert.equal(c1.row.status, 'hidden', 'oldest clip removed'); assert.equal(c2.row.status, 'ready', 'newer clip kept');
  assert.equal(await w.env.MEDIA.head(c1.row.r2_key), null); assert.equal(await w.env.MEDIA.head(abandoned.row.r2_key), null);
  assert.equal((await w.call('GET', '/api/clips')).data.clips.length, 1);
});

test('listing photos: owner only, max 5, shown on approved listing', async (t) => {
  const w = await fresh(t);
  const s = await w.user('s'), x = await w.user('x');
  const l = await w.call('POST', '/api/market/listings', { as: s, body: { title: 'Fridge small', price: 4000 } });
  const body = { kind: 'listing_photo', content_type: 'image/jpeg', bytes: 1000, listing_id: l.data.id };
  assert.equal((await w.call('POST', '/api/media/upload-url', { as: x, body })).status, 404, 'not your listing');
  for (let i = 0; i < 5; i++) { const r = await w.call('POST', '/api/media/upload-url', { as: s, body }); assert.equal(r.status, 201); w.env.MEDIA.put(w.db.rows('media')[i].r2_key, 1000); await w.call('POST', `/api/media/${r.data.id}/complete`, { as: s }); }
  assert.equal((await w.call('POST', '/api/media/upload-url', { as: s, body })).status, 400, 'sixth photo refused');
  const q = (await w.call('GET', '/api/admin/queue', { admin: true })).data.listings[0];
  assert.equal(q.photos.length, 5, 'admin sees photos in the review queue');
  await w.call('POST', `/api/admin/listings/${l.data.id}`, { admin: true, body: { action: 'approve' } });
  assert.equal((await w.call('GET', '/api/market/listings')).data.listings[0].photos.length, 5);
});

test('verification: private upload, admin sees image, approve sets verified, image deleted after retention', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  const up = await w.call('POST', '/api/verify/upload-url', { as: a, body: { content_type: 'image/png', bytes: 5000 } });
  assert.equal(up.status, 200); assert.ok(new URL(up.data.upload_url).pathname.startsWith('/storage/v1/object/upload/sign/private-bucket/verif/'));
  assert.equal((await w.call('POST', '/api/verify/submit', { as: a, body: { r2_key: up.data.r2_key, full_name: 'Jane Wanjiru' } })).status, 409, 'nothing uploaded yet');
  assert.equal((await w.call('POST', '/api/verify/submit', { as: a, body: { r2_key: '../../etc/passwd', full_name: 'Jane Wanjiru' } })).status, 400);
  w.env.PRIVATE.put(up.data.r2_key, 5000, 'IMGDATA');
  const sub = await w.call('POST', '/api/verify/submit', { as: a, body: { r2_key: up.data.r2_key, full_name: 'Jane Wanjiru' } });
  assert.equal(sub.status, 201);
  assert.equal((await w.call('POST', '/api/verify/submit', { as: a, body: { r2_key: up.data.r2_key, full_name: 'Jane Wanjiru' } })).status, 409, 'one pending at a time');
  const q = (await w.call('GET', '/api/admin/queue', { admin: true })).data;
  assert.equal(q.verifications.length, 1); assert.equal(q.verifications[0].r2_key, undefined, 'queue never lists the storage key');
  assert.equal((await w.call('GET', `/api/admin/verifications/${sub.data.id}/image`)).status, 403);
  const img = await w.call('GET', `/api/admin/verifications/${sub.data.id}/image`, { admin: true });
  assert.equal(img.status, 200);
  assert.equal((await w.call('GET', '/api/verify/status', { as: a })).data.verified, false);
  assert.equal((await w.call('POST', `/api/admin/verifications/${sub.data.id}`, { admin: true, body: { action: 'approve' } })).status, 200);
  assert.equal((await w.call('GET', '/api/verify/status', { as: a })).data.verified, true);
  assert.equal((await w.call('POST', `/api/admin/verifications/${sub.data.id}`, { admin: true, body: { action: 'reject' } })).status, 409, 'decision is final');
  await w.cron(); assert.ok(await w.env.PRIVATE.head(up.data.r2_key), 'kept during retention');
  w.db.rows('verifications')[0].purge_after = new Date(Date.now() - 1000).toISOString();
  const r = await w.cron(); assert.equal(r.purged, 1);
  assert.equal(await w.env.PRIVATE.head(up.data.r2_key), null, 'ID photo deleted');
  assert.equal(w.db.rows('verifications')[0].r2_key, null);
});

test('verification details: role badge needs a group link, admin can refuse the badge, rejection note is shown, resubmit works', async (t) => {
  const w = await fresh(t);
  const a = await w.user('r'), b = await w.user('s');
  const put = async (u) => { const up = await w.call('POST', '/api/verify/upload-url', { as: u, body: { content_type: 'image/jpeg', bytes: 5000 } }); w.env.PRIVATE.put(up.data.r2_key, 5000, 'IMG'); return up.data.r2_key; };
  const k1 = await put(a);
  const base = { r2_key: k1, full_name: 'Jane Wanjiru', id_number: 'SC211/0123/2022', barcode: 'match' };
  assert.equal((await w.call('POST', '/api/verify/submit', { as: a, body: { ...base, role: 'Chancellor' } })).status, 400, 'unknown role');
  assert.equal((await w.call('POST', '/api/verify/submit', { as: a, body: { ...base, role: 'Class rep' } })).status, 400, 'class rep needs a group link');
  assert.equal((await w.call('POST', '/api/verify/submit', { as: a, body: { ...base, role: 'Class rep', group_link: 'javascript:alert(1)' } })).status, 400, 'link must be http(s)');
  assert.equal((await w.call('POST', '/api/verify/submit', { as: a, body: { ...base, id_number: '<script>' } })).status, 400, 'odd characters in number');
  const sub = await w.call('POST', '/api/verify/submit', { as: a, body: { ...base, role: 'Class rep', group_link: 'https://chat.example.com/abc' } });
  assert.equal(sub.status, 201);
  const q = (await w.call('GET', '/api/admin/queue', { admin: true })).data.verifications[0];
  assert.equal(q.claimed_role, 'Class rep'); assert.equal(q.barcode_check, 'match'); assert.equal(q.group_link, 'https://chat.example.com/abc'); assert.equal(q.r2_key, undefined);
  const st = (await w.call('GET', '/api/verify/status', { as: a })).data;
  assert.equal(st.request.status, 'pending'); assert.equal(st.request.claimed_role, 'Class rep');
  // approve the ID but refuse the badge
  assert.equal((await w.call('POST', `/api/admin/verifications/${sub.data.id}`, { admin: true, body: { action: 'approve', badge: false } })).status, 200);
  let me = (await w.call('GET', '/api/me', { as: a })).data; assert.equal(me.verified, true); assert.equal(me.badge, null);
  // a verified student can ask for the badge later; approve with it
  const s2 = await w.call('POST', '/api/verify/submit', { as: a, body: { ...base, r2_key: await put(a), role: 'Class rep', group_link: 'https://chat.example.com/abc' } });
  assert.equal(s2.status, 201);
  assert.equal((await w.call('POST', `/api/admin/verifications/${s2.data.id}`, { admin: true, body: { action: 'approve' } })).status, 200);
  me = (await w.call('GET', '/api/me', { as: a })).data; assert.equal(me.badge, 'Class rep');
  assert.equal((await w.call('POST', '/api/verify/submit', { as: a, body: { ...base, r2_key: await put(a) } })).status, 409, 'already verified as a student');
  // rejection: user sees the note, then can send a new request
  const s3 = await w.call('POST', '/api/verify/submit', { as: b, body: { r2_key: await put(b), full_name: 'Peter Mwangi' } });
  assert.equal(s3.status, 201); assert.equal(w.db.rows('verifications').find((v) => v.id === s3.data.id).claimed_role, 'Student');
  assert.equal((await w.call('POST', `/api/admin/verifications/${s3.data.id}`, { admin: true, body: { action: 'reject', note: 'Photo is blurry' } })).status, 200);
  const st3 = (await w.call('GET', '/api/verify/status', { as: b })).data;
  assert.equal(st3.verified, false); assert.equal(st3.request.status, 'rejected'); assert.equal(st3.request.decision_note, 'Photo is blurry');
  assert.equal((await w.call('POST', '/api/verify/submit', { as: b, body: { r2_key: await put(b), full_name: 'Peter Mwangi' } })).status, 201, 'resubmit after rejection');
});

test('live: only club admins / admin key can start; only real YouTube/Facebook/TikTok/Twitch links; YouTube is embedded', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  const yt = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  assert.equal((await w.call('POST', '/api/live/start', { as: a, body: { title: 'Match day', url: yt } })).status, 403);
  await w.call('POST', `/api/admin/users/${a.aid}`, { admin: true, body: { action: 'role', role: 'club_admin' } });
  for (const bad of ['', 'http://youtube.com/watch?v=abcdefghijk', 'https://evil.example/live', 'javascript:alert(1)', 'https://youtube.com.evil.example/x', 'https://user:pw@youtube.com/x'])
    assert.equal((await w.call('POST', '/api/live/start', { as: a, body: { title: 'x', url: bad } })).status, 400, 'refused: ' + bad);
  const s = await w.call('POST', '/api/live/start', { as: a, body: { title: 'Match day', url: yt } });
  assert.equal(s.status, 201); assert.equal(s.data.embed_url, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  const pub = await w.call('GET', '/api/live');
  assert.equal(pub.data.streams.length, 1); assert.equal(pub.data.streams[0].watch_url, yt);
  const fb = await w.call('POST', '/api/live/start', { as: a, body: { title: 'Second', url: 'https://fb.watch/abc123/' } });
  assert.equal(fb.status, 201); assert.equal(fb.data.embed_url, null, 'only YouTube is embedded');
  assert.equal((await w.call('GET', '/api/live')).data.streams.length, 1, 'a host has one live stream at a time');
  const b = await w.user('b');
  assert.equal((await w.call('POST', `/api/live/${fb.data.id}/end`, { as: b })).status, 403);
  assert.equal((await w.call('POST', `/api/live/${fb.data.id}/end`, { as: a })).status, 200);
  assert.equal((await w.call('GET', '/api/live')).data.streams.length, 0);
  assert.equal((await w.call('POST', '/api/live/start', { admin: true, body: { url: 'https://twitch.tv/somechannel' } })).status, 201);
});

test('club: members only, stock is reserved, last item can only be bought once, failures and timeouts return stock', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b');
  const p = await w.call('POST', '/api/admin/club/products', { admin: true, body: { name: 'Club hoodie', price: 1500, qty: 1 } });
  assert.equal(p.status, 201);
  assert.equal((await w.call('GET', '/api/club/products')).data.products[0].stock, 1);
  const order = (u, ph) => w.call('POST', '/api/club/order', { as: u, body: { product_id: p.data.id, qty: 1, phone: ph } });
  assert.equal((await order(a, '0711111111')).status, 403, 'must join first');
  for (const u of [a, b]) await w.call('POST', '/api/club/join', { as: u, body: { display_name: 'Member' } });
  const [r1, r2] = await Promise.all([order(a, '0711111111'), order(b, '0722222222')]);
  assert.deepEqual([r1.status, r2.status].sort(), [201, 409], 'only one buyer gets the last hoodie');
  const winner = r1.status === 201 ? r1 : r2;
  assert.equal(w.row('club_stock', (s) => s.product_id === p.data.id).qty, 0);
  const pay = w.row('payments', (x) => x.id === winner.data.id);
  await w.callback(pay);
  assert.equal(w.row('club_orders', (o) => o.id === winner.data.order_id).status, 'paid');
  assert.equal((await w.call('POST', `/api/admin/club/orders/${winner.data.order_id}/collect`, { admin: true })).status, 200);
  assert.equal((await w.call('POST', `/api/admin/club/orders/${winner.data.order_id}/collect`, { admin: true })).status, 409);
  // failed payment returns stock
  await w.call('POST', '/api/admin/club/stock', { admin: true, body: { product_id: p.data.id, qty: 3 } });
  const f = await w.call('POST', '/api/club/order', { as: a, body: { product_id: p.data.id, qty: 2, phone: '0733333333' } });
  assert.equal(w.row('club_stock', (s) => s.product_id === p.data.id).qty, 1);
  await w.callback(w.row('payments', (x) => x.id === f.data.id), { code: 1032 });
  assert.equal(w.row('club_stock', (s) => s.product_id === p.data.id).qty, 3, 'stock back after cancelled payment');
  assert.equal(w.row('club_orders', (o) => o.id === f.data.order_id).status, 'cancelled');
  // STK push itself fails
  const bad = world({ tinypesaFail: true }); t.after(() => bad.restore());
  const ca = await bad.user('a'); await bad.call('POST', '/api/club/join', { as: ca, body: {} });
  const cp = await bad.call('POST', '/api/admin/club/products', { admin: true, body: { name: 'Cap', price: 300, qty: 2 } });
  assert.equal((await bad.call('POST', '/api/club/order', { as: ca, body: { product_id: cp.data.id, qty: 1, phone: '0744444444' } })).status, 502);
  assert.equal(bad.db.rows('club_stock')[0].qty, 2, 'stock restored when the prompt could not be sent');
});

test('club: pending orders that never get paid expire and return stock; a very late payment goes to wallet', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  await w.call('POST', '/api/club/join', { as: a, body: {} });
  const p = await w.call('POST', '/api/admin/club/products', { admin: true, body: { name: 'Mug', price: 400, qty: 5 } });
  const o = await w.call('POST', '/api/club/order', { as: a, body: { product_id: p.data.id, qty: 2, phone: '0755555555' } });
  assert.equal(w.db.rows('club_stock')[0].qty, 3);
  w.db.rows('club_orders')[0].created_at = new Date(Date.now() - 20 * 60e3).toISOString();
  assert.equal((await w.cron()).clubExpired, 1);
  assert.equal(w.db.rows('club_stock')[0].qty, 5);
  await w.callback(w.row('payments', (x) => x.id === o.data.id));            // payment arrives after the order expired
  assert.equal((await w.call('GET', '/api/me', { as: a })).data.balance, 800, 'refunded to wallet, nothing lost');
});

test('tickets: pay, get a code, door check works once, wrong code and unknown ticket fail', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  const bad = await w.call('POST', '/api/admin/events', { admin: true, body: { title: 'Fresher bash', date: '2026-02-30' } });
  assert.equal(bad.status, 400, 'real dates only');
  const day = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
  const ev = await w.call('POST', '/api/admin/events', { admin: true, body: { title: 'Fresher bash', date: day, venue: 'Main hall', ticket_price: 300 } });
  assert.equal(ev.status, 201);
  assert.equal((await w.call('GET', '/api/events')).data.events[0].date, day);
  const buy = await w.call('POST', '/api/tickets/buy', { as: a, body: { event_id: ev.data.id, phone: '0766666666' } });
  assert.equal(buy.status, 201);
  assert.equal((await w.call('GET', '/api/tickets/mine', { as: a })).data.tickets.length, 0, 'no ticket before payment');
  await w.callback(w.row('payments', (x) => x.id === buy.data.id));
  const tk = (await w.call('GET', '/api/tickets/mine', { as: a })).data.tickets[0];
  assert.match(tk.code, /^\d{8}$/); assert.equal(tk.event, 'Fresher bash');
  assert.ok(!JSON.stringify(w.db.rows('tickets')).includes(tk.code), 'code not stored in clear');
  const val = (code) => w.call('POST', '/api/admin/tickets/validate', { admin: true, body: { ticket_id: tk.id, code } });
  assert.equal((await val('00000000')).status, 409);
  assert.equal((await w.call('POST', '/api/admin/tickets/validate', { body: { ticket_id: tk.id, code: tk.code } })).status, 403, 'door check needs admin');
  const [v1, v2] = await Promise.all([val(tk.code), val(tk.code)]);
  assert.deepEqual([v1.status, v2.status].sort(), [200, 409], 'a ticket works once even with two scanners');
  assert.equal((await w.call('GET', '/api/tickets/mine', { as: a })).data.tickets[0].status, 'used');
  // door check by event + code only (no ticket id at the door)
  const buy2 = await w.call('POST', '/api/tickets/buy', { as: a, body: { event_id: ev.data.id, phone: '0766666668' } });
  await w.callback(w.row('payments', (x) => x.id === buy2.data.id));
  const tk2 = (await w.call('GET', '/api/tickets/mine', { as: a })).data.tickets.find((x) => x.status === 'valid');
  const door = (code, event_id = ev.data.id) => w.call('POST', '/api/admin/tickets/validate', { admin: true, body: { event_id, code } });
  assert.equal((await door('1234')).status, 409, 'short code refused');
  assert.equal((await door('00000000')).status, 409, 'unknown code refused');
  assert.equal((await door(tk2.code, '11111111-1111-4111-8111-111111111111')).status, 409, 'code for another event refused');
  assert.equal((await door(tk2.code)).status, 200);
  assert.equal((await door(tk2.code)).status, 409, 'already used');
  const free = await w.call('POST', '/api/admin/events', { admin: true, body: { title: 'Free talk', date: day } });
  assert.equal((await w.call('POST', '/api/tickets/buy', { as: a, body: { event_id: free.data.id, phone: '0766666667' } })).status, 404, 'no tickets for free events');
});

test('admin: key login with lockout, queue, notices/sponsors, ban, audit log; generic /api/pay cannot be used for orders', async (t) => {
  const w = await fresh(t);
  assert.equal((await w.call('POST', '/api/admin/login', { body: {} })).status, 403);
  assert.equal((await w.call('POST', '/api/admin/login', { admin: true })).status, 200);
  let r; for (let i = 0; i < 11; i++) r = await w.call('POST', '/api/admin/login', { admin: 'wrong' + i, ip: '66.6.6.6' });
  assert.equal(r.status, 429, 'lockout after repeated wrong keys');
  const keep = w.env.ADMIN_KEY; w.env.ADMIN_KEY = '';
  assert.equal((await w.call('POST', '/api/admin/login', { admin: '' })).status, 403, 'no key configured means nobody gets in');
  w.env.ADMIN_KEY = keep;
  const n = await w.call('POST', '/api/admin/notices', { admin: true, body: { title: 'Exams timetable out', body: 'Check portal', pinned: true, expires_days: 3 } });
  assert.equal(n.status, 201);
  await w.call('POST', '/api/admin/notices', { admin: true, body: { title: 'Old news' } });
  assert.equal((await w.call('GET', '/api/notices')).data.notices[0].title, 'Exams timetable out', 'pinned first');
  w.db.rows('notices')[0].expires_at = new Date(Date.now() - 1000).toISOString();
  assert.equal((await w.call('GET', '/api/notices')).data.notices.length, 1, 'expired notices hidden');
  assert.equal((await w.call('POST', '/api/admin/sponsors', { admin: true, body: { name: 'Acme', link: 'http://evil' } })).status, 400, 'https only');
  const sp = await w.call('POST', '/api/admin/sponsors', { admin: true, body: { name: 'Acme', blurb: 'Student deals', link: 'https://acme.co.ke' } });
  assert.equal((await w.call('GET', '/api/sponsors')).data.sponsors.length, 1);
  await w.call('POST', `/api/admin/sponsors/${sp.data.id}`, { admin: true, body: { action: 'delete' } });
  assert.equal((await w.call('GET', '/api/sponsors')).data.sponsors.length, 0);
  const u = await w.user('u');
  assert.equal((await w.call('POST', `/api/admin/users/${u.aid}`, { admin: true, body: { action: 'mute', hours: 0 } })).status, 400);
  assert.equal((await w.call('POST', '/api/admin/users/nobody_xyz', { admin: true, body: { action: 'ban' } })).status, 404);
  const actions = w.db.rows('admin_audit_log').map((x) => x.action);
  for (const a of ['login', 'notices.create', 'sponsors.create', 'sponsors.delete']) assert.ok(actions.includes(a), 'audited: ' + a);
  assert.ok(!JSON.stringify(w.db.rows('admin_audit_log')).includes('admin-secret-key'), 'key never logged');
  // money flows must use the dedicated endpoints where the server sets the amount
  assert.equal((await w.call('POST', '/api/pay', { as: u, body: { purpose: 'order', amount: 1, phone: '0712345678', ref_id: 'x' } })).status, 400);
  assert.equal((await w.call('POST', '/api/pay', { as: u, body: { purpose: 'club', amount: 1, phone: '0712345678' } })).status, 400);
});

test('boost: amount is fixed by the server and marks the post boosted when paid', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  const p = await w.call('POST', '/api/posts', { body: { aid: a.aid, content: 'Selling stuff cheap', category: 'General' } });
  const id = (p.data.id || p.data.post?.id || w.db.rows('posts')[0].id);
  const r = await w.call('POST', '/api/pay', { as: a, body: { purpose: 'boost', ref_id: id, amount: 1, phone: '0712987654' } });
  assert.equal(r.status, 200);
  assert.equal(w.row('payments', (x) => x.id === r.data.id).amount, 20, 'client amount ignored');
  await w.callback(w.row('payments', (x) => x.id === r.data.id));
  assert.ok(Date.parse(w.row('posts', (x) => x.id === id).boosted_until) > Date.now());
  const st = await w.call('GET', `/api/pay/status?id=${r.data.id}`);
  assert.equal(st.data.status, 'paid');
});

test('manual M-Pesa (free mode): instructions, code submitted, admin confirms, order is created; codes are single-use', async (t) => {
  const w = await fresh(t, { env: { PAYMENT_MODE: 'manual', MPESA_PAY_TO: '0712345678', MPESA_PAY_NAME: 'Henry O', MPESA_PAY_TYPE: 'send' } });
  const s = await w.user('s'), b = await w.user('b'), c = await w.user('c');
  const lid = await w.approvedListing(s, 1000);
  const buy = await w.call('POST', '/api/market/buy', { as: b, body: { listing_id: lid, phone: '0722111333' } });
  assert.equal(buy.status, 200); assert.ok(!w.calls.some((x) => x.url.includes('tinypesa.com')), 'no TinyPesa call in manual mode');
  const st = (await w.call('GET', `/api/pay/status?id=${buy.data.id}`)).data;
  assert.equal(st.status, 'pending'); assert.equal(st.manual.pay_to, '0712345678'); assert.equal(st.manual.amount, 1000); assert.ok(st.manual.steps.includes('Send Money'));
  // bad codes, wrong owner
  assert.equal((await w.call('POST', '/api/pay/confirm', { as: b, body: { id: buy.data.id, code: 'abc' } })).status, 400);
  assert.equal((await w.call('POST', '/api/pay/confirm', { as: c, body: { id: buy.data.id, code: 'SJK7ABC123' } })).status, 404, 'only the buyer can send a code');
  assert.equal((await w.call('POST', '/api/pay/confirm', { as: b, body: { id: buy.data.id, code: 'sjk7 abc124' } })).status, 200, 'typo submitted');
  assert.equal((await w.call('POST', '/api/pay/confirm', { as: b, body: { id: buy.data.id, code: 'SJK7ABC123' } })).status, 200, 'typo corrected before the admin decides');
  assert.equal((await w.call('GET', `/api/pay/status?id=${buy.data.id}`)).data.status, 'submitted');
  assert.equal(w.db.rows('orders').length, 0, 'nothing happens until the admin confirms');
  // the same code cannot pay for a second purchase
  const l2 = await w.approvedListing(s, 500, 'Second item');
  const buy2 = await w.call('POST', '/api/market/buy', { as: c, body: { listing_id: l2, phone: '0733111444' } });
  assert.equal((await w.call('POST', '/api/pay/confirm', { as: c, body: { id: buy2.data.id, code: 'SJK7ABC123' } })).status, 409, 'code already used');
  const q = (await w.call('GET', '/api/admin/queue', { admin: true })).data;
  assert.equal(q.confirm.length, 1); assert.equal(q.counts.confirm, 1); assert.equal(q.confirm[0].receipt, 'SJK7ABC123');
  assert.equal((await w.call('POST', `/api/admin/payments/${buy.data.id}`, { body: { action: 'approve' } })).status, 403);
  assert.equal((await w.call('POST', `/api/admin/payments/${buy.data.id}`, { admin: true, body: { action: 'approve' } })).status, 200);
  assert.equal((await w.call('POST', `/api/admin/payments/${buy.data.id}`, { admin: true, body: { action: 'approve' } })).status, 409, 'decided once');
  const done = (await w.call('GET', `/api/pay/status?id=${buy.data.id}`)).data;
  assert.equal(done.status, 'paid'); assert.ok(done.order_id, 'order exists after approval');
  assert.equal(w.db.rows('orders').length, 1);
  // refusing returns things to normal
  await w.call('POST', '/api/pay/confirm', { as: c, body: { id: buy2.data.id, code: 'ZZZ9ABC000' } });
  assert.equal((await w.call('POST', `/api/admin/payments/${buy2.data.id}`, { admin: true, body: { action: 'reject' } })).status, 200);
  assert.equal((await w.call('GET', `/api/pay/status?id=${buy2.data.id}`)).data.status, 'failed');
  assert.equal(w.db.rows('orders').length, 1);
  // not set up
  const off = await fresh(t, { env: { PAYMENT_MODE: 'manual', MPESA_PAY_TO: '' } });
  const o = await off.user('o'), sl = await off.user('sl'), l3 = await off.approvedListing(sl, 300);
  assert.equal((await off.call('POST', '/api/market/buy', { as: o, body: { listing_id: l3, phone: '0722111333' } })).status, 503);
});

test('manual M-Pesa: unpaid payments expire after 90 minutes, submitted ones wait for the admin', async (t) => {
  const w = await fresh(t, { env: { PAYMENT_MODE: 'manual', MPESA_PAY_TO: '0712345678' } });
  const s = await w.user('s'), b = await w.user('b'), lid = await w.approvedListing(s, 400);
  const p1 = await w.call('POST', '/api/market/buy', { as: b, body: { listing_id: lid, phone: '0722111333' } });
  const p2 = await w.call('POST', '/api/market/buy', { as: b, body: { listing_id: lid, phone: '0722111334' } });
  await w.call('POST', '/api/pay/confirm', { as: b, body: { id: p2.data.id, code: 'AAA1BBB222' } });
  for (const id of [p1.data.id, p2.data.id]) w.row('payments', (x) => x.id === id).created_at = new Date(Date.now() - 60 * 60e3).toISOString();
  await w.cron(); assert.equal(w.row('payments', (x) => x.id === p1.data.id).status, 'pending', 'still open at 60 min');
  for (const id of [p1.data.id, p2.data.id]) w.row('payments', (x) => x.id === id).created_at = new Date(Date.now() - 100 * 60e3).toISOString();
  await w.cron();
  assert.equal(w.row('payments', (x) => x.id === p1.data.id).status, 'expired'); assert.equal(w.row('payments', (x) => x.id === p2.data.id).status, 'submitted');
});
