import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function load(balance) {
  const calls = [];
  const win = { ccAuth: () => ({ token: 't' }), CC: { call: async (p) => { calls.push(p); return { balance }; } } };
  win.window = win;
  vm.runInNewContext(readFileSync(new URL('../frontend/cc-paychoice.js', import.meta.url), 'utf8'), win);
  return { win, calls };
}
const tick = () => new Promise((r) => setTimeout(r, 5));

test('wallet row is enabled when balance covers the price', async () => {
  const { win } = load(500); const host = {}; let need = 300;
  const wc = win.ccPayChoice.mount(host, { need: () => need }); await tick();
  assert.match(host.innerHTML, /Pay with wallet \(KSh 500 available\)/);
  assert.doesNotMatch(host.innerHTML, /value="wallet"[^>]*disabled/);
  const name = host.innerHTML.match(/name="(ccpc\d+)"/)[1];
  host.onchange({ target: { name, value: 'wallet' } });
  assert.equal(wc.mode(), 'wallet');
  need = 900; wc.repaint();
  assert.equal(wc.mode(), 'mpesa');
  assert.match(host.innerHTML, /Deposit first/);
});

test('wallet row is disabled when balance is too low, M-Pesa stays selectable', async () => {
  const { win } = load(50); const host = {};
  const wc = win.ccPayChoice.mount(host, { need: () => 300 }); await tick();
  assert.match(host.innerHTML, /value="wallet"[^>]*disabled/);
  assert.doesNotMatch(host.innerHTML, /value="mpesa"[^>]*disabled/);
  assert.equal(wc.mode(), 'mpesa');
});

test('short() returns the deposit-first message and falls back to M-Pesa', async () => {
  const { win } = load(500); const host = {}; let m = null;
  const wc = win.ccPayChoice.mount(host, { need: () => 100, onChange: (x) => { m = x; } }); await tick();
  const name = host.innerHTML.match(/name="(ccpc\d+)"/)[1];
  host.onchange({ target: { name, value: 'wallet' } });
  assert.match(wc.short(), /Deposit first or pay with M-Pesa/);
  assert.equal(m, 'mpesa');
});
