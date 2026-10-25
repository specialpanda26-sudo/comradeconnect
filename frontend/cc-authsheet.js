/* cc-authsheet.js v1: new look for the Log in / Sign up panel (#ccfrst), from the "Get started" design.
   Looks only. The real login and sign up code stays in cc-firstrun.js (username + password, Google), so nothing about how accounts work changes.
   It watches for #ccfrst and dresses it: dark bowl on top, white sheet, aqua fields, dark pill button, "Sign up / Log in" link at the bottom. */
(function () {
'use strict';
if (window.__ccAuthSheet) return; window.__ccAuthSheet = 1;
var T = '#101422', AQ = 'color-mix(in srgb,#A8DCE7 16%,#fff)';
var css = [
'html #ccfrst{--fg:' + T + ';--mut:rgba(16,20,34,.62);--g:#fff;--gb:rgba(16,20,34,.12);--line:rgba(16,20,34,.12);--soft:rgba(16,20,34,.06);background:#fff!important;color:' + T + '}',
'html #ccfrst:before{display:none!important}',
'@media(min-width:700px){html #ccfrst{background:rgba(16,20,34,.8)!important}}',
'html #ccfrst .ccfrst-b{background:#fff!important;color:' + T + ';overflow:hidden;animation:ccxrise .7s cubic-bezier(.2,.9,.3,1)}',
'@keyframes ccxrise{from{opacity:0;transform:translateY(40px)}}',
/* the dark bowl with the brand and heading */
'#ccfrst .ccx-dk{margin:calc(-22px - env(safe-area-inset-top,0px)) -22px 24px;padding:calc(22px + env(safe-area-inset-top,0px)) 22px 46px;background:' + T + ';color:#fff;border-radius:0 0 50% 50%/0 0 44px 44px}',
'#ccfrst .ccx-dk .ccfrst-hd{margin:2px 0 18px;color:#fff;font-weight:300;letter-spacing:.14em;text-transform:uppercase}',
'html #ccfrst .ccx-dk .ccfrst-hd img{filter:none!important}',
'html #ccfrst .ccx-dk h2{color:#fff!important;margin:0 0 6px}',
'html #ccfrst .ccx-dk p.ccfrst-s{color:rgba(255,255,255,.68)!important;margin:0!important;min-height:0!important}',
'html #ccfrst .ccfrst-x{background:rgba(255,255,255,.14)!important;color:#fff!important;z-index:3;border:1px solid rgba(255,255,255,.28)!important}',
/* the old two-tab switch is replaced by the link at the bottom */
'#ccfrst .ccfrst-seg{display:none!important}',
'#ccfrst .ccx-sw{text-align:center;color:var(--mut);font-size:13px;margin:16px 0 0}',
'#ccfrst .ccx-sw button{all:unset;cursor:pointer;color:' + T + ';font-weight:700;text-decoration:underline;text-underline-offset:3px}',
/* fields and buttons */
'html #ccfrst .ccfrst-f input{background:' + AQ + '!important;border:1.5px solid transparent!important;border-radius:12px!important;color:' + T + '!important;min-height:50px!important;box-shadow:none!important}',
'html #ccfrst .ccfrst-f input::placeholder{color:rgba(16,20,34,.45)!important}',
'html #ccfrst .ccfrst-f input:focus{border-color:' + T + '!important}',
'html #ccfrst .ccfrst-f label{color:' + T + '!important;font-weight:500}',
'html #ccfrst .ccfrst-forgot,html #ccfrst .ccfrst-or{color:' + T + '}',
'html #ccfrst .ccfrst-btn{background:' + T + '!important;background-image:none!important;color:#fff!important;border:0!important;box-shadow:none!important;min-height:50px;width:100%;margin-left:auto;margin-right:auto;transition:width .45s cubic-bezier(.65,0,.2,1),transform .15s}',
'html #ccfrst .ccfrst-btn[aria-busy="true"]{width:170px;opacity:1}',
'html #ccfrst .ccfrst-btn[disabled]{opacity:.85}',
'html #ccfrst .ccfrst-sk{color:rgba(16,20,34,.55)}',
'html #ccfrst .ccfrst-box{background:' + AQ + ';border-color:transparent}',
'@media(max-height:700px){#ccfrst .ccx-dk{padding-bottom:34px}#ccfrst .ccx-dk .ccfrst-hd{margin-bottom:10px}}',
'@media(prefers-reduced-motion:reduce){html #ccfrst .ccfrst-b{animation:none}}'
].join('');
var st = document.createElement('style'); st.id = 'ccx-auth-css'; st.textContent = css; document.head.appendChild(st);

function dress(m) {
  if (!m || m.__ccx) return; var b = m.querySelector('.ccfrst-b'); if (!b) return; m.__ccx = 1;
  var hd = b.querySelector('.ccfrst-hd'), h2 = b.querySelector('#ccfrst-t'), sub = b.querySelector('#ccfrst-s');
  if (hd && h2 && sub) {
    var dk = document.createElement('div'); dk.className = 'ccx-dk';
    hd.parentNode.insertBefore(dk, hd); dk.appendChild(hd); dk.appendChild(h2); dk.appendChild(sub);
  }
  var ft = b.querySelector('.ccfrst-ft'), sw = document.createElement('p'); sw.className = 'ccx-sw';
  sw.innerHTML = '<span></span> <button type="button"></button>';
  if (ft) ft.parentNode.insertBefore(sw, ft); else b.appendChild(sw);
  var tabs = [].slice.call(b.querySelectorAll('.ccfrst-seg button'));
  function mode() { var on = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0]; return on ? on.dataset.m : 'login'; }
  function sync() {
    var c = mode() === 'create'; sw.firstChild.textContent = c ? 'Already have an account?' : "Don't have an account?";
    sw.lastChild.textContent = c ? 'Log in' : 'Sign up';
  }
  sw.lastChild.onclick = function () { var want = mode() === 'create' ? 'login' : 'create'; tabs.forEach(function (t) { if (t.dataset.m === want) t.click(); }); };
  tabs.forEach(function (t) { new MutationObserver(sync).observe(t, { attributes: true, attributeFilter: ['aria-selected'] }); });
  sync();
}
function scan() { dress(document.getElementById('ccfrst')); }
new MutationObserver(scan).observe(document.body || document.documentElement, { childList: true });
scan();
})();
