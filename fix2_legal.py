import re, json, os, sys
F='frontend/'
if os.path.exists(F+'cc-doc.css') and 'cc-doc.css' in open(F+'terms.html',encoding='utf-8').read() and 'SUB.legal=' in open(F+'app/index.html',encoding='utf-8').read():
    print('Section 2 already applied'); sys.exit(0)

CSS = r'''@import url("https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&display=swap");
:root{--ink:#16130f;--mut:#6a625a;--bg:#fbf1ed;--bg2:#f3efe9;--card:rgba(255,255,255,.86);--line:rgba(22,19,15,.1);--o:#ff8a3d;--o2:#e8744f;--tint:rgba(255,138,61,.13);--inv:#fff;--sh:0 10px 28px rgba(140,80,50,.11);--fg:var(--ink)}
:root[data-theme="dark"]{--ink:#f6efe9;--mut:#b6aca2;--bg:#17130f;--bg2:#100d0a;--card:rgba(44,37,32,.86);--line:rgba(255,255,255,.1);--tint:rgba(255,138,61,.18);--inv:#17130f;--sh:0 10px 28px rgba(0,0,0,.35);--fg:var(--ink)}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--ink:#f6efe9;--mut:#b6aca2;--bg:#17130f;--bg2:#100d0a;--card:rgba(44,37,32,.86);--line:rgba(255,255,255,.1);--tint:rgba(255,138,61,.18);--inv:#17130f;--sh:0 10px 28px rgba(0,0,0,.35);--fg:var(--ink)}}
:root{color-scheme:light dark}:root[data-theme="light"]{color-scheme:light}:root[data-theme="dark"]{color-scheme:dark}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-padding-top:84px;accent-color:var(--o)}
html body{margin:0;min-height:100vh;background:linear-gradient(180deg,var(--bg),var(--bg2)) fixed;color:var(--ink);font-family:Manrope,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:16px;line-height:1.7;-webkit-font-smoothing:antialiased}
html body::before{display:none}
::selection{background:var(--o);color:#1d0f06}
html body>header{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:none;width:100%;margin:0;padding:max(10px,env(safe-area-inset-top)) 16px 10px;border:0;border-radius:0;box-shadow:none;background:color-mix(in srgb,var(--bg) 82%,transparent);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}
html body>header a.brand{font-weight:800;font-size:13px;letter-spacing:.08em;text-decoration:none;color:var(--ink)}
html a.cta,html a.b{display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#ffa05a,#ee7a4f);color:#1d0f06;padding:10px 18px;border-radius:999px;font-weight:800;font-size:13.5px;text-decoration:none;border:0;box-shadow:0 8px 20px rgba(238,122,79,.28)}
html .pb-b,html .pb-g{background:var(--card);border:1px solid var(--line);color:var(--ink);font-family:Manrope,system-ui,sans-serif;font-weight:700;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none}
html body>main{max-width:720px;margin:0 auto;padding:30px 22px 10px}
html h1{font-weight:800;font-size:clamp(30px,8vw,44px);line-height:1.08;letter-spacing:-.035em;margin:6px 0 10px;color:var(--ink)}
html h2{font-weight:800;font-size:20px;line-height:1.25;letter-spacing:-.02em;margin:38px 0 8px;padding-top:22px;border-top:1px solid var(--line);color:var(--ink)}
html h2:first-of-type{border-top:0;padding-top:0}
html h3{font-weight:800;font-size:16px;margin:22px 0 4px;color:var(--ink)}
html p,html li{color:var(--mut);font-size:15.5px}
html p{margin:8px 0}
html ul,html ol{padding-left:0;margin:10px 0;list-style:none}
html ul>li{position:relative;padding-left:22px;margin:9px 0}
html ul>li::before{content:"";position:absolute;left:3px;top:.72em;width:7px;height:7px;border-radius:50%;background:var(--o)}
html ol{counter-reset:n}html ol>li{counter-increment:n;position:relative;padding-left:34px;margin:10px 0}
html ol>li::before{content:counter(n);position:absolute;left:0;top:.1em;width:24px;height:24px;border-radius:50%;background:var(--tint);color:var(--o2);font-weight:800;font-size:12.5px;display:grid;place-items:center}
html b,html strong{color:var(--ink);font-weight:800}
html a{color:var(--o2);text-underline-offset:3px;font-weight:700}
html a.brand,html a.cta,html a.b{text-decoration:none}
html small,html .small{font-size:13px;color:var(--mut)}
html hr{border:0;border-top:1px solid var(--line);margin:28px 0}
html .card{background:var(--card);border:1px solid var(--line);border-radius:22px;padding:6px 18px;margin:14px 0;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none}
html .card p{color:var(--mut);margin:10px 0}html .card b{color:var(--ink)}
html .note{background:var(--tint);border:0;border-left:3px solid var(--o);border-radius:0 16px 16px 0;padding:8px 16px;margin:16px 0;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none}
html .note p,html .note li{color:var(--ink)}
html .pill{display:inline-block;font-size:12px;font-weight:800;padding:3px 11px;border-radius:999px;border:0;background:var(--tint);color:var(--o2)}
html table{display:block;overflow-x:auto;width:100%;border-collapse:collapse;margin:14px 0;font-size:14.5px;border-radius:0}
html th,html td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top;white-space:normal;min-width:110px}
html th{color:var(--ink);font-weight:800;font-size:12.5px;letter-spacing:.04em;text-transform:uppercase}html td{color:var(--mut)}
html input,html textarea,html select{font:inherit;font-size:16px;width:100%;padding:13px 16px;margin:6px 0;border-radius:18px;border:1px solid var(--line);background:var(--card);color:var(--ink)}
html input:focus{outline:0;border-color:var(--o);box-shadow:0 0 0 3px var(--tint)}
html button.go,html body>main>button{font:inherit;font-weight:800;font-size:15px;width:100%;height:52px;border-radius:999px;border:0;cursor:pointer;background:linear-gradient(135deg,#ffa05a,#ee7a4f);color:#1d0f06;box-shadow:0 8px 20px rgba(238,122,79,.28)}
html button.go:disabled{opacity:.5}
html .msg{min-height:1.4em;font-weight:700;color:var(--ink)}
html [hidden]{display:none!important}
html .shots{display:flex;gap:14px;overflow-x:auto;padding:6px 2px 12px;margin:18px -22px;padding-left:22px;padding-right:22px;scroll-snap-type:x mandatory}
html .shots figure{scroll-snap-align:start}
html .shots img{border-radius:22px;border:1px solid var(--line);box-shadow:var(--sh);background:var(--card)}
html .shots figcaption{font-size:13px;font-weight:700;color:var(--mut);margin-top:8px}
html body>footer{max-width:720px;margin:34px auto 0;padding:22px 22px 8px;border-top:1px solid var(--line);color:var(--mut);font-size:13.5px;line-height:2.1}
html body>footer a{color:var(--ink);font-weight:700;text-decoration:none;margin-right:14px;display:inline-block}
html body>p{color:var(--mut);padding:0 22px 40px;max-width:720px;margin-left:auto;margin-right:auto}
@media(max-width:420px){html body>main{padding-left:18px;padding-right:18px}html body>header a.brand{font-size:11.5px}}
@media(prefers-reduced-motion:no-preference){html body>main{animation:ccdoc .3s ease}@keyframes ccdoc{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}}
'''
JS = r'''(function () {
  try {
    var t = localStorage.getItem('cc_theme');
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    var dark = t === 'dark' || (!t && window.matchMedia && matchMedia('(prefers-color-scheme:dark)').matches);
    if (m) m.setAttribute('content', dark ? '#17130f' : '#fbf1ed');
  } catch (e) {}
})();
'''

