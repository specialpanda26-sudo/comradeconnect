(function(){
  var id,name,sh;
  try{id=localStorage.getItem('cc_campus');name=localStorage.getItem('cc_campus_name');sh=localStorage.getItem('cc_campus_short')}catch(e){}
  if(!name)name='Kirinyaga University';
  var short=sh||name.replace(/^University of /,'').replace(/ University.*$/,'');
  window.ccCampusName=name;window.ccCampusShort=short;
  var ATTR=['placeholder','title','aria-label','alt','content'];
  function fix(t){
    return t.replace(/Kirinyaga University/g,name).replace(/Kirinyaga Edition/g,short+' Edition')
      .replace(/kirinyaga_updates/g,short.toLowerCase().replace(/[^a-z0-9]/g,'')+'_updates').replace(/Kirinyaga/g,short);
  }
  var same=(!id||id==='kirinyaga');
  function skip(v){return v.indexOf('Kirinyaga')<0&&v.indexOf('kirinyaga_')<0||/founded|Kerugoya/i.test(v)}
  function walk(){
    var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null),n,list=[];
    while((n=w.nextNode())){
      var p=n.parentNode&&n.parentNode.nodeName;
      if(/^(SCRIPT|STYLE|TEXTAREA|INPUT|NOSCRIPT)$/.test(p))continue;
      if(skip(n.nodeValue))continue;
      list.push(n);
    }
    list.forEach(function(x){x.nodeValue=fix(x.nodeValue)});
    ATTR.forEach(function(a){
      document.querySelectorAll('body ['+a+'*="Kirinyaga"]').forEach(function(el){
        var v=el.getAttribute(a)||'';if(!skip(v))el.setAttribute(a,fix(v));
      });
    });
    document.title=fix(document.title);
    document.querySelectorAll('meta[name="description"],meta[property="og:description"]').forEach(function(m){m.content=fix(m.content)});
  }
  var q=0;function run(){if(q)return;q=requestAnimationFrame(function(){q=0;walk()})}
  function btn(){
    var cp=document.querySelector('.cp');if(!cp||document.getElementById('ccchg'))return;
    var b=document.createElement('button');b.id='ccchg';b.type='button';b.textContent='Change university ('+short+')';
    b.style.cssText='display:block;margin:10px auto;padding:8px 16px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);backdrop-filter:blur(8px);color:inherit;font:inherit;font-size:12px;cursor:pointer';
    b.onclick=function(){if(window.ccChangeCampus)ccChangeCampus()};
    cp.parentNode.insertBefore(b,cp.nextSibling);
  }
  function start(){if(!same)walk();btn();new MutationObserver(function(){if(!same)run();btn()}).observe(document.body,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
