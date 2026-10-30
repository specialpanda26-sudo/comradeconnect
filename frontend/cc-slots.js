/* cc-slots.js: "Presented by [brand]" lines for Today on campus, Polls and Kura.
   Sponsors are chosen in Admin > Market > Sponsor slots. Views and taps are counted on the server. */
(function () {
'use strict';
if (window.ccPresented) return;
var API = typeof CC_API === 'string' ? CC_API.replace(/\/$/, '') : '', SL = {}, seen = {};
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
function hit(id) { try { fetch(API + '/api/sponsors/hit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id, kind: 'view' }), keepalive: true }).catch(function () {}); } catch (e) {} }
window.ccPresented = function (slot) {
  var s = SL[slot]; if (!s || !/^https:\/\//i.test(s.link || '')) return '';
  if (!seen[slot]) { seen[slot] = 1; hit(s.id); }
  return '<div class="ccpb" style="font-size:12px;opacity:.75;margin:4px 0 10px">Presented by <a data-sp="' + esc(s.id) + '" href="' + esc(s.link) + '" target="_blank" rel="noopener noreferrer" style="color:inherit;font-weight:700;text-decoration:underline">' + esc(s.name) + '</a></div>';
};
if (API) fetch(API + '/api/sponsor-slots').then(function (r) { return r.json(); }).then(function (d) {
  SL = (d && d.slots) || {}; document.dispatchEvent(new Event('cc-slots'));
}).catch(function () {});
})();
