/* cc-getapp.js: "Download the app" button on the home page + clean install steps.
   Hidden inside the app itself. APK comes from the newest GitHub release. */
(function () {
  'use strict';
  if (window.__ccGetApp) return; window.__ccGetApp = 1;
  if (window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) return;
  var APK = 'https://github.com/specialpanda26-sudo/comradeconnect/releases/latest/download/comrade-connect.apk';
  var API = 'https://api.github.com/repos/specialpanda26-sudo/comradeconnect/releases/latest';
  // Asks GitHub for the newest release every time, so the button never hands out an old file.
  function latest() {
    return fetch(API, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var a = j && (j.assets || []).filter(function (x) { return /\.apk$/i.test(x.name); })[0];
      return a ? { url: a.browser_download_url, tag: j.tag_name || '', name: j.name || '' } : null;
    }).catch(function () { return null; });
  }
  var ua = navigator.userAgent || '';
  var ios = /iPhone|iPad|iPod/i.test(ua), android = /Android/i.test(ua);

  var css = document.createElement('style');
  css.textContent = [
    '.ccdl-row{margin-top:14px;display:flex;justify-content:flex-start}',
    '.ccdl{display:inline-flex;align-items:center;gap:10px;padding:10px 18px 10px 12px;border-radius:999px;border:1px solid var(--line);background:color-mix(in srgb,var(--fg) 8%,transparent);color:var(--fg);font:600 14px Poppins,system-ui,sans-serif;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}',
    '.ccdl:active{transform:scale(.97)}',
    '.ccdl i{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--fg);color:var(--bg)}',
    '.ccdl small{display:block;font-weight:300;font-size:11px;color:var(--mut);margin-top:1px;text-align:left}',
    '.ccdl span{text-align:left;line-height:1.15}',
    '.ccdl-m{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);display:flex;align-items:flex-end;justify-content:center;animation:ccdlf .2s ease}',
    '.ccdl-s{width:100%;max-width:440px;max-height:92vh;overflow:auto;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:24px 24px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom,0px));animation:ccdlu .25s ease}',
    '@media(min-width:600px){.ccdl-m{align-items:center}.ccdl-s{border-radius:24px}}',
    '.ccdl-h{display:flex;align-items:center;gap:14px}',
    '.ccdl-h img{width:56px;height:56px;border-radius:14px;background:#000}',
    '.ccdl-h h3{margin:0;font-size:18px}.ccdl-h p{margin:2px 0 0;font-size:12px;color:var(--mut)}',
    '.ccdl-go{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:18px;padding:14px;border-radius:999px;background:var(--fg);color:var(--bg);font:600 15px Poppins,system-ui,sans-serif;text-decoration:none;border:0}',
    '.ccdl-st{list-style:none;margin:18px 0 0;padding:0;display:grid;gap:12px;counter-reset:s}',
    '.ccdl-st li{counter-increment:s;display:flex;gap:12px;font-size:13.5px;line-height:1.45}',
    '.ccdl-st li:before{content:counter(s);flex:none;width:24px;height:24px;border-radius:50%;border:1px solid var(--line);display:grid;place-items:center;font-size:12px;font-weight:600}',
    '.ccdl-st b{font-weight:600}',
    '.ccdl-n{margin:16px 0 0;font-size:12px;color:var(--mut);line-height:1.5}',
    '.ccdl-x{display:block;width:100%;margin-top:10px;padding:10px;background:none;border:0;color:var(--mut);font:500 13px Poppins,system-ui,sans-serif;cursor:pointer}',
    '@keyframes ccdlf{from{opacity:0}}@keyframes ccdlu{from{transform:translateY(30px);opacity:0}}'
  ].join('');
  document.head.appendChild(css);

  var DL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>';

  function steps() {
    if (ios) return '<li><span>Open this page in <b>Safari</b>.</span></li><li><span>Tap the <b>Share</b> button, then <b>Add to Home Screen</b>.</span></li><li><span>Tap <b>Add</b>. Comrade Connect now opens like an app.</span></li>';
    return '<li><span>Tap <b>Download for Android</b> above. If your browser says the file may be harmful, tap <b>Download anyway</b>. It is our own app.</span></li>'
      + '<li><span>When it finishes, tap <b>Open</b> on the download notice, or find <b>comrade-connect.apk</b> in <b>Files &gt; Downloads</b>.</span></li>'
      + '<li><span>If Android asks, tap <b>Settings</b> and switch on <b>Allow from this source</b>, then press back.</span></li>'
      + '<li><span>Tap <b>Install</b>. If Play Protect appears, choose <b>Install anyway</b>.</span></li>'
      + '<li><span>Tap <b>Open</b> and sign in. Once opened, the app keeps working without data.</span></li>';
  }

  function open() {
    var m = document.createElement('div'); m.className = 'ccdl-m'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Get the Comrade Connect app');
    m.innerHTML = '<div class="ccdl-s"><div class="ccdl-h"><img src="/icon-192.png" alt="" width="56" height="56"><div><h3>Comrade Connect</h3><p>' + (ios ? 'Add it to your iPhone' : 'Android app &middot; Free &middot; Works offline') + '</p></div></div>'
      + (ios ? '' : '<a class="ccdl-go" href="' + APK + '" rel="noopener">' + DL + ' Download for Android</a>')
      + '<ol class="ccdl-st">' + steps() + '</ol>'
      + (ios || android ? '' : '<p class="ccdl-n">You are on a computer. Open this website on your Android phone to install the app.</p>')
      + '<p class="ccdl-n">Update later: download the new file and install it over the old app. Your account stays.</p>'
      + '<button class="ccdl-x" type="button">Close</button></div>';
    var close = function () { m.remove(); document.removeEventListener('keydown', esc); };
    var esc = function (e) { if (e.key === 'Escape') close(); };
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    m.querySelector('.ccdl-x').onclick = close;
    document.addEventListener('keydown', esc);
    document.body.appendChild(m);
    var go = m.querySelector('.ccdl-go');
    if (go) latest().then(function (l) {
      if (!l) return;
      go.href = l.url;
      var n = document.createElement('p'); n.className = 'ccdl-n'; n.style.textAlign = 'center'; n.style.marginTop = '8px';
      n.textContent = 'Newest version: ' + (l.name || l.tag); go.insertAdjacentElement('afterend', n);
    });
  }

  function mount() {
    if (document.getElementById('ccdl')) return true;
    var host = document.querySelector('#v-feed .hero');
    if (!host) return false;
    var row = document.createElement('div'); row.className = 'ccdl-row';
    row.innerHTML = '<button class="ccdl" id="ccdl" type="button" aria-label="Download the Comrade Connect app"><i>' + DL + '</i><span>' + (ios ? 'Install the app' : 'Download the app') + '<small>' + (ios ? 'Add to Home Screen' : 'Android &middot; Free') + '</small></span></button>';
    var cta = host.querySelector('[data-open]'); var after = cta && cta.parentElement;
    if (after && after.parentElement === host) after.insertAdjacentElement('afterend', row); else host.appendChild(row);
    row.querySelector('#ccdl').onclick = open;
    return true;
  }
  window.ccGetApp = open;
  if (!mount()) document.addEventListener('DOMContentLoaded', mount);
})();
