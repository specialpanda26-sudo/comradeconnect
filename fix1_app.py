import sys
p='frontend/app/index.html'
s=open(p,encoding='utf-8').read()
if 'A.bannergo=' in s:
    print('Section 1 already applied'); sys.exit(0)
def rep(old,new):
    global s
    if old not in s:
        print('SKIPPED (not found):',old[:70]); return
    s=s.replace(old,new,1)

rep('''${S.banner?`<div class="banner"><span>${esc(S.banner)}</span><button data-act="bannerx" aria-label="Dismiss">${ic('x','s')}</button></div>`:''}''',
    '''${S.banner?`<div class="banner" data-act="bannergo" role="button" tabindex="0"><span>${esc(S.banner)}</span><button type="button" class="bx" data-act="bannerx" aria-label="Dismiss">${ic('x','s')}</button></div>`:''}''')
rep("A.bannerx=()=>{S.banner='';refresh()};",
'''A.bannerx=()=>{try{localStorage.setItem('cc_banner_x',S.banner||'')}catch(e){}S.banner='';refresh()};
A.bannergo=()=>{const t=(S.banner||'').toLowerCase();
 if(/hostel|vacan|room/.test(t))return A.sec('hostels');
 if(/market|escrow|sale|buy|sell|shop/.test(t))return go('market');
 if(/event|ticket/.test(t))return A.sec('events');
 if(/live|stream/.test(t)){S.wTab='live';return go('watch')}
 if(/kura|vote|award/.test(t))return A.kura();
 if(/reward|point|streak/.test(t))return A.rewards();
 return A.bell()};
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('[role=button][data-act]')){e.preventDefault();e.target.click()}});''')
rep('.banner{display:flex;align-items:center;gap:10px;justify-content:space-between;background:linear-gradient(135deg,#ffa05a,#ee7a4f);color:#1d0f06;border-radius:20px;padding:13px 16px;font-weight:800;font-size:13px;margin-bottom:14px}',
    '.banner{cursor:pointer;display:flex;align-items:center;gap:10px;justify-content:space-between;background:linear-gradient(135deg,#ffa05a,#ee7a4f);color:#1d0f06;border-radius:20px;padding:6px 6px 6px 16px;font-weight:800;font-size:13px;margin-bottom:14px;min-height:50px}.banner span{flex:1;padding:6px 0}.banner .bx{flex:none;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:rgba(29,15,6,.12);color:#1d0f06}.banner .bx:active{transform:scale(.92)}')
rep("var _bx=A.bannerx;\nA.bannerx=function(){try{localStorage.setItem(KEY,S.banner||'')}catch(e){}if(_bx)_bx.apply(this,arguments);else{S.banner='';refresh()}};","")
rep("function dismissed(t){try{return localStorage.getItem(KEY)===t}catch(e){return false}}","function dismissed(t){try{return (localStorage.getItem(KEY)||'').trim()===String(t).trim()}catch(e){return false}}")

rep('''<div class="promo gb b2"><div><b>Pay safe, get 5 points</b>''','''<div class="promo gb b2" data-act="escrowinfo" role="button" tabindex="0" aria-label="How escrow protects you"><div><b>Pay safe, get 5 points</b>''')
rep("A.shopnow=()=>{S.mkView='near';refresh();toast('Tap + on anything to add it to your cart')};",
'''A.shopnow=()=>{if(S.tab!=='market'||S.stack.length){S.stack=[];S.tab='market'}S.mkTab='browse';S.mkView='grid';render();const el=$('#v-market');if(el)el.scrollTop=0;setTimeout(()=>{const v=$('#v-market .vt');if(v&&el)el.scrollTo({top:Math.max(0,v.offsetTop-12),behavior:'smooth'})},80);toast('Tap + on anything to add it to your cart')};
A.escrowinfo=()=>openSheet('How escrow protects you',`<p class="sub1" style="margin-bottom:12px">Your money is held safely. The seller only gets paid after you have the item.</p><ol class="prog" style="gap:10px;margin-bottom:12px">${['You pay. The money is held in escrow, not sent to the seller.','You meet the seller on campus and check the item.','Give the seller your 6-digit code only when you are happy.','The seller is paid. Problem? Open a dispute and an admin reviews it.'].map(t=>`<li class="done" style="color:var(--ink)"><i style="width:26px;height:26px">${ic('check','s')}</i>${t}</li>`).join('')}</ol><p class="note" style="margin-bottom:14px">Your first escrow purchase earns you 5 points. Admins watch the Market and remove anything unsafe.</p><button class="btn o" data-act="escrowgo">Shop now</button><button class="btn w" style="margin-top:10px" data-act="legal" data-arg="Refunds &amp; disputes">Refunds and disputes</button>`);
A.escrowgo=()=>{closeSheet();A.shopnow()};''')

rep('''<div class="seg"><button class="${S.wTab==='clips'?'on':''}" data-act="wtab" data-arg="clips">Videos</button><button class="${S.wTab==='live'?'on':''}" data-act="wtab" data-arg="live">Live</button></div>''',
'''<div class="seg"><button class="${S.wTab==='clips'?'on':''}" data-act="wtab" data-arg="clips">Videos</button><button class="${S.wTab==='live'?'on':''}" data-act="wtab" data-arg="live">Live</button></div>
<button class="btn o" id="glb" data-act="golivejump" style="margin-bottom:16px">${ic('video','s')} Go live</button>''')
rep("A.wtab=a=>{S.wTab=a;refresh()};",
'''A.wtab=a=>{S.wTab=a;refresh()};
A.golivejump=()=>{if(S.wTab!=='live')A.wtab('live');setTimeout(()=>{const e=$('#lt');if(e){e.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>{try{e.focus({preventScroll:true})}catch(x){}},350)}},120)};''')

open(p,'w',encoding='utf-8').write(s)
print('Section 1 done')
