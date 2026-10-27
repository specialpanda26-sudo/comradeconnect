import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Runs the real cc-fix6.js against a fake phone: a fake Capacitor, fake timers that run at once, a fake page.
function phone({ native = true, pending = null } = {}) {
  const log = { calls: [], clicks: [], go: [], threads: [], opened: [], cleared: 0, live: [] };
  const listeners = {}, push = {
    addListener: (e, f) => { listeners[e] = f; }, createChannel: () => Promise.resolve(), checkPermissions: () => Promise.resolve({ receive: 'granted' }),
    requestPermissions: () => Promise.resolve({ receive: 'granted' }), register: () => Promise.resolve(),
  };
  const N = { taps: [], addListener: (e, f) => { listeners['native:' + e] = f; }, takeTap: () => Promise.resolve(N.pending ? { tap: N.pending } : {}), clear: () => { log.cleared++; return Promise.resolve(); } };
  N.pending = pending;
  const winL = {}, timers = [];
  const ctx = {
    console, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { addEventListener() {}, querySelector: (s) => ({ click: () => log.clicks.push(s) }) },
    setTimeout: (fn, ms) => { if (ms >= 5000) { timers.push(fn); return 1; } fn(); return 1; },
    setInterval: (fn) => { fn(); return 1; }, clearInterval() {},
  };
  ctx.window = ctx;
  ctx.addEventListener = (e, f) => { winL[e] = f; };
  ctx.Capacitor = { isNativePlatform: () => true, isPluginAvailable: (n) => native && n === 'CCNotif', registerPlugin: (n) => (n === 'CCNotif' ? N : push), Plugins: { PushNotifications: push } };
  ctx.ccAuth = () => ({ token: 't' });
  ctx.ccCall = (p, o) => { log.calls.push([p, o]); if (p === '/api/push/key') return Promise.resolve({ fcm: true }); if (p === '/api/live') return Promise.resolve({ streams: [{ id: 'a1' }, { id: 'b2' }] }); return Promise.resolve({}); };
  ctx.go = (v) => log.go.push(v);
  ctx.ccOpenThread = (o) => log.threads.push(o);
  ctx.ccNotifOpen = (o) => log.opened.push(o);
  ctx.ccLiveStrip = { open: (s) => log.live.push(s.id) };
  vm.runInNewContext(fs.readFileSync('frontend/cc-fix6.js', 'utf8'), ctx);
  return { ctx, log, listeners, N, winL, timers };
}
const tick = () => new Promise((r) => setImmediate(r));

test('a phone with the new app registers with v:2, an old one without', async () => {
  for (const [native, want] of [[true, { token: 'abc', v: 2 }], [false, { token: 'abc' }]]) {
    const p = phone({ native });
    p.timers[0]();                       // the first sync, 7 seconds after start
    await tick(); await tick();
    p.listeners.registration({ value: 'abc' });
    const c = p.log.calls.find((x) => x[0] === '/api/push/fcm');
    assert.equal(JSON.stringify(c[1].body), JSON.stringify(want));
  }
});

test('tapping a notification opens the right screen', async () => {
  const cases = [
    [{ view: 'orders', ref_type: 'order', ref_id: '9' }, (l) => l.go.includes('market') && l.clicks.includes('#mseg button[data-s="orders"]')],
    [{ view: 'message', ref_type: 'thread', ref_id: 'T1' }, (l) => l.threads[0] && l.threads[0].tid === 'T1'],
    [{ view: 'post', ref_type: 'post', ref_id: 'P7' }, (l) => l.opened[0] && l.opened[0].ref_id === 'P7' && l.opened[0].ref_type === 'post'],
    [{ view: 'live', ref_type: 'live', ref_id: 'b2' }, (l) => l.live[0] === 'b2'],
    [{ view: 'live', ref_type: 'live', ref_id: 'gone' }, (l) => l.live[0] === 'a1'],
    [{ view: 'bell' }, (l) => l.clicks.includes('.ccb')],
  ];
  for (const [tap, ok] of cases) {
    const p = phone();
    p.listeners['native:ccTap'](tap);
    await tick(); await tick();
    assert.ok(ok(p.log), 'wrong screen for ' + JSON.stringify(tap) + ' -> ' + JSON.stringify(p.log));
  }
});

test('app was closed: the tap waiting in the native side is opened once at start', async () => {
  const p = phone({ native: true, pending: { view: 'message', ref_type: 'thread', ref_id: 'T9' } });
  await tick(); await tick();
  assert.equal(p.log.threads.length, 1);
  assert.equal(p.log.threads[0].tid, 'T9');
});

test('opening the bell clears the phone notifications', () => {
  const p = phone();
  p.winL.click({ target: { closest: (s) => (s === '.ccb' ? {} : null) } });
  assert.equal(p.log.cleared, 1);
  p.winL.click({ target: { closest: () => null } });
  assert.equal(p.log.cleared, 1);
});

test('without the native plugin (iPhone, old app) taps still work through the push plugin', async () => {
  const p = phone({ native: false });
  p.timers[0]();                       // the first sync wires the push listeners
  await tick(); await tick();
  p.listeners.pushNotificationActionPerformed({ notification: { data: { view: 'orders', ref_type: 'order', ref_id: '2' } } });
  await tick(); await tick();
  assert.ok(p.log.go.includes('market'));
});

test('the bell opens orders and conversations too', () => {
  const j = fs.readFileSync('frontend/cc-notify.js', 'utf8');
  assert.ok(j.includes('#mseg button[data-s=\\"orders\\"]') || j.includes('#mseg button[data-s="orders"]'));
  assert.ok(j.includes("n.ref_type === 'thread'") && j.includes('window.ccNotifOpen ='));
});
