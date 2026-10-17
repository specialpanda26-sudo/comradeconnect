// Site editor: admin only, validated, public read shows only what was set, changes audited. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

const save = (w, values, admin = true) => w.call('POST', '/api/admin/site-content', { admin, body: { values } });

test('site editor: admin only, validated, public read follows, audited', async (t) => {
  const w = world(); t.after(w.restore);
  assert.equal((await w.call('GET', '/api/admin/site-content')).status, 403);
  assert.equal((await save(w, { hero_title: 'x' }, false)).status, 403);
  const empty = await w.call('GET', '/api/site-content');
  assert.equal(empty.status, 200); assert.deepEqual(empty.data.content, {});

  assert.equal((await save(w, { hero_title: 'Karibu comrade', banner_on: true, banner_text: 'Bash on Friday', banner_link: 'https://example.com/bash' })).status, 200);
  const pub = (await w.call('GET', '/api/site-content')).data.content;
  assert.equal(pub.hero_title, 'Karibu comrade'); assert.equal(pub.banner_on, '1'); assert.equal(pub.banner_link, 'https://example.com/bash');
  assert.ok(w.db.rows('admin_audit_log').some((r) => r.action === 'site.update'));

  // refused: unknown field, http link, tags in text, scripts in css, bad email
  for (const bad of [{ nope: 'x' }, { banner_link: 'http://example.com' }, { hero_text: '<b>hi</b>' }, { custom_css: '@import url(x);' }, { contact_email: 'not an email' }]) {
    const r = await save(w, bad); assert.equal(r.status, 400, JSON.stringify(bad));
  }
  assert.equal((await w.call('GET', '/api/site-content')).data.content.hero_title, 'Karibu comrade');   // nothing half-saved

  // clearing a field goes back to the built-in text
  assert.equal((await save(w, { hero_title: '' })).status, 200);
  assert.equal((await w.call('GET', '/api/site-content')).data.content.hero_title, undefined);
  const adminView = (await w.call('GET', '/api/admin/site-content', { admin: true })).data.fields;
  assert.ok(adminView.find((f) => f.key === 'banner_text').value === 'Bash on Friday' && adminView.length > 20);
});
