import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
const fresh = async (t) => { const w = world(); t.after(() => w.restore()); return w; };
const D = 'https://drive.google.com/file/d/abc123/view?usp=sharing';

test('papers: share, filter by course and year, like, remove', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), b = await w.user('b');
  const mk = (as, body, campus) => w.call('POST', '/api/papers', { as, body, campus });
  assert.equal((await mk(a, { course_code: 'mat 110', year: 2023, title: 'Sem 1 main exam', link: D, kind: 'Past paper' }, 'kirinyaga')).status, 201);
  assert.equal((await mk(a, { course_code: 'MAT 110', year: 2022, title: 'CAT 1', link: D + '2', kind: 'CAT' }, 'kirinyaga')).status, 201);
  assert.equal((await mk(a, { course_code: 'STA 201', year: 2023, title: 'Notes', link: 'https://evil.example.com/x.pdf' }, 'kirinyaga')).status, 400, 'unknown host refused');
  assert.equal((await mk(a, { course_code: 'STA 201', year: 2023, title: 'Notes', link: 'http://drive.google.com/x' }, 'kirinyaga')).status, 400, 'https only');
  assert.equal((await mk(a, { course_code: 'STA 201', year: 2023, title: 'Call 0712345678', link: D + '3' }, 'kirinyaga')).status, 400, 'phone refused');
  assert.equal((await mk(a, { course_code: 'MAT 110', year: 2023, title: 'Same link', link: D }, 'kirinyaga')).status, 400, 'duplicate link');
  assert.equal((await mk(a, { course_code: 'MAT 110', year: 2020, title: 'Other campus', link: D + '4' }, 'uon')).status, 201);
  const l = (await w.call('GET', '/api/papers', { campus: 'kirinyaga' })).data.papers;
  assert.equal(l.length, 2); assert.equal(l[0].courseCode, 'MAT 110'); assert.equal(l[0].year, 2023);
  assert.equal((await w.call('GET', '/api/papers?year=2022', { campus: 'kirinyaga' })).data.papers.length, 1);
  assert.equal((await w.call('GET', '/api/papers?kind=CAT', { campus: 'kirinyaga' })).data.papers.length, 1);
  const id = l[0].id;
  await w.call('POST', `/api/papers/${id}/like`, { as: b, body: {} });
  assert.equal((await w.call('POST', `/api/papers/${id}/like`, { as: b, body: {} })).data.liked, false, 'tap again to undo');
  assert.equal((await w.call('POST', `/api/papers/${id}/remove`, { as: b, body: {} })).status, 403);
  assert.equal((await w.call('POST', `/api/papers/${id}/remove`, { as: a, body: {} })).status, 200);
  assert.equal((await w.call('GET', '/api/papers', { campus: 'kirinyaga' })).data.papers.length, 1);
});

test('reports: 3 different reports hide a lost and found post or a paper', async (t) => {
  const w = await fresh(t);
  const a = await w.user('a'), r = [await w.user('r1'), await w.user('r2'), await w.user('r3')];
  const it = (await w.call('POST', '/api/lostfound', { as: a, body: { kind: 'found', title: 'Fake post' } })).data;
  for (const x of r) assert.equal((await w.call('POST', '/api/report', { as: x, body: { type: 'lostfound', id: it.id, reason: 'scam' } })).status, 200);
  assert.equal((await w.call('GET', '/api/lostfound')).data.items.length, 0);
});
