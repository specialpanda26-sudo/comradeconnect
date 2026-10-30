#!/usr/bin/env python3
"""Merges the site's separate stylesheet files into ONE file, frontend/cc-all.css,
in exactly the order index.html used to load them, so the look does not change.
First run: reads the list from index.html and saves it in scripts/css-order.txt.
Later runs: reads css-order.txt. RUN THIS AGAIN after you edit any file listed there."""
import re, sys, os, hashlib
FE = 'frontend'; IDX = FE + '/index.html'; ORDER = 'scripts/css-order.txt'
html = open(IDX, encoding='utf-8').read()
head_end = html.index('</head>')
LINK = re.compile(r'<link\b[^>]*rel="stylesheet"[^>]*>')
def href(t):
    m = re.search(r'href="([^"]+)"', t); return m.group(1) if m else ''
def local(h): return bool(h) and not re.match(r'^(https?:)?//|^data:', h)

if os.path.exists(ORDER):
    files = [l.strip() for l in open(ORDER, encoding='utf-8') if l.strip()]
else:
    files = []
    for m in LINK.finditer(html[:head_end]):
        t = m.group(0); h = href(t)
        if not local(h): continue
        f = h.split('?')[0]
        if f in ('tw.css', 'cc-all.css'): continue
        if re.search(r'\b(media|disabled|onload|title)=', t):
            print('!! link with media/onload/title, will not merge:', f); sys.exit(1)
        if f in files: files.remove(f)   # a repeated link: the later one wins, as in the browser
        files.append(f)
    if not files: print('!! no stylesheet links found'); sys.exit(1)
    open(ORDER, 'w', encoding='utf-8').write('\n'.join(files) + '\n')

imports, parts = [], []
IMP = re.compile(r'''@import\s+(?:url\(\s*)?(?:"([^"]+)"|'([^']+)'|([^\s"')]+))\s*\)?\s*;''')
for f in files:
    p = os.path.join(FE, f)
    if not os.path.exists(p): print('!! missing file', p); sys.exit(1)
    css = open(p, encoding='utf-8').read().lstrip('\ufeff')
    def grab(m):
        u = m.group(1) or m.group(2) or m.group(3)
        if not u.startswith('https://'): print('!! local @import in', f, '->', u); sys.exit(1)
        if u not in imports: imports.append(u)
        return ''
    css = IMP.sub(grab, css)
    bare = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    if '/*' in bare: print('!! unterminated comment in', f); sys.exit(1)
    nostr = re.sub(r'"(?:\\.|[^"\\\n])*"|\'(?:\\.|[^\'\\\n])*\'', '""', bare)
    if bare.count('{') != bare.count('}') and nostr.count('{') != nostr.count('}'):
        print('!! unbalanced braces in', f, bare.count('{'), bare.count('}')); sys.exit(1)
    parts.append('/* ---- %s ---- */\n%s\n' % (f, css.strip()))

out = '/* Comrade Connect: all page styles in one file. Made by scripts/merge-css.py. Do not edit by hand. */\n' + '\n'.join(parts)
open(FE + '/cc-all.css', 'w', encoding='utf-8').write(out)
h = hashlib.sha1(out.encode('utf-8')).hexdigest()[:8]
tag = '<link rel="stylesheet" href="cc-all.css?v=%s">' % h

if 'href="cc-all.css' in html:
    html = re.sub(r'cc-all\.css\?v=[^"]*', 'cc-all.css?v=' + h, html, count=1)
else:
    plain = html.replace('&amp;', '&')
    fonts = ''.join('<link rel="stylesheet" href="%s">' % u.replace('&', '&amp;') for u in imports if u not in plain)
    spans = []
    for m in LINK.finditer(html[:head_end]):
        h0 = href(m.group(0))
        if local(h0) and h0.split('?')[0] in files: spans.append(m.span())
    if not spans: print('!! nothing to replace in index.html'); sys.exit(1)
    new, last = [], 0
    for i, (a, b) in enumerate(spans):
        new.append(html[last:a]); new.append(fonts + tag if i == 0 else ''); last = b
    new.append(html[last:]); html = ''.join(new)
open(IDX, 'w', encoding='utf-8').write(html)
print('merged %d files -> frontend/cc-all.css (%d KB), fonts as links: %d, version %s' % (len(files), len(out) // 1024, len(imports), h))
