/* cc-pagebar.js: the top bar of the full pages (Safety, Verification, Terms, Privacy...).
   Adds a Back arrow on the left and a "Get the app" button beside "Open the app", in the same glass/pill style as the site.
   The pop-up panels inside the app do NOT get a Back arrow, only one X. */
(function () {
  'use strict';
  if (window.__ccPageBar) return; window.__ccPageBar = 1;
  var h = document.querySelector('body > header'); if (!h || !h.querySelector('a.brand')) return;
  var native = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  var installed = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)) || /Electron/i.test(navigator.userAgent || '');

  var css = document.createElement('style');
  css.textContent = [
    'body>header{flex-wrap:nowrap}',
    '.pb-l{display:flex;align-items:center;gap:10px;min-width:0}.pb-r{display:flex;align-items:center;gap:8px;flex:none}',
    'a.brand{white-space:nowrap}',
    '.pb-b{flex:none;width:38px;height:38px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--fg);display:grid;place-items:center;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '.pb-b:active,.pb-g:active{transform:scale(.96)}',
    '.pb-b svg,.pb-g svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}',
    '.pb-g{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--fg);font:600 14px Poppins,system-ui,sans-serif;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}',
    '@media(max-width:520px){header{padding-left:14px!important;padding-right:14px!important}a.brand{font-size:13px}.pb-g{width:40px;padding:0;justify-content:center}.pb-g span{display:none}a.cta{padding:10px 14px!important;font-size:13px}.pb-r{gap:6px}}',
    '@media(max-width:360px){a.brand{display:none}}'
  ].join('');
  document.head.appendChild(css);

  var BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var DL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>';

  var brand = h.querySelector('a.brand'), cta = h.querySelector('a.cta');
  var left = document.createElement('div'); left.className = 'pb-l';
  var right = document.createElement('div'); right.className = 'pb-r';

  var back = document.createElement('button'); back.type = 'button'; back.className = 'pb-b'; back.setAttribute('aria-label', 'Back'); back.innerHTML = BACK;
  back.onclick = function () {
    var same = false; try { same = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) {}
    if (same && history.length > 1) history.back(); else location.href = '/';
  };
  left.append(back, brand);

  if (!native && !installed) {
    var dl = document.createElement('button'); dl.type = 'button'; dl.className = 'pb-g'; dl.setAttribute('aria-label', 'Download the Comrade Connect app');
    dl.innerHTML = DL + '<span>Get the app</span>';
    dl.onclick = function () { if (window.ccGetApp) window.ccGetApp(); else location.href = '/'; };
    right.appendChild(dl);
  }
  if (cta) right.appendChild(cta);
  h.textContent = ''; h.append(left, right);
})();
