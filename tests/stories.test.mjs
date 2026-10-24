import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
const fresh = async (t, o) => { const w = world(o); t.after(() => w.restore()); return w; };

async function story(w, who, kind = 'story_photo', ct = 'image/jpeg', caption = 'Library vibes') {
  const up = await w.call('POST', '/api/media/upload-url', { as: who, body: { kind, content_type: ct, bytes: 5000, caption } });
  if (up.status !== 201) return up;
  const row = w.db.rows('media').find((x) => x.id === up.data.id);
  w.env.MEDIA.put(row.r2_key, 5000);
  const done = await w.call('POST', `/api/media/${up.data.id}/complete`, { as: who });
  return { status: done.status, id: up.data.id, row, data: done.data };
}

test('stories: post a photo and a video, grouped by person, anonymous alias, never the account id', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b');
  const p = await story(w, a), v = await story(w, a, 'story_video', 'video/mp4', 'Match day');
  assert.equal(p.status, 200); assert.equal(v.status, 200);
  assert.equal((await story(w, b, 'story_photo', 'video/mp4')).status, 400, 'a photo story must be an image');
  const asB = (await w.call('GET', '/api/stories', { as: b })).data;
  assert.equal(asB.groups.length, 1);
  const g = asB.groups[0];
  assert.equal(g.mine, false); assert.match(g.alias, /^[A-Z][a-z]+ [A-Z][a-z]+$/);
  assert.deepEqual(g.items.map((i) => i.type), ['image', 'video']);
  assert.ok(!JSON.stringify(asB).includes(a.aid), 'the author id never leaves the server');
  const asA = (await w.call('GET', '/api/stories', { as: a })).data.groups[0];
  assert.equal(asA.mine, true); assert.equal(asA.alias, 'Your story'); assert.equal(asA.items[0].views, 0);
  // the alias is stable
  assert.equal((await w.call('GET', '/api/stories', { as: b })).data.groups[0].alias, g.alias);
  // guests can look
  assert.equal((await w.call('GET', '/api/stories')).data.groups.length, 1);
});

test('stories: views are counted once, the owner sees them, the tray marks seen stories', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b'), c = await w.user('c');
  const s = await story(w, a);
  for (const who of [b, b, c, a]) assert.equal((await w.call('POST', `/api/stories/${s.id}/view`, { as: who })).status, 200);
  assert.equal((await w.call('GET', '/api/stories', { as: a })).data.groups[0].items[0].views, 2, 'b counted once, the owner never counts');
  const gb = (await w.call('GET', '/api/stories', { as: b })).data.groups[0];
  assert.equal(gb.seen, true); assert.equal(gb.items[0].seen, true);
  const d = await w.user('d');
  assert.equal((await w.call('GET', '/api/stories', { as: d })).data.groups[0].seen, false);
});

test('stories: they vanish after 24 hours (and the file is deleted), owners can remove, banned authors are hidden', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b');
  const old = await story(w, a), keep = await story(w, a, 'story_photo', 'image/jpeg', 'Fresh');
  old.row.created_at = new Date(Date.now() - 25 * 3600e3).toISOString();
  assert.equal((await w.call('GET', '/api/stories', { as: b })).data.groups[0].items.length, 1, 'expired story is not listed');
  assert.equal((await w.call('POST', `/api/stories/${old.id}/view`, { as: b })).status, 404);
  const r = await w.cron();
  assert.equal(r.stories, 1); assert.equal(old.row.status, 'hidden'); assert.equal(await w.env.MEDIA.head(old.row.r2_key), null);
  assert.equal((await w.call('POST', `/api/stories/${keep.id}/remove`, { as: b })).status, 404, 'only the owner removes');
  assert.equal((await w.call('POST', `/api/stories/${keep.id}/remove`, { as: a })).status, 200);
  assert.equal((await w.call('GET', '/api/stories', { as: b })).data.groups.length, 0);
  const x = await story(w, a);
  await w.call('POST', `/api/admin/users/${a.aid}`, { admin: true, body: { action: 'ban' } });
  assert.equal((await w.call('GET', '/api/stories', { as: b })).data.groups.length, 0, 'banned author is hidden');
});

test('stories: at most 10 live at once', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a');
  for (let i = 0; i < 10; i++) assert.equal((await story(w, a)).status, 200);
  assert.equal((await story(w, a)).status, 400);
});

test('reel comments: post, list with aliases, count on the clip list, notify the owner, remove', async (t) => {
  const w = await fresh(t);
  const owner = await w.user('owner'), fan = await w.user('fan'), other = await w.user('other');
  const up = await w.call('POST', '/api/media/upload-url', { as: owner, body: { kind: 'clip', content_type: 'video/mp4', bytes: 5000, caption: 'Hostel cooking' } });
  w.env.MEDIA.put(w.db.rows('media').find((x) => x.id === up.data.id).r2_key, 5000);
  await w.call('POST', `/api/media/${up.data.id}/complete`, { as: owner });
  const id = up.data.id;
  assert.equal((await w.call('POST', `/api/clips/${id}/comments`, { body: { text: 'hi' } })).status, 401);
  assert.equal((await w.call('POST', `/api/clips/${id}/comments`, { as: fan, body: { text: 'call me 0712345678' } })).status, 400);
  assert.equal((await w.call('POST', `/api/clips/${id}/comments`, { as: fan, body: { text: '   ' } })).status, 400);
  const c1 = await w.call('POST', `/api/clips/${id}/comments`, { as: fan, body: { text: 'This looks great' } });
  assert.equal(c1.status, 201); assert.equal(c1.data.count, 1); assert.equal(c1.data.comment.mine, true);
  const c2 = await w.call('POST', `/api/clips/${id}/comments`, { as: owner, body: { text: 'Thanks comrade' } });
  assert.equal(c2.data.comment.creator, true);
  const list = (await w.call('GET', `/api/clips/${id}/comments`, { as: fan })).data.comments;
  assert.deepEqual(list.map((c) => c.text), ['This looks great', 'Thanks comrade']);
  assert.equal(list[0].mine, true); assert.equal(list[0].can_remove, true); assert.equal(list[1].mine, false); assert.equal(list[1].creator, true);
  assert.ok(!JSON.stringify(list).includes(fan.aid) && !JSON.stringify(list).includes(owner.aid));
  assert.equal((await w.call('GET', '/api/clips')).data.clips[0].comments, 2);
  const n = (await w.call('GET', '/api/notifications', { as: owner })).data;
  assert.equal(n.items.length, 1, 'comments by the owner do not notify the owner'); assert.equal(n.items[0].kind, 'reel_comment'); assert.equal(n.items[0].ref_type, 'clip'); assert.equal(n.items[0].ref_id, id);
  // removal: author or clip owner, nobody else
  assert.equal((await w.call('POST', `/api/clips/${id}/comments/${c1.data.comment.id}/remove`, { as: other })).status, 403);
  assert.equal((await w.call('POST', `/api/clips/${id}/comments/${c1.data.comment.id}/remove`, { as: owner })).status, 200);
  assert.equal((await w.call('GET', `/api/clips/${id}/comments`)).data.comments.length, 1);
  assert.equal((await w.call('GET', '/api/clips')).data.clips[0].comments, 1);
});
