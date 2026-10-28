import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
import { clearZoneCache } from '../backend/src/zonesuggest.js';

// Tom Mboya University is at -0.53, 34.45. Fake OpenStreetMap: two estates (one close, one far) and homes around them.
const TMU = { lat: -0.53, lng: 34.45 };
const place = (name, dLat, dLng, type = 'suburb') => ({ type: 'node', lat: TMU.lat + dLat, lon: TMU.lng + dLng, tags: { name, place: type } });
const homes = (dLat, dLng, n, building = 'residential') => Array.from({ length: n }, (_, i) => ({ type: 'way', center: { lat: TMU.lat + dLat + (i % 5) * 0.0002, lon: TMU.lng + dLng + Math.floor(i / 5) * 0.0002 }, tags: { building } }));
function fakeMap(w, { down = false } = {}) {
  const inner = globalThis.fetch;
  globalThis.fetch = async (u, init = {}) => {
    if (String(u).includes('overpass')) {
      if (down) throw new Error('offline');
      const q = decodeURIComponent(String(init.body || ''));
      if (q.includes('"place"')) return new Response(JSON.stringify({ elements: [place('Kowuor', 0.004, 0.003), place('Riat', 0.03, 0.02, 'neighbourhood')] }));
      return new Response(JSON.stringify({ elements: [...homes(0.0035, 0.0028, 60, 'apartments'), ...homes(0.0301, 0.0201, 10)] }));
    }
    return inner(u, init);
  };
}
const fresh = async (t, o) => { clearZoneCache(); const w = world(o); t.after(() => w.restore()); return w; };

test('zone suggest: ranks the estate with most homes first and reports distance and direction', async (t) => {
  const w = await fresh(t); fakeMap(w);
  const r = await w.call('GET', '/api/zones/suggest?campus=tmu&radius=5000', { ip: '1.1.1.1' });
  assert.equal(r.status, 200);
  assert.equal(r.data.campus.id, 'tmu');
  assert.equal(r.data.zones[0].name, 'Kowuor');
  assert.ok(r.data.zones[0].distance_m > 400 && r.data.zones[0].distance_m < 700, 'about 530 m away');
  assert.equal(r.data.zones[0].direction, 'NE');
  assert.ok(r.data.zones[0].score > r.data.zones[1].score);
  assert.equal(r.data.sources.map, 'ok');
});

test('zone suggest: 10 metres finds nothing near and says how far the nearest zone is', async (t) => {
  const w = await fresh(t); fakeMap(w);
  const r = await w.call('GET', '/api/zones/suggest?campus=tmu&radius=10', { ip: '1.1.1.2' });
  assert.equal(r.status, 200);
  assert.equal(r.data.radius_m, 10);
  assert.deepEqual(r.data.zones.filter((z) => !z.saved), [], 'nothing new that close');
  assert.ok(r.data.zones.some((z) => z.name === 'On campus'), 'the saved base zone still shows');
});

test('zone suggest: radius is kept between 10 m and 20 km', async (t) => {
  const w = await fresh(t); fakeMap(w);
  assert.equal((await w.call('GET', '/api/zones/suggest?campus=tmu&radius=1', { ip: '1.1.1.3' })).data.radius_m, 10);
  assert.equal((await w.call('GET', '/api/zones/suggest?campus=tmu&radius=999999', { ip: '1.1.1.3' })).data.radius_m, 20000);
  assert.equal((await w.call('GET', '/api/zones/suggest?campus=tmu&radius=abc', { ip: '1.1.1.3' })).status, 400);
  assert.equal((await w.call('GET', '/api/zones/suggest?campus=nope', { ip: '1.1.1.3' })).status, 400);
});

test('zone suggest: the app\'s own hostels and rooms lift a zone, and an existing zone is marked', async (t) => {
  const w = await fresh(t); fakeMap(w);
  const a = await w.user('a');
  for (let i = 0; i < 4; i++) w.db.rows('hostels').push({ id: 'h' + i, aid: a.aid, name: 'H' + i, zone: 'Riat', campus: 'tmu', kind: 'vacancy', hidden: false, lat: TMU.lat + 0.03, lng: TMU.lng + 0.02 });
  w.db.rows('rooms').push({ id: 'r1', aid: a.aid, title: 'Room', zone: 'Riat', campus: 'tmu', hidden: false });
  await w.call('POST', '/api/admin/zones', { admin: true, body: { action: 'add', name: 'Riat', campus: 'tmu' } });
  const r = await w.call('GET', '/api/zones/suggest?campus=tmu&radius=5000', { ip: '1.1.1.4' });
  const riat = r.data.zones.find((z) => z.name === 'Riat');
  assert.equal(riat.existing, true);
  assert.equal(riat.evidence.vacancies, 4);
  assert.equal(riat.source, 'both');
  assert.equal(r.data.zones[0].name, 'Riat', 'real hostel posts outweigh a few mapped homes');
});