docs={}
def grab(page,title):
    s=open(F+page+'.html',encoding='utf-8').read()
    b=re.search(r'<main>(.*?)</main>',s,re.S).group(1)
    b=re.sub(r'<script.*?</script>','',b,flags=re.S)
    b=re.sub(r'<div class="shots".*?</div>','',b,flags=re.S)
    b=re.sub(r'<h1>.*?</h1>','',b,count=1,flags=re.S)
    parts=re.split(r'<h[23][^>]*>(.*?)</h[23]>',b,flags=re.S)
    docs[page]={'t':title,'i':parts[0].strip(),'s':[[re.sub(r'<[^>]+>','',parts[i]).strip(),parts[i+1].strip()] for i in range(1,len(parts)-1,2)],'u':'/'+page+'.html'}
for pg,t in [('terms','Terms & Conditions'),('privacy','Privacy Policy'),('cookies','Cookie Policy'),('refunds','Refunds & disputes'),('about','About'),('safety','Safety'),('contact','Contact')]:
    grab(pg,t)
LDOCJSON=json.dumps(docs,ensure_ascii=False).replace('</','<\\/')

open(F+'cc-doc.css','w',encoding='utf-8').write(CSS)
open(F+'cc-doc.js','w',encoding='utf-8').write(JS)

for pg in ['terms','privacy','cookies','refunds','safety','payments','trust','contact','about']:
    f=F+pg+'.html'; s=open(f,encoding='utf-8').read()
    for old in ['<link rel="stylesheet" href="/trust.css">','<link rel="stylesheet" href="/cc-static.css?v=2">','<link rel="stylesheet" href="cc-glass.css?v=5">']:
        s=s.replace(old,'')
    s=s.replace('<script src="cc-glass.js?v=5" defer></script>','<link rel="stylesheet" href="/cc-doc.css?v=1"><script src="/cc-doc.js?v=1"></script>')
    s=s.replace('<meta name="theme-color" content="#101422">','<meta name="theme-color" content="#fbf1ed">')
    if pg=='about': s=re.sub(r'<style>.*?</style>','',s,count=1,flags=re.S)
    open(f,'w',encoding='utf-8').write(s)
