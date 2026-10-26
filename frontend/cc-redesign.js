/* cc-redesign.js v1 (section 2 of 2): the redesign structure. 5 tabs (Home, Explore, Market, Watch, Me),
   search pill + settings gear on top, Videos|Live switch inside Watch, Rewards inside Me. Old pages stay, nothing is removed. */
(function(){'use strict';
if(window.__crdBase)return;window.__crdBase=1;
var $=function(s,r){return(r||document).querySelector(s)};
var ICO={home:'<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',watch:'<rect x="3" y="5" width="18" height="14" rx="4"/><path d="M10 9l5 3-5 3z"/>',search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'};
var svg=function(k){return '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+ICO[k]+'</svg>'};
var click=function(s){var b=$(s);if(b)b.click()};
var go=function(v){click('#tb button[data-v="'+v+'"]')};
function relabel(){
 var f=$('#tb button[data-v="feed"]'),w=$('#tb button[data-v="videos"]');
 if(f&&!f.dataset.cr){f.dataset.cr=1;f.innerHTML=svg('home')+'Home'}
 if(w&&!w.dataset.cr){w.dataset.cr=1;w.innerHTML=svg('watch')+'Watch'}
 var h=$('#v-videos .ph');if(h)h.textContent='Watch';
 var l=$('#v-live .ph');if(l)l.textContent='Watch';
 var mb=$('#v-mbogi .ph');if(mb)mb.textContent='Watch';
}
function topbar(){
 var n=document.querySelector('body>nav.g:not(#tb)');if(!n||$('.crd-search',n))return;
 var s=document.createElement('button');s.type='button';s.className='crd-search';s.setAttribute('aria-label','Search anything');
 s.innerHTML=svg('search')+'Search anything...';s.onclick=function(){click('#fnd')};
 n.insertBefore(s,n.firstChild);
 var fnd=$('#fnd',n);if(fnd)fnd.style.display='none';
 if(!$('.crd-gear',n)){var g=document.createElement('button');g.type='button';g.className='ib crd-gear';g.setAttribute('aria-label','Settings');g.innerHTML=svg('gear');g.onclick=function(){click('#ccsettab')};
  var box=n.querySelector('.flex')||n;box.appendChild(g)}
}
function seg(){
 [['videos','Videos'],['live','Live'],['mbogi','Mbogi Talk']].forEach(function(p){
  var v=$('#v-'+p[0]);if(!v||$('.crd-seg',v))return;
  var d=document.createElement('div');d.className='crd-seg';
  d.innerHTML='<button type="button" data-sg="videos">Videos</button><button type="button" data-sg="live">Live</button><button type="button" data-sg="mbogi">Mbogi Talk</button>';
  d.onclick=function(e){var b=e.target.closest('button');if(b)go(b.dataset.sg)};
  var h=$('.ph',v);if(h&&h.nextSibling)h.parentNode.insertBefore(d,h.nextSibling);else v.insertBefore(d,v.firstChild);
 });
 document.querySelectorAll('.crd-seg').forEach(function(d){var cur=document.body.dataset.view;d.querySelectorAll('button').forEach(function(b){b.classList.toggle('on',b.dataset.sg===cur)})});
}
function rewards(){
 var me=$('#v-me');if(me&&!$('.crd-rw',me)){
  var b=document.createElement('button');b.type='button';b.className='crd-row crd-rw';
  b.innerHTML='<span style="width:42px;height:42px;border-radius:14px;background:rgba(255,138,61,.13);display:grid;place-items:center;flex:none">'+svg('star')+'</span><span style="flex:1"><b>Rewards and points</b><small>Spend points, invite friends, top referrers</small></span>';
  b.onclick=function(){go('rewards')};
  var c=$('#mecard',me);if(c&&c.parentNode)c.parentNode.insertBefore(b,c.nextSibling);else me.appendChild(b);
  if(c)c.classList.add('crdblob');
 }
 var r=$('#v-rewards');if(r&&!$('.crd-back',r)){var k=document.createElement('button');k.type='button';k.className='crd-back';k.textContent='\u2190 Me';k.onclick=function(){go('me')};r.insertBefore(k,r.firstChild)}
}
function sync(){
 var v=document.body.dataset.view,t=document.getElementById('tb');if(!t)return;
 var w=$('button[data-v="videos"]',t),m=$('button[data-v="me"]',t);
 if(w)w.classList.toggle('on2',v==='live'||v==='mbogi');
 if(m)m.classList.toggle('on2',v==='rewards');
 document.querySelectorAll('.crd-seg').forEach(function(d){d.querySelectorAll('button').forEach(function(b){b.classList.toggle('on',b.dataset.sg===v)})});
}
function run(){relabel();topbar();seg();rewards();sync()}
function start(){run();
 new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['data-view']});
 var n=0,iv=setInterval(function(){run();if(++n>20)clearInterval(iv)},500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
