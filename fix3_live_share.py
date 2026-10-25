import sys, json, re, os
F='frontend/'
p=F+'app/index.html'
s=open(p,encoding='utf-8').read()
if 'cc-minilive' in s:
    print('Section 3 already applied'); sys.exit(0)
def rep(old,new):
    global s
    if old not in s:
        print('SKIPPED (not found):',old[:70]); return
    s=s.replace(old,new,1)

rep('</button><button class="rb dk" data-act="settings"','</button><button class="rb" data-act="theme" aria-label="Light or dark mode">${ic(isDark()?\'sun\':\'moon\')}</button><button class="rb dk" data-act="settings"')
rep('<div class="hero gb b1">','<div class="hero gb b1"><button class="livep${LIVES.length?\' on\':\'\'}" data-act="livenow" aria-label="Live now"><i></i>Live${LIVES.length?\' · \'+LIVES.length:\'\'}</button>')
rep("ls.set('cc_theme',n);toast(n==='dark'?'Dark mode':'Light mode')};","ls.set('cc_theme',n);toast(n==='dark'?'Dark mode':'Light mode');refresh()};")
rep("A.vup=function(){if(!signedIn())return need();pickClip(false)};","A.vup=function(){if(!signedIn())return need();pickClip(false)};\nwindow.CCUPLOADCLIP=uploadClip;")

rep("A.share=a=>{const t=a||'Comrade Connect';if(navigator.share){navigator.share({title:t,text:t}).catch(()=>{})}else toast('Link copied to share')};",
"""A.share=a=>{const t=a||'Comrade Connect',app=t==='Comrade Connect',url='https://comradeconnect.co.ke/get',text=app?'Join me on Comrade Connect, the campus app for Kenyan comrades. Get the app here:':t;
 if(navigator.share){navigator.share(app?{title:t,text:text,url:url}:{title:t,text:t}).catch(()=>{})}else if(app)copyText(url,'App link copied');else toast('Sharing is not available here')};""")
rep('<button class="btn o" data-act="closesheet">Download the app</button>','<button class="btn o" data-act="dlapp">Download the app</button>')

css = r'''
.livep{position:absolute;top:22px;right:22px;z-index:2;display:flex;align-items:center;gap:7px;height:34px;padding:0 14px;border-radius:999px;background:rgba(255,255,255,.9);color:#16130f;font-weight:800;font-size:12.5px;letter-spacing:.04em}
.livep i{width:9px;height:9px;border-radius:50%;background:#9a928a}.livep.on i{background:#d9334a;animation:lvp 1.4s infinite}
@keyframes lvp{50%{opacity:.35;transform:scale(1.4)}}
#sheet.mini{top:auto;left:12px;right:auto;bottom:calc(98px + env(safe-area-inset-bottom,0px));width:min(230px,58vw);max-height:none;overflow:hidden;padding:6px;border-radius:22px;box-shadow:0 16px 38px rgba(0,0,0,.4);z-index:42;transform:none}
body.desk #sheet.mini{left:24px;transform:none}
#sheet.mini>*{display:none!important}
#sheet.mini>#rm{display:grid!important;height:128px!important;border-radius:16px!important}
#sheet.mini>.ccmbar{display:flex!important}
.cctools{display:flex;gap:8px;margin:12px 0 0;flex-wrap:wrap}.ccmbar{display:none;gap:6px;margin-top:6px}
.cctools button,.ccmbar button{flex:1;height:40px;border-radius:999px;background:var(--card);box-shadow:var(--sh);font-weight:800;font-size:12.5px;padding:0 10px;white-space:nowrap}
.ccmbar button{height:34px;font-size:11.5px}
'''
k=s.find('\n.banner{')
k = k+1 if k>=0 else s.index('</style>')
s=s[:k]+css.strip()+'\n'+s[k:]

