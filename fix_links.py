#!/usr/bin/env python3
import re, sys, os
F = 'frontend/'
def rd(p):
    with open(p, encoding='utf-8') as f: return f.read()
def wr(p, s):
    with open(p, 'w', encoding='utf-8') as f: f.write(s)
def sub(p, old, new, count=1):
    s = rd(p)
    if new in s and old not in s:
        print('  already done:', p); return
    if old not in s:
        print('  !! not found in', p, '->', old[:60]); sys.exit(1)
    wr(p, s.replace(old, new, count)); print('  patched:', p)

SITE = "const SITE=()=>{const h=location.hostname;return(/^(localhost|127\\.0\\.0\\.1|\\[::1\\]|0\\.0\\.0\\.0)$/.test(h)&&location.protocol==='https:'&&!location.port)||/^(capacitor|ionic|file):/.test(location.protocol)?'https://comradeconnect.co.ke':location.origin};\n"
p = F + 'ludo-online.html'
s = rd(p)
if 'const SITE=' not in s:
    i = s.index("$('share').onclick=")
    s = s[:i] + SITE + s[i:]
    wr(p, s)
sub(p, "${location.origin}/ludo-online.html?c=${room.code}", "${SITE()}/ludo-online.html?c=${room.code}")

p = F + 'index.html'
s = rd(p)
if 'window.ccShareUrl' not in s:
    anchor = "const rlink=()=>"
    helper = "window.ccShareUrl=()=>window.ccOrigin()+(location.pathname||'/').replace(/\\/index\\.html$/,'/')+location.search+location.hash;\n"
    s = s.replace(anchor, helper + anchor, 1)
    wr(p, s)
s = rd(p)
s = s.replace("url:location.href}", "url:window.ccShareUrl()}")
s = s.replace("encodeURIComponent(t+' '+location.href)", "encodeURIComponent(t+' '+window.ccShareUrl())")
s = s.replace("encodeURIComponent(x+' '+location.href)", "encodeURIComponent(x+' '+window.ccShareUrl())")
s = s.replace("x.fillText(location.host+location.pathname,80,1800,920)", "x.fillText(window.ccOrigin().replace(/^https?:\\/\\//,''),80,1800,920)")
wr(p, s)
print('  patched: index.html share links + story card text')

p = F + 'cc-profile.js'
sub(p, "u = (window.ccOrigin?window.ccOrigin():location.origin) + '/';",
       "u = (window.ccOrigin?window.ccOrigin():location.origin) + '/' + (window.ccRef && window.ccRef.code ? '?ref=' + window.ccRef.code : '');")
print('links ok')