test('zone suggest: still answers from the app\'s own data when the map is down', async (t) => {
  const w = await fresh(t); fakeMap(w, { down: true });
  const a = await w.user('a');
  w.db.rows('hostels').push({ id: 'h1', aid: a.aid, name: 'H', zone: 'Kanyamedha', campus: 'tmu', kind: 'review', hidden: false });
  const r = await w.call('GET', '/api/zones/suggest?campus=tmu&radius=3000', { ip: '1.1.1.5' });
  assert.equal(r.status, 200);
  assert.equal(r.data.sources.map, 'unavailable');
  assert.equal(r.data.attribution, null);
  assert.ok(r.data.zones.some((z) => z.name === 'Kanyamedha'));
});

test('zone suggest: admin adds many zones at once; duplicates are skipped; guests are refused', async (t) => {
  const w = await fresh(t);
  assert.equal((await w.call('POST', '/api/admin/zones/suggest-apply', { body: { campus: 'tmu', names: ['Kowuor'] } })).status, 403);
  let r = await w.call('POST', '/api/admin/zones/suggest-apply', { admin: true, body: { campus: 'tmu', names: ['Kowuor', 'Riat', 'kowuor', '<b>x</b>', 'Call 0722000111'] } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.added, ['Kowuor', 'Riat']);
  assert.deepEqual(r.data.skipped, ['kowuor']);
  assert.ok(r.data.zones.includes('Kowuor') && r.data.zones.includes('Riat') && r.data.zones.includes('On campus'));
  assert.ok(!r.data.zones.some((z) => /0722/.test(z)), 'a phone number is never a zone');
  r = await w.call('POST', '/api/admin/zones/suggest-apply', { admin: true, body: { campus: 'tmu', names: ['Riat'] } });
  assert.deepEqual(r.data.added, []); assert.deepEqual(r.data.skipped, ['Riat']);
  assert.equal((await w.call('POST', '/api/admin/zones/suggest-apply', { admin: true, body: { campus: 'tmu', names: [] } })).status, 400);
});

test('zone suggest: the person\'s own location can be the centre of the scan; top 7 by default', async (t) => {
  const w = await fresh(t); fakeMap(w);
  const r = await w.call('GET', '/api/zones/suggest?campus=tmu&radius=2000&lat=-0.526&lng=34.453', { ip: '1.1.1.6' });
  assert.equal(r.status, 200);
  assert.equal(r.data.center.me, true);
  assert.ok(r.data.zones.length <= 7);
  assert.equal(r.data.zones[0].name, 'Kowuor');
  assert.ok(r.data.zones[0].distance_m < 200, 'distance is measured from where the person stands');
  assert.equal((await w.call('GET', '/api/zones/suggest?campus=tmu&lat=10&lng=10', { ip: '1.1.1.6' })).status, 400);
});

test('zone suggest: a suburb name written on mapped addresses becomes a zone', async (t) => {
  const w = await fresh(t);
  const inner = globalThis.fetch;
  globalThis.fetch = async (u, init = {}) => {
    if (String(u).includes('overpass')) {
      const q = decodeURIComponent(String(init.body || ''));
      if (q.includes('addr:suburb')) return new Response(JSON.stringify({ elements: Array.from({ length: 20 }, (_, i) => ({ type: 'node', lat: -0.527 + i * 1e-4, lon: 34.452, tags: { 'addr:suburb': 'Kanyamedha' } })) }));
      return new Response(JSON.stringify({ elements: [] }));
    }
    return inner(u, init);
  };
  const r = await w.call('GET', '/api/zones/suggest?campus=tmu&radius=2000', { ip: '1.1.1.7' });
  assert.ok(r.data.zones.some((z) => z.name === 'Kanyamedha' && z.source === 'map'));
});
