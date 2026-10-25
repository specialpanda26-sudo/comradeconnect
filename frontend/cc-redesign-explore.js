/* cc-redesign-explore.js v1 (section 5): Explore like the redesign.
   Header with round search button, gradient tiles with a round icon + subtitle, tapping a tile opens that section as its own
   page with a back button, "More from Comrade Connect" rows, and redesign cards, chips, polls and forms inside every section
   (Hostels, Roommates, Study groups, Wi-Fi, Services, Polls, Events, Notices, Papers, Lost and Found, Land spots, Hearts, Top spills, Study hub).
   Old code is untouched: tiles still carry data-x and the page's own click handlers still run. */
(function(){'use strict';
if(window.__crdExplore)return;window.__crdExplore=1;
var CSS='\
html body .bg::after{display:none!important}\
html body .ph,html body h2,html body h3{font-family:Manrope,system-ui,-apple-system,sans-serif}\
html body #v-explore #xt button.cct span::before,html body #v-explore #xt button.cct span::after{display:none!important}\
html body #v-explore{position:relative}\
html body #v-explore .crd-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:6px 0 18px}\
html body #v-explore .crd-hd .ph{margin:0}\
html body #v-explore .crd-hd .sub{margin:4px 0 0;max-width:270px}\
html body #v-explore .crd-hd .ib{flex:none}\
/* tiles */\
html body #v-explore #xt.cct-row{display:grid!important;grid-template-columns:1fr 1fr;gap:14px!important;overflow:visible;padding:0!important;margin:0 0 6px}\
html body #v-explore #xt .cczadd{display:none!important}\
html body #v-explore #xt button.cct.cct.cct{width:100%!important;height:auto!important;min-height:172px;border-radius:32px!important;overflow:hidden!important}\
html body #v-explore #xt button.cct .cct-i{background:var(--crdbl),#fff8f4!important}\
html body #v-explore #xt button.cct .cct-i::after{display:none!important}\
html body #v-explore #xt button.cct .cct-l{left:16px!important;right:12px!important;bottom:34px!important;font:800 18px/1.1 Manrope,sans-serif!important;letter-spacing:-.02em;color:#16130f!important;text-align:left!important;white-space:normal!important;overflow:visible!important}\
html body #v-explore #xt button.cct .crd-xs{position:absolute;z-index:2;left:16px;right:12px;bottom:15px;font:600 12px/1.2 Manrope,sans-serif;color:#16130f;opacity:.8;text-align:left}\
html body #v-explore #xt button.cct .crd-xi{position:absolute;z-index:2;top:14px;left:14px;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.92);display:grid;place-items:center;color:#16130f}\
html body #v-explore #xt button.cct .crd-xi svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}\
html body #v-explore #xt button.cct.on{box-shadow:var(--sh)!important}\
html body #v-explore #xt button.cct.on::after{display:none!important}\
html body #v-explore #xt button.crdx1{--crdbl:radial-gradient(42% 52% at 24% 38%,#ff8a3d 0,transparent 72%),radial-gradient(44% 52% at 80% 60%,#c4727a 0,transparent 72%),radial-gradient(40% 40% at 45% 95%,#ffd9b8 0,transparent 72%)}\
html body #v-explore #xt button.crdx2{--crdbl:radial-gradient(45% 50% at 20% 30%,#a9b8a2 0,transparent 72%),radial-gradient(45% 50% at 80% 75%,#c4727a 0,transparent 72%),radial-gradient(40% 40% at 70% 15%,#ffd9b8 0,transparent 72%)}\
html body #v-explore #xt button.crdx3{--crdbl:radial-gradient(45% 55% at 25% 70%,#c4727a 0,transparent 72%),radial-gradient(50% 50% at 78% 35%,#ff8a3d 0,transparent 72%),radial-gradient(40% 40% at 50% 5%,#ffe7d2 0,transparent 72%)}\
html body #v-explore #xt button.crdx4{--crdbl:radial-gradient(48% 50% at 75% 25%,#ffd9b8 0,transparent 72%),radial-gradient(48% 50% at 30% 80%,#ff8a3d 0,transparent 72%),radial-gradient(40% 40% at 90% 90%,#a9b8a2 0,transparent 72%)}\
html body #v-explore #xt button.crdx5{--crdbl:radial-gradient(45% 55% at 20% 25%,#ff8a3d 0,transparent 72%),radial-gradient(45% 55% at 85% 80%,#a9b8a2 0,transparent 72%),radial-gradient(40% 40% at 60% 40%,#c4727a 0,transparent 72%)}\
html[data-theme="dark"] body #v-explore #xt button.cct .cct-i{background:var(--crdbl),#2a211b!important}\
/* order like the redesign */\
html body #v-explore #xt [data-x=hs]{order:1}html body #v-explore #xt [data-x=rm]{order:2}html body #v-explore #xt [data-x=sg]{order:3}html body #v-explore #xt [data-x=wf]{order:4}html body #v-explore #xt [data-x=sv]{order:5}html body #v-explore #xt [data-x=pl]{order:6}html body #v-explore #xt [data-x=ev]{order:7}html body #v-explore #xt [data-x=nt]{order:8}html body #v-explore #xt [data-x=lf]{order:9}html body #v-explore #xt [data-x=pp]{order:10}html body #v-explore #xt [data-x=ls]{order:11}html body #v-explore #xt [data-x=ht]{order:12}html body #v-explore #xt [data-x=top]{order:13}html body #v-explore #xt [data-x=sn]{order:14}html body #v-explore #xt [data-x=sr]{order:15}\
/* grid versus opened section */\
html body #v-explore .crd-open-only{display:none}\
html body #v-explore.crd-in .crd-open-only{display:block}\
html body #v-explore.crd-in .crd-hd,html body #v-explore.crd-in #xt,html body #v-explore.crd-in .crd-more{display:none!important}\
html body #v-explore:not(.crd-in) #xbody{display:none!important}\
html body #v-explore .crd-sh{margin:2px 0 14px}\
html body #v-explore .crd-sh h2{font-size:34px;font-weight:800;letter-spacing:-.035em;line-height:1.05;margin:0}\
html body #v-explore .crd-sh p{margin:4px 0 0;color:var(--mut);font-size:13px}\
html body #v-explore .crd-more .crd-row{margin:0 0 10px}\
html body #v-explore .crd-ri{width:42px;height:42px;border-radius:14px;background:rgba(255,138,61,.13);display:grid;place-items:center;flex:none}\
html body #v-explore .crd-ri svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}\
html body #v-explore .crd-rx{flex:1;min-width:0}\
/* inside a section: cards, badges, buttons, chips, forms, polls */\
html body #v-explore #xbody{display:grid;gap:12px}\
html body #v-explore #xbody>p.sub,html body #v-explore #xbody .sub{color:var(--mut);font-size:13px}\
html body #v-explore #xbody article.box,html body #v-explore #xbody .box.g,html body #v-explore #xbody .mc,html body #v-explore #xbody .cxe,html body #v-explore #xbody .cxn{border-radius:28px;padding:18px;background:var(--g);box-shadow:var(--sh);border:0}\
html body #v-explore #xbody .box.g:not(article):first-child{background:rgba(255,138,61,.13)}\
html body #v-explore #xbody article.box b,html body #v-explore #xbody article.box h3{font-weight:800;letter-spacing:-.01em}\
html body #v-explore #xbody .badge{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:999px;background:rgba(255,138,61,.13);font-size:11px;font-weight:800;color:var(--fg);border:0;box-shadow:none}\
html body #v-explore #xbody .bar{display:flex;flex-wrap:wrap;gap:8px;background:none;border:0;box-shadow:none;padding:0;border-radius:0}\
html body #v-explore #xbody .act,html body #v-explore #xbody a.act{display:inline-flex;align-items:center;justify-content:center;height:38px;padding:0 15px;border-radius:999px;background:rgba(255,138,61,.13);color:var(--fg);font-weight:800;font-size:12px;border:0;box-shadow:none;text-decoration:none}\
html body #v-explore #xbody .act.liked,html body #v-explore #xbody .act.on{background:var(--ink);color:var(--inkfg)}\
html body #v-explore #xbody .act.wa{background:linear-gradient(135deg,#ffa05a,#ee7a4f);color:#1d0f06}\
html body #v-explore #xbody .views{display:inline-flex;align-items:center;font-size:12px;font-weight:700;color:var(--mut);padding:0 4px}\
html body #v-explore #xbody .btn{width:100%}\
html body #v-explore #xbody .btn.p{background:var(--ink);color:var(--inkfg)}\
html body #v-explore #xbody .tabs{display:flex;gap:10px;overflow-x:auto;padding:2px 20px 8px!important;margin:0 -20px;scrollbar-width:none;flex-wrap:nowrap}\
html body #v-explore #xbody .tabs::-webkit-scrollbar{display:none}\
html body #v-explore #xbody .tabs .tab{flex:none;padding:11px 18px;border-radius:999px;background:var(--g);box-shadow:var(--sh);font-weight:700;font-size:13px;white-space:nowrap;border:0;color:var(--fg)}\
html body #v-explore #xbody .tabs .tab.on{background:var(--ink);color:var(--inkfg)}\
html body #v-explore #xbody .fld{margin:0}\
html body #v-explore #xbody .fld input,html body #v-explore #xbody .fld textarea,html body #v-explore #xbody .fld select,html body #v-explore #xbody article select,html body #v-explore #xbody article input{width:100%;border-radius:999px;padding:0 20px;font:600 14px Manrope,sans-serif;color:var(--fg);border:0}\
html body #v-explore #xbody .fld textarea,html body #v-explore #xbody article textarea{height:110px;border-radius:24px;padding:14px 20px;background:var(--g);border:0;box-shadow:var(--sh);width:100%}\
html body #v-explore #xbody article input,html body #v-explore #xbody article select{margin:0;box-shadow:none;background:rgba(22,19,15,.05)}\
html[data-theme="dark"] body #v-explore #xbody article input,html[data-theme="dark"] body #v-explore #xbody article select{background:rgba(255,255,255,.08)}\
html body #v-explore #xbody .opt{position:relative;height:50px;border-radius:18px;background:rgba(196,114,122,.22);overflow:hidden;display:flex;align-items:center;padding:0 16px;font-weight:800;font-size:14px;margin:10px 0 0;width:100%;text-align:left;border:0;color:var(--fg);box-shadow:none}\
html body #v-explore #xbody .opt i{position:absolute;inset:0 auto 0 0;background:var(--ink);opacity:.9;border-radius:18px 0 0 18px;transition:width .5s}\
html body #v-explore #xbody .opt span{position:relative;z-index:1;color:var(--fg)}\
html body #v-explore #xbody .opt:disabled{opacity:1}\
html body #v-explore #xbody .opt:disabled i+span{color:var(--inkfg)}\
html body #v-explore #xbody .empty{padding:36px 10px;text-align:center;color:var(--mut);font-size:14px}\
html body #v-explore #xbody article h3,html body #v-explore #xbody article p[style*="font-weight:600"]{font-size:16px;font-weight:800}\
\
html body #v-explore #xbody .tabs,html body #v-explore #xbody [class$="-chips"]{display:flex;gap:10px;overflow-x:auto;padding:2px 20px 8px!important;margin:0 -20px;scrollbar-width:none;flex-wrap:nowrap}\
html body #v-explore #xbody [class$="-chips"]::-webkit-scrollbar{display:none}\
html body #v-explore #xbody [class$="-chips"] .tab{flex:none;padding:11px 18px;border-radius:999px;background:var(--g);box-shadow:var(--sh);font-weight:700;font-size:13px;white-space:nowrap;border:0;color:var(--fg)}\
html body #v-explore #xbody [class$="-chips"] .tab.on{background:var(--ink);color:var(--inkfg)}\
html body #v-explore #xbody button.cct.cct.cct{position:relative;flex:none;width:auto!important;height:44px!important;min-height:0;padding:0 18px!important;border-radius:999px!important;background:var(--g)!important;box-shadow:var(--sh)!important;overflow:hidden}\
html body #v-explore #xbody button.cct .cct-i{display:none!important}\
html body #v-explore #xbody button.cct .cct-l{position:static!important;display:block;font:700 13px/44px Manrope,sans-serif!important;color:var(--fg)!important;white-space:nowrap}\
html body #v-explore #xbody button.cct.cct.cct.on{background:var(--ink)!important}\
html body #v-explore #xbody button.cct.cct.on .cct-l{color:var(--inkfg)!important}\
html body #v-explore #xbody button.cct.on::after{display:none!important}\
html body #v-explore #xbody button.cct:not(.on) .cct-l{color:var(--fg)!important}\
html body #v-explore #xbody input:not([type=checkbox]):not([type=radio]):not([type=file]),html body #v-explore #xbody select{height:52px;border-radius:999px;border:0!important;background:var(--g);box-shadow:var(--sh);padding:0 20px;font:600 14px Manrope,sans-serif;color:var(--fg);width:100%;box-sizing:border-box}\
html body #v-explore #xbody .cct-row{display:flex!important;gap:10px!important;overflow-x:auto;padding:2px 20px 8px!important;margin:0 -20px;grid-template-columns:none}\
html body #v-explore #xbody [class$="-top"]{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}\
html body #v-explore #xbody [class$="-top"] h3{font-size:20px;font-weight:800;letter-spacing:-.02em}\
html body #v-explore #xbody [class$="-row"]:not(.cct-row):not(.crd-row){display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}\
html body #v-explore #xbody [class$="-card"]{margin-top:0!important}\
html body #v-explore #xbody .lf-k{font-size:11px;font-weight:800;letter-spacing:.06em;padding:5px 11px;border-radius:999px}\
html body #v-explore #xbody .lf-k.lost{background:rgba(196,114,122,.22);color:#8e3b45}\
html body #v-explore #xbody .lf-k.found{background:rgba(169,184,162,.4);color:#3d5a38}\
html body #v-explore #xbody [class$="-form"] input,html body #v-explore #xbody [class$="-form"] select,html body #v-explore #xbody [class$="-form"] textarea{width:100%;box-sizing:border-box;height:54px;border-radius:999px;border:0;background:rgba(22,19,15,.05);padding:0 20px;font:600 14px Manrope,sans-serif;color:var(--fg)}\
html body #v-explore #xbody [class$="-form"] textarea{height:100px;border-radius:24px;padding:14px 20px}\
html[data-theme="dark"] body #v-explore #xbody [class$="-form"] input,html[data-theme="dark"] body #v-explore #xbody [class$="-form"] select,html[data-theme="dark"] body #v-explore #xbody [class$="-form"] textarea{background:rgba(255,255,255,.08)}\
html body #v-explore #xbody [class$="-form"] label{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);margin:14px 0 6px 8px;opacity:1}\
html body #v-explore #xbody .hsph img{border-radius:20px}\
html body #v-explore #xbody .hsl{border:0;background:rgba(255,138,61,.13);border-radius:18px}\
html body #v-explore #xbody .fld input#bq,html body #v-explore #xbody .fld input#sq,html body #v-explore #xbody .fld input{height:100%;min-height:52px;background:none!important;box-shadow:none!important;padding:0}\
html body #v-explore #xbody .fld{border-radius:999px;background:var(--g);box-shadow:var(--sh);padding:0 20px;display:flex;align-items:center}\
html body #v-explore #xt button.cct .crd-xi{background:rgba(255,255,255,.95)}\
html body #v-explore #xbody input.pp-q,html body #v-explore #xbody [class$="-q"]{height:52px;border-radius:999px!important;border:0!important;background:var(--g)!important;box-shadow:var(--sh);padding:0 20px!important;font:600 14px Manrope,sans-serif!important}\
html body #v-explore #xbody .xhd{display:flex;gap:12px}';
var st=document.createElement('style');st.id='cc-redesign-explore-css';st.textContent=CSS;document.head.appendChild(st);
var $=function(s,r){return(r||document).querySelector(s)};
var P={
 building:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4h4v4"/>',
 users:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M17 14c2.5 0 4 2 4 5"/>',
 book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M9 7h6"/>',
 wifi:'<path d="M2.5 9a15 15 0 0 1 19 0M5.5 12.5a10.5 10.5 0 0 1 13 0M8.6 16a6 6 0 0 1 6.8 0"/><circle cx="12" cy="19" r="1"/>',
 tag:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
 chat:'<path d="M4 5h16v11H9l-5 4z"/>',
 ticket:'<path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4v0a2 2 0 0 0 0-4V6H3z"/><path d="M14 6v12" stroke-dasharray="2 2.5"/>',
 mega:'<path d="M3 10v4h4l8 5V5L7 10z"/><path d="M18 9a4 4 0 0 1 0 6"/>',
 lost:'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M9 11h4"/>',
 doc:'<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
 pin:'<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.6"/>',
 heart:'<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
 flame:'<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.3 1 2 2 2 0-3-1-5 1-8z"/>',
 cap:'<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
 gift:'<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M12 9v11M3 13h18M12 9C9 9 8 4 11 4s1 5 1 5zm0 0c3 0 4-5 1-5s-1 5-1 5z"/>',
 cart:'<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2l2.4 11h11l2-8H6.5"/>',
 video:'<rect x="3" y="5" width="18" height="14" rx="4"/><path d="M10 9l5 3-5 3z"/>'};
var svg=function(k){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(P[k]||P.pin)+'</svg>'};
var META={hs:['building','Reviews and rents'],rm:['users','Find a match'],sg:['book','Join or start one'],wf:['wifi','Near you'],sv:['tag','Hire a comrade'],pl:['chat','Vote today'],ev:['ticket','Tickets and hosting'],nt:['mega','Verified updates'],lf:['lost','IDs, phones, keys'],pp:['doc','Past papers and notes'],ls:['pin','Food, study, safe walks'],ht:['heart','18+ only'],top:['flame','Best of the week'],sn:['cap','Tips by unit'],sr:['search','Stories, notices, events']};
var ORDER=['hs','rm','sg','wf','sv','pl','ev','nt','lf','pp','ls','ht','top','sn','sr'];
var go=function(v){var b=$('#tb button[data-v="'+v+'"]');if(b)b.click()};
var ROWS=[['gift','Rewards','Points, streaks and perks',function(){go('rewards')}],['cart','Club','Wholesale prices on student items',function(){go('rewards');setTimeout(function(){var b=$('#cgo');if(b)b.click()},60)}],['video','Videos and Live','Clips from campus, live streams',function(){go('videos')}]];
function tiles(){
 var xt=$('#xt');if(!xt)return;
 [].forEach.call(xt.querySelectorAll('.tab[data-x]'),function(b){
  var k=b.dataset.x,m=META[k];if(!m)return;
  if(!b.querySelector('.crd-xi')){
   var i=document.createElement('span');i.className='crd-xi';i.innerHTML=svg(m[0]);b.appendChild(i);
   var s=document.createElement('span');s.className='crd-xs';s.textContent=m[1];b.appendChild(s);
  }
  var n=ORDER.indexOf(k);b.classList.remove('crdx1','crdx2','crdx3','crdx4','crdx5');b.classList.add('crdx'+(n%5+1));
 });
}
function frame(){
 var v=$('#v-explore');if(!v)return;
 if(!$('.crd-hd',v)){
  var h=$('.ph',v),p=$('.sub',v);if(!h)return;
  var d=document.createElement('div');d.className='crd-hd';
  var l=document.createElement('div');v.insertBefore(d,h);l.appendChild(h);if(p&&p.parentNode===v)l.appendChild(p);
  if(p)p.textContent='Everything around campus';
  d.appendChild(l);
  var b=document.createElement('button');b.type='button';b.className='ib';b.setAttribute('aria-label','Search');b.innerHTML='<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">'+P.search+'</svg>';
  b.onclick=function(){var f=$('#fnd');if(f)f.click()};d.appendChild(b);
 }
 if(!$('.crd-sh',v)){
  var xb=$('#xbody',v);if(!xb)return;
  var back=document.createElement('button');back.type='button';back.className='crd-back crd-open-only';back.textContent='← Explore';back.onclick=close;
  var sh=document.createElement('div');sh.className='crd-sh crd-open-only';sh.innerHTML='<h2></h2><p></p>';
  xb.parentNode.insertBefore(back,xb);xb.parentNode.insertBefore(sh,xb);
 }
 if(!$('.crd-more',v)){
  var m=document.createElement('div');m.className='crd-more';
  var t=document.createElement('div');t.className='crd-sec';t.innerHTML='<h2>More from Comrade Connect</h2>';m.appendChild(t);
  ROWS.forEach(function(r){var b=document.createElement('button');b.type='button';b.className='crd-row';
   b.innerHTML='<span class="crd-ri"><svg viewBox="0 0 24 24">'+P[r[0]]+'</svg></span><span class="crd-rx"><b>'+r[1]+'</b><small>'+r[2]+'</small></span>';b.onclick=r[3];m.appendChild(b)});
  var xb2=$('#xbody',v);xb2.parentNode.appendChild(m);
 }
}
function title(){
 var v=$('#v-explore'),on=v&&$('#xt .tab.on',v);if(!on)return;
 var h=$('.crd-sh h2',v),p=$('.crd-sh p',v);if(!h)return;
 var l=on.querySelector('.cct-l'),name=l?l.textContent:on.textContent.replace(/\s+/g,' ').trim();
 h.textContent=name;var m=META[on.dataset.x];p.textContent=m?m[1]:'';
}
function open(){var v=$('#v-explore');if(!v)return;v.classList.add('crd-in');title();var s=$('.crd-sh',v);if(s)v.scrollTop=0;try{window.scrollTo(0,0)}catch(e){}}
function close(){var v=$('#v-explore');if(!v)return;v.classList.remove('crd-in');v.scrollTop=0}
function run(){tiles();frame();title()}
function start(){run();
 document.addEventListener('click',function(e){
  var t=e.target.closest&&e.target.closest('#xt .tab[data-x]');
  if(t){setTimeout(open,0);return}
  if(e.target.closest&&e.target.closest('#tb button[data-v="explore"]'))close();
 },true);
 var xt=$('#xt');if(xt)new MutationObserver(function(){tiles();title()}).observe(xt,{childList:true,attributes:true,attributeFilter:['class']});
 var n=0,iv=setInterval(function(){run();if(++n>24)clearInterval(iv)},500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
