(function(){
  var id,name;
  try{id=localStorage.getItem('cc_campus');name=localStorage.getItem('cc_campus_name')}catch(e){}
  if(!id||id==='kirinyaga'||!name)return;
  var short=name.replace(/^University of /,'').replace(/ University.*$/,'');
  function fix(t){
    return t.replace(/Kirinyaga University/g,name).replace(/Kirinyaga Edition/g,short+' Edition').replace(/Kirinyaga comrades/g,short+' comrades').replace(/Kirinyaga campus/g,short+' campus');
  }
  function walk(){
    var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null),n,list=[];
    while((n=w.nextNode())){
      var p=n.parentNode&&n.parentNode.nodeName;
      if(/^(SCRIPT|STYLE|TEXTAREA|INPUT|NOSCRIPT)$/.test(p))continue;
      if(n.nodeValue.indexOf('Kirinyaga')<0||/founded/i.test(n.nodeValue))continue;
      list.push(n);
    }
    list.forEach(function(x){x.nodeValue=fix(x.nodeValue)});
    document.title=fix(document.title);
    var m=document.querySelector('meta[name="description"]');if(m)m.content=fix(m.content);
  }
  var q=0;function run(){if(q)return;q=requestAnimationFrame(function(){q=0;walk()})}
  function btn(){
    var cp=document.querySelector('.cp');if(!cp||document.getElementById('ccchg'))return;
    var b=document.createElement('button');b.id='ccchg';b.type='button';b.textContent='Change university ('+short+')';
    b.style.cssText='display:block;margin:10px auto;padding:8px 16px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);backdrop-filter:blur(8px);color:inherit;font:inherit;font-size:12px;cursor:pointer';
    b.onclick=function(){if(window.ccChangeCampus)ccChangeCampus()};
    cp.parentNode.insertBefore(b,cp.nextSibling);
  }
  function start(){walk();btn();new MutationObserver(function(){run();btn()}).observe(document.body,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
