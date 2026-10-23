// Hides live metrics (watching, comments, reactions, hearts) until a stream is embedded in #rframe.
(function(){
  function active(){
    var f=document.getElementById('rframe');
    return !!(f&&f.querySelector('iframe,a,video'));
  }
  function targets(){
    var h=document.getElementById('lheart');
    return [document.getElementById('rstats'),document.getElementById('rv'),h&&h.parentElement].filter(Boolean);
  }
  function run(){
    var on=active();
    targets().forEach(function(e){e.style.display=on?'':'none'});
  }
  document.addEventListener('DOMContentLoaded',run);
  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
  run();
})();
