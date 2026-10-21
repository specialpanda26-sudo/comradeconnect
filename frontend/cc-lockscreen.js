/* cc-lockscreen.js: fills in the fingerprint lock screen (#lk in index.html): name, picture, buttons.
   Picture and greeting come from Admin > Site editor > App look. */
(function () {
  'use strict';
  var lk = document.getElementById('lk'); if (!lk) return;
  var hero = document.getElementById('lkhero');
  function saved() { try { return JSON.parse(localStorage.getItem('cc_site_v1') || '{}') || {}; } catch (e) { return {}; } }
  function name() {
    try { var me = JSON.parse(localStorage.getItem('cs_me') || 'null'); var h = me && me.handle ? String(me.handle) : ''; return h ? h.replace(/_/g, ' ').replace(/\d+$/, '').trim() : ''; } catch (e) { return ''; }
  }
  function paint(C) {
    C = C || saved();
    var img = /^https:\/\/[^\s<>"']+$/i.test(C.lock_image || '') ? C.lock_image : 'media/bg-poster.webp';
    hero.style.backgroundImage = 'url("' + img.replace(/"/g, '%22') + '")';
    var n = name(), hi = document.getElementById('lkhi'); if (hi) hi.textContent = 'Hi, ' + (n ? n.toUpperCase() : 'COMRADE');
  }
  paint();
  document.addEventListener('cc-site', function (e) { paint(e.detail); });
  var pw = document.getElementById('lkpw');
  if (pw) pw.onclick = function () { lk.classList.add('rec'); var c = document.getElementById('lkc'); if (c) c.focus(); };
  var sw = document.getElementById('lksw');
  if (sw) sw.onclick = function (e) { e.preventDefault(); lk.classList.remove('on'); if (window.ccSignOut) window.ccSignOut(); };
  new MutationObserver(function () { if (lk.classList.contains('on')) paint(); }).observe(lk, { attributes: true, attributeFilter: ['class'] });

  /* LK_V2: moving fingerprint, face/fingerprint wording that matches the phone, "sign in with my account", softer glass look */
  (function () {
    var st = document.createElement('style');
    st.textContent = [
      '#lk .lkhero{position:relative}#lk .lkhero:after{content:"";position:absolute;left:0;right:0;bottom:0;height:46%;background:linear-gradient(to bottom,transparent,var(--bg,#000))}',
      '#lk .bx.lkcard{background:color-mix(in srgb,var(--bg,#000) 82%,transparent)!important;-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);color:var(--fg,#fff)}',
      '#lk .lkfp{position:relative;overflow:visible;width:92px;height:92px;box-shadow:0 0 0 1px var(--gb,rgba(255,255,255,.3)) inset}',
      '#lk .lkfp svg{position:relative;z-index:1}#lk .lkfp svg path{stroke-dasharray:90;stroke-dashoffset:90;animation:lkd 1.1s ease forwards,lkp 2.8s ease-in-out 1.3s infinite}',
      '#lk .lkfp svg path:nth-child(2){animation-delay:.12s,1.4s}#lk .lkfp svg path:nth-child(3){animation-delay:.24s,1.5s}#lk .lkfp svg path:nth-child(4){animation-delay:.36s,1.6s}#lk .lkfp svg path:nth-child(5){animation-delay:.48s,1.7s}#lk .lkfp svg path:nth-child(6){animation-delay:.6s,1.8s}',
      '@keyframes lkd{to{stroke-dashoffset:0}}@keyframes lkp{0%,100%{opacity:1}50%{opacity:.35}}',
      '#lk .lkfp:before{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid var(--fg,#fff);opacity:0;animation:lkw 2.8s ease-out 1s infinite}',
      '@keyframes lkw{0%{transform:scale(.8);opacity:.5}100%{transform:scale(1.45);opacity:0}}',
      '#lk .lkfp:after{content:"";position:absolute;left:18%;right:18%;top:16%;height:3px;border-radius:3px;background:linear-gradient(90deg,transparent,var(--fg,#fff),transparent);opacity:0;animation:lks 2.3s ease-in-out 1.2s infinite}',
      '@keyframes lks{0%{top:16%;opacity:0}15%{opacity:.85}85%{opacity:.85}100%{top:80%;opacity:0}}',
      '#lk .lkfp.ok{color:#3ddc84}@media(prefers-reduced-motion:reduce){#lk .lkfp *,#lk .lkfp:before,#lk .lkfp:after{animation-duration:.01s!important;animation-iteration-count:1!important}}',
      '#lk .lkgo{width:100%;max-width:420px;margin:10px auto 0;display:flex;align-items:center;justify-content:center;gap:10px}'
    ].join('');
    document.head.appendChild(st);

    // wording follows what the phone really has: fingerprint, face unlock, or both
    var cap = window.Capacitor, native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
    var lab = document.querySelector('#lk .lkh'), note = document.querySelector('#lk .note');
    if (native && lab) try {
      var B = cap.Plugins && (cap.Plugins.BiometricAuth || (cap.registerPlugin && cap.registerPlugin('BiometricAuth')));
      B.checkBiometry().then(function (r) {
        var t = (r && (r.biometryTypes || [r.biometryType])) || [], fp = t.indexOf(3) > -1 || t.indexOf(1) > -1, face = t.indexOf(4) > -1 || t.indexOf(2) > -1;
        if (face && !fp) { lab.textContent = 'Continue with face unlock'; if (note) note.textContent = 'Look at your phone to unlock'; }
        else if (face && fp) { lab.textContent = 'Continue with fingerprint or face'; if (note) note.textContent = 'Touch the sensor or look at your phone'; }
        else if (r && r.deviceIsSecure && !fp) { lab.textContent = 'Continue with your phone lock'; if (note) note.textContent = 'Use your PIN, pattern or password'; }
      }, function () {});
    } catch (e) {}

    // "sign in with my account": the Google account you used before opens the app again (the app keeps the account on this phone)
    var pw = document.getElementById('lkpw');
    if (native && pw && typeof CC_GOOGLE_ID === 'string' && CC_GOOGLE_ID && !document.getElementById('lkgo')) {
      var g = document.createElement('button'); g.type = 'button'; g.id = 'lkgo'; g.className = 'btn g lkgo'; g.textContent = 'Sign in with my Google account';
      pw.insertAdjacentElement('afterend', g);
      g.onclick = function () {
        if (!(window.ccApp && ccApp.googleLogin && window.ccGoogle && ccGoogle.signIn)) return;
        g.disabled = true;
        ccApp.googleLogin().then(function (tok) { return ccGoogle.signIn(tok, false); })
          .then(function () { lk.classList.remove('on'); location.reload(); },
                function (e) { g.disabled = false; if (e && e.cancelled) return; try { toast((e && e.message) || 'Google sign-in failed. Try again.'); } catch (x) {} });
      };
    }
  })();
})();
