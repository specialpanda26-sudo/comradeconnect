#!/usr/bin/env python3
import re, sys
F = 'frontend/'
def rd(p):
    with open(p, encoding='utf-8') as f: return f.read()
def wr(p, s):
    with open(p, 'w', encoding='utf-8') as f: f.write(s)

p = F + 'admin.html'
s = rd(p)
aqua, pro, vibe = rd(F + 'cc-aqua.css'), rd(F + 'admin-pro.css'), rd(F + 'admin-vibe.css')
block = '<style id="vibe-css">\n/*VIBE-START*/\n' + aqua + '\n' + pro + '\n' + vibe + '\n/*VIBE-END*/\n</style>'

if 'id="vibe-css"' in s:
    s = re.sub(r'<style id="vibe-css">.*?</style>', lambda m: block, s, count=1, flags=re.S)
else:
    for tag in ('<link rel="stylesheet" href="cc-aqua.css?v=1">', '<link rel="stylesheet" href="admin-pro.css?v=1">'):
        if tag not in s:
            print('!! missing', tag); sys.exit(1)
        s = s.replace(tag, block if 'admin-pro' in tag else '', 1)

if 'data-theme="light">' in s.split('</head>')[0][:400]:
    s = s.replace('<html lang="en" data-theme="light">', '<html lang="en" data-theme="dark">', 1)
if 'cc_admin_theme2' not in s.split('</head>')[0]:
    s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<script>try{document.documentElement.setAttribute("data-theme",localStorage.getItem("cc_admin_theme2")==="light"?"light":"dark")}catch(e){}</script>', 1)
old = "(function () { setTheme('light'); })();"
new = "(function () { var t = 'dark'; try { if (localStorage.getItem('cc_admin_theme2') === 'light') t = 'light'; } catch (e) {} setTheme(t); })();"
if old in s: s = s.replace(old, new, 1)
s = s.replace('<meta name="theme-color" content="#ffffff">', '<meta name="theme-color" content="#101422">', 1)
if 'admin-vibe.js' not in s:
    k = '<script src="admin-pro.js?v=2"></script>'
    if k not in s: print('!! admin-pro.js tag not found'); sys.exit(1)
    s = s.replace(k, k + '\n<script src="admin-vibe.js?v=1"></script>', 1)
wr(p, s); print('  patched: admin.html')

p = F + '_headers'
h = rd(p)
if "style-src 'unsafe-inline' https://fonts.googleapis.com" in h:
    h = h.replace("style-src 'unsafe-inline' https://fonts.googleapis.com", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", 1)
    wr(p, h); print("  patched: _headers (style-src 'self')")
else:
    print('  _headers already ok')
print('admin ok')
