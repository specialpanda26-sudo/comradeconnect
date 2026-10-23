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
    var img = /^https:\/\/[^\s<>"']+$/i.test(C.lock_image || '') ? C.lock_image : '';
    hero.style.backgroundImage = img ? 'url("' + img.replace(/"/g, '%22') + '")' : 'none';
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
      '#lk .lkhero{position:relative}#lk .lkhero:after{content:"";position:absolute;left:0;right:0;bottom:0;height:46%;background:linear-gradient(to bottom,transparent,var(--bg,#101422))}',
      '#lk .bx.lkcard{background:color-mix(in srgb,var(--bg,#101422) 82%,transparent)!important;-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);color:var(--fg,#fff)}',
      '#lk .lkfp{position:relative;overflow:visible;width:92px;height:92px;box-shadow:0 0 0 1px var(--gb,rgba(255,255,255,.3)) inset}',
      '#lk .lkfp svg{position:relative;z-index:1}#lk .lkfp svg path{stroke-dasharray:90;stroke-dashoffset:90;animation:lkd 1.1s ease forwards,lkp 2.8s ease-in-out 1.3s infinite}',
      '#lk .lkfp svg path:nth-child(2){animation-delay:.12s,1.4s}#lk .lkfp svg path:nth-child(3){animation-delay:.24s,1.5s}#lk .lkfp svg path:nth-child(4){animation-delay:.36s,1.6s}#lk .lkfp svg path:nth-child(5){animation-delay:.48s,1.7s}#lk .lkfp svg path:nth-child(6){animation-delay:.6s,1.8s}',
      '@keyframes lkd{to{stroke-dashoffset:0}}@keyframes lkp{0%,100%{opacity:1}50%{opacity:.35}}',
      '#lk .lkfp:before{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid var(--fg,#fff);opacity:0;animation:lkw 2.8s ease-out 1s infinite}',
      '@keyframes lkw{0%{transform:scale(.8);opacity:.5}100%{transform:scale(1.45);opacity:0}}',
      '#lk .lkfp:after{content:"";position:absolute;left:18%;right:18%;top:16%;height:3px;border-radius:3px;background:linear-gradient(90deg,transparent,var(--fg,#fff),transparent);opacity:0;animation:lks 2.3s ease-in-out 1.2s infinite}',
      '@keyframes lks{0%{top:16%;opacity:0}15%{opacity:.85}85%{opacity:.85}100%{top:80%;opacity:0}}',
      '#lk .lkfp.ok{color:var(--ok)}@media(prefers-reduced-motion:reduce){#lk .lkfp *,#lk .lkfp:before,#lk .lkfp:after{outline:0}}',
      '#lk .lkgo{width:100%;max-width:420px;margin:10px auto 0;display:flex;align-items:center;justify-content:center;gap:10px}'
    ].join('');
    document.head.appendChild(st);

    // The lock shows only what this phone really has: a Fingerprint button, a Face ID button, or both (the phone's own lock if neither).
    // Each button opens the banking-style screen, which then opens the phone's real prompt.
    var cap = window.Capacitor, native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
    var FACEI = '<svg viewBox="0 0 48 48" width="52" height="52" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="fb" d="M6 15V10a4 4 0 0 1 4-4h5"/><path class="fb" d="M33 6h5a4 4 0 0 1 4 4v5"/><path class="fb" d="M42 33v5a4 4 0 0 1-4 4h-5"/><path class="fb" d="M15 42h-5a4 4 0 0 1-4-4v-5"/><path d="M17 19v4"/><path d="M31 19v4"/><path d="M24 19v8.5a1.6 1.6 0 0 1-1.6 1.6H21.5"/><path d="M17 33.5c2 2.2 4.2 3.2 7 3.2s5-1 7-3.2"/></svg>';
    var st2 = document.createElement('style');
    st2.textContent = '#lk .lkrow{display:flex;justify-content:center;gap:26px;margin:16px auto 20px}#lk .lkrow .lkb{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--fg,#fff)}'
      + '#lk .lkrow .lkfp{margin:0;width:84px;height:84px}#lk .lkfp.lkface{border-radius:30px}#lk .lkface svg path{stroke-dasharray:none;stroke-dashoffset:0;animation:none}#lk .lkface svg .fb{animation:lkp 2.4s ease-in-out infinite}'
      + '#lk .lkface:after{border-radius:30px;left:22%;right:22%}#lk .lkface:before{border-radius:30px}';
    document.head.appendChild(st2);
    var fpBtn = document.getElementById('lku');
    if (native && fpBtn && window.ccNativeBio) window.ccNativeBio.caps().then(function (c) {
      if (!c.any) return;
      if (c.fingerprint && c.face) lab && (lab.textContent = 'Continue with Fingerprint or Face ID');
      else if (c.face) lab && (lab.textContent = 'Continue with Face ID');
      else if (c.fingerprint) lab && (lab.textContent = 'Continue with Fingerprint');
      else lab && (lab.textContent = 'Continue with your phone lock');
      if (note) note.textContent = c.fingerprint && c.face ? 'Choose how to unlock' : c.face ? 'Look at your phone to unlock' : c.fingerprint ? 'Touch the sensor to unlock' : 'Use your PIN, pattern or password';
      if (document.getElementById('lkf')) return;
      var row = document.createElement('div'); row.className = 'lkrow';
      fpBtn.parentNode.insertBefore(row, fpBtn);
      var cap1 = function (btn, text) { var w = document.createElement('div'); w.className = 'lkb'; w.appendChild(btn); var t = document.createElement('span'); t.textContent = text; w.appendChild(t); row.appendChild(w); };
      if (c.face) {
        var fb = document.createElement('button'); fb.type = 'button'; fb.id = 'lkf'; fb.className = 'lkfp lkface'; fb.setAttribute('aria-label', 'Unlock with Face ID'); fb.innerHTML = FACEI;
        if (c.fingerprint) { cap1(fpBtn, 'Fingerprint'); cap1(fb, 'Face ID'); }
        else { fpBtn.hidden = true; fpBtn.style.display = 'none'; cap1(fb, 'Face ID'); row.appendChild(fpBtn); }       // #lku stays in the page: the app's own unlock code clicks it
      } else cap1(fpBtn, c.fingerprint ? 'Fingerprint' : 'Phone lock');
    }, function () {});
    var lab = document.querySelector('#lk .lkh'), note = document.querySelector('#lk .note');

    // "Sign in with my password": a real check. The password is sent to the server and only a yes unlocks. The old recovery code still works.
    var pwb = document.getElementById('lkpw'), lkc = document.getElementById('lkc'), lkr = document.getElementById('lkr');
    if (pwb) pwb.textContent = 'Sign in with my password';
    if (lkc) { lkc.type = 'password'; lkc.placeholder = 'Your password or code'; lkc.setAttribute('aria-label', 'Password or recovery code'); }
    if (lkr) {
      lkr.textContent = 'Unlock';
      lkr.addEventListener('click', function (e) {
        var v = lkc ? lkc.value : '';
        if (!v.trim() || !(window.CC && CC.restoreAccount)) return;                     // empty or app still starting: the page's own check answers
        try { if (v.trim().toUpperCase() === String(ME.code || '').toUpperCase()) return; } catch (x) {}   // the saved recovery code: the page's own check
        e.preventDefault(); e.stopImmediatePropagation();
        var who = ''; try { who = ME.handle || ME.aid || ''; } catch (x) {}
        lkr.disabled = true; var old = lkr.textContent; lkr.textContent = 'Checking...';
        CC.restoreAccount(who, v).then(function () { lk.classList.remove('on'); if (lkc) lkc.value = ''; try { toast('Unlocked'); } catch (x) {} },
          function (er) { try { toast((er && er.message) || 'That password is not right'); } catch (x) {} })
          .then(function () { lkr.disabled = false; lkr.textContent = old; });
      }, true);
    }

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
