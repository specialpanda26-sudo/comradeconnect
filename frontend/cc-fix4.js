/* cc-fix4.js: WhatsApp-style alerts. Says exactly what happened ("Amina commented on your post", "Brian is live"),
   shows a top banner while you are in the app, a phone notification when the app is in the background,
   and an On/Off switch in the bell panel (same setting as Settings > Notifications). */
(function () {
  'use strict';
  if (window.__ccFix4) return; window.__ccFix4 = 1;
  var K_SEEN = 'ccfx_seen', K_BASE = 'ccfx_base', busy = false;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function cfg() { try { return JSON.parse(ls('cs_nt') || '{"n2":1}') || { n2: 1 }; } catch (e) { return { n2: 1 }; } }
  function enabled() { return cfg().n2 !== 0; }
  function setOn(v) { var c = cfg(); c.n2 = v ? 1 : 0; ls('cs_nt', JSON.stringify(c)); }
  function signed() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
  function api(p) { return window.ccCall ? window.ccCall(p, { auth: false }) : Promise.reject(new Error('not ready')); }
  function seen() { try { var a = JSON.parse(ls(K_SEEN) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }

  /* ---------- banner inside the app ---------- */
  var st = el('style'); st.textContent = '#ccfx-b{position:fixed;left:50%;top:calc(10px + env(safe-area-inset-top,0px));width:min(92vw,400px);transform:translate(-50%,-140%);z-index:100001;display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:24px;background:var(--g,#fff);color:var(--fg,#16130f);box-shadow:0 14px 40px rgba(22,19,15,.25);transition:transform .35s cubic-bezier(.2,.9,.3,1.1);cursor:pointer;font-family:Manrope,Poppins,sans-serif}'
    + '#ccfx-b.on{transform:translate(-50%,0)}#ccfx-b i{flex:none;width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#ffa05a,#ee7a4f);display:grid;place-items:center;font-style:normal;font-size:18px}'
    + '#ccfx-b div{min-width:0}#ccfx-b b{display:block;font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#ccfx-b span{display:block;font-size:13px;color:var(--mut,#6b6259);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.ccfx-t{border:0;border-radius:999px;padding:7px 12px;font:800 12px Manrope,Poppins,sans-serif;cursor:pointer;background:var(--ink,#16130f);color:var(--inkfg,#fff);margin-right:4px}.ccfx-t.off{background:rgba(22,19,15,.12);color:var(--fg,#16130f)}';
  document.head.appendChild(st);
  var bn, bt;
  function openView(v) {
    if (v === 'live' && typeof window.go === 'function') { try { window.go('videos'); } catch (e) {} return; }
    var b = document.querySelector('.ccb'); if (b) b.click();
  }
  function banner(title, body, view) {
    if (!bn) { bn = el('div'); bn.id = 'ccfx-b'; bn.setAttribute('role', 'status'); bn.innerHTML = '<i>\uD83D\uDD14</i><div><b></b><span></span></div>'; document.body.appendChild(bn); }
    bn.onclick = function () { bn.classList.remove('on'); openView(view); };
    bn.querySelector('b').textContent = title; bn.querySelector('span').textContent = body || '';
    void bn.offsetWidth; bn.classList.add('on'); clearTimeout(bt); bt = setTimeout(function () { bn.classList.remove('on'); }, 5500);
  }

  /* ---------- phone notification when the app is in the background ---------- */
  function show(title, body, tag, view) {
    if (!document.hidden) { banner(title, body, view); return; }
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var o = { body: body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: tag, renotify: true, data: { view: view || '' } };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(function (r) { r.showNotification(title, o); }).catch(function () { try { new Notification(title, o); } catch (e) {} });
    else { try { new Notification(title, o); } catch (e) {} }
  }

  /* ---------- checking for news (every 45 seconds, and when you come back) ---------- */
  function poll() {
    if (busy || !enabled()) return; busy = true;
    var jobs = [
      signed() ? api('/api/notifications').then(function (d) { return ((d && d.items) || []).filter(function (n) { return !n.read; }).map(function (n) { return { key: 'n' + n.id, title: n.title || 'Comrade Connect', body: n.body || '', view: 'bell' }; }); }).catch(function () { return null; }) : Promise.resolve([]),
      api('/api/live').then(function (d) { return ((d && d.streams) || []).filter(function (s) { return !s.status || s.status === 'live'; }).map(function (s) { var who = s.host_name || s.handle || s.host || s.name || 'Someone'; return { key: 'l' + s.id, title: who + ' is live now', body: s.title || 'Tap to watch', view: 'live' }; }); }).catch(function () { return null; })
    ];
    Promise.all(jobs).then(function (r) {
      if (r[0] === null && r[1] === null) return;
      var all = (r[0] || []).concat(r[1] || []), s = seen();
      if (ls(K_BASE) !== '1') { ls(K_SEEN, JSON.stringify(all.map(function (x) { return x.key; }).slice(-300))); ls(K_BASE, '1'); return; }   // first run: remember what is already there, no flood
      var fresh = all.filter(function (x) { return s.indexOf(x.key) < 0; });
      if (!fresh.length) return;
      ls(K_SEEN, JSON.stringify(s.concat(fresh.map(function (x) { return x.key; })).slice(-300)));
      fresh.slice(0, 3).forEach(function (x, i) { setTimeout(function () { show(x.title, x.body, x.key, x.view); }, i * 1200); });
      if (fresh.length > 3) setTimeout(function () { show('Comrade Connect', (fresh.length - 3) + ' more new updates', 'ccfx-more', 'bell'); }, 4000);
    }).then(function () { busy = false; }, function () { busy = false; });
  }
  setInterval(poll, 45000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(poll, 800); });
  setTimeout(poll, 4000);

  /* ---------- On/Off switch in the bell panel ---------- */
  function say(t) { if (typeof window.toast === 'function') window.toast(t); else banner(t, '', ''); }
  function paintToggle(b) { var on = enabled(); b.textContent = on ? 'Alerts: On' : 'Alerts: Off'; b.classList.toggle('off', !on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  function addToggle() {
    var hd = document.querySelector('.ccn:not(.ccn-ev) .hd > div'); if (!hd || hd.querySelector('.ccfx-t')) return;
    var b = el('button', 'ccfx-t'); b.type = 'button'; paintToggle(b);
    b.onclick = function () {
      if (enabled()) { setOn(false); paintToggle(b); say('Notifications turned off'); return; }
      setOn(true); paintToggle(b); poll();
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(function (p) { say(p === 'granted' ? 'Notifications turned on' : 'Allowed in the app only. Allow notifications in your browser settings to get them on your phone.'); });
      } else if ('Notification' in window && Notification.permission === 'denied') say('Turned on in the app. Allow notifications in your browser settings to get them on your phone.');
      else say('Notifications turned on');
    };
    hd.insertBefore(b, hd.firstChild);
  }
  new MutationObserver(function () { addToggle(); }).observe(document.body, { childList: true, subtree: true });

  /* tapping a phone notification opens the right place */
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.ccOpen !== undefined) openView(e.data.ccOpen); });
})();