js = r'''<script>/* cc-minilive: Live buttons, mini-player, sound, and sharing into the app */
(function(){
'use strict';
var sh=document.getElementById('sheet'),bg=document.getElementById('sbg');
function mini(on){sh.classList.toggle('mini',!!on);if(on)bg.classList.remove('on');else if(sh.classList.contains('on'))bg.classList.add('on')}
var _os=openSheet;openSheet=function(){sh.classList.remove('mini');return _os.apply(this,arguments)};
var _cs=closeSheet;closeSheet=function(){sh.classList.remove('mini');return _cs.apply(this,arguments)};
A.livenow=function(){S.wTab='live';A.tab('watch')};
var _ar=A.room;
A.room=function(a){var r=_ar.apply(this,arguments),rm=document.getElementById('rm');
 if(rm&&!document.getElementById('cctools'))rm.insertAdjacentHTML('afterend','<div class="cctools" id="cctools"><button data-act="ccmin">Minimize</button><button data-act="ccfull">Full screen</button><button data-act="ccsound">Sound on</button></div><div class="ccmbar"><button data-act="ccmax">Expand</button><button data-act="ccsound">Sound</button><button data-act="closesheet">Leave</button></div>');
 return r};
A.ccmin=function(){mini(true)};A.ccmax=function(){mini(false)};
A.ccfull=function(){var rm=document.getElementById('rm');if(!rm)return;var f=rm.requestFullscreen||rm.webkitRequestFullscreen;
 if(f){try{f.call(rm)}catch(e){toast('Full screen is not available here')}}else{var v=rm.querySelector('video');if(v&&v.webkitEnterFullscreen){try{v.webkitEnterFullscreen()}catch(e){}}else toast('Full screen is not available on this phone')}};
A.ccsound=function(){var rm=document.getElementById('rm');if(!rm)return;
 var f=rm.querySelector('iframe');
 if(f&&f.src&&!f.dataset.snd){var u=f.src.replace(/([?&])mute=1/,'$1mute=0');if(!/[?&]autoplay=/.test(u))u+=(u.indexOf('?')<0?'?':'&')+'autoplay=1';if(!/[?&]mute=/.test(u))u+=(u.indexOf('?')<0?'?':'&')+'mute=0';f.dataset.snd='1';f.src=u}
 [].forEach.call(rm.querySelectorAll('video,audio'),function(m){try{m.muted=false;m.volume=1;var q=m.play();if(q&&q.catch)q.catch(function(){})}catch(e){}});
 var b=rm.querySelector('#rav button');if(b)b.click();
 toast('Sound on. Still silent? Raise your phone volume.')};

try{if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}catch(e){}
A.dlapp=function(){closeSheet();window.open('https://comradeconnect.co.ke/get','_blank','noopener')};
var LINK='';
A.sharelive=function(){closeSheet();S.wTab='live';A.tab('watch');setTimeout(function(){var u=document.getElementById('lu'),t=document.getElementById('lt');if(u)u.value=LINK;if(t)t.focus()},250)};
function show(m,f,link){
 if(f&&/^video\//.test(f.type||m.type||'')){
  var url=URL.createObjectURL(f);S.wTab='clips';A.tab('watch');
  openSheet('Share to Comrade Connect','<video src="'+url+'" controls playsinline style="width:100%;border-radius:18px;max-height:42vh;background:#000"></video><div class="fld" style="margin-top:12px"><label>Caption (optional)</label><input class="in" id="shcap" maxlength="140" placeholder="Add a caption"></div><button class="btn o" id="shgo">Post as a clip</button><p class="note">Clips must be MP4 or WebM and under 25 MB.</p>',function(x){
   document.getElementById('shgo').onclick=function(){var v=document.getElementById('vcap');if(v)v.value=(document.getElementById('shcap').value||'').trim();closeSheet();
    if(window.CCUPLOADCLIP)CCUPLOADCLIP(new File([f],m.name||'clip.mp4',{type:f.type||m.type||'video/mp4'}))}});return}
 if(f){toast('Only videos can be shared into Comrade Connect for now');return}
 if(link){LINK=link;var tk=/tiktok\.com/i.test(link);
  openSheet('Link shared with you','<p class="sub1" style="margin-bottom:10px;overflow-wrap:anywhere">'+esc(link)+'</p>'+(tk?'<p class="note" style="margin-bottom:12px">TikTok only shares a link, not the video file. To post the video itself, save it to your gallery, then share it from the gallery to Comrade Connect.</p>':'')+'<button class="btn o" data-act="sharelive">I am live: use as my live link</button><button class="btn w" style="margin-top:10px" data-act="closesheet">Not now</button>')}}
async function take(){
 if(!/[?&]shared=1/.test(location.search)||!window.caches)return;
 var m=null,f=null;
 try{var c=await caches.open('cc-share'),r=await c.match('/shared-meta');if(r)m=await r.json();var fr=await c.match('/shared-file');if(fr)f=await fr.blob();
  var ks=await c.keys();for(var i=0;i<ks.length;i++)await c.delete(ks[i])}catch(e){}
 try{history.replaceState(null,'',location.pathname)}catch(e){}
 if(!m)return;
 var link=(m.url||((m.text||'').match(/https?:\/\/\S+/)||[''])[0]||'').trim();
 setTimeout(function(){show(m,f,link)},900)}
take();
})();
</script>
'''
k=s.rindex('</body>')
s=s[:k]+js+s[k:]
open(p,'w',encoding='utf-8').write(s)

