(function(){
  var K='cc_campus';
  window.ccChangeCampus=function(){try{localStorage.removeItem(K)}catch(e){}location.reload()};
  try{if(localStorage.getItem(K))return}catch(e){return}
  var FB=[{id:'kirinyaga',name:'Kirinyaga University'},{id:'uon',name:'University of Nairobi'}];
  var st=document.createElement('style');
  st.textContent='#ccu{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,8,18,.72);backdrop-filter:blur(10px)}#ccu .cd{width:100%;max-width:420px;max-height:86vh;display:flex;flex-direction:column;padding:20px;border-radius:24px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);box-shadow:0 20px 60px rgba(0,0,0,.45);backdrop-filter:blur(18px);color:#fff;font-family:inherit;position:relative}#ccu h2{margin:0 0 4px;font-size:20px;padding-right:34px}#ccu p{margin:0 0 12px;opacity:.7;font-size:13px}#ccu input{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#fff;font-size:15px;outline:none;margin-bottom:10px}#ccu .ls{overflow:auto;display:flex;flex-direction:column;gap:6px}#ccu .it{text-align:left;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;font-size:14px;cursor:pointer}#ccu .it:active{background:rgba(255,255,255,.16)}#ccu .x{position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);color:#fff;font-size:18px;cursor:pointer}';
  document.head.appendChild(st);
  function show(list){
    var o=document.createElement('div');o.id='ccu';o.setAttribute('role','dialog');o.setAttribute('aria-label','Choose your university');
    var c=document.createElement('div');c.className='cd';
    var x=document.createElement('button');x.className='x';x.type='button';x.setAttribute('aria-label','Close');x.textContent='\u00d7';x.onclick=function(){o.remove()};
    var h=document.createElement('h2');h.textContent='Which university are you in?';
    var p=document.createElement('p');p.textContent='Your feed, events, hostels and more follow the university you pick.';
    var q=document.createElement('input');q.type='search';q.placeholder='Search universities';q.setAttribute('aria-label','Search universities');
    var ls=document.createElement('div');ls.className='ls';
    function draw(){
      var t=q.value.trim().toLowerCase();ls.textContent='';
      list.forEach(function(u){
        var n=(u.name||'')+' '+(u.short||'');
        if(t&&n.toLowerCase().indexOf(t)<0)return;
        var b=document.createElement('button');b.type='button';b.className='it';b.textContent=u.name;
        b.onclick=function(){try{localStorage.setItem(K,u.id);localStorage.setItem('cc_campus_name',u.name)}catch(e){}location.reload()};
        ls.appendChild(b);
      });
    }
    q.oninput=draw;draw();
    c.appendChild(x);c.appendChild(h);c.appendChild(p);c.appendChild(q);c.appendChild(ls);o.appendChild(c);document.body.appendChild(o);
  }
  function go(){
    var api=(typeof CC_API!=='undefined'&&CC_API)||'';
    fetch(api+'/api/campuses').then(function(r){return r.json()}).then(function(d){show(d&&d.campuses&&d.campuses.length?d.campuses:FB)}).catch(function(){show(FB)});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();
})();
