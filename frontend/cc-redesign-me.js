/* cc-redesign-me.js v1 (section 4): Me like the redesign. Profile card, gradient wallet card right under it with Deposit and Withdraw,
   Shortcuts tiles (Rewards, Club, Messages, Support), dashboard, "Account and safety" heading. Needs section 3 (tile styles). */
(function(){'use strict';
if(window.__crdMe)return;window.__crdMe=1;
var CSS='\
#v-me .crd-rw{display:none!important}\
#v-me #ccwtop{position:relative;overflow:hidden;isolation:isolate;background:#fff8f4;border-radius:32px;padding:20px;color:#16130f;margin:0 0 14px}\
#v-me #ccwtop::before{content:"";position:absolute;inset:-25%;z-index:-1;filter:blur(30px);opacity:.95;background:radial-gradient(45% 55% at 25% 70%,#c4727a 0,transparent 72%),radial-gradient(50% 50% at 78% 35%,#ff8a3d 0,transparent 72%),radial-gradient(40% 40% at 50% 5%,#ffe7d2 0,transparent 72%)}\
#v-me #ccwtop .sub{color:#16130f;font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase}\
#v-me #ccwtop .big{font-size:40px;font-weight:800;letter-spacing:-.04em;line-height:1.1;color:#16130f}\
#v-me #ccwtop .sub:last-child{font-weight:600;letter-spacing:0;text-transform:none;opacity:.8}\
#v-me #ccwtop span[aria-hidden]{background:rgba(255,255,255,.9)!important;border-radius:50%!important;width:46px!important;height:46px!important;color:#16130f!important}\
#v-me #ccwtop .two .btn.g{background:rgba(255,255,255,.9);color:#16130f}\
#v-me .mecard .mtop{align-items:center}\
#v-me .mecard .av{background:rgba(255,255,255,.9);color:#16130f;font-weight:800}\
#v-me .mecard .ccp-act .btn{height:42px;font-size:13px;background:rgba(255,255,255,.8);color:#16130f}\
#v-me .crd-two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 14px}\
#v-me .crd-two .crd-tile{width:100%;min-height:96px;padding:12px 14px;border-radius:26px}\
#v-me .crd-two .crd-tile .ic{width:38px;height:38px;top:10px;left:12px}\
#v-me .crd-two .crd-tile b{font-size:15px}\
#v-me .stats>div,#v-me #ms>div{background:var(--tint,rgba(255,138,61,.1));border-radius:18px}\
#v-me #wk i{background:linear-gradient(180deg,#ffa05a,#ee7a4f);border-radius:8px}\
#v-me .ccset{border-radius:22px;padding:14px 16px}\
#v-me .ccset h3{font-size:15px}\
#v-me .rw{border-color:var(--line)}';
var st=document.createElement('style');st.id='cc-redesign-me-css';st.textContent=CSS;document.head.appendChild(st);
var $=function(s,r){return(r||document).querySelector(s)};
var I=function(p){return '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>'};
var ICO={gift:'<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M12 9v11M3 13h18M12 9C9 9 8 4 11 4s1 5 1 5zm0 0c3 0 4-5 1-5s-1 5-1 5z"/>',cart:'<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2l2.4 11h11l2-8H6.5"/>',chat:'<path d="M4 5h16v11H9l-5 4z"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>'};
var go=function(v){var b=$('#tb button[data-v="'+v+'"]');if(b)b.click()};
function sec(t){var d=document.createElement('div');d.className='crd-sec';d.innerHTML='<h2>'+t+'</h2>';return d}
function run(){
 var me=$('#v-me');if(!me)return;
 var card=$('#mecard',me),w=$('#ccwtop',me);
 if(card&&w&&w.previousElementSibling!==card)card.after(w);
 if(!$('#crd-short',me)){
  var dash=[].slice.call(me.querySelectorAll('.box.g')).filter(function(b){var h=b.querySelector('h3');return h&&/dashboard/i.test(h.textContent)})[0];
  if(!dash)return;
  var wrap=document.createElement('div');wrap.id='crd-short';wrap.appendChild(sec('Shortcuts'));
  var g=document.createElement('div');g.className='crd-two';
  [['Rewards','gift','b1',function(){go('rewards')}],['Club','cart','b2',function(){var b=$('#cgo');if(b)b.click()}],['Messages','chat','b3',function(){var e=$('#dml');if(e)e.scrollIntoView({block:'center',behavior:'smooth'})}],['Support','help','b4',function(){document.dispatchEvent(new CustomEvent('cc-open-support'))}]].forEach(function(x){
   var b=document.createElement('button');b.type='button';b.className='crd-tile crd-'+x[2];b.innerHTML='<span class="ic">'+I(ICO[x[1]])+'</span><b>'+x[0]+'</b>';b.onclick=x[3];g.appendChild(b)});
  wrap.appendChild(g);dash.parentNode.insertBefore(wrap,dash);
 }
 var m=$('#ccmenu',me);if(m&&!$('#crd-acct',me)){var h=sec('Account and safety');h.id='crd-acct';m.parentNode.insertBefore(h,m)}
}
function start(){run();var n=0,iv=setInterval(function(){run();if(++n>24)clearInterval(iv)},500);
 document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('#tb button'))setTimeout(run,120)})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
