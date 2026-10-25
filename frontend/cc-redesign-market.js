/* cc-redesign-market.js v1 (section 6): Market like the redesign.
   Big "Market" header, gradient "Protected by escrow" banner, Browse / My listings / Orders pill switch, pill search,
   pill category chips, product cards with soft image, green price and round add button, sell flow, orders list and wallet.
   Only styles and light DOM tweaks: all real Market code (listings, escrow, wallet, sell, orders) is untouched. */
(function(){'use strict';
if(window.__crdMarket)return;window.__crdMarket=1;
var CSS='\
html body #v-market{display:flex!important;flex-direction:column;padding:4px 0 26px}\
html body #v-market:not(.on){display:none!important}\
html body #v-market>*{order:20}\
html body #v-market>.ph{display:block!important;order:1;font-size:34px;margin:6px 0 2px;font-family:Manrope,system-ui,sans-serif}\
html body #v-market>.crd-msub{order:2;color:var(--mut);font-size:13px;margin:0 0 14px}\
html body #v-market>.mu-top{order:3;margin:0 0 12px}\
html body #v-market>.mtrust{order:4}\
html body #v-market>#mseg{order:5}\
html body #v-market>.mu-cats{order:6}\
html body #v-market>#mbrowse{order:7}\
html body #v-market .mu-pin,html body #v-market .mu-bell{background:var(--g);border:0;box-shadow:var(--sh)}\
html body #v-market .mu-loc small{color:var(--mut)}html body #v-market .mu-loc b{font-weight:800}\
html body #v-market .mtrust{position:relative;overflow:hidden;isolation:isolate;background:#fff8f4;border:0;border-radius:28px;padding:20px;color:#16130f;box-shadow:var(--sh);margin:0 0 14px}\
html body #v-market .mtrust::before{content:"";position:absolute;inset:-25%;z-index:-1;filter:blur(30px);opacity:.95;background:radial-gradient(45% 50% at 20% 30%,#a9b8a2 0,transparent 72%),radial-gradient(45% 50% at 80% 75%,#c4727a 0,transparent 72%),radial-gradient(40% 40% at 70% 15%,#ffd9b8 0,transparent 72%)}\
html body #v-market .mtrust b{font-size:20px;letter-spacing:-.03em;color:#16130f}html body #v-market .mtrust small{color:#16130f;opacity:.75}\
html body #v-market .mtrust .mt-h>svg,html body #v-market .mtrust svg.i{background:rgba(255,255,255,.75);border-radius:50%;padding:12px;width:50px;height:50px;stroke:#16130f}\
html body #v-market .mtrust .badge{background:rgba(255,255,255,.75);color:#16130f;box-shadow:none;border:0;font-size:11px}\
html body #v-market #mseg{display:flex;background:var(--g);border-radius:999px;padding:5px;box-shadow:var(--sh);margin:0 0 16px;border:0}\
html body #v-market #mseg button{flex:1;height:42px;border-radius:999px;font-weight:800;font-size:13px;border:0;background:none;color:var(--fg);box-shadow:none}\
html body #v-market #mseg button.on{background:var(--ink);color:var(--inkfg)}\
html body #v-market .mu-cats{display:flex!important;gap:10px!important;overflow-x:auto;padding:2px 20px 12px!important;margin:0 -20px 4px;grid-template-columns:none}\
html body #v-market .mu-cats button.cct.cct.cct,html body #v-market .mu-cats .mu-cat{flex:none;width:auto!important;height:44px!important;padding:0 18px!important;border-radius:999px!important;background:var(--g)!important;box-shadow:var(--sh)!important;color:var(--fg)}\
html body #v-market .mu-cats button.cct.cct.cct.on,html body #v-market .mu-cats .mu-cat.on{background:var(--ink)!important}\
html body #v-market .mu-cats .mu-cat.on .cct-l,html body #v-market .mu-cats .mu-cat.on .cct-l{color:var(--inkfg)!important}\
html body #v-market .mu-cats .mu-cat.on .cct-l{color:var(--inkfg)!important}\
html body #v-market .mu-cats .mu-cat:not(.on) .cct-l{color:var(--fg)!important}html body #v-market .mu-cats .cct-l{position:static!important;display:block;line-height:44px;font:700 13px/44px Manrope,sans-serif!important}\
html body #v-market #mbrowse .fld{background:var(--g);border-radius:999px;box-shadow:var(--sh);padding:0 18px;height:52px;display:flex;align-items:center}\
html body #v-market #mbrowse .fld input{width:100%;border:0;background:none;font:600 14px Manrope,sans-serif;color:var(--fg)}\
html body #v-market .cce{border-radius:24px;padding:14px 16px;background:var(--g);border:0;box-shadow:var(--sh)}\
html body #v-market .mu-ban{position:relative;overflow:hidden;isolation:isolate;background:#fff8f4;border:0;border-radius:28px;color:#16130f;box-shadow:var(--sh)}\
html body #v-market .mu-ban::before{content:"";position:absolute;inset:-25%;z-index:-1;filter:blur(30px);opacity:.95;background:radial-gradient(45% 55% at 25% 70%,#c4727a 0,transparent 72%),radial-gradient(50% 50% at 78% 35%,#ff8a3d 0,transparent 72%),radial-gradient(40% 40% at 50% 5%,#ffe7d2 0,transparent 72%)}\
html body #v-market .mu-ban h4{font-size:20px;letter-spacing:-.03em;font-weight:800;color:#16130f}html body #v-market .mu-ban p,html body #v-market .mu-ban .tag{color:#16130f;opacity:.8}\
html body #v-market .mu-ban button{background:#fff;color:#16130f;border-radius:999px;padding:10px 18px;font-weight:800;font-size:13px;border:0}\
html body #v-market .mu-h{display:flex;justify-content:space-between;align-items:baseline;margin:6px 2px 10px}\
html body #v-market .mu-h b{font-size:17px;font-weight:800;letter-spacing:-.02em}html body #v-market .mu-h span{font-size:12px;font-weight:700;color:var(--mut)}\
html body #v-market .mgrid{gap:14px}\
html body #v-market .mgrid .mc{border:0!important;border-radius:28px;box-shadow:var(--sh)!important;padding:0!important;background:var(--g)!important}\
html body #v-market .mgrid .mc .mm{border-radius:0!important;aspect-ratio:1/.9!important;background:linear-gradient(160deg,#ffe3cc,#f4c2bf)!important}\
html body #v-market .mgrid .mc .mb{padding:12px 14px 14px!important}\
html body #v-market .mgrid .mc .mb b{font-size:14px;font-weight:800;color:var(--fg)}\
html body #v-market .mgrid .mc .mb em{font-style:normal;font-weight:800;color:#5c6d56;font-size:14px;display:block;margin-top:2px}\
html body #v-market .mgrid .mc .mb small{font-size:11px;font-weight:600;color:var(--mut)}\
html body #v-market .mu-heart,html body #v-market .mgrid .mc .mu-heart{background:rgba(255,255,255,.92)!important;color:#16130f;border:0;border-radius:50%;box-shadow:none}\
html body #v-market .mu-add,html body #v-market .mgrid .mc .mu-add{background:#5c6d56!important;color:#fff!important;border:0;border-radius:50%;box-shadow:none}\
html body #v-market #mmine>.btn.p,html body #v-market #msell{background:var(--ink);color:var(--inkfg);height:54px;border-radius:999px;margin-bottom:14px}\
html body #v-market #mord>.box.g{background:#fff8f4;position:relative;overflow:hidden;isolation:isolate;border-radius:34px;padding:22px;color:#16130f}\
html body #v-market #mord>.box.g::before{content:"";position:absolute;inset:-25%;z-index:-1;filter:blur(30px);opacity:.95;background:radial-gradient(45% 55% at 25% 70%,#c4727a 0,transparent 72%),radial-gradient(50% 50% at 78% 35%,#ff8a3d 0,transparent 72%),radial-gradient(40% 40% at 50% 5%,#ffe7d2 0,transparent 72%)}\
html body #v-market #mord .big,html body #v-market #wb{font-size:40px;font-weight:800;letter-spacing:-.04em;color:#16130f}\
html body #v-market #mord>.box.g .sub{color:#16130f;font-weight:700}\
html body #v-market #mord>.box.g .btn.g{background:rgba(255,255,255,.9);color:#16130f}\
html body #v-market #olist .box,html body #v-market #mlist .box,html body #v-market #olist article,html body #v-market #mlist article{border-radius:26px;padding:16px;background:var(--g);box-shadow:var(--sh);border:0}\
html body #v-market .badge{background:rgba(255,138,61,.13);color:var(--fg);border:0;border-radius:999px;font-weight:800}\
html body #v-market .act{background:rgba(255,138,61,.13);color:var(--fg);border:0;border-radius:999px;font-weight:800}\
html body #v-market .btn.p{background:var(--ink);color:var(--inkfg)}\
\
html body #v-market .mgrid .mc .mb em{position:static!important;background:none!important;width:auto!important;height:auto!important;padding:0!important;margin:2px 0 0!important;box-shadow:none!important;border:0!important;border-radius:0!important;transform:none!important;inset:auto!important}\
html body #v-market #mbrowse .fld input#mkq,html body #v-market #mbrowse .fld input{border:0!important;background:none!important;box-shadow:none!important;height:100%;min-height:50px;padding:0!important;border-radius:0!important}\
html body #v-market .ccf input,html body #v-market .ccf select,html body #v-market #mbrowse select{height:48px;border-radius:999px;border:0!important;background:var(--g);box-shadow:var(--sh);padding:0 18px;font:600 14px Manrope,sans-serif;color:var(--fg)}\
html body #v-market #mbrowse .ccf input,html body #v-market #mbrowse .ccf select,html body #v-market #mbrowse input[type=number],html body #v-market #mbrowse input[inputmode],html body #v-market #mbrowse select{height:48px!important;border-radius:999px!important;border:0!important;background:var(--g)!important;box-shadow:var(--sh)!important;padding:0 18px!important}\
html body #v-market .mu-ban{background:#fff8f4!important;background-image:none!important}\
html body #v-market .mu-ban::after{display:none!important}\
html body #v-market .mu-ban .tag{background:rgba(255,255,255,.7);color:#16130f;border-radius:999px;padding:4px 10px}\
html body #v-market .mgrid .mc small.mtl{display:none!important}';
var st=document.createElement('style');st.id='cc-redesign-market-css';st.textContent=CSS;document.head.appendChild(st);
var $=function(s,r){return(r||document).querySelector(s)};
function run(){
 var v=$('#v-market');if(!v)return;
 var h=$('.ph',v);
 if(h&&!$('.crd-msub',v)){var p=document.createElement('p');p.className='crd-msub';p.textContent='Buy and sell with other comrades';h.after(p)}
 var s=$('.mu-h b',v);if(s&&s.textContent!=='Items near you')s.textContent='Items near you';
 var a=$('.mu-h span',v);if(a&&a.textContent!=='View all')a.textContent='View all';
 var t=$('.mtrust .mt-h b',v);if(t&&!/Pay safe/i.test(t.textContent))t.textContent='Pay safe, protected by escrow';
}
function start(){run();new MutationObserver(function(){run()}).observe(document.getElementById('v-market')||document.body,{childList:true,subtree:true});
 var n=0,iv=setInterval(function(){run();if(++n>20)clearInterval(iv)},500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
