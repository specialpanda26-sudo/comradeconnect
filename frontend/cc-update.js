/* cc-update.js v1: the app checks GitHub by itself and tells you on the Me tab when a new version is ready.
   Only inside the Android app. Shows a card at the top of the Me tab and a dot on the Me button while an update is waiting.
   "Update now" downloads the new APK; Android installs it over the old one (no uninstall needed, your data stays). */
(function () {
  'use strict';
  var cap = window.Capacitor;
  if (!(cap && cap.isNativePlatform && cap.isNativePlatform())) return;
  if (window.__ccUpd) return; window.__ccUpd = 1;
  var REPO = 'specialpanda26-sudo/comradeconnect';
  var P = cap.Plugins || {};
  ['App', 'Browser'].forEach(function (n) { try { if (!P[n] && cap.registerPlugin) P[n] = cap.registerPlugin(n); } catch (e) {} });
  var state = { cur: 0, n: 0, url: '', notes: '', checking: false, last: 0, msg: '' };
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var css = document.createElement('style');
  css.textContent = '#ccupd{margin:12px 14px 0;padding:14px 16px;border-radius:18px;border:1px solid var(--gb,rgba(255,255,255,.25));background:var(--g,rgba(255,255,255,.07));color:var(--fg,#fff);font-family:Poppins,system-ui,sans-serif}'
    + '#ccupd.new{border-color:#FE813C;background:rgba(254,129,60,.12)}'
    + '#ccupd b{display:block;font-size:15px;font-weight:700}#ccupd p{margin:4px 0 0;font-size:13px;line-height:1.5;color:var(--mut,#bdbdbd)}'
    + '#ccupd .r{display:flex;gap:8px;margin-top:12px}'
    + '#ccupd button{flex:1;border:0;border-radius:999px;padding:12px 14px;font:600 14px Poppins,system-ui,sans-serif;cursor:pointer}'
    + '#ccupd .p{background:#FE813C;color:#0E0F0B}#ccupd .g{background:transparent;border:1px solid var(--gb,rgba(255,255,255,.3));color:inherit}#ccupd button:disabled{opacity:.6}'
    + '#tb button[data-v="me"]{position:relative}#tb button[data-v="me"].ccupd-dot::after{content:"";position:absolute;top:6px;right:calc(50% - 20px);width:9px;height:9px;border-radius:50%;background:#FE813C;box-shadow:0 0 0 2px var(--bg,#0E0F0B)}';
  document.head.appendChild(css);

  function render() {
    var me = document.getElementById('me'); if (!me || !me.parentNode) return;
    var c = document.getElementById('ccupd');
    if (!c) { c = document.createElement('div'); c.id = 'ccupd'; }
    if (c.nextSibling !== me) me.parentNode.insertBefore(c, me);                 // sits above the Me menu, outside it, so the menu never wipes it
    var has = state.n > state.cur && state.url;
    c.className = has ? 'new' : '';
    if (has) {
      c.innerHTML = '<b>Update available</b><p>A new version of Comrade Connect is ready.' + (state.notes ? ' ' + esc(state.notes) : '') + '</p>'
        + '<div class="r"><button type="button" class="p" id="ccupd-go">Update now</button></div>'
        + '<p>Your account and saved data stay as they are. When the download finishes, open it and tap Install.</p>';
      c.querySelector('#ccupd-go').onclick = function () { try { P.Browser.open({ url: state.url }); } catch (e) { location.href = state.url; } };
    } else {
      c.innerHTML = '<b>Comrade Connect is up to date</b><p>' + esc(state.msg || (state.cur ? 'Version ' + state.cur : 'Checking for updates...')) + '</p>'
        + '<div class="r"><button type="button" class="g" id="ccupd-chk"' + (state.checking ? ' disabled' : '') + '>' + (state.checking ? 'Checking...' : 'Check for updates') + '</button></div>';
      c.querySelector('#ccupd-chk').onclick = function () { check(true); };
    }
    var tb = document.querySelector('#tb button[data-v="me"]'); if (tb) tb.classList.toggle('ccupd-dot', !!has);
  }

  function check(force) {
    if (state.checking || !P.App || !P.App.getInfo || navigator.onLine === false) { if (force) { state.msg = 'You are offline. Connect to data or Wi-Fi and try again.'; render(); } return; }
    if (!force && Date.now() - state.last < 15 * 60 * 1000) return;
    state.checking = true; state.last = Date.now(); render();
    P.App.getInfo().then(function (i) {
      state.cur = parseInt(String((i && i.version) || '').split('.').pop(), 10) || 0;
      return fetch('https://api.github.com/repos/' + REPO + '/releases?per_page=15', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (list) { var rel = (Array.isArray(list) ? list : []).filter(function (x) { return /^app-\d+/.test(x.tag_name || '') && !x.draft; })[0] || null;
        if (!rel) { state.msg = 'Could not check right now. Try again later.'; return; }
        var a = (rel.assets || []).filter(function (x) { return /\.apk$/i.test(x.name); })[0];
        state.n = parseInt(String(rel.tag_name || '').replace(/\D/g, ''), 10) || 0;
        state.url = a ? a.browser_download_url : '';
        state.notes = String(rel.body || '').replace(/Install comrade-connect\.apk on your (Android )?phone\.?/i, '').replace(/[#*_`>]/g, '').trim().slice(0, 200);
        state.msg = state.n > state.cur ? '' : 'You have the newest version (' + state.cur + ').';
      });
    }).catch(function () { state.msg = 'Could not check right now. Try again later.'; }).then(function () { state.checking = false; render(); });
  }

  function start() {
    render();
    var me = document.getElementById('me');
    if (me && me.parentNode) new MutationObserver(function () { var c = document.getElementById('ccupd'); if (!c || c.nextSibling !== me) render(); }).observe(me.parentNode, { childList: true });
    setTimeout(function () { check(true); }, 3000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(function () { check(false); }, 1200); });
    window.addEventListener('online', function () { setTimeout(function () { check(true); }, 1500); });
    setInterval(function () { check(false); }, 20 * 60 * 1000);
  }
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
  window.ccUpdateCheck = function () { check(true); };
})();
