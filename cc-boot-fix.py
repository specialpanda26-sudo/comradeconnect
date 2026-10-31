import re, sys
P = 'frontend/index.html'
h = open(P, encoding='utf-8', newline='').read()
if 'id="ccboot"' in h:
    sys.exit('already applied')
L = h.split('\n')
vi = [i for i, l in enumerate(L) if l.startswith('<meta name="viewport"')][0]
bd = [i for i, l in enumerate(L) if l.startswith('<body data-view="feed">')][0]
HEAD = '''<link rel="preload" href="icon-192.png" as="image" fetchpriority="high">
<style id="ccboot-css">html[data-capp]{background:#000}#ccboot{position:fixed;inset:0;z-index:2147482999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;background:#fbf1ed;color:#2a1d18;transition:opacity .3s ease}html[data-theme=dark] #ccboot{background:#17130f;color:#f6ece6}html[data-capp] #ccboot{background:#000;color:#fff}#ccboot.off{opacity:0;pointer-events:none}#ccboot img{width:84px;height:84px;border-radius:22px;display:block}#ccboot i{width:26px;height:26px;box-sizing:border-box;border:3px solid currentColor;border-color:currentColor transparent transparent;border-radius:50%;opacity:.7;animation:ccbootsp .8s linear infinite}@keyframes ccbootsp{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){#ccboot i{animation-duration:2.4s}}</style>
<noscript><style>#ccboot{display:none}</style></noscript>
<script>try{if(location.protocol==='https:'&&location.hostname==='localhost'&&!location.port)document.documentElement.setAttribute('data-capp','1')}catch(e){}</script>'''
BODY = '''<div id="ccboot" aria-hidden="true"><img src="icon-192.png" alt="" width="84" height="84" decoding="sync" fetchpriority="high"><i></i></div>
<script>(function(){var b=document.getElementById('ccboot');if(!b)return;var d=0;function off(){if(d)return;d=1;b.classList.add('off');setTimeout(function(){if(b.parentNode)b.parentNode.removeChild(b)},400)}function go(){requestAnimationFrame(function(){requestAnimationFrame(off)})}if(document.readyState==='complete')go();else{document.addEventListener('DOMContentLoaded',go);window.addEventListener('load',go)}setTimeout(off,6000)})()</script>'''
h = '\n'.join(L[:vi + 1] + HEAD.split('\n') + L[vi + 1:bd + 1] + BODY.split('\n') + L[bd + 1:])
he = h.index('</head>')
head = h[:he]
items = [m for m in re.finditer(r'<style\b[^>]*>.*?</style>|<link\b[^>]*rel=["\']?stylesheet[^>]*>', head, re.S) if 'ccboot' not in m.group(0)]
if len(items) < 3:
    sys.exit('STOP: expected head stylesheets, found ' + str(len(items)))
blk = ''.join(m.group(0) + '\n' for m in items)
for m in sorted(items, key=lambda m: m.start(), reverse=True):
    head = head[:m.start()] + head[m.end():]
rest = h[he:]
mk = 'setTimeout(off,6000)})()</script>'
i = rest.index(mk) + len(mk)
open(P, 'w', encoding='utf-8', newline='').write(head + rest[:i] + '\n' + blk + rest[i:])
print('done: splash added, ' + str(len(items)) + ' stylesheets moved after it')
