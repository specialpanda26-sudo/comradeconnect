/* cc-redesign-sheets.js v1 (section A): popups, bottom sheets, payment steps and receipt in the redesign look.
   Cream sheet with a grab handle, soft scrim, pill fields and buttons, Manrope. Only styles plus a class tag (crd-ov)
   on popups made by the old code: deposit, withdraw, pay, sign in, wholesaler, gifts, alerts, wallet, help. */
(function(){'use strict';
if(window.__crdSheets)return;window.__crdSheets=1;
var CSS='\
html body{--bad:#c4412f;--ok:#5c6d56}\
:root[data-theme="dark"] body{--bad:#ff8a7a;--ok:#a9b8a2}\
@keyframes crdUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}\
html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov,html body #ccal,html body #dm{position:fixed!important;inset:0!important;display:flex!important;align-items:flex-end!important;justify-content:center!important;padding:0!important;background:rgba(22,19,15,.45)!important;-webkit-backdrop-filter:blur(6px)!important;backdrop-filter:blur(6px)!important;overflow:hidden!important}\
html body #dm:not(.on){display:none!important}\
html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov>div,html body #ccal>div,html body #dm>.bx{position:relative!important;box-sizing:border-box!important;width:100%!important;max-width:560px!important;max-height:92vh!important;min-height:0!important;height:auto!important;overflow-y:auto!important;margin:0!important;align-self:auto!important;background:var(--bg)!important;color:var(--fg)!important;border:0!important;border-radius:34px 34px 0 0!important;padding:30px 20px calc(26px + env(safe-area-inset-bottom,0px))!important;box-shadow:0 -12px 40px rgba(22,19,15,.22)!important;animation:crdUp .32s cubic-bezier(.2,.8,.2,1)!important;font-family:Manrope,system-ui,sans-serif!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}\
html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov>div::before,html body #ccal>div::before,html body #dm>.bx::before{content:"";position:absolute;top:10px;left:50%;width:44px;height:5px;margin-left:-22px;border-radius:3px;background:var(--line)}\
html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov h2,html body #ccal h2,html body #dm h2{font:800 22px/1.15 Manrope,sans-serif!important;letter-spacing:-.03em!important;color:var(--fg)!important;margin:0 0 4px!important}\
html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov h3{font:800 20px/1.15 Manrope,sans-serif!important;letter-spacing:-.03em!important;color:var(--fg)!important}\
html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov .sub:not([style*="--bad"]),html body #dm .note,html body #dm .sub,html body #ccal p{color:var(--mut)!important;font-size:13px!important;line-height:1.5}\
html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov .fld,html body #dm .fld{display:flex!important;align-items:center;min-height:52px;height:auto;padding:0 18px!important;margin:10px 0 0!important;border-radius:999px!important;background:var(--g)!important;box-shadow:var(--sh)!important;border:0!important}\
html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov .fld:has(textarea),html body #dm .fld:has(textarea){border-radius:24px!important;padding:10px 18px!important}\
html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov .fld input,html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov .fld select,html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov .fld textarea,html body #dm .fld input,html body #dm .fld select,html body #dm .fld textarea{flex:1;width:100%!important;min-width:0;height:50px;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;border-radius:0!important;outline:0;color:var(--fg)!important;font:600 14px Manrope,sans-serif!important}\
html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov .fld textarea,html body #dm .fld textarea{height:auto}\
html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov .btn,html body #dm .btn,html body #ccal button:not(.xb){height:54px;border-radius:999px!important;font:800 15px Manrope,sans-serif!important;border:0!important;margin-top:8px}\
html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov .btn.p,html body #dm .btn.p{background:var(--ink)!important;color:var(--inkfg)!important;box-shadow:none!important}\
html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov .btn.g,html body #dm .btn.g{background:var(--g)!important;color:var(--fg)!important;box-shadow:var(--sh)!important}\
html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov .btn:disabled,html body #dm .btn:disabled{opacity:.45}\
html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov .rw,html body #dm .rw{border-top:1px solid var(--line);padding:13px 2px}\
html body #dm .tot,html body #dm .big{font-weight:800!important;letter-spacing:-.04em}\
html body #dm .stk{display:grid;gap:10px}\
html body #dm .ib,html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov .ib,html body #ccal>div>button:first-of-type{width:44px;height:44px;border-radius:50%!important;background:var(--g)!important;box-shadow:var(--sh)!important;border:0!important;color:var(--fg)!important}\
html body #dm li::before{background:var(--ink);color:var(--inkfg)}\
html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov label{font-weight:700;font-size:12px;color:var(--mut)}\
html body div.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov.crd-ov .cs-h,html body #dm .cs-h{font-weight:800;font-size:15px;color:var(--fg)}\
html body .cs-s{background:var(--g)!important;border-radius:20px!important;box-shadow:var(--sh)!important;border:0!important;padding:12px 14px!important;margin:8px 0!important;color:var(--fg)!important}\
html body .cs-s small{color:var(--mut)!important}\
html body .cs-s .cs-i{border-radius:50%!important;border-color:var(--line)!important}\
html body .cs-s.a .cs-i{border-color:#ee7a4f!important;border-top-color:transparent!important}\
html body .cs-s.d .cs-i{background:var(--ok)!important;border-color:var(--ok)!important}\
html body .cs-s.f .cs-i{background:var(--bad)!important;border-color:var(--bad)!important}\
html body .cs-e{color:var(--bad)!important;font-weight:700;font-size:13px}\
html body #ccrc,html body #ccrc.dk{background:var(--bg)!important;color:var(--fg)!important;font-family:Manrope,system-ui,sans-serif!important}\
html body #ccrc.dk{background:#17130f!important;color:#f6efe9!important}\
html body #ccrc h2,html body #ccrc .rc-b{font-family:Manrope,sans-serif!important}\
html body #ccrc h2{font-weight:800!important;font-size:26px!important;letter-spacing:-.035em!important}\
html body #ccrc .rc-x{background:var(--g);border:0;box-shadow:var(--sh);width:44px;height:44px}\
html body #ccrc .rc-card{background:#fff8f4!important;color:#16130f!important;border:0!important;border-radius:28px!important;box-shadow:var(--sh)!important;isolation:isolate}\
html body #ccrc .rc-card::before{content:"";position:absolute;inset:-25%;z-index:-1;filter:blur(26px);background:radial-gradient(45% 55% at 25% 70%,#c4727a 0,transparent 72%),radial-gradient(50% 50% at 78% 35%,#ff8a3d 0,transparent 72%),radial-gradient(40% 40% at 50% 5%,#ffe7d2 0,transparent 72%)}\
html body #ccrc .rc-card *,html body #ccrc .rc-cf small{color:#16130f!important}\
html body #ccrc .rc-lgo{background:#16130f!important}\
html body #ccrc .rc-pill{border-color:#16130f!important}\
html body #ccrc .rc-nfc{stroke:#16130f!important}\
html body #ccrc .rc-bd{background:var(--bg)!important;border:0!important;box-shadow:var(--sh)}\
html body #ccrc .rc-bd.ok{background:var(--ok)!important}\
html body #ccrc .rc-bd svg{stroke:#fff!important}\
html body #ccrc .rc-bd i{border-top-color:#ee7a4f!important}\
html body #ccrc .rc-rows{background:var(--g)!important;border:0!important;border-radius:26px!important;box-shadow:var(--sh)}\
html body #ccrc .rc-b{height:54px;border-radius:999px!important;font-weight:800!important;border:0!important;background:var(--g)!important;color:var(--fg)!important;box-shadow:var(--sh)!important}\
html body #ccrc .rc-b.p{background:linear-gradient(135deg,#ffa05a,#ee7a4f)!important;color:#1d0f06!important}\
html body #ccrc.dk .rc-b{background:rgba(255,255,255,.1)!important;color:#f6efe9!important}\
html body #ccrc.dk .rc-b.p{background:linear-gradient(135deg,#ffa05a,#ee7a4f)!important;color:#1d0f06!important}\
';
var SKIP=/^(ccgate|ccuniv|ccfrst|dm|ccal|ccrc)$/;
function tag(n){
 if(!n||n.nodeType!==1||n.parentNode!==document.body)return;
 if(SKIP.test(n.id)||n.classList.contains('crd-ov'))return;
 var c=n.firstElementChild;if(!c)return;
 var named=n.matches('.cchm,.ccp-sheet,#ccsh,#ccwsheet');
 if(!named&&!(n.style&&n.style.position==='fixed'&&c.classList.contains('box')))return;
 n.classList.add('crd-ov');
 n.addEventListener('click',function(e){if(e.target===n&&typeof n.close==='function')n.close()});
}
function scan(){var k=document.body.children;for(var i=0;i<k.length;i++)tag(k[i])}
function init(){
 if(!document.getElementById('crd-sheets-css')){var s=document.createElement('style');s.id='crd-sheets-css';s.textContent=CSS;document.head.appendChild(s)}
 scan();
 new MutationObserver(function(m){for(var i=0;i<m.length;i++)for(var j=0;j<m[i].addedNodes.length;j++)tag(m[i].addedNodes[j])}).observe(document.body,{childList:true});
 setInterval(scan,5000);
}
if(document.body)init();else document.addEventListener('DOMContentLoaded',init);
})();
