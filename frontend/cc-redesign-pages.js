/* cc-redesign-pages.js v1 (section B): notifications sheet, lock screen, Settings page and Rewards page in the redesign look.
   Styles only. Cream sheets, white rounded cards, round icon buttons, orange accent, dark pill buttons, Manrope. */
(function(){'use strict';
if(window.__crdPages)return;window.__crdPages=1;
var BL='radial-gradient(45% 55% at 25% 70%,#c4727a 0,transparent 72%),radial-gradient(50% 50% at 78% 35%,#ff8a3d 0,transparent 72%),radial-gradient(40% 40% at 50% 5%,#ffe7d2 0,transparent 72%)';
var CSS='\
@keyframes crdUp2{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}\
html body div.ccn.ccn.ccn.ccn{position:fixed!important;inset:0!important;display:flex!important;align-items:flex-end!important;justify-content:center!important;padding:0!important;background:rgba(22,19,15,.45)!important;-webkit-backdrop-filter:blur(6px)!important;backdrop-filter:blur(6px)!important}\
html body div.ccn.ccn.ccn.ccn>.bx{position:relative!important;width:100%!important;max-width:560px!important;max-height:92vh!important;min-height:0!important;height:auto!important;margin:0!important;overflow-y:auto!important;background:var(--bg)!important;background-image:none!important;color:var(--fg)!important;border:0!important;border-radius:34px 34px 0 0!important;padding:30px 20px calc(26px + env(safe-area-inset-bottom,0px))!important;box-shadow:0 -12px 40px rgba(22,19,15,.22)!important;animation:crdUp2 .32s cubic-bezier(.2,.8,.2,1)!important;font-family:Manrope,system-ui,sans-serif!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}\
html body div.ccn.ccn.ccn.ccn>.bx::before{content:"";position:absolute;top:10px;left:50%;width:44px;height:5px;margin-left:-22px;border-radius:3px;background:var(--line)}\
html body div.ccn.ccn.ccn.ccn h2{font:800 22px/1.15 Manrope,sans-serif!important;letter-spacing:-.03em!important;color:var(--fg)!important}\
html body div.ccn.ccn.ccn.ccn .hd>div>button:not(.ib){background:none!important;border:0!important;box-shadow:none!important;font:800 13px Manrope,sans-serif!important;color:var(--mut)!important}\
html body div.ccn.ccn.ccn.ccn .ib{width:44px;height:44px;border-radius:50%!important;background:var(--g)!important;box-shadow:var(--sh)!important;border:0!important;color:var(--fg)!important}\
html body div.ccn.ccn.ccn.ccn .tb{display:flex;gap:8px;overflow-x:auto;margin:12px 0 14px;padding:2px 2px 8px}\
html body div.ccn.ccn.ccn.ccn .tb button{flex:none;height:40px;padding:0 18px;border-radius:999px!important;background:var(--g)!important;box-shadow:var(--sh)!important;border:0!important;color:var(--fg)!important;font:700 13px Manrope,sans-serif!important}\
html body div.ccn.ccn.ccn.ccn .tb button.on{background:var(--ink)!important;color:var(--inkfg)!important}\
html body div.ccn.ccn.ccn.ccn .em{text-align:center;padding:34px 12px;color:var(--mut)!important;font:600 13px/1.5 Manrope,sans-serif}\
html body div.ccn.ccn.ccn.ccn .em b{display:block;color:var(--fg);font-weight:800;font-size:17px;margin-bottom:6px}\
html body div.ccn.ccn.ccn.ccn .tb,html body div.ccn.ccn.ccn.ccn .ls{background:none!important;background-image:none!important;border:0!important;box-shadow:none!important}\
html body div.ccn.ccn.ccn.ccn .ls>*{background:var(--g);border-radius:22px;box-shadow:var(--sh);border:0}\
html body #lk.lkg{background:linear-gradient(180deg,var(--bg),#f3efe9)!important;background-image:linear-gradient(180deg,var(--bg),#f3efe9)!important;color:var(--fg)!important;font-family:Manrope,system-ui,sans-serif!important;overflow:hidden}\
:root[data-theme="dark"] body #lk.lkg{background-image:linear-gradient(180deg,#17130f,#100d0a)!important}\
html body #lk.lkg::before{content:"";position:absolute;inset:-10% -30% 40% -30%;z-index:0;filter:blur(40px);opacity:.85;background:'+BL+'}\
html body #lk .lkhero,html body #lk .lkpill{display:none!important}\
html body #lk .lkcard{position:relative;z-index:1;background:var(--g)!important;background-image:none!important;border:0!important;border-radius:34px!important;box-shadow:var(--sh)!important;color:var(--fg)!important}\
html body #lk .lkcard h2{font:800 28px/1.1 Manrope,sans-serif!important;letter-spacing:-.04em!important;color:var(--fg)!important}\
html body #lk .lkcard p,html body #lk .lkcard .note{color:var(--mut)!important}\
html body #lk .lkcard .lkh{color:var(--fg)!important;font-weight:800}\
html body #lk.lkg .lkcard #lku.lkfp,html body #lk.lkg .lkcard .lkfp,html body #lk.lkg .lkcard #lkf{background:linear-gradient(135deg,#ffa05a,#ee7a4f)!important;color:#1d0f06!important;border:0!important;box-shadow:0 10px 24px rgba(238,122,79,.35)!important;border-radius:50%!important}\
html body #lk.lkg .lkcard .btn,html body #lk.lkg .lkcard #lkgo{height:54px;border-radius:999px!important;font:800 15px Manrope,sans-serif!important;border:0!important;background:var(--ink)!important;color:var(--inkfg)!important;box-shadow:none!important}\
html body #lk.lkg .lkcard a,html body #lk.lkg .lkcard u{color:var(--fg)!important;font-weight:800}\
html body #lk.lkg .lkcard h2 b{color:#ee7a4f!important}\
html body .ccset-card{background:var(--g)!important;background-image:none!important;border:0!important;border-radius:28px!important;box-shadow:var(--sh)!important;overflow:hidden}\
html body .ccset-row{border-color:var(--line)!important;color:var(--fg)!important}\
html body .ccset-row .ic{width:42px;height:42px;border-radius:50%!important;background:rgba(255,138,61,.15)!important;color:#c4531f!important;display:grid;place-items:center}\
html body .ccset-row b{font-weight:800;color:var(--fg)}html body .ccset-row small{color:var(--mut)}\
html body .ccset-row .go{background:var(--ink);color:var(--inkfg)!important;border-radius:999px;padding:7px 14px;font-weight:800;font-size:12px}\
html body .ccset-sec{font:800 11px Manrope,sans-serif!important;letter-spacing:.14em;color:var(--mut)!important}\
html body .ccset-sw{background:var(--line)!important;border-radius:999px!important}\
html body .ccset-row[aria-checked="true"] .ccset-sw{background:linear-gradient(135deg,#ffa05a,#ee7a4f)!important}\
html body .ccset-x{width:44px;height:44px;border-radius:50%!important;background:var(--g)!important;box-shadow:var(--sh)!important;border:0!important;color:var(--fg)!important}\
html body #v-rewards{padding-bottom:120px}\
html body #v-rewards .box.g:nth-of-type(1) .badge{background:rgba(255,255,255,.78)!important;color:#16130f!important;border:0!important;box-shadow:none!important}\
html body #v-rewards .box.g{border-radius:30px!important;border:0!important;box-shadow:var(--sh)!important}\
html body #v-rewards .box.g:nth-of-type(1){position:relative;overflow:hidden;isolation:isolate;background:#fff8f4!important;color:#16130f!important}\
html body #v-rewards .box.g:nth-of-type(1)::before{content:"";position:absolute;inset:-25%;z-index:-1;filter:blur(30px);opacity:.95;background:'+BL+'}\
html body #v-rewards .box.g:nth-of-type(1) *{color:#16130f}\
html body #v-rewards .box.g:nth-of-type(1) .btn.p{background:#16130f!important;color:#fff!important}\
html body #v-rewards .big{font-weight:800;letter-spacing:-.04em}\
html body #v-rewards .btn.p{height:54px;border-radius:999px!important;background:var(--ink)!important;color:var(--inkfg)!important}\
';
function init(){if(document.getElementById('crd-pages-css'))return;var s=document.createElement('style');s.id='crd-pages-css';s.textContent=CSS;document.head.appendChild(s)}
if(document.head)init();else document.addEventListener('DOMContentLoaded',init);
})();
