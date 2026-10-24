/* cc-campus.js: university picker for every university in Kenya.
   - Opens the first time, and any time you tap the location chip ("Kirinyaga University . Change").
   - "Use my location" sorts the list by distance and shows the nearest ones first.
   - The full list is also built in here, so the picker never shrinks to two names when the server is slow. */
(function(){
  'use strict';
  var K='cc_campus';
  var ALL=[
["kirinyaga","Kirinyaga University","Kirinyaga",-0.4986,37.2806],
["uon","University of Nairobi","UoN",-1.2794,36.8167],
["ku","Kenyatta University","KU",-1.1807,36.93],
["jkuat","Jomo Kenyatta University of Agriculture and Technology","JKUAT",-1.091,37.012],
["moi","Moi University","Moi",0.287,35.305],
["egerton","Egerton University","Egerton",-0.372,35.933],
["maseno","Maseno University","Maseno",-0.003,34.6],
["mmust","Masinde Muliro University of Science and Technology","MMUST",0.286,34.762],
["dekut","Dedan Kimathi University of Technology","DeKUT",-0.402,36.959],
["tuk","Technical University of Kenya","TU-K",-1.297,36.823],
["tum","Technical University of Mombasa","TUM",-4.039,39.668],
["pwani","Pwani University","Pwani",-3.629,39.851],
["uoeld","University of Eldoret","UoEld",0.58,35.33],
["chuka","Chuka University","Chuka",-0.333,37.65],
["laikipia","Laikipia University","Laikipia",0.03,36.36],
["must","Meru University of Science and Technology","MUST",0.09,37.63],
["embu","Embu University","Embu",-0.54,37.45],
["kisii","Kisii University","Kisii",-0.677,34.77],
["karatina","Karatina University","Karatina",-0.483,37.127],
["machakos","Machakos University","Machakos",-1.52,37.26],
["mmu","Multimedia University of Kenya","MMU",-1.41,36.75],
["seku","South Eastern Kenya University","SEKU",-1.35,38.01],
["ttu","Taita Taveta University","TTU",-3.39,38.56],
["jooust","Jaramogi Oginga Odinga University","JOOUST",-0.1,34.27],
["garissa","Garissa University","Garissa",-0.46,39.64],
["kibabii","Kibabii University","Kibabii",0.6,34.58],
["mut","Murang'a University of Technology","MUT",-0.72,37.15],
["rongo","Rongo University","Rongo",-0.76,34.6],
["kabianga","University of Kabianga","Kabianga",-0.37,35.24],
["cuk","Co-operative University of Kenya","CUK",-1.33,36.71],
["tmu","Tom Mboya University","TMU",-0.53,34.45],
["alupe","Alupe University","Alupe",0.49,34.13],
["strathmore","Strathmore University","Strathmore",-1.31,36.812],
["usiu","United States International University Africa","USIU",-1.219,36.883],
["cuea","Catholic University of Eastern Africa","CUEA",-1.35,36.7],
["daystar","Daystar University","Daystar",-1.45,36.99],
["mku","Mount Kenya University","MKU",-1.039,37.083],
["kca","KCA University","KCA",-1.235,36.878],
["kemu","Kenya Methodist University","KeMU",0.05,37.65],
["anu","Africa Nazarene University","ANU",-1.4,36.76],
["riara","Riara University","Riara",-1.305,36.77],
["zetech","Zetech University","Zetech",-1.15,36.96],
["kabarak","Kabarak University","Kabarak",-0.1667,35.9667],
["kaimosi","Kaimosi Friends University","Kaimosi",0.1167,34.8667],
["gretsa","Gretsa University","Gretsa",-1.0333,37.0833],
["tharaka","Tharaka University","Tharaka",-0.2,37.9],
["lukenya","Lukenya University","Lukenya",-2.6833,38.1667],
["turkana","Turkana University College","Turkana",3.1167,35.6],
["koitaleel","Koitaleel Samoei University College","Koitaleel",0.18,35.1],
["bomet","Bomet University College","Bomet",-0.7833,35.3417],
["kheu","Kenya Highlands Evangelical University","KHEU",-0.3667,35.28],
["panac","Pan Africa Christian University","PAC",-1.2214,36.8993],
["spu","St. Paul's University","St Paul's",-1.1333,36.6333],
["pueac","Presbyterian University of East Africa","PUEA",-1.25,36.6667],
["mua","Management University of Africa","MUA",-1.2833,36.8],
["gluk","Great Lakes University of Kisumu","GLUK",-0.1,34.75],
["aiu","Africa International University","AIU",-1.3333,36.7],
["scott","Scott Christian University","Scott",-1.4167,37.4],
["other","Other university or college","Other",-0.0236,37.9062]
  ].map(function(a){return{id:a[0],name:a[1],short:a[2],lat:a[3],lng:a[4]}});
  var open=false;
  function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
  function cur(){try{return localStorage.getItem(K)||''}catch(e){return ''}}
  function curName(){try{return localStorage.getItem('cc_campus_name')||'Kirinyaga University'}catch(e){return 'Kirinyaga University'}}
  function km(a,b,c,d){var r=Math.PI/180,x=(c-a)*r,y=(d-b)*r,h=Math.sin(x/2)*Math.sin(x/2)+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)*Math.sin(y/2);return 12742*Math.asin(Math.sqrt(h))}
  var PIN='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
  var st=el('style');
  st.textContent='#ccuniv{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,8,18,.72);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}'
  +'#ccuniv .cd{width:100%;max-width:420px;max-height:88vh;display:flex;flex-direction:column;padding:20px;border-radius:24px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);box-shadow:0 20px 60px rgba(0,0,0,.45);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);color:#fff;font-family:inherit;position:relative}'
  +'#ccuniv h2{margin:0 0 4px;font-size:20px;padding-right:34px}#ccuniv p{margin:0 0 12px;opacity:.7;font-size:13px;line-height:1.5}'
  +'#ccuniv input{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#fff;font-size:15px;outline:none;margin-bottom:10px}'
  +'#ccuniv .ls{overflow:auto;display:flex;flex-direction:column;gap:6px;min-height:120px}'
  +'#ccuniv .it{display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;font-size:14px;cursor:pointer;font-family:inherit}'
  +'#ccuniv .it small{opacity:.65;font-size:12px;white-space:nowrap}#ccuniv .it.on{border-color:rgba(168,220,231,.8);background:rgba(168,220,231,.16)}#ccuniv .it:active{background:rgba(255,255,255,.16)}'
  +'#ccuniv .hd{margin:8px 2px 2px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;opacity:.6}'
  +'#ccuniv .loc{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px 14px;margin-bottom:10px;border-radius:14px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.14);color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}'
  +'#ccuniv .msg{margin:0 0 8px;font-size:12px;opacity:.8}'
  +'#ccuniv .x{position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);color:#fff;font-size:18px;cursor:pointer}'
  +'.ccc-chip{display:inline-flex;align-items:center;gap:8px;max-width:100%;margin:0 0 8px;padding:8px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:inherit;font:500 13px Poppins,sans-serif;cursor:pointer}'
  +'.ccc-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ccc-chip u{text-decoration:none;opacity:.7}';
  document.head.appendChild(st);

  function choose(u){
    try{localStorage.setItem(K,u.id);localStorage.setItem('cc_campus_name',u.name);localStorage.setItem('cc_campus_short',u.short||'')}catch(e){}
    location.reload();
  }
  function show(list,must){
    if(open)return;open=true;
    var o=el('div');o.id='ccuniv';o.setAttribute('role','dialog');o.setAttribute('aria-label','Choose your university');
    var c=el('div','cd');
    function close(){o.remove();open=false}
    if(!must){var x=el('button','x','\u00d7');x.type='button';x.setAttribute('aria-label','Close');x.onclick=close;c.appendChild(x)}
    c.appendChild(el('h2','','Which university are you in?'));
    c.appendChild(el('p','','Your feed, events, hostels and more follow the university you pick. Tap Use my location and we show the ones closest to you.'));
    var lb=el('button','loc');lb.type='button';lb.innerHTML=PIN+'<span>Use my location</span>';c.appendChild(lb);
    var msg=el('p','msg');msg.hidden=true;c.appendChild(msg);
    var q=el('input');q.type='search';q.placeholder='Search universities';q.setAttribute('aria-label','Search universities');c.appendChild(q);
    var ls=el('div','ls');c.appendChild(ls);
    var dist=null;
    function item(u){
      var b=el('button','it'+(u.id===cur()?' on':''));b.type='button';b.appendChild(el('span','',u.name));
      if(dist&&dist[u.id]!=null)b.appendChild(el('small','',dist[u.id]<10?dist[u.id].toFixed(1)+' km':Math.round(dist[u.id])+' km'));
      b.onclick=function(){choose(u)};return b;
    }
    function draw(){
      var t=q.value.trim().toLowerCase();ls.textContent='';
      var arr=list.filter(function(u){return u.id!=='other'&&(!t||((u.name||'')+' '+(u.short||'')).toLowerCase().indexOf(t)>=0)});
      var other=list.filter(function(u){return u.id==='other'&&(!t||'other university college'.indexOf(t)>=0)});
      if(dist){
        arr.sort(function(a,b){return dist[a.id]-dist[b.id]});
        if(!t){ls.appendChild(el('div','hd','Closest to you'));arr.slice(0,3).forEach(function(u){ls.appendChild(item(u))});ls.appendChild(el('div','hd','All universities, nearest first'));}
      }
      arr.forEach(function(u){ls.appendChild(item(u))});
      other.forEach(function(u){ls.appendChild(item(u))});
      if(!ls.children.length)ls.appendChild(el('p','msg','No match. Try another name, or pick Other.'));
    }
    lb.onclick=function(){
      if(!navigator.geolocation){msg.hidden=false;msg.textContent='This phone cannot share its location. Pick from the list.';return}
      msg.hidden=false;msg.textContent='Finding where you are...';
      navigator.geolocation.getCurrentPosition(function(p){
        dist={};list.forEach(function(u){if(u.lat!=null&&u.id!=='other')dist[u.id]=km(p.coords.latitude,p.coords.longitude,u.lat,u.lng)});
        var near=list.filter(function(u){return dist[u.id]!=null}).sort(function(a,b){return dist[a.id]-dist[b.id]})[0];
        msg.textContent=near&&dist[near.id]<60?'You seem to be near '+near.name+'. Tap it, or pick another.':'No listed university is close to you. Pick yours from the list.';
        ls.scrollTop=0;draw();
      },function(e){msg.textContent=e&&e.code===1?'Location is blocked. Allow it in your browser settings, or pick from the list.':'Could not get your location. Pick from the list.'},{enableHighAccuracy:false,timeout:12000,maximumAge:600000});
    };
    q.oninput=draw;draw();
    o.appendChild(c);document.body.appendChild(o);
  }
  function go(must){
    var api=(typeof CC_API!=='undefined'&&CC_API)||'';
    show(ALL,must);   // show at once; the server list only adds universities this build does not know yet
    fetch(api+'/api/campuses').then(function(r){return r.json()}).then(function(d){
      if(!(d&&d.campuses&&d.campuses.length))return;
      var have={};ALL.forEach(function(u){have[u.id]=1});
      var add=d.campuses.filter(function(u){return !have[u.id]});
      if(add.length){add.forEach(function(u){ALL.splice(ALL.length-1,0,u)});var o=document.getElementById('ccuniv');if(o){o.remove();open=false;show(ALL,must)}}
    }).catch(function(){});
  }
  window.ccChangeCampus=function(){go(false)};

  /* the location chip: "Kirinyaga University . Change" */
  function chip(){
    var v=document.getElementById('v-feed');if(!v||document.getElementById('ccLocChip'))return;
    var w=el('div'),b=el('button','ccc-chip');b.id='ccLocChip';b.type='button';b.setAttribute('aria-label','Change your university');
    b.innerHTML=PIN;b.appendChild(el('span','',curName()));b.appendChild(el('u','','Change'));
    b.onclick=function(){go(false)};w.appendChild(b);v.insertBefore(w,v.firstChild);
  }
  function start(){chip();new MutationObserver(chip).observe(document.body,{childList:true,subtree:true})}
  if(!cur()){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){go(true)});else go(true)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
