/* cc-cam.js v1: shared camera helpers for Live and Mbogi Talk.
   - ccCam.loadSdk()      loads the Agora video engine once (same CDN list as Live)
   - ccCam.ask(opts)      asks "Front camera or back camera?" and resolves 'user' | 'environment' (or null if cancelled)
   - ccCam.flip(track)    switches an Agora camera track between the front and back camera, resolves the new facing
   - ccCam.facingOf(track) 'user' | 'environment'
   Loaded before cc-live.js and cc-mbogi.js. No emoji in the buttons, outline icons only. */
(function () {
  'use strict';
  if (window.ccCam) return;
  var SDK = ['https://download.agora.io/sdk/release/AgoraRTC_N-4.22.0.js', 'https://cdn.jsdelivr.net/npm/agora-rtc-sdk-ng@4.22.0/AgoraRTC_N.js', 'https://download.agora.io/sdk/release/AgoraRTC_N-4.20.0.js'];
  var sdkP = null;
  function loadSdk() {
    if (window.AgoraRTC) return Promise.resolve();
    if (sdkP) return sdkP;
    sdkP = new Promise(function (ok, bad) {
      var i = 0;
      (function next() {
        if (window.AgoraRTC) return ok();
        if (i >= SDK.length) { sdkP = null; return bad(new Error('Could not load the video player. Check your internet.')); }
        var s = document.createElement('script'); s.src = SDK[i++]; s.onload = function () { window.AgoraRTC ? ok() : next(); }; s.onerror = next; document.head.appendChild(s);
      })();
    });
    return sdkP;
  }

  function facingOf(track) {
    try {
      var s = track.getMediaStreamTrack().getSettings();
      if (s.facingMode === 'environment' || s.facingMode === 'user') return s.facingMode;
      if (/back|rear|environment/i.test(track.getMediaStreamTrack().label || '')) return 'environment';
    } catch (e) {}
    return 'user';
  }

  /* Switch cameras on a phone: front <-> back. If the labels do not say which is which, it simply goes to the next camera. */
  async function flip(track) {
    if (!track || !window.AgoraRTC) throw new Error('The camera is not on yet');
    var cams = await AgoraRTC.getCameras();
    if (!cams || cams.length < 2) throw new Error('This device has only one camera');
    var cur = facingOf(track), want = cur === 'environment' ? 'user' : 'environment';
    var re = want === 'environment' ? /back|rear|environment|world/i : /front|user|face|selfie/i;
    var curId = ''; try { curId = track.getMediaStreamTrack().getSettings().deviceId || ''; } catch (e) {}
    var pick = cams.filter(function (c) { return re.test(c.label || '') && c.deviceId !== curId; })[0];
    if (!pick) { var i = cams.findIndex(function (c) { return c.deviceId === curId; }); pick = cams[(i + 1) % cams.length]; }
    await track.setDevice(pick.deviceId);
    return facingOf(track);
  }

  var CSS = '.ccm-sh{position:fixed;inset:0;z-index:99990;background:rgba(16,20,34,.82);display:flex;align-items:flex-end;justify-content:center;padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px))}'
    + '@media(min-width:600px){.ccm-sh{align-items:center}}'
    + '.ccm-sh .box{width:100%;max-width:380px;display:grid;gap:10px;text-align:center}'
    + '.ccm-sh h3{margin:2px 0 0;font-size:18px}.ccm-sh p{margin:0}'
    + '.ccm-opt{display:flex;align-items:center;gap:14px;width:100%;text-align:left;border:1px solid var(--line,rgba(255,255,255,.18));background:transparent;color:inherit;border-radius:16px;padding:14px;font:600 15px Poppins,Manrope,sans-serif;cursor:pointer}'
    + '.ccm-opt svg{width:26px;height:26px;flex:none}.ccm-opt small{display:block;font-weight:400;opacity:.7;font-size:12px;margin-top:2px}'
    + '.ccm-opt:active{transform:scale(.99)}';
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  var SV = function (p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var ICON = {
    front: SV('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
    back: SV('<path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>'),
    off: SV('<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/><path d="M2 2l20 20"/>')
  };
  window.ccCam = { loadSdk: loadSdk, flip: flip, facingOf: facingOf, ICON: ICON };

  /* "Which camera?" prompt. opts: { title, sub, allowOff }  ->  'user' | 'environment' | 'off' | null */
  window.ccCam.ask = function (opts) {
    opts = opts || {};
    return new Promise(function (done) {
      var m = document.createElement('div'); m.className = 'ccm-sh'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
      m.innerHTML = '<div class="box g"><h3>' + (opts.title || 'Which camera?') + '</h3><p class="sub">' + (opts.sub || 'You can switch any time with the flip button.') + '</p>'
        + '<button type="button" class="ccm-opt" data-k="user">' + ICON.front + '<span>Front camera<small>Selfie view, shows you</small></span></button>'
        + '<button type="button" class="ccm-opt" data-k="environment">' + ICON.back + '<span>Back camera<small>Shows what is around you</small></span></button>'
        + (opts.allowOff ? '<button type="button" class="ccm-opt" data-k="off">' + ICON.off + '<span>Camera off<small>Join with sound only</small></span></button>' : '')
        + '<button type="button" class="btn g" data-k="x" style="width:100%">Cancel</button></div>';
      var fin = function (v) { try { m.remove(); } catch (e) {} done(v); };
      m.onclick = function (e) {
        if (e.target === m) return fin(null);
        var b = e.target.closest('button'); if (!b) return;
        fin(b.dataset.k === 'x' ? null : b.dataset.k);
      };
      document.body.appendChild(m);
      try { m.querySelector('[data-k=user]').focus(); } catch (e) {}
    });
  };
})();