get = r'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Get Comrade Connect | The campus app for Kenyan comrades</title><meta name="description" content="Download Comrade Connect for Android, or open it in your browser.">
<link rel="canonical" href="https://comradeconnect.co.ke/get"><link rel="manifest" href="/site.webmanifest"><meta name="theme-color" content="#fbf1ed">
<meta property="og:type" content="website"><meta property="og:title" content="Get Comrade Connect"><meta property="og:description" content="The anonymous campus feed, safe marketplace and more for Kenyan comrades."><meta property="og:image" content="https://comradeconnect.co.ke/og-image.png"><meta property="og:url" content="https://comradeconnect.co.ke/get">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/cc-doc.css?v=1"><script src="/cc-doc.js?v=1"></script>
<style>.dl{display:flex;align-items:center;justify-content:center;gap:10px;height:56px;border-radius:999px;font-weight:800;font-size:16px;text-decoration:none;margin:14px 0 6px;background:linear-gradient(135deg,#ffa05a,#ee7a4f);color:#1d0f06!important;box-shadow:0 10px 24px rgba(238,122,79,.3)}.dl.alt{background:var(--card);color:var(--ink)!important;box-shadow:none;border:1px solid var(--line)}.pf{display:none}.pf.on{display:block}</style></head>
<body>
<header><a class="brand" href="/">COMRADE CONNECT</a><a class="cta" href="/">Open in browser</a></header>
<main>
<h1>Get Comrade Connect</h1>
<p>The anonymous campus feed, a safe marketplace with escrow, hostels, roommates and more, made for Kenyan comrades.</p>

<div class="pf" id="p-android">
<a class="dl" id="apk" href="https://github.com/specialpanda26-sudo/comradeconnect-releases/releases/latest/download/comrade-connect.apk" rel="noopener">Download for Android</a>
<h2>Install in 3 steps</h2>
<ol><li>Tap Download. When it finishes, tap <b>Open</b> on the download notice, or find <b>comrade-connect.apk</b> in Files &gt; Downloads.</li><li>If your phone asks, allow installs from this source. This is normal for apps outside the Play Store.</li><li>Open Comrade Connect and sign in.</li></ol>
<a class="dl alt" href="/">Or use it in your browser, nothing to install</a>
</div>

<div class="pf" id="p-ios">
<h2>Add it to your iPhone</h2>
<ol><li>Open <b>comradeconnect.co.ke</b> in Safari.</li><li>Tap the Share button, then <b>Add to Home Screen</b>.</li><li>Open Comrade Connect from your home screen.</li></ol>
<a class="dl" href="/">Open Comrade Connect</a>
</div>

<div class="pf" id="p-pc">
<a class="dl" href="/">Open Comrade Connect</a>
<h2>Computer apps</h2>
<ul><li><a href="https://github.com/specialpanda26-sudo/comradeconnect-releases/releases/download/desktop-latest/comrade-connect-setup.exe" rel="noopener">Windows</a></li><li><a href="https://github.com/specialpanda26-sudo/comradeconnect-releases/releases/download/desktop-latest/comrade-connect-arm64.dmg" rel="noopener">Mac (Apple chip)</a> and <a href="https://github.com/specialpanda26-sudo/comradeconnect-releases/releases/download/desktop-latest/comrade-connect-x64.dmg" rel="noopener">Mac (Intel)</a></li><li><a href="https://github.com/specialpanda26-sudo/comradeconnect-releases/releases/download/desktop-latest/comrade-connect.AppImage" rel="noopener">Linux</a></li></ul>
</div>

<p class="note">Anonymous means anonymous. Your handle is never shown on your stories.</p>
</main>
<footer><a href="/terms.html">Terms</a><a href="/privacy.html">Privacy</a><a href="/safety.html">Safety</a><a href="/contact.html">Contact</a><a href="/about.html">About</a></footer>
<script>(function(){var u=navigator.userAgent||'',k=/Android/i.test(u)?'android':(/iPhone|iPad|iPod/i.test(u)?'ios':'pc');document.getElementById('p-'+k).className='pf on'})();</script>
<script src="/cc-pagebar.js?v=1"></script>
</body></html>
'''
open(F+'get.html','w',encoding='utf-8').write(get)
r=open(F+'_redirects',encoding='utf-8').read() if os.path.exists(F+'_redirects') else ''
if '/get ' not in r: open(F+'_redirects','w',encoding='utf-8').write(r.rstrip('\n')+'\n/get /get.html 200\n')

mp=F+'site.webmanifest'; m=json.load(open(mp,encoding='utf-8'))
m['share_target']={'action':'/share-target','method':'POST','enctype':'multipart/form-data','params':{'title':'title','text':'text','url':'url','files':[{'name':'media','accept':['video/*']}]}}
json.dump(m,open(mp,'w',encoding='utf-8'),indent=2,ensure_ascii=False)
sp=F+'sw.js'; w=open(sp,encoding='utf-8').read()
if 'ccShare' not in w:
    w=w.replace("  if (req.method !== 'GET' || req.headers.has('range')) return;","  if (req.method === 'POST' && new URL(req.url).pathname === '/share-target') { e.respondWith(ccShare(req)); return; }\n  if (req.method !== 'GET' || req.headers.has('range')) return;",1)
    w+='''
const SHARE_HOME = '/app/';   // where shared things open. Change to '/' once the new app is the main page.
async function ccShare(req) {
  try {
    const fd = await req.formData(), file = fd.get('media'), c = await caches.open('cc-share');
    for (const k of await c.keys()) await c.delete(k);
    const meta = { title: String(fd.get('title') || ''), text: String(fd.get('text') || ''), url: String(fd.get('url') || ''), name: (file && file.name) || '', type: (file && file.type) || '', size: (file && file.size) || 0 };
    await c.put('/shared-meta', new Response(JSON.stringify(meta), { headers: { 'content-type': 'application/json' } }));
    if (file && file.size) await c.put('/shared-file', new Response(file, { headers: { 'content-type': file.type || 'video/mp4' } }));
  } catch (x) {}
  return Response.redirect(SHARE_HOME + '?shared=1', 303);
}
'''
    open(sp,'w',encoding='utf-8').write(w)
print('Section 3 done')
