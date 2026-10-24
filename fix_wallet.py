import sys
def edit(path, pairs):
    s = open(path, encoding='utf-8').read()
    for a, b in pairs:
        if s.count(a) != 1:
            sys.exit('NOT FOUND (or already done) in ' + path + ': ' + a[:60])
        s = s.replace(a, b)
    open(path, 'w', encoding='utf-8').write(s)

# SECTION 1 (backend): money history for the graph, last 90 days
edit('backend/src/account.js', [(
"  if (path === '/api/wallet/withdraw' && m === 'POST') {",
"""  if (path === '/api/wallet/stats' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const list = await rows(await sb(env, `wallet_ledger?select=delta,kind,status,note,created_at&aid=eq.${enc(u.aid)}&status=neq.void&created_at=gte.${enc(ago(90 * DAY))}&order=created_at.desc&limit=1000`));
    return json(env, { balance: await balance(env, u.aid), ledger: list });
  }
  if (path === '/api/wallet/withdraw' && m === 'POST') {""")])

# SECTION 2 (app): one wallet balance at the top of Me, no zero clutter
edit('frontend/cc-gifts.js', [(
"  var hr = el('div'); hr.style.cssText = 'height:1px;background:var(--line,rgba(255,255,255,.12));margin:14px 0'; host.appendChild(hr);\n  host.appendChild(el('div', 'sub', 'Received in gifts'));",
"  if (!D.earned.count) { var z = el('p', 'note', 'No gifts yet. When someone sends you one, it shows here and in your wallet.'); z.style.marginTop = '12px'; host.appendChild(z); return; }\n  var hr = el('div'); hr.style.cssText = 'height:1px;background:var(--line,rgba(255,255,255,.12));margin:14px 0'; host.appendChild(hr);\n  host.appendChild(el('div', 'sub', 'Received in gifts'));")])
edit('frontend/cc-wholesale.js', [(
"  host.appendChild(el('div', 'sub', 'Wallet balance'));\n  var big = el('div', 'big', kes(W.balance)); big.id = 'ccw-bal'; host.appendChild(big);\n",
"  host.appendChild(el('b', '', 'Deposit or withdraw'));\n")])
edit('frontend/index.html', [(
'<script src="cc-gifts.js?v=2" defer></script>',
'<script src="cc-gifts.js?v=3" defer></script><script src="cc-wallet-top.js?v=1" defer></script>'),
('cc-wholesale.js?v=3ea', 'cc-wholesale.js?v=3eb')])
print('Wallet update applied')
