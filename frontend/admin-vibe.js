(function () {
'use strict';
var K = 'cc_admin_theme2', root = document.documentElement;
function get() { try { return localStorage.getItem(K) === 'light' ? 'light' : 'dark'; } catch (e) { return 'dark'; } }
function apply(t) {
  root.setAttribute('data-theme', t);
  var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t === 'light' ? '#ffffff' : '#101422');
  var b = document.getElementById('vb_th'); if (b) b.innerHTML = icon(t);
}
function icon(t) {
  return t === 'light'
    ? '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>'
    : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/></svg>';
}
function mount() {
  var tools = document.querySelector('header.top .tools'); if (!tools || document.getElementById('vb_th')) return;
  var b = document.createElement('button'); b.className = 'ib vb-th'; b.id = 'vb_th'; b.type = 'button';
  b.setAttribute('aria-label', 'Switch dark or light'); b.title = 'Dark or light';
  b.onclick = function () { var t = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light'; try { localStorage.setItem(K, t); } catch (e) {} apply(t); };
  tools.insertBefore(b, tools.firstChild); apply(get());
}
apply(get());
try {
  var _r = render;
  render = function () { _r(); try { mount(); } catch (e) {} };
} catch (e) {}
mount();
})();
