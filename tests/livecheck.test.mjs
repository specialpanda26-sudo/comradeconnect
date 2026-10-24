import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

test('live-check: admin only, shows whether the Agora keys are set, never the certificate', async () => {
  const w = world({ env: { AGORA_APP_ID: '79e2fffbbb174dc68ef55905a227d9f8', AGORA_APP_CERTIFICATE: 'c'.repeat(32) } });
  try {
    let r = await w.call('GET', '/api/admin/live-check');
    assert.equal(r.status, 403);
    r = await w.call('GET', '/api/admin/live-check', { admin: true });
    assert.equal(r.status, 200); assert.equal(r.data.certificate_set, true); assert.equal(r.data.app_id_ends_with, 'd9f8');
    assert.ok(!JSON.stringify(r.data).includes('cccc'), 'the certificate must never be shown');
  } finally { w.restore(); }
  const w2 = world();
  try {
    const r = await w2.call('GET', '/api/admin/live-check', { admin: true });
    assert.equal(r.status, 200); assert.equal(r.data.certificate_set, false); assert.equal(r.data.app_id_set, false);
  } finally { w2.restore(); }
});
