# Notifications, section 1 (money): deposits, failed payments, withdrawals, wallet gifts from admin, gifts, wholesale.
# Safe to run twice: every step checks its anchor and skips if already applied.
import os, sys

def edit(path, old, new, done_marker):
    s = open(path, encoding='utf-8').read()
    if done_marker in s:
        print('skip (already applied):', path, '-', done_marker[:40]); return
    if s.count(old) != 1:
        sys.exit('STOP: anchor not found exactly once in ' + path + ' (' + old[:50].strip() + ') - nothing changed there')
    open(path, 'w', encoding='utf-8').write(s.replace(old, new))
    print('patched:', path)

# phone alerts: the new kinds go to the Wallet switch; tapping opens Me
edit('backend/src/push.js', "club: 'orders' };", "club: 'orders', wallet: 'wallet', wholesale: 'wallet' };", "wholesale: 'wallet' };")
edit('backend/src/notifications.js', "club: 'bell' };", "club: 'bell', wallet: 'me', gift: 'me', withdrawal: 'me' };", "withdrawal: 'me' };")

# index.js: deposit, boost, spill, and every failed payment tell the person
edit('backend/src/index.js', "import { notificationRoutes } from './notifications.js';", "import { notificationRoutes, notify } from './notifications.js';", "import { notificationRoutes, notify }")
edit('backend/src/index.js',
"  else if (p.purpose === 'topup') await credit(env, p.aid, p.amount, 'topup', 'pay:' + p.id, 'Wallet deposit');",
"  else if (p.purpose === 'topup') { if (await credit(env, p.aid, p.amount, 'topup', 'pay:' + p.id, 'Wallet deposit')) await notify(env, p.aid, 'wallet', 'Deposit received', 'KSh ' + p.amount + ' was added to your wallet.', 'wallet', p.id); }",
"'Deposit received'")
edit('backend/src/index.js',
"  else if (p.purpose === 'gift') await giftPaid(env, p);\n};",
"  else if (p.purpose === 'gift') await giftPaid(env, p);\n  if (p.aid && p.purpose === 'boost') await notify(env, p.aid, 'payment', 'Your post is boosted', 'KSh ' + p.amount + ' was received. More people will see your post.', 'post', p.ref_id);\n  if (p.aid && p.purpose === 'spillfee') await notify(env, p.aid, 'payment', 'Your spill is live', 'KSh ' + p.amount + ' was received and your post is now public.', 'post', p.ref_id);\n};",
"'Your spill is live'")
edit('backend/src/index.js',
"  if (p.credit_ksh > 0) await giveBack(env, p.aid, 'pay:' + p.id);   // a failed payment returns the points\n};",
"  if (p.credit_ksh > 0) await giveBack(env, p.aid, 'pay:' + p.id);   // a failed payment returns the points\n  if (p.aid && !String(p.aid).startsWith('gift:')) await notify(env, p.aid, 'payment', 'Payment not completed', 'Your payment of KSh ' + p.amount + ' was not completed. If you paid by M-Pesa, check the code and try again.', 'payment', p.id);\n};",
"'Payment not completed'")

# admin.js: the old confirm/reject message would now double up; keep only the confirm for purposes that have no message of their own
edit('backend/src/admin.js',
"    if (p.aid) await notify(env, p.aid, 'payment', act === 'approve' ? 'Payment confirmed' : 'Payment not confirmed', act === 'approve' ? 'KSh ' + p.amount + ' was received. Thank you.' : 'We could not find your M-Pesa payment of KSh ' + p.amount + '. Check the code and try again.', 'payment', p.id);",
"    if (p.aid && act === 'approve' && !['topup', 'boost', 'spillfee'].includes(p.purpose)) await notify(env, p.aid, 'payment', 'Payment confirmed', 'KSh ' + p.amount + ' was received. Thank you.', 'payment', p.id);   // reject: onFailed tells them",
"reject: onFailed tells them")
edit('backend/src/admin.js',
"    await A('wallet.grant', 'profile', p.aid, `KSh ${amount}: ${note}`);",
"    await notify(env, p.aid, 'reward', 'Comrade Connect added KSh ' + amount + ' to your wallet', note, 'wallet', null);\n    await A('wallet.grant', 'profile', p.aid, `KSh ${amount}: ${note}`);",
"Comrade Connect added KSh ")

# account.js: withdrawal asked and withdrawal cancelled
edit('backend/src/account.js',
"    return json(env, { id: w.id, status: how === 'sending' ? 'sending' : 'requested', fee, net: amount - fee }, 201);",
"    await notify(env, u.aid, 'payout', how === 'sending' ? 'Withdrawal on its way' : 'Withdrawal requested', 'KSh ' + (amount - fee) + ' to ' + norm.replace(/^254/, '0') + (how === 'sending' ? ' is being sent to your M-Pesa.' : ' was requested. We will send it by M-Pesa soon.'), 'withdrawal', w.id);\n    return json(env, { id: w.id, status: how === 'sending' ? 'sending' : 'requested', fee, net: amount - fee }, 201);",
"'Withdrawal on its way'")
edit('backend/src/account.js',
"    await credit(env, w.aid, w.amount, 'adjustment', 'wdrej:' + w.id, 'Withdrawal cancelled, money returned');",
"    await credit(env, w.aid, w.amount, 'adjustment', 'wdrej:' + w.id, 'Withdrawal cancelled, money returned');\n    await notify(env, w.aid, 'payout', 'Withdrawal cancelled', 'KSh ' + w.amount + ' is back in your wallet.', 'withdrawal', w.id);",
"'Withdrawal cancelled', 'KSh '")

# gifts.js: say who sent it (only the name the supporter typed) and what they said
edit('backend/src/gifts.js',
"  try { await notify(env, g.creator_aid, 'gift', 'You received a gift', `KSh ${net} was added to your wallet.`, 'gift', g.id); } catch (e) {}",
"  try { const who = String(g.supporter_name || '').trim(), item = g.item && g.item !== 'custom' ? g.item[0].toUpperCase() + g.item.slice(1) + ': ' : ''; await notify(env, g.creator_aid, 'gift', who ? who + ' sent you a gift' : 'Someone sent you a gift', item + 'KSh ' + net + ' was added to your wallet.' + (g.message ? ' \\u201c' + String(g.message).slice(0, 70) + '\\u201d' : ''), 'gift', g.id); } catch (e) {}",
"' sent you a gift'")

# wholesale.js: joined or renewed
edit('backend/src/wholesale.js', "import { balance } from './account.js';", "import { balance } from './account.js';\nimport { notify } from './notifications.js';", "import { notify } from './notifications.js';")
edit('backend/src/wholesale.js', "  return until;\n}", "  await notify(env, aid, 'wholesale', 'Wholesaler membership active', 'You can upload unlimited photos until ' + String(until).slice(0, 10) + '.', 'wallet', null);\n  return until;\n}", "'Wholesaler membership active'")

print('done. Next: paste the tests file, then git add / commit / push')
