# Audit fixes, part 1. Safe to run twice: every step checks its anchor and skips if already applied.
import os, subprocess, sys

def edit(path, old, new, done_marker):
    s = open(path, encoding='utf-8').read()
    if done_marker in s:
        print('skip (already applied):', path); return
    if s.count(old) != 1:
        sys.exit('STOP: anchor not found exactly once in ' + path + ' - nothing changed there')
    open(path, 'w', encoding='utf-8').write(s.replace(old, new))
    print('patched:', path)

# 1) wholesale.js: a failed save must never mean a free membership, or a charge with no membership
edit('backend/src/wholesale.js',
"  await patch(env, `profiles?aid=eq.${enc(aid)}`, { wholesaler_until: until });\n  return until;\n}",
"  const res = await patch(env, `profiles?aid=eq.${enc(aid)}`, { wholesaler_until: until });\n  if (!res.ok) { console.error('wholesale: could not save the membership for', aid); return null; }\n  return until;\n}",
"could not save the membership for")

edit('backend/src/wholesale.js',
"""      await credit(env, u.aid, -S.wholesale_fee, 'wholesale_fee', ref, 'Wholesaler membership');
      if ((await balance(env, u.aid)) < 0) {
        await patch(env, `wallet_ledger?kind=eq.wholesale_fee&ref=eq.${enc(ref)}`, { status: 'void' });
        return err(env, 'Not enough wallet balance', 402);
      }
      return json(env, { active: true, until: await extendWholesale(env, u.aid) });""",
"""      const undo = () => patch(env, `wallet_ledger?kind=eq.wholesale_fee&ref=eq.${enc(ref)}`, { status: 'void' });
      if (!(await credit(env, u.aid, -S.wholesale_fee, 'wholesale_fee', ref, 'Wholesaler membership'))) return err(env, 'Wallet payment is not ready yet. Nothing was charged.', 503);
      if ((await balance(env, u.aid)) < 0) { await undo(); return err(env, 'Not enough wallet balance', 402); }
      const until = await extendWholesale(env, u.aid).catch(() => null);
      if (!until) { await undo(); return err(env, 'Something went wrong. Nothing was charged.', 500); }
      return json(env, { active: true, until });""",
"Wallet payment is not ready yet. Nothing was charged.")

# 2) fake database: orders get hide_top=false like the real column (fixes the failing market-top test)
edit('tests/mockdb.js',
"SCHEMA.profiles.defaults.student_verified = false;",
"SCHEMA.profiles.defaults.student_verified = false;\nSCHEMA.orders.defaults.hide_top = false;",
"SCHEMA.orders.defaults.hide_top")

# 3) tests for the wholesale fix
T = 'tests/wholesale-wallet.test.mjs'
if os.path.exists(T):
    print('skip (already there):', T)
else:
    open(T, 'w', encoding='utf-8').write("""import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

// Runs one wallet join while the database refuses a certain write; returns the join answer and the state afterwards.
async function joinWhileRefusing(t, refuse) {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('ws');
  w.db.rows('wallet_ledger').push({ id: crypto.randomUUID(), aid: u.aid, delta: 500, kind: 'topup', ref: 'seed', status: 'available' });
  const real = globalThis.fetch; let r;
  globalThis.fetch = async (url, o = {}) => refuse(String(url), o)
    ? new Response(JSON.stringify({ code: '23514' }), { status: 400, headers: { 'Content-Type': 'application/json' } }) : real(url, o);
  try { r = await w.call('POST', '/api/wholesale/join', { as: u, body: { method: 'wallet' } }); } finally { globalThis.fetch = real; }
  return { r, active: (await w.call('GET', '/api/wholesale/me', { as: u })).data.active, balance: (await w.call('GET', '/api/wallet', { as: u })).data.balance };
}

test('wholesale by wallet: debit cannot be saved -> no membership, no charge', async (t) => {
  const x = await joinWhileRefusing(t, (url, o) => url.includes('/rest/v1/wallet_ledger') && o.method === 'POST' && String(o.body).includes('wholesale_fee'));
  assert.equal(x.r.status, 503); assert.equal(x.active, false); assert.equal(x.balance, 500);
});

test('wholesale by wallet: membership cannot be saved -> the charge is undone', async (t) => {
  const x = await joinWhileRefusing(t, (url, o) => url.includes('/rest/v1/profiles') && o.method === 'PATCH' && String(o.body).includes('wholesaler_until'));
  assert.equal(x.r.status, 500); assert.equal(x.active, false); assert.equal(x.balance, 500);
});
""")
    print('created:', T)

# 4) repack the SQL files so the admin SQL panel also lists listing-stock.sql and top-sales-hide.sql
subprocess.run([sys.executable, 'build-sql.py'], check=True)
print('done. Now run: git add -A && git commit -m "Audit fixes" && git push origin HEAD')
