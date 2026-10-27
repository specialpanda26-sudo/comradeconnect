// ccFetch(url, opts, ttlMs): cached JSON GET. Falls back to the last saved copy when offline.
// Use for public data (events, notices, listings), not per-user private data.
(function(){
  var P='cc_cache:';
  window.ccFetch=async function(url,opts,ttl){
    ttl=ttl||60000;var k=P+(function(){try{return localStorage.getItem('cc_campus')||''}catch(e){return ''}})()+'|'+url,now=Date.now(),hit=null;
    try{hit=JSON.parse(localStorage.getItem(k)||'null')}catch(e){}
    if(hit&&now-hit.t<ttl)return hit.d;
    try{
      var r=await fetch(url,opts);if(!r.ok)throw new Error(r.status);
      var d=await r.json();
      try{localStorage.setItem(k,JSON.stringify({t:now,d:d}))}catch(e){}
      return d;
    }catch(e){if(hit)return hit.d;throw e}
  };
  window.ccCacheClear=function(){
    Object.keys(localStorage).forEach(function(k){if(k.indexOf(P)===0)localStorage.removeItem(k)});
  };
})();
