import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

test('a shared Wi-Fi with a real location shows on the map; password hidden from guests', async (t) => {
  const w = world(); t.after(w.restore);
  const u = await w.user('wifi'), v = await w.user('viewer');
  const add = await w.call('POST', '/api/c/wifi', { as: u, body: { kind: 'share', place: 'Kutus Library', zone: 'Kutus', ssid: 'LibNet', password: 'secret123', consent: true, lat: -0.5602, lng: 37.2801, accuracy: 20 } });
  console.log('ADD', add.status, JSON.stringify(add.data).slice(0, 200));
  const guest = await w.call('GET', '/api/c/wifi/map');
  console.log('GUEST', guest.status, JSON.stringify(guest.data).slice(0, 300));
  const signed = await w.call('GET', '/api/c/wifi/map', { as: v });
  console.log('SIGNED', JSON.stringify(signed.data).slice(0, 300));
  assert.equal(guest.data.items.length, 1);
  assert.equal(guest.data.items[0].password, undefined);
  assert.equal(signed.data.items[0].password, 'secret123');
  const off = await w.call('POST', '/api/c/wifi', { as: u, body: { kind: 'share', place: 'Nowhere', ssid: 'X', password: 'secret123', consent: true, lat: 51.5, lng: -0.1, accuracy: 20 } });
  assert.equal(off.status >= 400, true);
});
