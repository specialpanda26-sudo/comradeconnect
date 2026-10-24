import sys
p = 'frontend/gift.html'
s = open(p, encoding='utf-8').read()
pairs = [
 # theme colour of the phone's browser bar
 ('<meta name="theme-color" content="#0E0F0B">', '<meta name="theme-color" content="#101422">'),
 # dark palette: app navy + aqua instead of orange/rose/sage
 ('--bg:#0E0F0B;--fg:#fff;', '--bg:#101422;--fg:#fff;'),
 ('--or:#FE813C;--ro:#BC656A;--sa:#727E6E;', '--or:#A8DCE7;--ro:#7FC4D4;--sa:#3A4A6B;'),
 # light palette
 ('--bg:#f6f3ef;--fg:#0E0F0B;', '--bg:#EEF6F8;--fg:#101422;--or:#5BB0C4;'),
]
for a, b in pairs:
    if s.count(a) != 1:
        sys.exit('NOT FOUND (or already fixed): ' + a[:50])
    s = s.replace(a, b)
# every orange glow/tint becomes aqua
n = s.count('254,129,60')
s = s.replace('254,129,60', '168,220,231')
# dark text on aqua buttons/ticks should be the app navy
s = s.replace('#0E0F0B', '#101422')
open(p, 'w', encoding='utf-8').write(s)
print('Gift page recoloured (' + str(n) + ' glows changed)')
