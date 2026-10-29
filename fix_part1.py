import sys
def edit(path, pairs):
    s = open(path, encoding='utf-8').read()
    for a, b in pairs:
        if b in s:
            print('already done in', path); continue
        if s.count(a) != 1:
            sys.exit('NOT FOUND in ' + path + ': ' + a[:70])
        s = s.replace(a, b)
    open(path, 'w', encoding='utf-8').write(s)

# 1) login attempts are limited per account+phone, per phone, and per account overall
a = "    const whoKey = who.toLowerCase() || 'x';\n"
edit('backend/src/account.js', [(a, a
  + "    if (!(await throttle(env, ip, 'recover', whoKey + '|' + ip, 15, 60))) return tooMany(env);\n"
  + "    if (!(await bump(env, 'recoverall:' + whoKey, 200))) return tooMany(env);\n")])

# 2) a wrong admin key is counted on every endpoint, and the key length warning is stricter
edit('backend/src/index.js', [
  ("import { json, err, corsHeaders, sb, rows, patch, ago } from './lib.js';",
   "import { json, err, corsHeaders, sb, rows, patch, ago, isAdmin, tooMany } from './lib.js';"),
  ("  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(env) });\n",
   "  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(env) });\n"
   "  if (req.headers.get('X-Admin-Key') && !isAdmin(req, env) && !(await bump(env, 'adminkey:' + ip, 20))) return tooMany(env);   // wrong admin keys, on any endpoint\n"),
  # 3) one failing cron step no longer stops the others
  ("export async function runCron(env) {\n  const out = {};\n",
   "export async function runCron(env) {\n  const out = {};\n"
   "  const safe = (name, p) => p.catch((e) => { console.error('cron step failed: ' + name, e && e.message); return -1; });\n"),
  ("  out.released = await autoReleaseOrders(env);\n  out.referrals = await unlockReferrals(env);\n  out.clubExpired = await expireClubOrders(env);\n",
   "  out.released = await safe('released', autoReleaseOrders(env));\n  out.referrals = await safe('referrals', unlockReferrals(env));\n  out.clubExpired = await safe('clubExpired', expireClubOrders(env));\n"),
  ("  for (const p of stale) await hooks.onFailed(env, p);\n",
   "  for (const p of stale) { try { await hooks.onFailed(env, p); } catch (e) { console.error('cron: onFailed', p.id, e && e.message); } }\n"),
  ("  out.media = await pruneMedia(env);\n", "  out.media = await safe('media', pruneMedia(env));\n"),
])
edit('server.js', [("if (env.ADMIN_KEY.length < 8) console.warn('WARNING: ADMIN_KEY is shorter than 8 characters. Use at least 8.');",
  "if (env.ADMIN_KEY.length < 24) console.warn('WARNING: ADMIN_KEY is shorter than 24 characters. Use a long random key (32+ is best).');")])
print('part 1 done')
