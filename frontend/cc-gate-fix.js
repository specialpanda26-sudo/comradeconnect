/* cc-gate-fix.js v1: sign-up invite code opens and closes like a panel; the header curve keeps one fixed height. */
(function(){'use strict';
var CSS='.app.a{--ch:236px}.app.a.su{--ch:218px}.app.a.typ{--ch:236px}.app.a.su.typ{--ch:218px}'
+'.su .brand{top:calc(env(safe-area-inset-top,0px) + 30px)}.app .cv{transition:none}'
+'.invb{all:unset;cursor:pointer;display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;padding:14px 16px;border-radius:18px;background:var(--aqt);font-size:14px;font-weight:500;color:var(--ink)}'
+'.invb span{flex:1}.invb svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}'
+'.invb .ch{transition:transform .3s}.inv.open .ch{transform:rotate(180deg)}'
+'.invbox{display:grid;grid-template-rows:0fr;transition:grid-template-rows .35s cubic-bezier(.22,1,.36,1)}.inv.open .invbox{grid-template-rows:1fr}'
+'.invbox>div{overflow:hidden;min-height:0}.inv.open .invbox>div{padding-top:10px}';
var ICON='<svg viewBox="0 0 24 24"><path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3z"/><path d="M14 6v12" stroke-dasharray="2 2.5"/></svg>';
var CH='<svg class="ch" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
function apply(r){
 if(r.getElementById('ccgfx'))return;
 var st=document.createElement('style');st.id='ccgfx';st.textContent=CSS;r.appendChild(st);
 var sr=r.getElementById('sr');if(!sr)return;
 var f=sr.closest('.f');if(!f||f.classList.contains('inv'))return;
 var inp=sr.parentNode;
 f.className='f inv';f.id='inv';f.innerHTML='';
 var b=document.createElement('button');b.type='button';b.className='invb';b.id='invb';b.setAttribute('aria-expanded','false');
 b.innerHTML=ICON+'<span>I have an invite code</span>'+CH;
 var box=document.createElement('div');box.className='invbox';var w=document.createElement('div');w.appendChild(inp);box.appendChild(w);
 f.appendChild(b);f.appendChild(box);
 function set(o){f.classList.toggle('open',o);b.setAttribute('aria-expanded',o?'true':'false');if(o)setTimeout(function(){sr.focus()},380)}
 b.onclick=function(){set(!f.classList.contains('open'))};
 var n=0,t=setInterval(function(){if(sr.value){set(true);clearInterval(t)}else if(++n>20)clearInterval(t)},250);
}
var tries=0,iv=setInterval(function(){var h=document.getElementById('ccgate'),r=h&&h.shadowRoot;
 if(r&&r.getElementById('sr')){apply(r);clearInterval(iv)}else if(++tries>120)clearInterval(iv)},150);
})();
