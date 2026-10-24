/* cc-device.js: the device lock, app side (Section 2).
   In the Android app it reads the phone's Android ID (the hardware-backed id Android lets an app read) with the Capacitor Device plugin.
   In a browser there is no hardware id, so it uses a random id kept in the browser (weaker: clearing the browser resets it).
   Every sign-up / sign-in / passkey call to the API carries it as X-Device-Id and X-Device-Kind. The server keeps only a keyed hash. */
(function () {
  'use strict';
  if (window.ccDevice) return;
  var cap = window.Capacitor, native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  var cache = null;

  function rand() { var a = new Uint8Array(16); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function readCookie() { var m = /(?:^|; )cc_dev=([a-f0-9]{32})/.exec(document.cookie || ''); return m ? m[1] : ''; }
  function webId() {
    var id = ''; try { id = localStorage.getItem('cc_dev') || ''; } catch (e) {}
    if (!/^[a-f0-9]{32}$/.test(id)) id = readCookie();                    // second copy, in case the page storage was cleared
    if (!/^[a-f0-9]{32}$/.test(id)) id = rand();
    try { localStorage.setItem('cc_dev', id); } catch (e) {}
    try { document.cookie = 'cc_dev=' + id + ';max-age=63072000;path=/;SameSite=Lax' + (location.protocol === 'https:' ? ';Secure' : ''); } catch (e) {}
    return id;
  }
  function get() {
    if (cache) return cache;
    cache = (async function () {
      if (native) {
        try {
          var D = (cap.Plugins && cap.Plugins.Device) || (cap.registerPlugin ? cap.registerPlugin('Device') : null);
          var r = D && await D.getId(), id = r && (r.identifier || r.uuid);
          if (id && /^[A-Za-z0-9_-]{8,100}$/.test(String(id))) return { id: 'a_' + id, kind: 'app' };
        } catch (e) {}
      }
      return { id: 'w_' + webId(), kind: 'web' };
    })();
    return cache;
  }
  window.ccDevice = { get: get, native: native };

  // add the two headers to sign-up, sign-in and passkey calls (everything else is left alone)
  var f = window.fetch;
  window.fetch = function (input, init) {
    var u = typeof input === 'string' ? input : (input && input.url) || '';
    if (u.indexOf('/api/auth/') < 0 && u.indexOf('/api/passkey/') < 0) return f.apply(this, arguments);
    var self = this;
    return get().then(function (d) {
      init = Object.assign({}, init);
      var h = {}; var src = init.headers || (input && input.headers && typeof input !== 'string' ? input.headers : null);
      if (src && typeof src.forEach === 'function' && !Array.isArray(src)) src.forEach(function (v, k) { h[k] = v; }); else if (src) Object.assign(h, src);
      h['X-Device-Id'] = d.id; h['X-Device-Kind'] = d.kind; init.headers = h;
      return f.call(self, input, init);
    });
  };
})();
