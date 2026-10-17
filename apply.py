import re,io
HUB=r'''/* Me page hub: profile card, grouped menu, one panel at a time. Also the quick "Find" search in the top bar. */
(function(){
const me=$('#v-me'),h2=me&&me.querySelector('.ph');if(!me||!h2)return;
const BACK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
const IC={'Account':'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>','Recovery code':'<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l3 3M14 9l2 2"/>','Secure my account':'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>','Verification':'<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>','Restore an account':'<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/>','Messages':'<path d="M4 5h16v11H9l-5 4z"/>','Notifications':'<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>','Club':'<path d="M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18"/>','Safety':'<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>','Documentation':'<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>','Join our community':'<circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M15 15c3 0 6 1.5 6 4.5"/>','Advertise with us':'<path d="M4 10v4h3l8 4V6L7 10z"/><path d="M18 9a4 4 0 0 1 0 6"/>','Media kit':'<path d="M5 20V10M12 20V4M19 20v-7"/>','out':'<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>','d':'<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>'};
const NAME={'Secure my account':'Security'};
const DESC=()=>({'Account':ME.google?'Signed in with Google':'Anonymous. Add Google to recover it','Recovery code':'Your way back in on a new phone','Secure my account':'Fingerprint lock','Verification':'Get a verified badge','Restore an account':'Use your account ID and recovery code','Messages':'Your anonymous chats','Notifications':'Alerts and what you hear about','Club':'Wholesale student prices','Safety':'Blocked posters and safety tools','Documentation':'How Comrade Connect works'});
const GROUPS=[['Account',['Account','Recovery code','Secure my account','Verification','Restore an account']],['Activity',['Messages','Notifications','Club']],['Help and safety',['Safety','Documentation']]];
h2.insertAdjacentHTML('beforebegin','<div id="ccph"><button id="ccback" type="button" aria-label="Back to Me">'+BACK+'</button><b id="ccpt"></b></div>');
const ttl=b=>{const x=b.querySelector('h3');return x?x.textContent.trim():''};
const boxes=()=>[...me.querySelectorAll('.box')].filter(b=>!b.closest('#ccmenu')&&b.id!=='mecard'&&ttl(b));
const svg=k=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+(IC[k]||IC.d)+'</svg>';
let busy=false,lastKey='';
function mark(){if(busy)return;busy=true;boxes().forEach(b=>{if(ttl(b)!=='My dashboard')b.classList.add('ccset')});busy=false}
function titles(){const seen=[];me.querySelectorAll('.ccset').forEach(b=>{const t=ttl(b);if(t&&!seen.includes(t))seen.push(t)});return seen}
function row(t){return '<button type="button" class="mit" data-t="'+esc(t)+'"><span class="ic">'+svg(t)+'</span><span><b>'+esc(NAME[t]||t)+'</b><small>'+esc(DESC()[t]||'')+'</small></span><span class="ch" aria-hidden="true">›</span></button>'}
function renderMenu(){
 const all=titles(),key=all.join('|')+'|'+(ME.google?1:0);if(key===lastKey&&$('#ccmenu'))return;lastKey=key;
 const used=new Set();let html='';
 GROUPS.forEach(([g,list])=>{const have=list.filter(t=>all.includes(t));have.forEach(t=>used.add(t));if(have.length)html+='<div class="box g mgrp"><div class="mgl">'+g+'</div>'+have.map(row).join('')+'</div>'});
 const more=all.filter(t=>!used.has(t));if(more.length)html+='<div class="box g mgrp"><div class="mgl">More</div>'+more.map(row).join('')+'</div>';
 html+='<div class="box g mgrp"><button type="button" class="mit out" id="ccso"><span class="ic">'+svg('out')+'</span><span><b>Sign out</b><small>Remove this account from this phone</small></span><span class="ch" aria-hidden="true">›</span></button></div>';
 let box=$('#ccmenu');
 if(!box){box=document.createElement('div');box.id='ccmenu';const dash=boxes().find(b=>ttl(b)==='My dashboard');(dash||$('#mecard')||h2).after(box)}
 box.innerHTML=html;
}
function exit(){me.classList.remove('ccp');me.querySelectorAll('.ccsel').forEach(b=>b.classList.remove('ccsel'));mark();renderMenu()}
function openPanel(t){me.querySelectorAll('.ccset').forEach(b=>{if(ttl(b)===t)b.classList.add('ccsel')});$('#ccpt').textContent=NAME[t]||t;me.classList.add('ccp');scrollTo(0,0)}
me.addEventListener('click',e=>{if(e.target.closest('#ccso')){window.ccSignOut&&window.ccSignOut();return}const i=e.target.closest('.mit');if(i&&i.dataset.t)openPanel(i.dataset.t)});
$('#ccback').onclick=exit;
const so=$('#acso');if(so)so.onclick=()=>window.ccSignOut&&window.ccSignOut();
new MutationObserver(()=>{if(!busy){mark();renderMenu()}}).observe(me,{childList:true,subtree:true});
try{const o=go;go=function(v){const r=o.apply(this,arguments);if(v==='me'){exit()}return r}}catch(e){}
mark();renderMenu();
window.ccOpenMe=t=>{go('me');openPanel(t)};

/* ---- Find: one search box for every page and setting ---- */
const D=[
 ['Feed','Stories and tea','feed home stories gossip','go','feed'],['Videos','Short clips','videos clips reels','go','videos'],['Live','Live rooms and streams','live stream rooms','go','live'],
 ['Market','Buy and sell with escrow','market buy sell shop bed fridge table listing orders wallet','go','market'],['Explore','Roommates, study groups, polls, notices, events','explore rooms roommate study groups polls notices events','go','explore'],
 ['Search stories, notices and events','Open the search in Explore','search find stories notices events','srch'],['Rewards','Points, daily check-in, invite friends','rewards points check-in invite referral earn','go','rewards'],
 ['Club','Wholesale student prices','club wholesale members','go','club'],['Me','Your profile','me profile dashboard','go','me'],
 ['Account','Sign-in options, tour, cookies','account sign in google login cookie tour','me','Account'],['Sign out','Remove this account from this phone','sign out log out logout','out'],
 ['Recovery code','Your way back in','recovery code backup','me','Recovery code'],['Security','Fingerprint lock','security fingerprint lock biometric','me','Secure my account'],
 ['Verification','Get a verified badge','verification verified badge id','me','Verification'],['Restore an account','Use your account ID and recovery code','restore recover account','me','Restore an account'],
 ['Messages','Your anonymous chats','messages chats dm inbox','me','Messages'],['Notifications','Alerts and preferences','notifications alerts','me','Notifications'],
 ['Safety','Blocked posters, emergency contacts','safety emergency blocked report help police','me','Safety'],['Documentation','How Comrade Connect works','documentation guide help pdf docs','me','Documentation']
];
document.body.insertAdjacentHTML('beforeend','<div id="ccfind" role="dialog" aria-modal="true" aria-label="Find anything"><div class="fw"><div class="fh"><div class="fld"><input id="ccfq" type="search" placeholder="Find a page or setting" autocomplete="off" aria-label="Find a page or setting"></div><button type="button" class="btn g" id="ccfx">Close</button></div><div class="box g fr" id="ccfr"></div></div></div>');
const F=$('#ccfind'),fq=$('#ccfq'),fr=$('#ccfr');
function drawFind(){const q=fq.value.trim().toLowerCase();const hit=D.filter(d=>!q||(d[0]+' '+d[1]+' '+d[2]).toLowerCase().includes(q)).slice(0,12);
 fr.innerHTML=hit.length?hit.map((d,i)=>'<button type="button" class="mit'+(d[3]==='out'?' out':'')+'" data-i="'+D.indexOf(d)+'"><span class="ic">'+svg(d[3]==='out'?'out':(IC[d[0]]?d[0]:d[3]==='me'?d[4]:'d'))+'</span><span><b>'+esc(d[0])+'</b><small>'+esc(d[1])+'</small></span><span class="ch" aria-hidden="true">›</span></button>').join(''):'<p class="sub fe">Nothing matches that. Try a shorter word like "market" or "safety".</p>'}
function openFind(){F.classList.add('on');fq.value='';drawFind();setTimeout(()=>fq.focus(),50)}
const closeFind=()=>F.classList.remove('on');
$('#fnd').onclick=openFind;$('#ccfx').onclick=closeFind;fq.oninput=drawFind;
addEventListener('keydown',e=>{if(e.key==='Escape')closeFind()});
fr.addEventListener('click',e=>{const b=e.target.closest('.mit');if(!b)return;const d=D[+b.dataset.i];closeFind();
 if(d[3]==='go')go(d[4]);else if(d[3]==='me')window.ccOpenMe(d[4]);else if(d[3]==='out'){window.ccSignOut&&window.ccSignOut()}else if(d[3]==='srch'){go('explore');setTimeout(()=>{const t=document.querySelector('#xt [data-x="sr"]');if(t)t.click();const i=$('#sq');if(i)i.focus()},60)}});
})();
'''
CSS=r'''/* Me page: profile card, grouped menu, panels, quick finder */
#v-me:not(.ccp) .ccset{display:none}
#v-me.ccp .box:not(.ccsel),#v-me.ccp>.ph,#v-me.ccp>p.sub,#v-me.ccp #ccmenu,#v-me:not(.ccp) #ccpub{display:none}
#v-me.ccp #ccpub:not(:has(.ccsel)){display:none}
.mecard{display:grid;gap:16px}
.mtop{display:flex;align-items:center;gap:14px}
.mtop .av{flex:none}
.mwho{min-width:0;flex:1}
.mwho b{display:block;font-size:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mpill{display:inline-block;margin-top:8px;padding:5px 12px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid var(--line);background:color-mix(in srgb,var(--fg) 8%,transparent)}
.mstats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.mstats div{text-align:center;padding:12px 6px;border-radius:16px;background:color-mix(in srgb,var(--fg) 7%,transparent)}
.mstats b{display:block;font-size:20px;font-weight:600}
.mstats small{color:var(--mut);font-size:11px;font-weight:300}
#ccmenu{display:grid;gap:14px}
.mgrp{padding:10px 8px 6px}
.mgl{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--mut);font-weight:600;padding:2px 12px 6px}
.mit{display:grid;grid-template-columns:40px minmax(0,1fr) 14px;gap:12px;align-items:center;width:100%;min-height:60px;padding:10px 12px;border:0;border-top:1px solid var(--line);background:none;color:var(--fg);font:inherit;text-align:left;cursor:pointer;transition:background .25s;border-radius:0}
.mgl+.mit{border-top:0}
.mit:hover{background:color-mix(in srgb,var(--fg) 6%,transparent)}
.mit:focus-visible{outline:2px solid var(--fg);outline-offset:-2px}
.mit .ic{width:40px;height:40px;border-radius:13px;display:grid;place-items:center;background:color-mix(in srgb,var(--fg) 9%,transparent)}
.mit .ic svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.mit b{display:block;font-size:14px;font-weight:600}
.mit small{display:block;color:var(--mut);font-size:12px;font-weight:300;margin-top:1px}
.mit .ch{color:var(--mut);font-size:18px}
.mit.out{color:#f87171}
.mit.out small{color:color-mix(in srgb,#f87171 70%,var(--mut))}
#ccph{display:none;align-items:center;gap:12px;margin:0 0 14px}
#v-me.ccp #ccph{display:flex}
#ccph b{font-size:20px}
#ccback{width:44px;height:44px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);background:transparent;color:inherit;cursor:pointer}
#ccback svg{width:22px;height:22px}
.acl{display:grid;gap:10px;margin-top:14px}
.acl .btn{width:100%}
.acl.so{border-top:1px solid var(--line);padding-top:14px;margin-top:16px}
#acso{color:#f87171;border-color:color-mix(in srgb,#f87171 45%,transparent)}
#acso svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#ccfind{position:fixed;inset:0;z-index:9500;display:none;background:color-mix(in srgb,var(--bg) 88%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);padding:calc(16px + env(safe-area-inset-top,0px)) 16px 16px;overflow:auto}
#ccfind.on{display:block}
#ccfind .fw{max-width:560px;margin:0 auto}
#ccfind .fh{display:flex;gap:10px;align-items:center}
#ccfind .fh .fld{flex:1}
#ccfind input{width:100%}
#ccfind .fr{display:grid;gap:0;margin-top:14px;padding:6px 8px}
#ccfind .fe{padding:18px 12px}
'''
import sys,os
P=(sys.argv[1] if len(sys.argv)>1 else '.').rstrip('/')+'/'
def rd(f): return open(P+f,encoding='utf-8').read()
def wr(f,s): open(P+f,'w',encoding='utf-8').write(s)
def rep(s,old,new,count=1):
    assert s.count(old)>=1, 'missing: '+old[:70]
    return s.replace(old,new,count)

