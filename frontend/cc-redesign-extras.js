/* cc-redesign-extras.js v1 (section C): payment step connector, stories viewer in the redesign look. */
(function(){'use strict';
if(window.__crdExtras)return;window.__crdExtras=1;
var CSS='\
html body .cs-l .cs-s::before,html body .cs-l .cs-s::after,html body .cs-m .cs-s::before,html body .cs-m .cs-s::after{display:none!important;content:none!important}\
html body .ccs-v.ccs-v.ccs-v,html body .ccs-v .ccs-st{background:#16130f!important;font-family:Manrope,sans-serif}\
html body .ccs-v .ccs-st img,html body .ccs-v .ccs-st video{background:#16130f!important}\
html body .ccs-v .ccs-top{background:linear-gradient(rgba(22,19,15,.65),transparent)!important}\
html body .ccs-v .ccs-bt{background:linear-gradient(transparent,rgba(22,19,15,.75))!important}\
html body .ccs-v .ccs-bar{background:rgba(255,255,255,.28)!important;height:4px!important;border-radius:4px!important}\
html body .ccs-v .ccs-bar i{background:linear-gradient(90deg,#ffa05a,#ee7a4f)!important}\
html body .ccs-v .ccs-who{font-weight:800!important;letter-spacing:-.02em}\
html body .ccs-v .ccs-ib{background:rgba(255,255,255,.16)!important;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}\
html body .ccs-v .ccs-ib:active{background:rgba(255,255,255,.3)!important}\
html body .ccs-v .ccs-ib:focus-visible,html body .ccs-v .ccs-act:focus-visible,html body .ccs-v .ccs-menu button:focus-visible{outline:2px solid #ffa05a!important}\
html body .ccs-v .ccs-act{background:rgba(255,255,255,.16)!important;border:0!important;font-weight:800!important}\
html body .ccs-v .ccs-menu{background:#26211b!important;border:0!important;border-radius:22px!important;box-shadow:0 14px 40px rgba(0,0,0,.45)!important}\
html body .ccs-v .ccs-menu button{border-radius:16px!important;font-weight:700!important}\
html body .ccs-v .ccs-menu button:hover,html body .ccs-v .ccs-menu button:focus-visible{background:rgba(255,255,255,.1)!important;box-shadow:none!important}\
html body .ccs-v .ccs-cap{font-weight:600!important}\
';
function add(){if(document.getElementById('crd-extras-css'))return;var s=document.createElement('style');s.id='crd-extras-css';s.textContent=CSS;document.head.appendChild(s)}
add();
})();
