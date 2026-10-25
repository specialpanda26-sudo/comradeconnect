/* cc-proto-fix.js v1: every panel gets a close X. Panels without a header (like Paying) had none. */
(function(){'use strict';
function shut(s){var c=window.closeSheet;if(typeof c==='function'){c();return}s.classList.remove('on');var g=document.getElementById('sbg');if(g)g.classList.remove('on')}
setInterval(function(){var s=document.getElementById('sheet');if(!s||!s.classList.contains('on'))return;
 if(s.querySelector('[data-act="closesheet"],.ccx'))return;
 var b=document.createElement('button');b.type='button';b.className='ccx';b.setAttribute('aria-label','Close');
 b.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
 b.onclick=function(){shut(s)};s.appendChild(b)},250);
})();