# ---------------- index.html ----------------
h=rd('frontend/index.html')

# a) welcome sheet: real Google button container
m=re.search(r'    <button class="btn g" id="siG".*?</button>\n    <p class="note" id="siGn" hidden>.*?</p>\n',h,re.S)
assert m
h=h.replace(m.group(0),'    <div id="siGb" style="display:flex;justify-content:center;margin-top:10px;min-height:44px"></div>\n    <p class="note" id="siGn" role="alert" hidden></p>\n')

# b) wiring
h=rep(h,"function resetSi(){$('#siC').hidden=true;$('#siA').hidden=false;$('#siG').hidden=false;$('#siGn').hidden=true}",
"function resetSi(){$('#siC').hidden=true;$('#siA').hidden=false;$('#siGb').style.display='flex';$('#siGn').hidden=true;if(window.ccMountSi)window.ccMountSi()}")
h=rep(h,"$('#siA').hidden=true;$('#siG').hidden=true};","$('#siA').hidden=true;$('#siGb').style.display='none';$('#siGn').hidden=true};")
h=rep(h,"$('#siG').onclick=()=>{$('#siGn').hidden=false;setTimeout(()=>openDm('sec'),1500)};","")

# c) Me profile card + recovery box
a=h.index('  <div class="box g"><div class="flex items-center gap-3"><div class="av" id="mav">')
b=h.index('  <div class="box g"><h3>My dashboard</h3>')
card='''  <div class="box g mecard" id="mecard"><div class="mtop"><div class="av" id="mav"></div><div class="mwho"><b id="mh"></b><div class="sub" id="mj"></div><span class="mpill" id="mkind">Anonymous</span></div></div><span class="badge" id="mbd" hidden></span>
   <div class="mstats"><div><b id="mpts">0</b><small>Points</small></div><div><b id="mstr">0</b><small>Day streak</small></div><div><b id="mrf">0</b><small>Referrals</small></div></div></div>
'''
h=h[:a]+card+h[b:]
# recovery code box: goes with the settings panels
rec='''  <div class="box g"><h3>Recovery code</h3><p class="sub" style="margin:6px 0 12px">It is the only way back into this account on a new phone. Save it somewhere safe and never share it.</p><div class="code" id="mcode"></div><div class="two" style="margin-top:12px"><button class="btn g" id="mshow">Show code</button><button class="btn g" id="mcopy">Copy code</button></div></div>
'''
h=rep(h,'  <div class="box g"><h3>Account</h3><p class="sub" id="acs">',rec+'  <div class="box g"><h3>Account</h3><p class="sub" id="acs">')

