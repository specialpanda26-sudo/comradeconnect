/* cc-fingerprint.js v3: the banking-style "Hi, NAME / Welcome back" biometric screen inside the Android app.
   One screen, two choices: Fingerprint or Face ID. Each one animates (moving fingerprint / face-scan frame) and then opens
   the phone's REAL prompt through window.ccNativeBio.verify(why, kind): the fingerprint sensor for Fingerprint, the phone's
   face unlock for Face ID, and the phone's PIN / pattern / password as the last choice. Nothing is faked: the green tick
   appears only after Android itself says yes, and only the choices this phone really has are offered.
   Used by the app lock, turning the lock on and withdrawals (via cc-faceid.js). */
(function () {
  'use strict';
  if (window.__ccFp) return; window.__ccFp = 1;
  var reduce = false; try { reduce = false; } catch (e) {}
  var current = null;

  var FP = '<svg viewBox="0 0 24 24" class="fpx-ic fpx-fpi" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/></svg>';
  // Face ID drawing: four corner brackets, eyes, nose, smile. Each line draws itself, then the scan line sweeps over it.
  var FACE = '<svg viewBox="0 0 48 48" class="fpx-ic fpx-fci" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">'
    + '<path class="fb" d="M6 15V10a4 4 0 0 1 4-4h5"/><path class="fb" d="M33 6h5a4 4 0 0 1 4 4v5"/><path class="fb" d="M42 33v5a4 4 0 0 1-4 4h-5"/><path class="fb" d="M15 42h-5a4 4 0 0 1-4-4v-5"/>'
    + '<path class="ff" d="M17 19v4"/><path class="ff" d="M31 19v4"/><path class="ff" d="M24 19v8.5a1.6 1.6 0 0 1-1.6 1.6H21.5"/><path class="ff" d="M17 33.5c2 2.2 4.2 3.2 7 3.2s5-1 7-3.2"/></svg>';
  var KEY = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" class="fpx-ck" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var XS = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  function css() {
    if (document.getElementById('fpx-css')) return;
    var s = document.createElement('style'); s.id = 'fpx-css';
    s.textContent = [
      '#ccfp{--fpa:#ff8a3d;position:fixed;inset:0;z-index:10100;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:var(--bg,#f6efe9);color:var(--fg,#fff);font-family:Poppins,system-ui,sans-serif;text-align:center;opacity:0;transition:opacity .25s;overflow-y:auto}',
      '#ccfp.on{opacity:1}',
      '#ccfp .fpx-x{position:absolute;right:16px;top:calc(14px + env(safe-area-inset-top,0px));width:40px;height:40px;border-radius:50%;border:1px solid var(--gb,rgba(255,255,255,.25));background:var(--g,rgba(255,255,255,.07));color:inherit;display:grid;place-items:center;cursor:pointer;padding:0}',
      '#ccfp .fpx-hi{margin:0;font-size:clamp(26px,7.5vw,34px);font-weight:700;letter-spacing:-.02em;line-height:1.15}',
      '#ccfp .fpx-hi b{font-weight:800;color:var(--fpa)}',
      '#ccfp .fpx-sub{margin:8px 0 0;font-size:14px;color:var(--mut,var(--mut));line-height:1.5;max-width:300px}',
      '#ccfp .fpx-wb{font-size:16px;color:var(--fg,#fff);margin-top:10px}',
      /* the choice: Fingerprint | Face ID */
      '#ccfp .fpx-tabs{display:flex;gap:4px;margin:26px 0 0;padding:4px;border-radius:999px;border:1px solid var(--gb,rgba(255,255,255,.25));background:var(--g,rgba(255,255,255,.07))}',
      '#ccfp .fpx-tab{display:flex;align-items:center;gap:8px;border:0;background:transparent;color:var(--mut,var(--mut));border-radius:999px;padding:10px 18px;font:600 14px Poppins,system-ui,sans-serif;cursor:pointer;transition:background .25s,color .25s}',
      '#ccfp .fpx-tab svg{width:20px;height:20px}',
      '#ccfp .fpx-tab[aria-selected=true]{background:var(--fpa);color:#16130f}',
      '#ccfp .fpx-ct{margin:26px 0 0;font-size:16px;font-weight:700}',
      '#ccfp .fpx-st{min-height:22px;margin:4px 0 0;font-size:15px;font-weight:400;color:var(--mut,var(--mut))}',
      /* the stage: moving fingerprint or face scan */
      '#ccfp button.fpx-stage{position:relative;width:176px;height:176px;margin:18px 0 10px;display:grid;place-items:center;border:0;background:none;color:var(--fpa);padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '#ccfp .fpx-disc{position:relative;width:128px;height:128px;border-radius:50%;display:grid;place-items:center;overflow:hidden;background:var(--g,rgba(255,255,255,.07));border:1px solid var(--gb,rgba(255,255,255,.25));transition:border-color .3s,background .3s,border-radius .35s}',
      '#ccfp[data-k=face] .fpx-disc{border-radius:38px}',
      '#ccfp .fpx-ic{width:76px;height:76px;transition:opacity .25s,transform .25s;position:absolute}',
      '#ccfp .fpx-fci{width:84px;height:84px}',
      '#ccfp[data-k=fingerprint] .fpx-fci,#ccfp[data-k=face] .fpx-fpi{opacity:0;transform:scale(.7)}',
      '#ccfp .fpx-ck{position:absolute;width:64px;height:64px;opacity:0;transform:scale(.4);transition:opacity .3s,transform .4s cubic-bezier(.2,.9,.3,1.4)}',
      '#ccfp .fpx-ln{position:absolute;left:0;right:0;height:34%;top:-34%;background:linear-gradient(transparent,var(--fg,#fff),transparent);opacity:.35;animation:fpx-sweep 1.7s ease-in-out infinite}',
      '#ccfp[data-k=face] .fpx-ln{height:14%;top:-14%;background:linear-gradient(transparent,var(--fpa),transparent);opacity:.8;animation:fpx-fsweep 1.9s ease-in-out infinite}',
      '#ccfp .fpx-r{position:absolute;inset:14px;border-radius:50%;border:1.5px solid var(--fpa);opacity:0;animation:fpx-ring 2.4s ease-out infinite}',
      '#ccfp[data-k=face] .fpx-r{border-radius:44px}',
      '#ccfp .fpx-r.b{animation-delay:1.2s}',
      '#ccfp[data-k=face] .fpx-fci .fb{stroke-dasharray:30;stroke-dashoffset:30;animation:fpx-draw .7s ease forwards,fpx-pulse 1.9s ease-in-out .9s infinite}',
      '#ccfp[data-k=face] .fpx-fci .ff{stroke-dasharray:24;stroke-dashoffset:24;animation:fpx-draw .8s ease .35s forwards,fpx-blink 3s ease-in-out 1.6s infinite}',
      '#ccfp[data-k=fingerprint] .fpx-fpi{animation:fpx-fp 2.4s ease-in-out infinite}',
      '@keyframes fpx-sweep{from{top:-34%}to{top:100%}}',
      '@keyframes fpx-fsweep{0%{top:-14%}50%{top:100%}100%{top:-14%}}',
      '@keyframes fpx-ring{0%{transform:scale(.72);opacity:.55}100%{transform:scale(1.28);opacity:0}}',
      '@keyframes fpx-draw{to{stroke-dashoffset:0}}',
      '@keyframes fpx-pulse{0%,100%{opacity:1}50%{opacity:.45}}',
      '@keyframes fpx-blink{0%,92%,100%{opacity:1}96%{opacity:.25}}',
      '@keyframes fpx-fp{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(.96)}}',
      '#ccfp.ok .fpx-disc{border-color:var(--ok);background:rgba(61,220,132,.14)}#ccfp.ok .fpx-ic{opacity:0!important;transform:scale(.6)}#ccfp.ok .fpx-ck{opacity:1;transform:scale(1);color:var(--ok)}',
      '#ccfp.ok .fpx-ln,#ccfp.ok .fpx-r,#ccfp.bad .fpx-ln,#ccfp.bad .fpx-r{display:none}',
      '#ccfp.bad .fpx-disc{border-color:var(--bad);animation:fpx-shake .4s}#ccfp.bad .fpx-ic{color:var(--bad)}',
      '@keyframes fpx-shake{20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}',
      '#ccfp .fpx-bar{display:flex;flex-direction:column;gap:6px;width:100%;max-width:320px;margin-top:18px}',
      '#ccfp .fpx-b{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;border:1px solid var(--gb,rgba(255,255,255,.3));background:transparent;color:inherit;border-radius:999px;padding:14px 20px;font:600 15px Poppins,system-ui,sans-serif;cursor:pointer}',
      '#ccfp .fpx-b.p{background:var(--fpa);border-color:var(--fpa);color:#16130f;min-height:50px}',
      '#ccfp .fpx-b.t{border:0;color:var(--mut,var(--mut));font-weight:500}',
      '#ccfp .fpx-ln2{margin:16px 0 0;font-size:15px;font-weight:600}#ccfp .fpx-ln2 a{color:var(--fpa);text-decoration:underline}',
      '#ccfp[data-rm] *{animation:none!important;transition-duration:.01s!important}',
      '#ccfp{background:var(--bg,#f6efe9)!important;overflow:hidden}',
      '#ccfp::before{content:"";position:absolute;inset:-10% -20% auto -20%;height:60%;z-index:0;pointer-events:none;filter:blur(40px);background:radial-gradient(50% 60% at 80% 20%,rgba(255,138,61,.55),transparent 70%),radial-gradient(55% 60% at 10% 40%,rgba(196,114,122,.4),transparent 70%),radial-gradient(40% 50% at 50% 0,rgba(255,217,184,.9),transparent 70%)}',
      '#ccfp>*{position:relative;z-index:1}',
      '#ccfp .fpx-hi{font-weight:800;letter-spacing:-.04em}#ccfp .fpx-hi b{background:linear-gradient(95deg,#ff8a3d,#c4727a);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}',
      '#ccfp .fpx-disc{width:136px;height:136px;background:radial-gradient(120% 120% at 28% 20%,#ffd9b8 0,#ff8a3d 58%,#c4727a 130%);border:0;color:#16130f;box-shadow:0 20px 40px -14px rgba(255,138,61,.7),inset 0 2px 0 rgba(255,255,255,.55)}',
      '#ccfp .fpx-ic{color:#16130f;stroke-width:1.5}',
      '#ccfp .fpx-tab[aria-selected=true]{background:#16130f;color:#fff}',
      '#ccfp .fpx-b.p{background:#16130f;border-color:#16130f;color:#fff;border-radius:999px}',
      '#ccfp .fpx-b{border-radius:999px;font-weight:800}',
      '#ccfp[data-rm] .fpx-fci path{stroke-dashoffset:0!important}'
    ].join('');
    document.head.appendChild(s);
  }
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var handle = function () { try { return (typeof ME !== 'undefined' && ME && ME.handle) ? String(ME.handle).replace(/^@/, '').replace(/_/g, ' ').replace(/\d+$/, '').trim() : ''; } catch (e) { return ''; } };
  var NAMES = { fingerprint: 'Fingerprint', face: 'Face ID' };

  // scan(why, mode, kind): resolves true when the phone confirmed it is you, false if cancelled or refused.
  // kind is optional: 'fingerprint' or 'face' opens on that choice; otherwise the last choice (or the first the phone has) is used.
  function scan(why, mode, kind) {
    if (current) return current;
    var bio = window.ccNativeBio;
    if (!bio) return Promise.resolve(false);
    css();
    current = new Promise(function (resolve) {
      bio.caps().then(function (caps) {
        if (!caps.any) { current = null; try { (window.ccTools && ccTools.toast || window.toast)('Set up a fingerprint, face unlock or a screen lock on your phone first'); } catch (e) {} return resolve(false); }
        try { build(caps); } catch (e) { direct(caps); }
      });
      function direct(caps) {
        var kinds = []; if (caps.fingerprint) kinds.push('fingerprint'); if (caps.face) kinds.push('face');
        var k = kind && kinds.indexOf(kind) > -1 ? kind : (kinds.indexOf(bio.pref()) > -1 ? bio.pref() : (kinds[0] || 'credential'));
        bio.verify(why || 'Confirm it is really you', k).then(function (ok) {
          if (ok && k !== 'credential') bio.setPref(k);
          current = null; resolve(!!ok);
        }, function () { current = null; resolve(false); });
      }
      function build(caps) {
        var h = handle(), enable = mode === 'enable';
        var kinds = []; if (caps.fingerprint) kinds.push('fingerprint'); if (caps.face) kinds.push('face');
        var onlyLock = !kinds.length;                                  // the phone has a PIN / pattern / password but no fingerprint or face
        var k = kind && kinds.indexOf(kind) > -1 ? kind : (kinds.indexOf(bio.pref()) > -1 ? bio.pref() : (kinds[0] || 'fingerprint'));
        var root = document.createElement('div'); root.id = 'ccfp'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Confirm it is you');
        if (reduce) root.setAttribute('data-rm', '1');
        root.setAttribute('data-k', k);
        var locked = !enable && !!(document.getElementById('lk') && document.getElementById('lk').classList.contains('on'));
        var tabs = kinds.length > 1
          ? '<div class="fpx-tabs" role="tablist" aria-label="Choose how to confirm">' + kinds.map(function (x) {
              return '<button type="button" class="fpx-tab" role="tab" data-k="' + x + '" aria-selected="' + (x === k) + '">' + (x === 'face' ? FACE.replace('class="fpx-ic fpx-fci"', 'width="20" height="20"') : FP.replace('class="fpx-ic fpx-fpi"', 'width="20" height="20"')) + '<span>' + NAMES[x] + '</span></button>';
            }).join('') + '</div>' : '';
        root.innerHTML = '<h2 class="fpx-hi">' + (enable ? 'Secure your account' : (h ? 'Hi, <b>' + esc(h.toUpperCase()) + '</b>' : 'Welcome')) + '</h2>'
          + '<p class="fpx-sub fpx-wb">' + (enable ? 'Confirm it is you to turn the lock on.' : 'Welcome Back!') + '</p>'
          + tabs
          + '<p class="fpx-ct" id="fpx-ct"></p>'
          + '<p class="fpx-st" id="fpx-st" aria-live="polite"></p>'
          + '<button type="button" class="fpx-stage" id="fpx-tap" aria-label="Scan"><i class="fpx-r"></i><i class="fpx-r b"></i><span class="fpx-disc">' + FP + FACE + CHECK + '<i class="fpx-ln"></i></span></button>'
          + '<p class="fpx-sub" id="fpx-h"></p>'
          + '<div class="fpx-bar"><button type="button" class="fpx-b" id="fpx-again" hidden>Try again</button>'
          + (caps.credential && !onlyLock ? '<button type="button" class="fpx-b" id="fpx-pin" hidden>' + KEY + '<span>Use phone password</span></button>' : '')
          + (locked ? '<button type="button" class="fpx-b p" id="fpx-pw">Sign in with my password</button>' : '')
          + '<button type="button" class="fpx-b t" id="fpx-cancel">Cancel</button></div>'
          + (locked ? '<p class="fpx-ln2"><a href="#" id="fpx-sw">Switch Account</a> &nbsp;&middot;&nbsp; <a href="#" id="fpx-hp">Need Help?</a></p>' : '');
        document.body.appendChild(root);
        requestAnimationFrame(function () { root.classList.add('on'); });
        var st = root.querySelector('#fpx-st'), hint = root.querySelector('#fpx-h'), ct = root.querySelector('#fpx-ct'), again = root.querySelector('#fpx-again'), pin = root.querySelector('#fpx-pin');
        var gone = false, timer = 0, run = 0, using = onlyLock ? 'credential' : k;

        function label() {
          if (using === 'credential') { ct.textContent = enable ? 'Turn on phone lock' : 'Continue with your phone lock'; st.textContent = 'Enter your PIN, pattern or password'; hint.textContent = 'Your phone opens its own lock screen.'; return; }
          ct.textContent = (enable ? 'Turn on ' : 'Continue with ') + NAMES[using];
          st.textContent = using === 'face' ? 'Look at your phone' : 'Scan your fingerprint';
          hint.textContent = using === 'face' ? 'Your phone checks your face with its own face unlock.' : 'Touch the sensor. Your phone checks your fingerprint itself.';
        }
        function finish(ok) {
          if (gone) return; gone = true; run++; clearTimeout(timer); document.removeEventListener('keydown', key);
          root.classList.remove('on'); setTimeout(function () { root.remove(); current = null; }, 260); resolve(!!ok);
        }
        function key(e) { if (e.key === 'Escape') finish(false); }
        function say(code) {
          return code === 'locked' ? 'Too many tries. Use your phone password.'
            : code === 'notenrolled' ? (using === 'face' ? 'No face unlock is set up on this phone.' : 'No fingerprint is set up on this phone.')
            : code === 'cancelled' ? 'Cancelled' : code === 'unavailable' ? NAMES[using] + ' is not available right now.' : 'Not recognised';
        }
        function attempt() {
          if (gone) return; var my = ++run;
          root.classList.remove('bad', 'ok'); again.hidden = true; if (pin) pin.hidden = true; label();
          clearTimeout(timer);
          timer = setTimeout(function () {                                  // a moment to see the animation, then the phone's own prompt
            if (gone || my !== run) return;
            bio.verify(why || 'Confirm it is really you', using).then(function (ok) {
              if (gone || my !== run) return;
              if (ok) {
                bio.setPref(using === 'credential' ? bio.pref() : using);
                root.classList.add('ok'); st.textContent = 'Verified'; hint.textContent = ''; try { navigator.vibrate && navigator.vibrate([20, 40, 20]); } catch (e) {}
                timer = setTimeout(function () { finish(true); }, reduce ? 150 : 800);
              } else {
                var c = bio.last || 'nomatch';
                root.classList.add('bad'); st.textContent = say(c); hint.textContent = c === 'cancelled' ? 'Tap the picture to try again, or cancel.' : 'Try again, or pick another way.';
                again.hidden = false; if (pin) pin.hidden = false; try { navigator.vibrate && navigator.vibrate(60); } catch (e) {}
                if (c === 'locked' && pin) { again.hidden = true; }
              }
            });
          }, reduce ? 50 : 700);
        }
        function pick(x) {
          if (gone || x === using && !root.classList.contains('bad') && !root.classList.contains('ok')) return;
          using = x; root.setAttribute('data-k', x === 'credential' ? k : x);
          [].forEach.call(root.querySelectorAll('.fpx-tab'), function (t) { t.setAttribute('aria-selected', String(t.getAttribute('data-k') === x)); });
          attempt();
        }
        /* the Cancel button (#fpx-cancel) is the only way out: no second X */
        root.querySelector('#fpx-cancel').onclick = function () { finish(false); };
        again.onclick = attempt;
        if (pin) pin.onclick = function () { using = 'credential'; attempt(); };
        [].forEach.call(root.querySelectorAll('.fpx-tab'), function (t) { t.onclick = function () { k = t.getAttribute('data-k'); pick(k); }; });
        var tap = root.querySelector('#fpx-tap'); if (tap) tap.onclick = function () { if (!again.hidden) attempt(); };
        var pw = root.querySelector('#fpx-pw'); if (pw) pw.onclick = function () { finish(false); setTimeout(function () { var lkk = document.getElementById('lk'); if (lkk) lkk.classList.add('rec'); var c = document.getElementById('lkc'); if (c) { c.scrollIntoView({ block: 'center' }); c.focus(); } }, 320); };
        var sw = root.querySelector('#fpx-sw'); if (sw) sw.onclick = function (e) { e.preventDefault(); finish(false); setTimeout(function () { try { window.ccAuthPanel && window.ccAuthPanel(); } catch (x) {} }, 320); };
        var hp = root.querySelector('#fpx-hp'); if (hp) hp.onclick = function (e) {
          e.preventDefault(); var u = 'https://comradeconnect.co.ke/contact.html', B = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Browser;
          try { if (B) B.open({ url: u }); else window.open(u, '_blank'); } catch (x) {}
        };
        document.addEventListener('keydown', key);
        attempt();
      }
    });
    return current;
  }
  window.ccFp = { scan: scan };
})();
