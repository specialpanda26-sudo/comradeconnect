// Hides any [data-live-metric] element unless its [data-live-url] parent holds a valid stream link.
(function(){
  function ok(u){return /^https:\/\/(www\.|vm\.)?(youtube\.com|youtu\.be|tiktok\.com|twitch\.tv|facebook\.com|fb\.watch)\//i.test(u||'')}
  function run(){
    document.querySelectorAll('[data-live-metric]').forEach(function(el){
      var box=el.closest('[data-live-url]');
      el.style.display=ok(box?box.getAttribute('data-live-url'):'')?'':'none';
    });
  }
  window.ccLiveApply=run;
  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-live-url']});
  document.addEventListener('DOMContentLoaded',run);
})();
