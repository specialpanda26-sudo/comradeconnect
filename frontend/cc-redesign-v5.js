/* cc-redesign-v5.js: animated full Continue with Google button, and cards that react to taps and tab switches. */
(function(){'use strict';
if(window.__crdV5)return;window.__crdV5=1;
var CSS=`
@keyframes crdGIn{from{opacity:0;transform:translateY(10px) scale(.92)}to{opacity:1;transform:none}}
@keyframes crdGSw{0%{transform:translateX(-130%) skewX(-18deg)}60%,100%{transform:translateX(230%) skewX(-18deg)}}
@keyframes crdGHalo{0%,100%{box-shadow:0 8px 22px rgba(238,122,79,.16)}50%{box-shadow:0 10px 30px rgba(238,122,79,.4)}}
@keyframes crdCardIn{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}
html body .crd-gw.crd-gw,html body .cc-gbtn.cc-gbtn{position:relative;overflow:hidden;border-radius:999px;animation:crdGIn .5s cubic-bezier(.2,.9,.3,1.2) both,crdGHalo 3.2s ease-in-out .6s infinite;transition:transform .2s cubic-bezier(.2,.9,.3,1.3)}
html body .crd-gw.crd-gw{display:flex;justify-content:center;width:fit-content;max-width:100%;margin-left:auto;margin-right:auto}
html body .crd-gw::before,html body .cc-gbtn::before{content:"";position:absolute;top:0;bottom:0;left:0;width:40%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent);pointer-events:none;z-index:2;animation:crdGSw 3.6s ease-in-out 1s infinite}
html body .crd-gw:hover,html body .cc-gbtn:hover{transform:translateY(-2px) scale(1.03)}
html body .crd-gw:active,html body .cc-gbtn:active{transform:scale(.95)}
html body .cc-gbtn.cc-gbtn{width:auto;min-width:230px;height:50px;padding:0 24px 0 16px;gap:12px;background:#fff;color:#16130f;font:700 15px Manrope,sans-serif}
html body .cc-gbtn::after{content:"Continue with Google"}
html body :is(#v-feed,#v-explore,#v-market,#v-videos,#v-me) :is(.box.g,.crd-row,.pcard,.cct,.vcard,.mecard){transition:transform .22s cubic-bezier(.2,.9,.3,1.25),box-shadow .22s,background-color .2s}
html body :is(#v-feed,#v-explore,#v-market,#v-videos,#v-me) :is(.box.g:not(:has(input,textarea,select)),.crd-row,.pcard,.cct,.vcard):active{transform:scale(.97)}
@media(hover:hover){html body :is(#v-feed,#v-explore,#v-market,#v-videos,#v-me) :is(.crd-row,.pcard,.cct,.vcard,.box.g:has(button,a)):hover:not(:active){transform:translateY(-3px);box-shadow:0 16px 34px rgba(140,80,50,.18)}}
html body .crd-enter :is(.box.g,.crd-row,.pcard,.mecard,.hero,.cct,.vcard){animation:crdCardIn .5s cubic-bezier(.2,.8,.3,1) both}
html body .crd-enter :is(.box.g,.crd-row,.pcard,.mecard,.hero):nth-child(2){animation-delay:.06s}
html body .crd-enter :is(.box.g,.crd-row,.pcard,.mecard,.hero):nth-child(3){animation-delay:.12s}
html body .crd-enter :is(.box.g,.crd-row,.pcard,.mecard,.hero):nth-child(4){animation-delay:.18s}
html body .crd-enter :is(.box.g,.crd-row,.pcard,.mecard,.hero):nth-child(n+5){animation-delay:.24s}
@media(prefers-reduced-motion:reduce){html body .crd-gw,html body .cc-gbtn,html body .crd-gw::before,html body .cc-gbtn::before,html body .crd-enter *{animation:none!important;transition:none!important}}
`;
var st=document.createElement('style');st.id='crd-v5-css';st.textContent=CSS;document.head.appendChild(st);
function patchG(){try{var g=window.google&&google.accounts&&google.accounts.id;if(!g)return false;if(g.__crdP)return true;g.__crdP=1;var o=g.renderButton;
 g.renderButton=function(box,opt){var dk=document.documentElement.dataset.theme==='dark',pw=box&&box.parentNode&&box.parentNode.clientWidth||300,w=Math.max(220,Math.min(320,pw-8));
  var n=Object.assign({},opt||{},{type:'standard',shape:'pill',text:'continue_with',theme:dk?'filled_black':'outline',size:'large',width:w,logo_alignment:'left'});
  try{box.classList.add('crd-gw')}catch(e){}return o.call(g,box,n)};return true}catch(e){return false}}
var gt=setInterval(function(){if(patchG())clearInterval(gt)},500);
var tbar=document.getElementById('tb');
if(tbar)tbar.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('button[data-v]');if(!b)return;
 setTimeout(function(){var v=document.getElementById('v-'+b.dataset.v);if(!v)return;v.classList.remove('crd-enter');void v.offsetWidth;v.classList.add('crd-enter');setTimeout(function(){v.classList.remove('crd-enter')},1000)},30)});
})();
