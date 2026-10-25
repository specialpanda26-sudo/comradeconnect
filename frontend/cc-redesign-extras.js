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
/* blob cards stay light in dark mode, so their text and dark buttons must stay ink */\
html:root body #v-feed .hero.hero h1,html:root body #v-feed .hero.hero p,html:root body #v-feed .hero.hero .gr,html:root body #v-feed .hero.hero small,html:root body #v-feed .hero.hero a,html:root body .mecard.mecard h1,html:root body .mecard.mecard h2,html:root body .mecard.mecard p,html:root body .mecard.mecard small,html:root body .mecard.mecard b{color:#16130f!important}\
html:root body #v-feed .hero.hero .btn.p,html:root body .mecard.mecard .btn.p{background:#16130f!important;color:#fff!important}\
html:root body #v-feed .hero.hero .btn.g,html:root body .mecard.mecard .btn.g{background:rgba(255,255,255,.85)!important;color:#16130f!important}\
html:root body .mecard.mecard.crdblob,html:root body .box.g.crdblob.crdblob,html:root body #ccwtop.ccwtop.box,html:root body #v-market .box.g.mtrust.mtrust,html:root body #v-me #ccwtop.box.g{background:#fff8f4!important;background-image:none!important}\
html:root body #v-market .mtrust.mtrust *:not(button):not(.btn):not(svg):not(path),html:root body #ccwtop *:not(button):not(.btn):not(svg):not(path),html:root body .crdblob.crdblob *:not(button):not(.btn):not(svg):not(path):not(.pill){color:#16130f!important}\
html:root body .crdblob.crdblob button,html:root body .crdblob.crdblob .btn{color:#16130f!important}\
html:root body #v-market #mseg.mseg button.on,html:root body #v-market #mseg button.on.on{background:var(--ink)!important;color:var(--inkfg)!important}\
html body #kura,html body .kpage,html body .ksh,html body #kura *,html body .kpage *,html body .ksh *{font-family:Manrope,sans-serif!important}\
html body .kdot,html body .ksp em,html body .kt3:nth-child(2) .bd{background:#ee7a4f!important;color:#fff!important}\
html body .kbrand svg,html body .kpza svg,html body .kban svg,html body .kbo svg{color:#ee7a4f!important}\
html body .kh1 .ka{background:linear-gradient(90deg,#ff8a3d,#c4727a)!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important}\
html body .kpod .kt3:nth-child(2){border-color:#ee7a4f!important;box-shadow:0 0 0 1px rgba(238,122,79,.4),var(--sh)!important}\
html body .ksh{background:rgba(22,19,15,.55)!important}\
';
function add(){if(document.getElementById('crd-extras-css'))return;var s=document.createElement('style');s.id='crd-extras-css';s.textContent=CSS;document.head.appendChild(s)}
add();
})();
