# Audit fixes, part 2: a database blip must never lose money. Safe to run twice (anchor-checked).
import os, sys

def edit(path, old, new, done_marker):
    s = open(path, encoding='utf-8').read()
    if done_marker in s:
        print('skip (already applied):', path); return
    if s.count(old) != 1:
        sys.exit('STOP: anchor not found exactly once in ' + path + ' - nothing changed there')
    open(path, 'w', encoding='utf-8').write(s.replace(old, new))
    print('patched:', path)

# 1) credit(): retry a database blip (5xx or no answer) up to 3 times. A refusal (4xx) is final.
#    If an earlier try may have landed before the answer got lost, a "duplicate" on the retry counts as saved.
edit('backend/src/pay.js',
"""  const r = await rows(await post(env, 'wallet_ledger', { aid, delta, kind, ref, note, status }, 'resolution=ignore-duplicates,return=representation'));
  return r.length > 0;
}""",
"""  const row = { aid, delta, kind, ref, note, status };
  for (let i = 0; i < 3; i++) {
    let res = null;
    try { res = await post(env, 'wallet_ledger', row, 'resolution=ignore-duplicates,return=representation'); } catch (e) { res = null; }
    if (res && res.ok) { const r = await rows(res); return r.length > 0 || i > 0; }   // empty on a retry = our first try landed
    if (res && res.status < 500) return false;                                          // refused for good, retrying cannot help
    await new Promise((ok) => setTimeout(ok, 250 * (i + 1)));                           // database blip: wait, try again
  }
  return false;
}""",
"if (res && res.status < 500) return false;")

# 2) withdraw: if the wallet debit was not saved, never let the money go out
edit('backend/src/account.js',
"    await credit(env, u.aid, -amount, 'withdrawal', w.id, 'Withdrawal request');\n",
"""    if (!(await credit(env, u.aid, -amount, 'withdrawal', w.id, 'Withdrawal request'))) {   // debit not saved: never send money out for it
      await patch(env, `withdrawals?id=eq.${w.id}`, { status: 'rejected' });
      return err(env, 'We could not process that right now. Nothing was taken from your wallet. Please try again.', 503);
    }
""",
"debit not saved: never send money out for it")

# 3) cron: one failing step must not stop the steps after it (payout settling, expiring payments)
edit('backend/src/index.js',
"""  out.released = await autoReleaseOrders(env);
  out.referrals = await unlockReferrals(env);
  out.clubExpired = await expireClubOrders(env);""",
"""  const step = (name, p) => p.catch((e) => { console.error('cron step failed:', name, e && e.message); return -1; });   // one failing step must not stop the rest
  out.released = await step('release', autoReleaseOrders(env));
  out.referrals = await step('referrals', unlockReferrals(env));
  out.clubExpired = await step('club', expireClubOrders(env));""",
"one failing step must not stop the rest")

# 4) tests
T = 'tests/credit-retry.test.mjs'
if os.path.exists(T):
    print('skip (already there):', T)
else:
    open(T, 'w', encoding='utf-8').write("""import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';

// The database misbehaves for the next `times` ledger writes of one kind, then works again.
// mode 'fail': answers with `status` and saves nothing. mode 'lost': saves the row but the answer is lost (503).
function misbehave(kind, times, { status = 503, mode = 'fail' } = {}) {
  const real = globalThis.fetch; let left = times;
  globalThis.fetch = async (url, o = {}) => {
    if (left > 0 && String(url).includes('/rest/v1/wallet_ledger') && o.method === 'POST' && String(o.body).includes('"kind":"' + kind + '"')) {
      left--; if (mode === 'lost') await real(url, o);
      return new Response('{"message":"db blip"}', { status, headers: { 'Content-Type': 'application/json' } });
    }
    return real(url, o);
  };
  return () => { globalThis.fetch = real; };
}
const verified = (w, u) => { w.row('profiles', (p) => p.aid === u.aid).verified = true; };
const fund = (w, u, n) => w.db.rows('wallet_ledger').push({ id: crypto.randomUUID(), aid: u.aid, delta: n, kind: 'topup', ref: 'seed' + n, status: 'available' });
const balance = async (w, u) => (await w.call('GET', '/api/wallet', { as: u })).data.balance;

test('escrow release: one database blip while paying the seller does not lose the money', async (t) => {
  const w = world(); t.after(() => w.restore());
  const seller = await w.user('seller'), buyer = await w.user('buyer');
  const { order } = await w.buy(buyer, await w.approvedListing(seller, 1000));
  order.status = 'handed'; order.auto_release_at = new Date(Date.now() - 1000).toISOString();
  const stop = misbehave('sale', 1); try { await w.cron(); } finally { stop(); }
  assert.equal(order.status, 'released'); assert.equal(await balance(w, seller), 970);
});

test('withdraw: the wallet debit is refused -> the request is cancelled and nothing is sent', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('wd'); verified(w, u); fund(w, u, 500);
  const stop = misbehave('withdrawal', 99, { status: 400 }); let r; try { r = await w.call('POST', '/api/wallet/withdraw', { as: u, body: { amount: 100, phone: '0700111222' } }); } finally { stop(); }
  assert.equal(r.status, 503);
  assert.equal(w.db.rows('withdrawals').filter((x) => x.aid === u.aid && x.status === 'requested').length, 0);
  assert.equal(await balance(w, u), 500);
});

test('withdraw: debit saved but the answer was lost -> taken exactly once, request goes ahead', async (t) => {
  const w = world(); t.after(() => w.restore());
  const u = await w.user('wd2'); verified(w, u); fund(w, u, 500);
  const stop = misbehave('withdrawal', 1, { mode: 'lost' }); let r; try { r = await w.call('POST', '/api/wallet/withdraw', { as: u, body: { amount: 100, phone: '0700111222' } }); } finally { stop(); }
  assert.equal(r.status, 201); assert.equal(await balance(w, u), 400);
});
""")
    print('created:', T)
print('done. Now run: git add -A && git commit -m "Audit fixes 2" && git push origin HEAD')
