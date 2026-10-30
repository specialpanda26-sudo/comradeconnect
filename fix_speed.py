#!/usr/bin/env python3
import sys
p = 'frontend/sw.js'
s = open(p, encoding='utf-8').read()

old1 = "    e.respondWith(fresh(req, req.url, 4000));\n    return;"
new1 = """    e.respondWith((async () => {                                  // saved copy at once, refreshed quietly for next time
      const hit = await caches.match(req);
      if (hit) { e.waitUntil(fresh(req, req.url, 8000).catch(() => {})); return hit; }
      return fresh(req, req.url, 4000);
    })());
    return;"""
if 'saved copy at once' not in s:
    if old1 not in s: print('!! app-file rule not found'); sys.exit(1)
    s = s.replace(old1, new1, 1)

old2 = "const r = await Promise.race([fetch(req), timeout(5000)]);\n        if (r && r.status >= 500) throw new Error('server');"
new2 = "const r = await Promise.race([fetch(req), timeout(2500)]);\n        if (r && r.status >= 500) throw new Error('server');"
if old2 in s: s = s.replace(old2, new2, 1)
elif 'timeout(2500)' not in s: print('!! page rule not found'); sys.exit(1)

open(p, 'w', encoding='utf-8').write(s)
print('speed ok')