open(F+'legal.html','w',encoding='utf-8').write('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Terms | Comrade Connect</title><meta http-equiv="refresh" content="0;url=/terms.html"><link rel="canonical" href="https://comradeconnect.co.ke/terms.html"></head><body><p>Moved to <a href="/terms.html">Terms &amp; Conditions</a>.</p><script>location.replace("/terms.html")</script></body></html>')

p=F+'app/index.html'; s=open(p,encoding='utf-8').read()
i=s.find("A.legal=a=>openSheet(a,")
if i<0: print('SKIPPED in-app legal (A.legal not found)')
else:
    j=s.index("\n",i)
    NEW = r'''const LDOC=__LDOC__;
const LKEY={'terms & conditions':'terms','terms':'terms','privacy policy':'privacy','privacy':'privacy','cookie policy':'cookies','cookies':'cookies','refunds & disputes':'refunds','refunds':'refunds','about':'about','safety':'safety','contact':'contact'};
const lkey=a=>LKEY[String(a||'').replace(/&amp;/g,'&').toLowerCase()]||'terms';
SUB.legal=k=>{const d=LDOC[k]||LDOC.terms;
 return `${back(d.t,'Comrade Connect')}
 <div class="chips ldn">${Object.keys(LDOC).map(x=>`<button class="chip sm ${x===k?'on':''}" data-act="legalto" data-arg="${x}">${LDOC[x].t}</button>`).join('')}</div>
 <article class="ldoc">${d.i}${d.s.map((x,n)=>`<section><h2><i>${n+1}</i>${x[0]}</h2>${x[1]}</section>`).join('')}
 ${k==='safety'?'<button class="btn k" style="margin-top:18px" data-act="safety">Emergency contacts</button>':''}
 <p class="note" style="margin-top:20px">Owned and operated by Ogolla Tech, founded by Henry O. Odhiambo. <a href="${d.u}" target="_blank" rel="noopener">Open the web version</a></p></article>`};
A.legal=a=>{closeSheet();const k=lkey(a),top=S.stack[S.stack.length-1];if(top&&top.name==='legal'){top.arg=k;refresh();$('#sub').scrollTop=0}else{push('legal',k)}};
A.legalto=a=>{const top=S.stack[S.stack.length-1];if(top&&top.name==='legal'){top.arg=a;render();$('#sub').scrollTop=0}};'''.replace('__LDOC__',LDOCJSON)
    s=s[:i]+NEW+s[j:]
    LCSS = r'''/* full legal pages inside the app */
.ldn{margin-bottom:14px;flex-wrap:nowrap;overflow-x:auto}
.ldoc{font-size:14.5px;color:var(--mut);line-height:1.65}
.ldoc p{margin:8px 0}.ldoc b{color:var(--ink)}.ldoc a{color:var(--o2);font-weight:800}
.ldoc section{padding-top:20px;margin-top:20px;border-top:1px solid var(--line)}.ldoc section:first-of-type{border-top:0;margin-top:6px;padding-top:6px}
.ldoc h2{display:flex;gap:10px;align-items:flex-start;font-size:18px;line-height:1.25;letter-spacing:-.02em;color:var(--ink);margin-bottom:6px}
.ldoc h2 i{flex:none;width:26px;height:26px;border-radius:50%;background:var(--tint);color:var(--o2);font:800 12px/26px Manrope,sans-serif;text-align:center;font-style:normal}
.ldoc h3{font-size:15px;color:var(--ink);margin:14px 0 4px}
.ldoc ul,.ldoc ol{list-style:none;margin:8px 0}.ldoc li{position:relative;padding-left:20px;margin:8px 0}
.ldoc ul>li::before{content:"";position:absolute;left:2px;top:.62em;width:7px;height:7px;border-radius:50%;background:var(--o)}
.ldoc ol{counter-reset:n}.ldoc ol>li{counter-increment:n;padding-left:30px}.ldoc ol>li::before{content:counter(n);position:absolute;left:0;top:0;width:22px;height:22px;border-radius:50%;background:var(--tint);color:var(--o2);font:800 11.5px/22px Manrope,sans-serif;text-align:center}
.ldoc table{display:block;overflow-x:auto;border-collapse:collapse;margin:10px 0;font-size:13.5px}.ldoc th,.ldoc td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top;min-width:96px}.ldoc th{color:var(--ink)}
.ldoc .card{background:var(--card);border-radius:18px;padding:4px 14px;margin:10px 0;box-shadow:none}
'''
    k=s.find('\n.banner{')
    k = k+1 if k>=0 else s.index('</style>',s.index('/* app shell */'))
    s=s[:k]+LCSS+s[k:]
    open(p,'w',encoding='utf-8').write(s)
print('Section 2 done')
