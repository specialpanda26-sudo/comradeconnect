/* cc-theme.js: light / dark / match-my-phone. Runs first in <head> so the page never flashes the wrong colours.
   window.ccGetTheme() -> 'light' | 'dark' | 'system'   window.ccSetTheme(t) saves it and applies it right away. */
(function () {
  'use strict';
  if (window.ccSetTheme) return;
  var K = 'cc_theme', root = document.documentElement;
  var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  function saved() { try { var t = localStorage.getItem(K); return t === 'dark' || t === 'light' || t === 'system' ? t : 'light'; } catch (e) { return 'light'; } }
  function eff(t) { return t === 'system' ? (mq && mq.matches ? 'dark' : 'light') : t; }
  function apply(t) {
    var e = eff(t);
    if (root.getAttribute('data-theme') !== e) root.setAttribute('data-theme', e);
    root.style.colorScheme = e;
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', e === 'dark' ? '#17130f' : '#fbf1ed');
  }
  window.ccGetTheme = saved;
  window.ccSetTheme = function (t) {
    if (t !== 'dark' && t !== 'light' && t !== 'system') t = 'light';
    try { localStorage.setItem(K, t); } catch (e) {}
    apply(t);
    try { window.dispatchEvent(new CustomEvent('cc-theme', { detail: t })); } catch (e) {}
  };
  apply(saved());
  if (mq) {
    var onMq = function () { if (saved() === 'system') apply('system'); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
  }
})();