# d) Account box with sign out
m=re.search(r'  <div class="box g"><h3>Account</h3><p class="sub" id="acs"></p>.*?</div>\n',h,re.S)
acc='''  <div class="box g"><h3>Account</h3><p class="sub" id="acs"></p><div class="acl"><button class="btn g" id="acb">Sign-in options</button><button class="btn g" id="atour">Take the tour</button><button class="btn g" id="ckre">Cookie settings</button></div><div class="acl so"><button class="btn g" id="acso"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/></svg>Sign out</button><p class="sub">Signing out removes this account from this phone.</p></div></div>
'''
h=h.replace(m.group(0),acc)

# e) drawMe stats + account text
h=rep(h,"$('#mshow').onclick=()=>{showC=!showC;drawMe()};",
"$('#mshow').onclick=()=>{showC=!showC;drawMe()};\n{const _dm=drawMe;drawMe=function(){_dm.apply(this,arguments);try{$('#mpts').textContent=ME.pts||0;$('#mstr').textContent=ME.streak||0;$('#mrf').textContent=ME.refs||0;$('#mkind').textContent=ME.google?'Google linked':'Anonymous'}catch(e){}}}")
h=rep(h,"$('#acs').textContent='You are using an anonymous account (@'+ME.handle+'). Google sign-in is for recovery only and switches on with the backend.'}",
"$('#acs').textContent=ME.google?'Signed in with Google'+(ME.gmask?' ('+ME.gmask+')':'')+'. Your handle is @'+ME.handle+'. Your stories stay anonymous.':'You are using an anonymous account (@'+ME.handle+'). Add Google in Sign-in options so you can get back in on any phone.'}")

