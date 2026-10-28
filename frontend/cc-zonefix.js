/* cc-zonefix.js: "Best zones" no longer dead-ends on "not found".
   If the server answers with an error or an empty list, it retries by itself: first with the university's own coordinates,
   then with a wider radius (up to 20 km). If the server still has nothing, it shows the zones already saved in the app. */
(function () {
  'use strict';
  if (window.__ccZoneFix) return; window.__ccZoneFix = 1;
  var CAMPUS = {"kirinyaga":[-0.4986,37.2806],"uon":[-1.2794,36.8167],"ku":[-1.1807,36.93],"jkuat":[-1.091,37.012],"moi":[0.287,35.305],"egerton":[-0.372,35.933],"maseno":[-0.003,34.6],"mmust":[0.286,34.762],"dekut":[-0.402,36.959],"tuk":[-1.297,36.823],"tum":[-4.039,39.668],"pwani":[-3.629,39.851],"uoeld":[0.58,35.33],"chuka":[-0.333,37.65],"laikipia":[0.03,36.36],"must":[0.09,37.63],"embu":[-0.54,37.45],"kisii":[-0.677,34.77],"karatina":[-0.483,37.127],"machakos":[-1.52,37.26],"mmu":[-1.41,36.75],"seku":[-1.35,38.01],"ttu":[-3.39,38.56],"jooust":[-0.1,34.27],"garissa":[-0.46,39.64],"kibabii":[0.6,34.58],"mut":[-0.72,37.15],"rongo":[-0.76,34.6],"kabianga":[-0.37,35.24],"cuk":[-1.33,36.71],"tmu":[-0.53,34.45],"alupe":[0.49,34.13],"strathmore":[-1.31,36.812],"usiu":[-1.219,36.883],"cuea":[-1.35,36.7],"daystar":[-1.45,36.99],"mku":[-1.039,37.083],"kca":[-1.235,36.878],"kemu":[0.05,37.65],"anu":[-1.4,36.76],"riara":[-1.305,36.77],"zetech":[-1.15,36.96],"kabarak":[-0.1667,35.9667],"kaimosi":[0.1167,34.8667],"gretsa":[-1.0333,37.0833],"tharaka":[-0.2,37.9],"lukenya":[-2.6833,38.1667],"turkana":[3.1167,35.6],"koitaleel":[0.18,35.1],"bomet":[-0.7833,35.3417],"kheu":[-0.3667,35.28],"panac":[-1.2214,36.8993],"spu":[-1.1333,36.6333],"pueac":[-1.25,36.6667],"mua":[-1.2833,36.8],"gluk":[-0.1,34.75],"aiu":[-1.3333,36.7],"scott":[-1.4167,37.4],"other":[-0.0236,37.9062]};
  var of = window.fetch; if (!of) return;
  function ls(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function param(u, k) { var m = new RegExp('[?&]' + k + '=([^&]*)').exec(u); return m ? decodeURIComponent(m[1]) : ''; }
  function setp(u, k, v) { u = u.replace(new RegExp('([?&])' + k + '=[^&]*&?'), '$1').replace(/[?&]$/, ''); return u + (u.indexOf('?') < 0 ? '?' : '&') + k + '=' + encodeURIComponent(v); }
  function json(r) { return r.clone().json().then(function (d) { return { ok: r.ok, d: d || {}, r: r }; }, function () { return { ok: false, d: {}, r: r }; }); }
  function good(o) { return o.ok && o.d && Array.isArray(o.d.zones) && o.d.zones.length; }
  function reply(d) { return new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
  function saved(radius, id) {
    var z = (typeof ZONES !== 'undefined' && Array.isArray(ZONES)) ? ZONES : [];
    var names = z.filter(function (n) { return n && !/^all$/i.test(n); });
    if (!names.length) return null;
    return { campus: { id: id, name: ls('cc_campus_name') || 'your university', short: ls('cc_campus_short') || '' }, center: { me: false }, radius_m: radius,
      zones: names.slice(0, 12).map(function (n) { return { name: n, score: 0, saved: true, existing: true, evidence: {} }; }),
      nearest_outside: null, sources: { map: 'unavailable' }, attribution: 'The live map had nothing here, so these are the zones saved in the app' };
  }
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('/api/zones/suggest') < 0 || (init && init.__zf)) return of.apply(this, arguments);
    var self = this, args = arguments;
    return of.apply(self, args).then(function (r0) {
      return json(r0).then(function (o0) {
        if (good(o0)) return r0;
        var id = param(url, 'campus'), radius = Number(param(url, 'radius')) || 2000, c = CAMPUS[id];
        var tries = [], base = url;
        if (c && !param(url, 'lat')) base = url + '&lat=' + c[0] + '&lng=' + c[1];
        [radius, 2000, 5000, 10000, 20000].forEach(function (r) { if (r >= radius && tries.indexOf(r) < 0) tries.push(r); });
        if (base !== url) tries.unshift(radius);
        var i = 0;
        function next() {
          if (i >= tries.length) { var f = saved(radius, id); return f ? reply(f) : r0; }
          var u = setp(base, 'radius', tries[i++]);
          return of.call(self, u, { __zf: 1 }).then(json).then(function (o) { if (good(o)) { o.d.radius_m = o.d.radius_m || tries[i - 1]; return reply(o.d); } return next(); }, next);
        }
        return next();
      });
    });
  };
})();
