/* cc-market-km.js v1: "about X km from you" under the seller map on the item sheet.
   Adds only. It wraps ccMkGeo.show and changes nothing else. Straight-line distance, worked out on the phone: your location is never sent anywhere. */
(function(){'use strict';
if(window.ccMkKm)return;
var me=null,meAt=0,RAD=Math.PI/180;
function ok(v,a){return typeof v==='number'&&isFinite(v)&&Math.abs(v)<=a}
function dist(a,b,c,d){var p=(c-a)*RAD,q=(d-b)*RAD,x=Math.sin(p/2)*Math.sin(p/2)+Math.cos(a*RAD)*Math.cos(c*RAD)*Math.sin(q/2)*Math.sin(q/2);return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function fmt(km){return km<1?'about '+Math.max(50,Math.round(km*20)*50)+' m':'about '+km.toFixed(1)+' km'}
function where(cb){
 if(me&&Date.now()-meAt<300000)return cb(me);
 if(!navigator.geolocation)return cb(null);
 navigator.geolocation.getCurrentPosition(function(p){
  var la=p.coords.latitude,ln=p.coords.longitude;
  if(!ok(la,90)||!ok(ln,180))return cb(null);
  me={lat:la,lng:ln};meAt=Date.now();cb(me)},
 function(){cb(null)},{enableHighAccuracy:false,timeout:8000,maximumAge:300000})}
function paint(l){
 var box=document.getElementById('mvmap');
 if(!box||!l||!ok(l.lat,90)||!ok(l.lng,180))return;
 var old=document.getElementById('mvkm');if(old)old.remove();
 var row=document.createElement('p');row.id='mvkm';row.className='note';row.style.cssText='margin:8px 2px 0';
 box.appendChild(row);
 function show(m){if(row.isConnected)row.textContent=fmt(dist(m.lat,m.lng,l.lat,l.lng))+' from you (straight line)'}
 function ask(msg){
  if(!row.isConnected)return;
  row.innerHTML=(msg?'<span style="display:block;margin-bottom:6px"></span>':'')+'<button type="button" class="btn g" style="width:100%">Show distance from me</button>';
  if(msg)row.firstChild.textContent=msg;
  var b=row.querySelector('button');
  b.onclick=function(){b.disabled=true;b.textContent='Finding you...';
   where(function(m){if(m)show(m);else ask('Could not get your location. Allow location access and try again.')})}}
 function quiet(){where(function(m){if(m)show(m);else ask()})}
 if(me&&Date.now()-meAt<300000)return show(me);
 try{navigator.permissions.query({name:'geolocation'}).then(function(r){if(r.state==='granted')quiet();else ask()},function(){ask()})}catch(e){ask()}}
function hook(){
 var g=window.ccMkGeo;if(!g||g.__km)return false;
 var o=g.show;g.show=function(l){var r=o.apply(this,arguments);try{paint(l)}catch(e){}return r};
 g.__km=1;return true}
if(!hook()){document.addEventListener('DOMContentLoaded',hook);setTimeout(hook,1500)}
window.ccMkKm={dist:dist};
})();
