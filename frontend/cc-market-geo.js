/* cc-market-geo.js v1: seller map pin. "Use my location" on the sell form, small OpenStreetMap view on the item sheet. Free, no key. */
(function(){'use strict';
if(window.ccMkGeo)return;
var pin=null,$=function(s){return document.querySelector(s)};
var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
function say(m){try{window.ccTools.toast(m)}catch(e){}}
function ok(v,a){return typeof v==='number'&&isFinite(v)&&Math.abs(v)<=a}
function paint(){var s=$('#mgs'),b=$('#mgb'),c=$('#mgc');if(!s)return;
 s.textContent=pin?'Pin saved ('+pin.lat.toFixed(4)+', '+pin.lng.toFixed(4)+'). Buyers will see it on the item.':'Optional. Shows buyers where you are.';
 b.textContent=pin?'Update my location':'Use my location';c.hidden=!pin}
function build(){
 var f=$('#mde'),fld=f&&f.closest('.fld');if(!fld||$('#mgrow'))return;
 var r=document.createElement('div');r.id='mgrow';r.style.cssText='margin:10px 0';
 r.innerHTML='<div class="two"><button type="button" class="btn g" id="mgb">Use my location</button><button type="button" class="btn g" id="mgc" hidden>Remove pin</button></div><p class="note" id="mgs" style="margin:6px 4px 0"></p><p class="note" style="margin:2px 4px 0">Meet in a safe public place on campus. Do not pin your hostel room.</p>';
 fld.parentNode.insertBefore(r,fld);
 $('#mgb').onclick=function(){var b=this;
  if(!navigator.geolocation)return say('Location is not available here');
  b.disabled=true;b.textContent='Finding you...';
  navigator.geolocation.getCurrentPosition(function(p){
   var la=Math.round(p.coords.latitude*1e5)/1e5,ln=Math.round(p.coords.longitude*1e5)/1e5;
   b.disabled=false;if(!ok(la,90)||!ok(ln,180)){pin=null;paint();return say('Could not read your location. Try again.')}
   pin={lat:la,lng:ln};paint()},
  function(){b.disabled=false;paint();say('Could not get your location. Allow location access and try again.')},{enableHighAccuracy:true,timeout:10000,maximumAge:60000})};
 $('#mgc').onclick=function(){pin=null;paint()};paint()}
function show(l){var old=$('#mvmap');if(old)old.remove();
 var v=$('#mvb');if(!v||!l||!ok(l.lat,90)||!ok(l.lng,180)||(l.lat===0&&l.lng===0))return;
 var la=l.lat,ln=l.lng,d=0.004,bb=[ln-d,la-d*.75,ln+d,la+d*.75].join(',');
 var src='https://www.openstreetmap.org/export/embed.html?bbox='+bb+'&layer=mapnik&marker='+la+','+ln;
 var link='https://www.google.com/maps?q='+la+','+ln;
 var m=document.createElement('div');m.id='mvmap';m.style.cssText='margin:12px 0';
 m.innerHTML='<div class="flex items-center justify-between" style="margin-bottom:8px"><b style="font-size:14px">Seller location</b><a href="'+esc(link)+'" target="_blank" rel="noopener" style="font-size:13px;font-weight:700;color:var(--fg)">Open in Maps</a></div><iframe title="Seller location map" loading="lazy" referrerpolicy="no-referrer" src="'+esc(src)+'" style="width:100%;height:170px;border:0;border-radius:18px;display:block"></iframe>';
 v.appendChild(m)}
var rs=window.resetSell;window.resetSell=function(){pin=null;try{paint()}catch(e){}if(rs)return rs.apply(this,arguments)};
window.ccMkGeo={get:function(){return pin?{lat:pin.lat,lng:pin.lng}:{}},show:show};
build();document.addEventListener('DOMContentLoaded',build);setTimeout(build,1500);
})();
