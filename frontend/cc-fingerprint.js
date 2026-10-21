/* cc-fingerprint.js: the "Scan your fingerprint" screen inside the Android app.
   It shows a moving fingerprint, then opens the phone's REAL prompt (fingerprint, face unlock or the phone's own
   PIN / pattern / password) through window.ccNativeBio. Nothing is faked: if the phone says no, you see it.
   Has a Cancel button and an X. Used by the app lock, turning the lock on and withdrawals (via cc-faceid.js). */
(function () {
  'use strict';
  if (window.__ccFp) return; window.__ccFp = 1;
  var reduce = false; try { reduce = matchMedia('(prefers-reduced-motion:reduce)').matches; } catch (e) {}
  var current = null;

  var FP = '<svg viewBox="0 0 24 24" class="fpx-ic" aria-hidden="true"><path fill="currentColor" d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67-.09.18-.26.28-.44.28zM3.5 9.72c-.1 0-.2-.03-.29-.09-.23-.16-.28-.47-.12-.7.99-1.4 2.25-2.5 3.75-3.27C9.98 4.04 14 4.03 17.15 5.65c1.5.77 2.76 1.86 3.75 3.25.16.22.11.54-.12.7-.23.16-.54.11-.7-.12-.9-1.26-2.04-2.25-3.39-2.94-2.87-1.47-6.54-1.47-9.4.01-1.36.7-2.5 1.7-3.4 2.96-.08.14-.23.21-.39.21zm6.25 12.07c-.13 0-.26-.05-.35-.15-.87-.87-1.34-1.43-2.01-2.64-.69-1.23-1.05-2.73-1.05-4.34 0-2.97 2.54-5.39 5.66-5.39s5.66 2.42 5.66 5.39c0 .28-.22.5-.5.5s-.5-.22-.5-.5c0-2.42-2.09-4.39-4.66-4.39-2.57 0-4.66 1.97-4.66 4.39 0 1.44.32 2.77.93 3.85.64 1.15 1.08 1.64 1.85 2.42.19.2.19.51 0 .71-.11.1-.24.15-.37.15zm7.17-1.85c-1.19 0-2.24-.3-3.1-.89-1.49-1.01-2.38-2.65-2.38-4.39 0-.28.22-.5.5-.5s.5.22.5.5c0 1.41.72 2.74 1.94 3.56.71.48 1.54.71 2.54.71.24 0 .64-.03 1.04-.1.27-.05.53.13.58.41.05.27-.13.53-.41.58-.57.11-1.07.12-1.21.12zM14.91 22c-.04 0-.09-.01-.13-.02-1.59-.44-2.63-1.03-3.72-2.1-1.4-1.39-2.17-3.24-2.17-5.22 0-1.62 1.38-2.94 3.08-2.94 1.7 0 3.08 1.32 3.08 2.94 0 1.07.93 1.94 2.08 1.94s2.08-.87 2.08-1.94c0-3.77-3.25-6.83-7.25-6.83-2.84 0-5.44 1.58-6.61 4.03-.39.81-.59 1.76-.59 2.8 0 .78.07 2.01.67 3.61.1.26-.03.55-.29.64-.26.1-.55-.04-.64-.29-.49-1.31-.73-2.61-.73-3.96 0-1.2.23-2.29.68-3.24 1.33-2.79 4.28-4.6 7.51-4.6 4.55 0 8.25 3.51 8.25 7.83 0 1.62-1.38 2.94-3.08 2.94s-3.08-1.32-3.08-2.94c0-1.07-.93-1.94-2.08-1.94s-2.08.87-2.08 1.94c0 1.71.66 3.31 1.87 4.51.95.94 1.86 1.46 3.27 1.85.27.07.42.35.35.61-.05.23-.26.38-.47.38z"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" class="fpx-ck" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var XS = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  function css() {
    if (document.getElementById('fpx-css')) return;
    var s = document.createElement('style'); s.id = 'fpx-css';
    s.textContent = [
      '#ccfp{position:fixed;inset:0;z-index:10100;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:var(--bg,#000);color:var(--fg,#fff);font-family:Poppins,system-ui,sans-serif;text-align:center;opacity:0;transition:opacity .25s}',
      '#ccfp.on{opacity:1}',
      '#ccfp .fpx-x{position:absolute;right:16px;top:calc(14px + env(safe-area-inset-top,0px));width:40px;height:40px;border-radius:50%;border:1px solid var(--gb,rgba(255,255,255,.25));background:var(--g,rgba(255,255,255,.07));color:inherit;display:grid;place-items:center;cursor:pointer;padding:0}',
      '#ccfp .fpx-hi{margin:0;font-size:clamp(26px,7.5vw,34px);font-weight:700;letter-spacing:-.02em;line-height:1.15}',
      '#ccfp .fpx-hi b{font-weight:800}',
      '#ccfp .fpx-sub{margin:8px 0 0;font-size:14px;color:var(--mut,#bdbdbd);line-height:1.5;max-width:300px}',
      '#ccfp .fpx-stage{position:relative;width:176px;height:176px;margin:34px 0 26px;display:grid;place-items:center}',
      '#ccfp .fpx-disc{position:relative;width:128px;height:128px;border-radius:50%;display:grid;place-items:center;overflow:hidden;background:var(--g,rgba(255,255,255,.07));border:1px solid var(--gb,rgba(255,255,255,.25));transition:border-color .3s,background .3s}',
      '#ccfp .fpx-ic{width:76px;height:76px;transition:opacity .25s,transform .25s}',
      '#ccfp .fpx-ck{position:absolute;width:64px;height:64px;opacity:0;transform:scale(.4);transition:opacity .3s,transform .4s cubic-bezier(.2,.9,.3,1.4)}',
      '#ccfp .fpx-ln{position:absolute;left:0;right:0;height:34%;top:-34%;background:linear-gradient(transparent,var(--fg,#fff),transparent);opacity:.35;animation:fpx-sweep 1.7s ease-in-out infinite}',
      '#ccfp .fpx-r{position:absolute;inset:14px;border-radius:50%;border:1.5px solid var(--fg,#fff);opacity:0;animation:fpx-ring 2.4s ease-out infinite}',
      '#ccfp .fpx-r.b{animation-delay:1.2s}',
      '@keyframes fpx-sweep{from{top:-34%}to{top:100%}}',
      '@keyframes fpx-ring{0%{transform:scale(.72);opacity:.55}100%{transform:scale(1.28);opacity:0}}',
      '#ccfp.ok .fpx-disc{border-color:#3ddc84;background:rgba(61,220,132,.14)}#ccfp.ok .fpx-ic{opacity:0;transform:scale(.6)}#ccfp.ok .fpx-ck{opacity:1;transform:scale(1);color:#3ddc84}',
      '#ccfp.ok .fpx-ln,#ccfp.ok .fpx-r,#ccfp.bad .fpx-ln,#ccfp.bad .fpx-r{display:none}',
      '#ccfp.bad .fpx-disc{border-color:#ff5c5c}#ccfp.bad .fpx-ic{color:#ff5c5c;animation:fpx-shake .4s}',
      '@keyframes fpx-shake{20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}',
      '#ccfp .fpx-st{min-height:22px;margin:0;font-size:15px;font-weight:600}',
      '#ccfp .fpx-bar{display:flex;flex-direction:column;gap:6px;width:100%;max-width:320px;margin-top:22px}',
      '#ccfp .fpx-b{width:100%;border:1px solid var(--gb,rgba(255,255,255,.3));background:transparent;color:inherit;border-radius:999px;padding:14px 20px;font:600 15px Poppins,system-ui,sans-serif;cursor:pointer}',
      '#ccfp .fpx-b.p{background:var(--ink,#fff);color:var(--inkfg,#000);border-color:var(--ink,#fff)}',
      '#ccfp .fpx-b.t{border:0;color:var(--mut,#bdbdbd);font-weight:500}',
      '#ccfp{--fpa:#ff5a00}#ccfp .fpx-hi b{color:var(--fpa)}#ccfp .fpx-wb{font-size:16px;color:var(--fg,#fff);margin-top:10px}',
      '#ccfp .fpx-ct{margin:34px 0 0;font-size:16px;font-weight:700}#ccfp .fpx-st{font-weight:400;color:var(--mut,#bdbdbd);margin-top:4px}',
      '#ccfp button.fpx-stage{border:0;background:none;color:var(--fpa);padding:0;cursor:pointer;margin:18px 0 10px}#ccfp .fpx-ic{color:var(--fpa)}',
      '#ccfp .fpx-b.p{background:var(--fpa);border-color:var(--fpa);color:#fff;min-height:50px}',
      '#ccfp .fpx-ln2{margin:18px 0 0;font-size:15px;font-weight:600}#ccfp .fpx-ln2 a{color:var(--fpa);text-decoration:underline}',
      '#ccfp[data-rm] *{animation:none!important;transition-duration:.01s!important}'
    ].join('');
    document.head.appendChild(s);
  }
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var handle = function () { try { return (typeof ME !== 'undefined' && ME && ME.handle) ? String(ME.handle).replace(/^@/, '') : ''; } catch (e) { return ''; } };

  // scan(why, mode): resolves true when the phone confirmed it is you, false if cancelled or refused
  function scan(why, mode) {
    if (current) return current;
    if (!window.ccNativeBio) return Promise.resolve(false);
    css();
    current = new Promise(function (resolve) {
      var h = handle(), enable = mode === 'enable';
      var root = document.createElement('div'); root.id = 'ccfp'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Fingerprint');
      if (reduce) root.setAttribute('data-rm', '1');
      var locked = !enable && !!(document.getElementById('lk') && document.getElementById('lk').classList.contains('on'));
      root.innerHTML = '<button type="button" class="fpx-x" aria-label="Cancel">' + XS + '</button>'
        + '<h2 class="fpx-hi">' + (enable ? 'Secure your account' : (h ? 'Hi, <b>' + esc(h.toUpperCase()) + '</b>' : 'Welcome')) + '</h2>'
        + '<p class="fpx-sub fpx-wb">' + (enable ? 'Confirm it is you to turn the lock on.' : 'Welcome Back!') + '</p>'
        + '<p class="fpx-ct">' + (enable ? 'Turn on fingerprint lock' : 'Continue with Fingerprint') + '</p>'
        + '<p class="fpx-st" aria-live="polite">Scan your fingerprint</p>'
        + '<button type="button" class="fpx-stage" id="fpx-tap" aria-label="Scan fingerprint"><i class="fpx-r"></i><i class="fpx-r b"></i><span class="fpx-disc">' + FP + CHECK + '<i class="fpx-ln"></i></span></button>'
        + '<p class="fpx-sub" id="fpx-h">Use your fingerprint, face unlock or phone password.</p>'
        + '<div class="fpx-bar"><button type="button" class="fpx-b" id="fpx-again" hidden>Try again</button>'
        + (locked ? '<button type="button" class="fpx-b p" id="fpx-pw">Sign in with my Password</button>' : '')
        + '<button type="button" class="fpx-b t" id="fpx-cancel">Cancel</button></div>'
        + (locked ? '<p class="fpx-ln2"><a href="#" id="fpx-sw">Switch Account</a> &nbsp;&middot;&nbsp; <a href="#" id="fpx-hp">Need Help?</a></p>' : '');
      document.body.appendChild(root);
      requestAnimationFrame(function () { root.classList.add('on'); });
      var st = root.querySelector('.fpx-st'), hint = root.querySelector('#fpx-h'), again = root.querySelector('#fpx-again'), gone = false, timer = 0;
      function finish(ok) {
        if (gone) return; gone = true; clearTimeout(timer); document.removeEventListener('keydown', key);
        root.classList.remove('on'); setTimeout(function () { root.remove(); current = null; }, 260); resolve(!!ok);
      }
      function key(e) { if (e.key === 'Escape') finish(false); }
      function attempt() {
        if (gone) return;
        root.classList.remove('bad'); again.hidden = true; st.textContent = 'Scan your fingerprint'; hint.textContent = 'Use your fingerprint, face unlock or phone password.';
        timer = setTimeout(function () {
          window.ccNativeBio.verify(why || 'Confirm it is really you').then(function (ok) {
            if (gone) return;
            if (ok) {
              root.classList.add('ok'); st.textContent = 'Verified'; hint.textContent = ''; try { navigator.vibrate && navigator.vibrate([20, 40, 20]); } catch (e) {}
              timer = setTimeout(function () { finish(true); }, reduce ? 150 : 750);
            } else {
              root.classList.add('bad'); st.textContent = 'Not confirmed'; hint.textContent = 'Try again, or cancel.'; again.hidden = false; try { navigator.vibrate && navigator.vibrate(60); } catch (e) {}
            }
          });
        }, reduce ? 50 : 650);                                                  // a moment to see the animation, then the real prompt
      }
      root.querySelector('.fpx-x').onclick = function () { finish(false); };
      root.querySelector('#fpx-cancel').onclick = function () { finish(false); };
      again.onclick = attempt;
      var tap = root.querySelector('#fpx-tap'); if (tap) tap.onclick = function () { if (!again.hidden) attempt(); };
      var pw = root.querySelector('#fpx-pw'); if (pw) pw.onclick = function () { finish(false); setTimeout(function () { var lkk = document.getElementById('lk'); if (lkk) lkk.classList.add('rec'); var c = document.getElementById('lkc'); if (c) { c.scrollIntoView({ block: 'center' }); c.focus(); } }, 320); };
      var sw = root.querySelector('#fpx-sw'); if (sw) sw.onclick = function (e) { e.preventDefault(); finish(false); setTimeout(function () { try { window.ccAuthPanel && window.ccAuthPanel(); } catch (x) {} }, 320); };
      var hp = root.querySelector('#fpx-hp'); if (hp) hp.onclick = function (e) {
        e.preventDefault(); var u = 'https://comradeconnect.co.ke/contact.html', B = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Browser;
        try { if (B) B.open({ url: u }); else window.open(u, '_blank'); } catch (x) {}
      };
      document.addEventListener('keydown', key);
      attempt();
    });
    return current;
  }
  window.ccFp = { scan: scan };
})();
