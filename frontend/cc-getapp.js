/* cc-getapp.js: "Download the app" button on the home page + clean install steps.
   Hidden inside the app itself. APK comes from the newest GitHub release. */
(function () {
  'use strict';
  if (window.__ccGetApp) return; window.__ccGetApp = 1;
  if (window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) return;
  var REL = 'https://github.com/specialpanda26-sudo/comradeconnect/releases/latest/download/';
  var DREL = 'https://github.com/specialpanda26-sudo/comradeconnect/releases/download/desktop-latest/';   // computer apps always live here
  var API = 'https://api.github.com/repos/specialpanda26-sudo/comradeconnect/releases?per_page=20';
  var FILES = { apk: 'comrade-connect.apk', win: 'comrade-connect-setup.exe', macA: 'comrade-connect-arm64.dmg', macI: 'comrade-connect-x64.dmg', linux: 'comrade-connect.AppImage' };
  // Asks GitHub for the recent releases and, for EACH file, uses the newest release that really contains it.
  // (The Android build and the computer builds publish separately, so the very newest release can briefly hold only one of them.
  //  Asking only for "latest" is what used to grey out the Windows button.)
  function latest() {
    return fetch(API, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (list) {
      if (!list || !list.length) return null;
      var m = {}, head = null;
      list.forEach(function (j) {
        if (j.draft) return;
        if (!head) head = j;
        (j.assets || []).forEach(function (x) { if (!m[x.name]) m[x.name] = x.browser_download_url; });
      });
      list.forEach(function (j) { if (j.tag_name === 'desktop-latest') (j.assets || []).forEach(function (x) { m[x.name] = x.browser_download_url; }); });   // computer files: always from the fixed release
      return head ? { files: m, tag: head.tag_name || '', name: head.name || '' } : null;
    }).catch(function () { return null; });
  }
  var ua = navigator.userAgent || '';
  var ios = /iPhone|iPad|iPod/i.test(ua), android = /Android/i.test(ua);
  var mac = /Macintosh|Mac OS X/i.test(ua) && !ios, win = /Windows/i.test(ua), linux = /Linux/i.test(ua) && !android;

  var standalone = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  var inApp = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|TikTok|Snapchat|Twitter/i.test(ua);
  var SITE = 'https://comradeconnect.co.ke/';

  var css = document.createElement('style');
  css.textContent = [
    '.ccdl-row{margin-top:14px;display:flex;justify-content:flex-start}',
    '.ccdl{display:inline-flex;align-items:center;gap:10px;padding:10px 18px 10px 12px;border-radius:999px;border:1px solid var(--line);background:color-mix(in srgb,var(--fg) 8%,transparent);color:var(--fg);font:600 14px Poppins,system-ui,sans-serif;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}',
    '.ccdl:active{transform:scale(.97)}',
    '.ccdl i{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--fg);color:var(--bg)}',
    '.ccdl small{display:block;font-weight:300;font-size:11px;color:var(--mut);margin-top:1px;text-align:left}',
    '.ccdl span{text-align:left;line-height:1.15}',
    '.ccdl-m{position:fixed;inset:0;z-index:99999;background:rgba(14,15,11,.72);display:flex;align-items:flex-end;justify-content:center;animation:ccdlf .2s ease}',
    '.ccdl-s{width:100%;max-width:440px;max-height:92vh;overflow:auto;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:24px 24px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom,0px));animation:ccdlu .25s ease}',
    '@media(min-width:600px){.ccdl-m{align-items:center}.ccdl-s{border-radius:24px}}',
    '.ccdl-h{display:flex;align-items:center;gap:14px}',
    '.ccdl-h img{width:56px;height:56px;border-radius:14px;background:#0E0F0B}',
    '.ccdl-h h3{margin:0;font-size:18px}.ccdl-h p{margin:2px 0 0;font-size:12px;color:var(--mut)}',
    '.ccdl-go{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:18px;padding:14px;border-radius:999px;background:var(--fg);color:var(--bg);font:600 15px Poppins,system-ui,sans-serif;text-decoration:none;border:0}',
    '.ccdl-st{list-style:none;margin:18px 0 0;padding:0;display:grid;gap:12px;counter-reset:s}',
    '.ccdl-st li{counter-increment:s;display:flex;gap:12px;font-size:13.5px;line-height:1.45}',
    '.ccdl-st li:before{content:counter(s);flex:none;width:24px;height:24px;border-radius:50%;border:1px solid var(--line);display:grid;place-items:center;font-size:12px;font-weight:600}',
    '.ccdl-st b{font-weight:600}',
    '.ccdl-n{margin:16px 0 0;font-size:12px;color:var(--mut);line-height:1.5}',
    '.ccdl-x{display:block;width:100%;margin-top:10px;padding:10px;background:none;border:0;color:var(--mut);font:500 13px Poppins,system-ui,sans-serif;cursor:pointer}',
    '.ccdl-tabs{display:flex;gap:6px;margin:16px 0 0;padding:4px;border-radius:999px;border:1px solid var(--line);background:color-mix(in srgb,var(--fg) 6%,transparent)}',
    '.ccdl-tabs button{flex:1;min-height:38px;border:0;border-radius:999px;background:none;color:var(--fg);font:600 13px Poppins,system-ui,sans-serif;cursor:pointer}',
    '.ccdl-tabs button.on{background:var(--fg);color:var(--bg)}',
    '.ccdl-go.off{opacity:.45;pointer-events:none}',
    '.ccdl-hint{margin:12px 0 0;padding:10px 14px;border-radius:14px;border:1px solid var(--line);background:color-mix(in srgb,var(--fg) 6%,transparent);font-size:13px;line-height:1.45;text-align:center}',
    '.ccdl-go.alt{background:none;color:var(--fg);border:1px solid var(--line);margin-top:10px}',
    '@keyframes ccdlf{from{opacity:0}}@keyframes ccdlu{from{transform:translateY(30px);opacity:0}}'
  ].join('');
  document.head.appendChild(css);

  var DL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>';

  var STEPS = {
    android: '<li><span>Tap <b>Download for Android</b> above. If your browser says the file may be harmful, tap <b>Download anyway</b>. It is our own app.</span></li>'
      + '<li><span>When it finishes, tap <b>Open</b> on the download notice, or find <b>comrade-connect.apk</b> in <b>Files &gt; Downloads</b>.</span></li>'
      + '<li><span>If Android asks, tap <b>Settings</b> and switch on <b>Allow from this source</b>, then press back.</span></li>'
      + '<li><span>Tap <b>Install</b>. If Play Protect appears, choose <b>Install anyway</b>.</span></li>'
      + '<li><span>Tap <b>Open</b> and sign in. Once opened, the app keeps working without data.</span></li>',
    ios: '<li><span>Open <b>comradeconnect.co.ke</b> in <b>Safari</b> on your iPhone.</span></li>'
      + '<li><span>Tap the <b>Share</b> button, then <b>Add to Home Screen</b>.</span></li>'
      + '<li><span>Tap <b>Add</b>. Comrade Connect now sits on your Home Screen with its own icon and opens full screen, like an app.</span></li>',
    pc: '<li><span>Pick your computer below and let the file download.</span></li>'
      + '<li><span><b>Windows:</b> open <b>comrade-connect-setup.exe</b>. If Windows says it protected your PC, tap <b>More info</b>, then <b>Run anyway</b>.</span></li>'
      + '<li><span><b>Mac:</b> open the <b>.dmg</b>, drag the app to <b>Applications</b>, then right-click it and choose <b>Open</b> the first time.</span></li>'
      + '<li><span><b>Linux:</b> right-click the <b>.AppImage</b>, allow it to run as a program, then open it.</span></li>'
  };
  function btn(k, label, alt) { return '<a class="ccdl-go' + (alt ? ' alt' : '') + '" data-k="' + k + '" href="' + (k === 'apk' ? REL : DREL) + FILES[k] + '" rel="noopener">' + DL + ' ' + label + '</a>'; }

  function open() {
    var first = ios ? 'ios' : android ? 'android' : 'pc';
    var m = document.createElement('div'); m.className = 'ccdl-m'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Get the Comrade Connect app');
    var macFirst = mac;
    m.innerHTML = '<div class="ccdl-s"><div class="ccdl-h"><img src="/icon-192.png" alt="" width="56" height="56"><div><h3>Comrade Connect</h3><p>Free &middot; Android, iPhone and computer</p></div></div>'
      + '<div class="ccdl-tabs" role="tablist"><button type="button" data-t="android">Android</button><button type="button" data-t="ios">iPhone</button><button type="button" data-t="pc">Computer</button></div>'
      + '<div data-p="android">' + btn('apk', 'Download for Android') + '<ol class="ccdl-st">' + STEPS.android + '</ol><p class="ccdl-n">Update later: download the new file and install it over the old app. Your account stays.</p></div>'
      + '<div data-p="ios" hidden><button type="button" class="ccdl-go" id="ccdl-ios">' + DL + ' Install on iPhone</button><p class="ccdl-hint" id="ccdl-iosn" hidden></p><ol class="ccdl-st">' + STEPS.ios + '</ol><p class="ccdl-n">Safari is required on iPhone. A listing in the App Store comes later.</p></div>'
      + '<div data-p="pc" hidden>' + (macFirst ? btn('macA', 'Download for Mac (Apple chip: M1 to M4)') + btn('macI', 'Mac with Intel chip', 1) + btn('win', 'Windows', 1) + btn('linux', 'Linux', 1)
          : linux ? btn('linux', 'Download for Linux') + btn('win', 'Windows', 1) + btn('macA', 'Mac (Apple chip)', 1) + btn('macI', 'Mac (Intel chip)', 1)
          : btn('win', 'Download for Windows') + btn('macA', 'Mac (Apple chip: M1 to M4)', 1) + btn('macI', 'Mac (Intel chip)', 1) + btn('linux', 'Linux', 1))
        + '<ol class="ccdl-st">' + STEPS.pc + '</ol><p class="ccdl-n">The computer app opens the live website, so it is always the newest version, and keeps a copy for when you are offline.</p></div>'
      + '<p class="ccdl-n" id="ccdl-v" style="text-align:center"></p>'
      + '<button class="ccdl-x" type="button">Close</button></div>';
    var tab = function (t) {
      Array.prototype.forEach.call(m.querySelectorAll('[data-t]'), function (b) { b.classList.toggle('on', b.dataset.t === t); });
      Array.prototype.forEach.call(m.querySelectorAll('[data-p]'), function (d) { d.hidden = d.dataset.p !== t; });
    };
    m.querySelector('.ccdl-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (b) tab(b.dataset.t); });
    tab(first);
    var close = function () { m.remove(); document.removeEventListener('keydown', esc); };
    var esc = function (e) { if (e.key === 'Escape') close(); };
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    m.querySelector('.ccdl-x').onclick = close;
    document.addEventListener('keydown', esc);
    var ib = m.querySelector('#ccdl-ios'), hn = m.querySelector('#ccdl-iosn');
    var say = function (t) { hn.textContent = t; hn.hidden = false; };
    var copy = function () {
      var ok = function () { say('Link copied. Open Safari on your iPhone, paste it, then tap Share and Add to Home Screen.'); };
      try { navigator.clipboard.writeText(SITE).then(ok, function () { say('Open ' + SITE + ' in Safari on your iPhone, then tap Share and Add to Home Screen.'); }); }
      catch (e) { say('Open ' + SITE + ' in Safari on your iPhone, then tap Share and Add to Home Screen.'); }
    };
    ib.onclick = function () {
      if (standalone) { say('Already installed. Open Comrade Connect from your Home Screen.'); return; }
      if (!ios || inApp) { if (ios) say('Open this page in Safari first (tap the ... or compass icon, then Open in Safari).'); else copy(); return; }
      say('In the sheet that opens, scroll down and tap Add to Home Screen, then Add.');
      if (navigator.share) navigator.share({ title: 'Comrade Connect', url: SITE }).catch(function (e) { if (!e || e.name !== 'AbortError') say('Tap the Share button at the bottom of Safari, then Add to Home Screen.'); });
      else say('Tap the Share button at the bottom of Safari, then Add to Home Screen.');
    };
    document.body.appendChild(m);
    latest().then(function (l) {
      if (!l) return;                                   // GitHub unreachable: the buttons keep their direct links
      var missing = false;
      Array.prototype.forEach.call(m.querySelectorAll('a[data-k]'), function (a) {
        var u = l.files[FILES[a.dataset.k]];
        if (u) a.href = u; else { a.classList.add('off'); a.removeAttribute('href'); a.title = 'This file is still being built. Try again in a few minutes.'; missing = true; }
      });
      var v = m.querySelector('#ccdl-v'); if (v) v.textContent = missing ? 'Some files are still being built. Try again in a few minutes.' : 'Newest version: ' + (l.name || l.tag);
    });
  }

  function mount() {
    if (document.getElementById('ccdl') || standalone) return true;
    var host = document.querySelector('#v-feed .hero');
    if (!host) return false;
    var row = document.createElement('div'); row.className = 'ccdl-row';
    row.innerHTML = '<button class="ccdl" id="ccdl" type="button" aria-label="Download the Comrade Connect app"><i>' + DL + '</i><span>' + 'Get the app' + '<small>' + 'Android &middot; iPhone &middot; Computer' + '</small></span></button>';
    var cta = host.querySelector('[data-open]'); var after = cta && cta.parentElement;
    if (after && after.parentElement === host) after.insertAdjacentElement('afterend', row); else host.appendChild(row);
    row.querySelector('#ccdl').onclick = open;
    return true;
  }
  window.ccGetApp = open;
  if (!mount()) document.addEventListener('DOMContentLoaded', mount);
})();
