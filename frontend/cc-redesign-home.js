/* cc-redesign-home.js v1 (section 3): Home like the redesign. Hero (icon, big "Spill it.", link tour), countdown badges,
   story rings, "Around campus" tiles, Campus pulse and "Latest on campus" headings, poll bars, leaderboard. */
(function(){'use strict';
if(window.__crdHome)return;window.__crdHome=1;
var CSS='\
#v-feed .hero{display:flex;flex-direction:column;min-height:372px}\
#v-feed .hero .crd-hi{width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.85);display:grid;place-items:center;margin-bottom:14px;color:#16130f}\
#v-feed .hero h1{font-size:46px!important;margin:0}\
#v-feed .hero .crd-h1b{font-size:14px;margin:8px 0 0;font-weight:700}\
#v-feed .hero>p:not(.gr):not(.crd-h1b){font-size:12px;opacity:.85;margin:auto 0 0;padding-top:18px;max-width:310px}\
#v-feed .hero>div{margin-top:14px!important;display:flex;flex-direction:column;gap:6px;align-items:center}\
#v-feed .hero #tpill{background:none!important;box-shadow:none!important;height:auto;padding:8px;text-decoration:underline;text-underline-offset:4px;font-size:13px;color:#16130f}\
#v-feed #cd{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0}\
#v-feed #cd>*{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;background:rgba(255,138,61,.13);color:var(--fg);font-size:12px;font-weight:800;box-shadow:none;border:0}\
#ccs-tray .ccs-ring{background:conic-gradient(#ff8a3d,#c4727a,#a9b8a2,#ff8a3d)!important;border:0!important}\
#ccs-tray .ccs-ring.add{background:var(--line)!important}\
#ccs-tray .ccs-lb{font-weight:700;font-size:11px;color:var(--fg)}\
#ccs-tray .ccs-hint{color:var(--mut);font-size:12px}\
.crd-sec{display:flex;justify-content:space-between;align-items:baseline;margin:26px 0 12px}\
.crd-sec h2{font-size:17px;font-weight:800;letter-spacing:-.01em;margin:0}\
.crd-sec button{font-size:13px;font-weight:700;background:none;border:0;color:var(--fg)}\
.crd-hs{display:flex;gap:14px;overflow-x:auto;margin:0 -2px;padding:2px 2px 14px;scrollbar-width:none}.crd-hs::-webkit-scrollbar{display:none}\
.crd-tile{position:relative;overflow:hidden;isolation:isolate;flex:none;width:200px;min-height:200px;border-radius:32px;padding:16px;display:flex;flex-direction:column;justify-content:flex-end;text-align:left;box-shadow:var(--sh);color:#16130f;border:0;background:#fff8f4}\
.crd-tile::before{content:"";position:absolute;inset:-25%;z-index:-1;filter:blur(30px);opacity:.95;background:var(--bl)}\
.crd-tile .ic{position:absolute;top:14px;left:14px;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.92);display:grid;place-items:center}\
.crd-tile b{font-size:18px;letter-spacing:-.02em;font-weight:800;display:block}.crd-tile small{font-size:12px;font-weight:600;opacity:.8;display:block;margin-top:2px}\
.crd-b1{--bl:radial-gradient(42% 52% at 24% 38%,#ff8a3d 0,transparent 72%),radial-gradient(44% 52% at 80% 60%,#c4727a 0,transparent 72%),radial-gradient(40% 40% at 45% 95%,#ffd9b8 0,transparent 72%)}\
.crd-b2{--bl:radial-gradient(45% 50% at 20% 30%,#a9b8a2 0,transparent 72%),radial-gradient(45% 50% at 80% 75%,#c4727a 0,transparent 72%),radial-gradient(40% 40% at 70% 15%,#ffd9b8 0,transparent 72%)}\
.crd-b3{--bl:radial-gradient(45% 55% at 25% 70%,#c4727a 0,transparent 72%),radial-gradient(50% 50% at 78% 35%,#ff8a3d 0,transparent 72%),radial-gradient(40% 40% at 50% 5%,#ffe7d2 0,transparent 72%)}\
.crd-b4{--bl:radial-gradient(48% 50% at 75% 25%,#ffd9b8 0,transparent 72%),radial-gradient(48% 50% at 30% 80%,#ff8a3d 0,transparent 72%),radial-gradient(40% 40% at 90% 90%,#a9b8a2 0,transparent 72%)}\
.crd-b5{--bl:radial-gradient(45% 55% at 20% 25%,#ff8a3d 0,transparent 72%),radial-gradient(45% 55% at 85% 80%,#a9b8a2 0,transparent 72%),radial-gradient(40% 40% at 60% 40%,#c4727a 0,transparent 72%)}\
#v-feed{padding-left:18px!important;padding-right:18px!important}\
#v-feed .pulse{padding:0!important;margin:0!important}\
#v-feed .pcard{margin:0 0 14px!important}\
html body #v-feed #tabs button.cct.cct.cct{width:auto!important;height:44px!important;border-radius:999px!important;padding:0 16px!important;background:var(--g)!important}\
html body #v-feed #tabs .cct-i{display:none!important}\
html body #v-feed #tabs .cct-l{position:static!important;display:block;line-height:44px;color:var(--fg)!important;font:700 13px Manrope,sans-serif!important}\
html body #v-feed #tabs button.cct.on{background:var(--ink)!important}html body #v-feed #tabs button.cct.on .cct-l{color:var(--inkfg)!important}\
html body .pulse .pcard h3{font-size:19px}\
html body .opt{position:relative;overflow:hidden;height:50px;border-radius:18px;background:rgba(196,114,122,.22);border:0;display:flex;align-items:center;padding:0 16px;font-weight:800;font-size:14px;margin-bottom:10px;width:100%;text-align:left;color:var(--fg)}\
html body .opt i{position:absolute;inset:0 auto 0 0;background:rgba(255,138,61,.55);border-radius:18px 0 0 18px}\
html body .opt span{position:relative;z-index:1}\
html body .lb{display:flex;align-items:center;gap:14px;padding:13px 0;border-top:1px solid var(--line)}\
html body .lb>b{font-size:26px;font-weight:800;color:var(--cco2);width:26px;letter-spacing:-.04em}\
html body .lb>span{flex:1;font-weight:800;font-size:15px}html body .lb small{display:block;color:var(--mut);font-size:11px;font-weight:600}\
html body .lb>em{font-style:normal;font-weight:800;font-size:15px}\
html body .cc-chipwrap .ccc-chip{background:var(--g);box-shadow:var(--sh);border:0;border-radius:999px;font-weight:700;font-size:12px;padding:8px 14px;color:var(--fg)}\
html body section.ccwb{position:relative;overflow:hidden;isolation:isolate;border-radius:28px;color:#16130f;background:#fff8f4}\
html body section.ccwb::before{content:"";position:absolute;inset:-25%;z-index:-1;filter:blur(30px);opacity:.95;background:radial-gradient(48% 50% at 75% 25%,#ffd9b8 0,transparent 72%),radial-gradient(48% 50% at 30% 80%,#ff8a3d 0,transparent 72%),radial-gradient(40% 40% at 90% 90%,#a9b8a2 0,transparent 72%)}';
var st=document.createElement('style');st.id='cc-redesign-home-css';st.textContent=CSS;document.head.appendChild(st);
var $=function(s,r){return(r||document).querySelector(s)};
var I=function(p){return '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>'};
var ICO={mega:'<path d="M4 14V10l12-5v14L4 14z"/><path d="M7 14l1 5h3l-1-4.5"/>',bed:'<path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/>',bag:'<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',tix:'<path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3z"/>',wifi:'<path d="M5 12a10 10 0 0 1 14 0M8 15a6 6 0 0 1 8 0"/><circle cx="12" cy="19" r="1"/>',gift:'<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M12 9v11M3 13h18M12 9C9 9 8 4 11 4s1 5 1 5zm0 0c3 0 4-5 1-5s-1 5-1 5z"/>'};
var go=function(v){var b=$('#tb button[data-v="'+v+'"]');if(b)b.click()};
var xgo=function(x){go('explore');setTimeout(function(){var b=$('#xt [data-x="'+x+'"]');if(b)b.click()},80)};
function hero(){
 var h=$('#v-feed .hero');if(!h)return;
 if(!$('.crd-hi',h)){var d=document.createElement('span');d.className='crd-hi';d.innerHTML=I(ICO.mega);h.insertBefore(d,h.firstChild)}
 var t=$('h1',h);if(t&&!$('.crd-h1b',h)){var m=(t.textContent||'').match(/^(.{2,40}?\.)\s+(.+)$/);
  if(m){t.textContent=m[1];var p=document.createElement('p');p.className='crd-h1b';p.textContent=m[2];t.after(p)}}
}
function around(){
 var pu=$('#v-feed .pulse');if(!pu)return;
 if(!$('#crd-around')){
  var w=document.createElement('div');w.id='crd-around';
  var T=[['Hostels','Vacancies and services','bed','b1',function(){xgo('hs')}],['Market','Buy and sell safely','bag','b2',function(){go('market')}],['Events','Tickets and notices','tix','b4',function(){xgo('ev')}],['Wi-Fi spots','Near you','wifi','b3',function(){xgo('wf')}],['Rewards','Points and perks','gift','b5',function(){go('rewards')}]];
  w.innerHTML='<div class="crd-sec"><h2>Around campus</h2><button type="button" id="crd-all">View All</button></div><div class="crd-hs"></div>';
  var hs=$('.crd-hs',w);
  T.forEach(function(x){var b=document.createElement('button');b.type='button';b.className='crd-tile crd-'+x[3];b.innerHTML='<span class="ic">'+I(ICO[x[2]])+'</span><b>'+x[0]+'</b><small>'+x[1]+'</small>';b.onclick=x[4];hs.appendChild(b)});
  $('#crd-all',w).onclick=function(){go('explore')};
  pu.parentNode.insertBefore(w,pu);
  var s=document.createElement('div');s.className='crd-sec';s.innerHTML='<h2>Campus pulse</h2>';pu.parentNode.insertBefore(s,pu);
 }
 var z=$('#zones');if(z&&!$('#crd-latest')){var l=document.createElement('div');l.id='crd-latest';l.className='crd-sec';l.innerHTML='<h2>Latest on campus</h2>';z.parentNode.insertBefore(l,z)}
}
function run(){hero();around()}
function start(){run();var n=0,iv=setInterval(function(){run();if(++n>24)clearInterval(iv)},500);
 var h=$('#v-feed .hero');if(h)new MutationObserver(function(){hero()}).observe(h,{childList:true,characterData:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