# f) top bar search button
h=rep(h,'<button id="sfb" class="ib"','<button id="fnd" class="ib" aria-label="Find anything"><svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></button><button id="sfb" class="ib"')

# g) replace the Me settings script
m=re.search(r'<script>\n/\* Me page settings: a gear opens a menu.*?\n</script>\n',h,re.S)
assert m
hub=HUB
h=h.replace(m.group(0),'<script>\n'+hub+'\n</script>\n')

# h) css
css=CSS
h=rep(h,'</head>','<style id="ccme-css">\n'+css+'\n</style>\n</head>')
wr('frontend/index.html',h)

# ---------------- cc-core.js ----------------
c=rd('frontend/cc-core.js')
c=rep(c,"  saveAuth({ aid: d.aid, token: d.token });\n  ME.aid = d.aid; saveMe();\n  setTimeout(() => { attributeRef(); syncVer(); }, 0);\n  return d;\n}\nasync function mountGoogle(box, onDone, onErr) {",
"""  saveAuth({ aid: d.aid, token: d.token });
  ME.aid = d.aid; ME.google = 1;
  try { const j = JSON.parse(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); if (j.email) { const [u, dom] = String(j.email).split('@'); ME.gmask = u.slice(0, 2) + '***@' + dom; } } catch (e) {}
  saveMe();
  setTimeout(() => { attributeRef(); syncVer(); }, 0);
  return d;
}
async function mountGoogle(box, onDone, onErr, opts) {""")
c=rep(c,"google.accounts.id.renderButton(box, { theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'pill', width: 280 });",
"google.accounts.id.renderButton(box, Object.assign({ theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'pill', width: 280 }, opts || {}));")
# restore via Google also marks the account
c=rep(c,"mountGoogle(m.querySelector('#ccrg'), () => { m.close(); toast('Signed in'); refreshAll(); }","mountGoogle(m.querySelector('#ccrg'), () => { m.close(); toast('Signed in'); refreshAll(); try { drawMe(); drawMe2(); } catch (e) {} }")
extra='''
/* ---------- welcome sheet Google button + sign out ---------- */
window.ccMountSi = async function () {
  const box = document.getElementById('siGb'), note = document.getElementById('siGn'); if (!box || !note) return;
  const say = (t) => { note.textContent = t; note.hidden = !t; };
  say('');
  if (!googleOn()) { box.style.display = 'none'; say('Google sign-in is not set up on this site yet. Use an anonymous account for now.'); return; }
  box.style.display = 'flex'; box.innerHTML = '<span class="note">Loading Google...</span>';
  const w = Math.max(200, Math.min(360, Math.floor((box.parentElement && box.parentElement.clientWidth) || 300) - 4));
  box.innerHTML = '';
  const ok = await mountGoogle(box, () => { toast('Signed in with Google'); try { shut(); drawMe(); drawMe2(); } catch (e) {} refreshAll(); }, (msg) => say(msg || 'Google sign-in failed. Try again.'), { theme: 'outline', width: w });
  if (!ok) say('Google sign-in could not load. Check your internet. If you opened this link inside WhatsApp, Instagram or Facebook, open it in Chrome instead.');
};
function signOut() {
  const a = window.ccAuth && window.ccAuth(), linked = !!ME.google;
  let body;
  if (linked) body = '<p class="sub" style="margin-top:6px">You are signed in with Google. You can sign back in any time with the same Google account.</p>';
  else if (a && a.aid) body = '<p class="sub" style="margin-top:6px">This is an anonymous account. After you sign out, the only way back in is your account ID and recovery code.</p>'
    + '<div class="rw" style="margin-top:12px"><span>Account ID</span><b>' + esc(a.aid) + '</b></div><button class="btn g" id="sox-cp" style="width:100%;margin-top:10px">Copy account ID</button>'
    + '<label class="sub" style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="sox-ok"> I saved my account ID and recovery code</label>';
  else body = '<p class="sub" style="margin-top:6px">This clears your handle, points and settings from this phone.</p>';
  const m = sheet('<h3>Sign out?</h3>' + body + '<div class="two" style="margin-top:14px"><button class="btn g" id="sox-x">Cancel</button><button class="btn p" id="sox-go">Sign out</button></div>');
  const go = m.querySelector('#sox-go'), ok = m.querySelector('#sox-ok');
  if (ok) { go.disabled = true; ok.onchange = () => { go.disabled = !ok.checked; }; }
  const cp = m.querySelector('#sox-cp'); if (cp) cp.onclick = () => copyText(a.aid);
  m.querySelector('#sox-x').onclick = () => m.close();
  go.onclick = async () => {
    go.disabled = true;
    try { if (connected() && a && a.token) await Promise.race([fetch(CC_API + '/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), sleep(3000)]); } catch (e) {}
    try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) {}
    try {
      const aid = a && a.aid;
      Object.keys(localStorage).forEach((k) => { if (k === 'cc_auth' || k === 'cc_pending' || k === 'cs_me' || k === 'cs_seen' || (aid && k.endsWith(':' + aid))) localStorage.removeItem(k); });
    } catch (e) {}
    toast('Signed out');
    setTimeout(() => location.reload(), 400);
  };
}
window.ccSignOut = signOut;
window.ccGoogle = { on: googleOn, mount: mountGoogle };
'''
c=rep(c,"\nwindow.CC = { ensureAccount,",extra+"\nwindow.CC = { ensureAccount,")
wr('frontend/cc-core.js',c)

# ---------------- backend: logout ----------------
b=rd('backend/src/account.js')
b=rep(b,"  // Get a new token with the recovery code",
"""  // Sign out: the token this phone was using stops working (a new one is made by Google sign-in or the recovery code).
  if (path === '/api/auth/logout' && m === 'POST') {
    const p = await authProfile(req, env);
    if (p) await patch(env, `profiles?aid=eq.${enc(p.aid)}`, { token_hash: await H(env, 'tok:' + randHex(24)) });
    return json(env, { ok: true });
  }
  // Get a new token with the recovery code""")
wr('backend/src/account.js',b)
print('patched')
