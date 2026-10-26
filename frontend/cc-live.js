/* cc-live.js v2: Live inside Comrade Connect (video by Agora, free plan), a viewers button, full screen and small screen modes, host leave prompt.
   Lives show ONLY in the Live tab (never in the Feed).
   Loaded after cc-core.js and cc-profile.js. Icons are outline SVGs, no emoji. */
(function () {
  'use strict';
  if (window.__ccLive) return; window.__ccLive = 1;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var AGORA = typeof CC_AGORA_ID === 'string' ? CC_AGORA_ID : '';
  var say = function (m) { try { toast(m); } catch (e) {} };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var call = function (p, o) { return window.CC ? CC.call(p, o) : Promise.reject(new Error('Not ready yet. Reload the page and try again.')); };
  var SV = function (p, f) { return '<svg viewBox="0 0 24 24" fill="' + (f ? 'currentColor' : 'none') + '" stroke="' + (f ? 'none' : 'currentColor') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:20px;height:20px">' + p + '</svg>'; };
  var I = {
    eye: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.6c2.2.7 3.5 2.4 3.5 5.4"/></svg>',   // people icon, same line style as the tab icons
    heart: SV('<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>'),
    chat: SV('<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z"/>'),
    share: SV('<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"/>'),
    cam: SV('<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>'),
    send: SV('<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>')
  };
  var VID = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);

  var css = document.createElement('style');
  css.textContent = [
    '.ccl-v{position:relative;width:100%;aspect-ratio:9/14;max-height:62vh;border-radius:16px;overflow:hidden;background:#101422;display:grid;place-items:center;color:#fff;font-size:13px;text-align:center}',
    '.ccl-v>div{width:100%!important;height:100%!important}',
    '.ccl-v video{object-fit:cover}',
    '.ccl-vw{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line,rgba(255,255,255,.25));background:transparent;color:inherit;border-radius:999px;padding:6px 12px;font:600 13px Poppins,sans-serif;cursor:pointer}',
    '.ccl-vw svg{width:16px;height:16px}',
    '.ccl-card{display:grid;gap:10px;margin-bottom:14px}',
    '.ccl-hd{display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '.ccl-hd b{font-size:15px;overflow-wrap:anywhere}',
    '.ccl-ac{display:flex;gap:8px;flex-wrap:wrap}',
    '.ccl-ac button{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;color:inherit;font:600 13px Poppins,sans-serif;padding:6px 8px;border-radius:10px;cursor:pointer}',
    '.ccl-ac button.on{color:var(--ink)}',
    '.ccl-cm{display:grid;gap:4px;font-size:13px;max-height:120px;overflow:auto;overflow-wrap:anywhere}',
    '.ccl-cm p{margin:0}',
    '.ccl-f{display:flex;gap:8px}',
    '.ccl-f input{flex:1;min-width:0}',
    '.ccl-sh{position:fixed;inset:0;z-index:9999;background:rgba(16,20,34,.8);display:flex;align-items:center;justify-content:center;padding:20px}',
    '.ccl-sh .box{max-width:320px;width:100%;text-align:center;position:relative}',
    '.ccl-sh .ccl-x{position:absolute;top:8px;right:8px;width:36px;height:36px;border:0;background:transparent;color:inherit;display:grid;place-items:center;cursor:pointer;padding:0}',
    '.ccl-sh .ccl-x svg{width:20px;height:20px}',
    '#ccl-ctl{position:absolute;top:10px;right:10px;display:flex;gap:8px;z-index:5}',
    '#ccl-ctl button{width:38px;height:38px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;display:grid;place-items:center;cursor:pointer;padding:0}',
    '#ccl-ctl button.ccl-plain{background:transparent;filter:drop-shadow(0 1px 3px rgba(0,0,0,.8))}',
    '#ccl-ctl button[data-k=hrt]{display:none}',
    '#rmedia.ccl-fs{position:fixed!important;inset:0;z-index:9000;background:#000;display:grid}',
    '#rmedia.ccl-fs #rframe{height:100%}',
    '#rmedia.ccl-fs .ccl-v{max-height:none;height:100%;aspect-ratio:auto;border-radius:0}',
    '#rmedia.ccl-fs #ccl-ctl{top:calc(10px + env(safe-area-inset-top,0px))}',
    '#rmedia.ccl-fs #ccl-ctl button[data-k=hrt]{display:grid}',
    'body.ccl-fsb{overflow:hidden}',
    '#ccl-mini{position:fixed;right:12px;bottom:calc(84px + env(safe-area-inset-bottom,0px));width:128px;z-index:8000;border-radius:14px;overflow:hidden;background:#101422;box-shadow:0 6px 24px rgba(0,0,0,.45)}',
    '#ccl-mini #ccl-ctl{display:none}',
    '#ccl-mini .ccl-v{max-height:none;border-radius:0}',
    '#ccl-mbar{position:absolute;top:4px;left:4px;right:4px;display:flex;justify-content:space-between;z-index:6}',
    '#ccl-mbar button{width:30px;height:30px;border:0;background:rgba(0,0,0,.55);color:#fff;border-radius:50%;display:grid;place-items:center;padding:0;cursor:pointer}',
    '#ccl-mbar button svg{width:15px;height:15px}',
    '.ccl-snd{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:6;border:0;border-radius:999px;padding:9px 16px;background:#fff;color:#101422;font:600 13px Poppins,sans-serif;cursor:pointer}'
  ].join('');
  document.head.appendChild(css);

  /* ---------- video engine ---------- */
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
  function detach(box) {
    var st = box && box.__cc; if (!st) return;
    st.dead = true; box.__cc = null; try { clearInterval(st.watch); } catch (e) {}
    try { st.tracks.forEach(function (t) { try { t.stop(); t.close(); } catch (e) {} }); } catch (e) {}
    try { st.cl && st.cl.leave().catch(function () {}); } catch (e) {}
    box.textContent = '';
  }
  /* host = this phone's camera goes out; otherwise it is a viewer */
  async function attach(s, box, host) {
    detach(box);
    var v = document.createElement('div'); v.className = 'ccl-v'; v.textContent = 'Connecting...'; box.textContent = ''; box.appendChild(v);
    var st = { cl: null, tracks: [], dead: false }; box.__cc = st;
    if (!AGORA) { v.textContent = 'Live video is not set up yet. The admin must add the video key.'; return false; }
    try {
      await loadSdk(); if (st.dead) return;
      try { AgoraRTC.onAudioAutoplayFailed = function () { soundTap(box); }; } catch (e) {}   // the browser blocked sound until a tap
      st.cl = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      await st.cl.setClientRole(host ? 'host' : 'audience');
      if (!host) {
        // Subscribe to whatever the host is publishing right now. It retries what failed and runs every 3 seconds,
        // so the viewer can never stay stuck on "Waiting" after the host is back.
        var pull = async function () {
          if (st.dead) return;
          var us = st.cl.remoteUsers || [];
          for (var i = 0; i < us.length; i++) {
            var u = us[i];
            try {
              if (u.hasVideo && !u.videoTrack) await st.cl.subscribe(u, 'video');
              if (u.hasAudio && !u.audioTrack) await st.cl.subscribe(u, 'audio');
            } catch (e) { continue; }
            if (st.dead) return;
            if (u.videoTrack && !u.videoTrack.isPlaying) { v.textContent = ''; u.videoTrack.play(v); }
            if (u.audioTrack && !u.audioTrack.isPlaying) { try { u.audioTrack.setVolume(st.muted ? 0 : 100); u.audioTrack.play(); } catch (e) {} }
          }
        };
        st.cl.on('user-published', function () { pull(); });
        st.cl.on('user-unpublished', function (u, type) { if (type === 'video' && !st.dead) { v.textContent = 'The host paused the video'; } });
        st.cl.on('user-left', function () { if (!st.dead) { v.textContent = 'The host is away. Waiting for them to come back...'; } });
        v.textContent = 'Waiting for the host video...';
        st.watch = setInterval(function () { if (st.dead) clearInterval(st.watch); else pull(); }, 3000);
      }
      var tk = null; try { tk = (await call('/api/live/token', { auth: !!host, body: { channel: s.channel, host: !!host } })).token || null; } catch (e) { if (host) throw e; }
      await st.cl.join(AGORA, s.channel, tk, null); if (st.dead) { try { st.cl.leave(); } catch (e) {} return; }
      if (host) {
        var t;
        try { t = await AgoraRTC.createMicrophoneAndCameraTracks({ AEC: true, ANS: true, AGC: true }, { encoderConfig: '720p_2', facingMode: window.__ccFacing || 'user' }); }
        catch (me) {
          // microphone blocked or missing: still go live with the camera, and say so
          var cam = await AgoraRTC.createCameraVideoTrack({ encoderConfig: '720p_2', facingMode: window.__ccFacing || 'user' }); t = [null, cam];
          say('Your microphone is blocked, so people will see you but not hear you. Allow the microphone for this site.');
        }
        st.tracks = t.filter(Boolean); st.mic = t[0]; st.cam = t[1]; if (st.dead) { detach(box); return; }
        st.facing = window.__ccFacing || 'user'; v.textContent = ''; t[1].play(v, { mirror: st.facing !== 'environment' }); await st.cl.publish(st.tracks); st.ready = true;
      }
      return true;
    } catch (e) {
      if (st.dead) return false;
      var n = e && (e.name || e.code) || '';
      var why = String(n) + ' ' + (e && e.message) + ' ' + (e && e.code);
      if (/CAN_NOT_GET_GATEWAY_SERVER|INVALID_VENDOR_KEY|DYNAMIC_KEY|TOKEN/i.test(why)) { v.textContent = 'Live video is not ready: the video service refused to connect. The admin must add the Agora App Certificate on the server.'; try { console.warn('live error', e); } catch (x) {} return false; }
      v.textContent = /NotAllowed|PERMISSION/i.test(String(n) + (e && e.message)) ? 'Camera or microphone is blocked. Allow them for this site, then try again.' : 'Could not start the video (' + String(e && (e.code || e.name || e.message) || 'unknown').slice(0, 60) + '). Tell the admin this code.'; /* ccl-why */ try { console.warn('live error', e); } catch (x) {}
      return false;
    }
  }

  /* ---------- viewers button ---------- */
  function viewersSheet(n) {
    var m = document.createElement('div'); m.className = 'ccl-sh';
    m.innerHTML = '<div class="box g"><div style="display:grid;place-items:center">' + I.eye.replace('class="i"', 'class="i" style="width:34px;height:34px"') + '</div><h3 style="margin:10px 0 4px">' + esc(n) + ' watching</h3><p class="sub" style="margin:0 0 14px">Comrades watching this live right now.</p><button class="btn p" style="width:100%">Close</button></div>';
    m.onclick = function (e) { if (e.target === m || e.target.closest('button')) m.remove(); };
    document.body.appendChild(m);
  }
  function numOf(t) { var x = parseInt(String(t || '').replace(/\D/g, ''), 10); return isNaN(x) ? 0 : x; }
  function mountRoomViewers() {
    var rv = $('#rv'); if (!rv) return;
    rv.style.display = 'none';                                  // the banner under the title (#rstats) shows watching, comments and reactions
    var w = $('#rs-w'); if (w && !w.__ccl) { w.__ccl = 1; w.onclick = function () { viewersSheet(numOf($('#rs-v').textContent)); }; }
    var lh = $('#lheart'); if (lh && !$('#ccl-rsh')) {
      lh.insertAdjacentHTML('afterend', '<button class="act" id="ccl-rsh" aria-label="Share this live" style="margin-left:6px">' + I.share + '</button>');
      $('#ccl-rsh').onclick = function () { if (typeof cur !== 'undefined' && cur) shareLive(cur.id, $('#rt').textContent); };
    }
  }
  function shareLive(id, title) {
    var u = (window.ccOrigin?window.ccOrigin():location.origin) + '/?live=' + id, t = 'Watch "' + (title || 'this live') + '" live on Comrade Connect';
    if (navigator.share) navigator.share({ title: 'Comrade Connect Live', text: t, url: u }).catch(function () {});
    else try { navigator.clipboard.writeText(t + ' ' + u).then(function () { say('Link copied'); }); } catch (e) { say(u); }
  }

  /* ---------- Live tab: go live from this phone, watch inside the site ---------- */
  function mountHost() {
    var set = $('#lvset'); if (!set || $('#ccl-go')) return;
    var p = $('p', set); if (p) p.textContent = 'Go live straight from your phone camera. Comrades watch right here in the app, send hearts and chat. Anyone with an account can go live.';
    var u = $('#lurl'); if (u && u.parentElement) u.parentElement.style.display = 'none';
    var g = $('#golive'); if (g) g.style.display = 'none';
    set.insertAdjacentHTML('beforeend', '<button class="btn p" id="ccl-go" style="display:flex;align-items:center;justify-content:center;gap:8px">' + I.cam + 'Go live from this phone</button>');
    $('#ccl-go').onclick = async function (e) {
      var b = e.currentTarget;                                  // read it now: it is empty after the camera question is answered
      var t = $('#ltitle').value.trim(); if (!t) return say('Add a title so people know what is happening');
      if (!AGORA) return say('Live video is not set up yet. The admin must add the video key.');
      var face = window.ccCam ? await window.ccCam.ask({ title: 'Go live with which camera?', sub: 'You can flip between front and back while you are live.' }) : 'user';
      if (!face) return;                                        // cancelled
      window.__ccFacing = face;
      b.disabled = true;
      try {
        var d = await call('/api/live/start', { body: { title: t, native: true } });
        $('#ltitle').value = '';
        try { earn(10, 'Went live', 1); } catch (x) {}
        changed();
        openRoom({ id: d.id, title: t, native: true, channel: d.channel, mine: true });
      } catch (er) { say(er.message); }
      b.disabled = false;
    };
  }


  /* ---------- room controls: sound, full screen, small screen, leave ---------- */
  var ICON = {
    spk: SV('<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
    spkOff: SV('<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/>'),
    mic: SV('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>'),
    micOff: SV('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M3 3l18 18"/>'),
    fs: SV('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    fsOff: SV('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
    min: SV('<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="12" y="12" width="7" height="6" rx="1"/>'),
    big: SV('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),
    flip: SV('<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>'),
    x: SV('<path d="M6 6l12 12M18 6L6 18"/>')
  };
  var ME = null, HB = null, keep = false, force = false;
  window.ccLiveMe = function () { return ME; };
  var changed = function () { try { window.dispatchEvent(new Event('cc-live-changed')); } catch (e) {} };
  var media = function () { return $('#rmedia'); };
  var mini = function () { return $('#ccl-mini'); };
  var st = function () { var f = $('#rframe'); return f && f.__cc; };

  function endOnServer(id) { return call('/api/live/' + id + '/end', { body: {} }).catch(function () {}).then(function (r) { changed(); return r; }); }
  function endBeacon(id) {                                  // survives the tab closing
    try { fetch((typeof CC_API !== 'undefined' ? CC_API : '') + '/api/live/' + id + '/end', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(function () {}); } catch (e) {}
  }

  function soundTap(box) {
    var v = box && box.querySelector('.ccl-v'); if (!v || v.querySelector('.ccl-snd')) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'ccl-snd'; b.textContent = 'Tap for sound';
    b.onclick = function (e) {
      e.stopPropagation(); var s = box.__cc;
      try { s && s.cl && s.cl.remoteUsers.forEach(function (u) { if (u.audioTrack) { u.audioTrack.setVolume(s.muted ? 0 : 100); u.audioTrack.play(); } }); } catch (x) {}
      b.remove();
    };
    v.appendChild(b);
  }
  function replay(box) {                                    // a video stops when its element is moved: start it again
    var s = box && box.__cc, v = box && box.querySelector('.ccl-v'); if (!s || !v) return;
    try { if (s.cam) s.cam.play(v, { mirror: s.facing !== 'environment' }); else s.cl && s.cl.remoteUsers.forEach(function (u) { if (u.videoTrack) u.videoTrack.play(v); }); } catch (e) {}
  }

  function drawCtl() {
    var m = media(); if (!m) return;
    var c = $('#ccl-ctl'); if (c) c.remove();
    if (!ME) return;
    var fsOn = m.classList.contains('ccl-fs'), s = st();
    var off = ME.mine ? !!(s && s.micOff) : !!(s && s.muted);
    var h = '';
    if (ME.native) h += '<button type="button" data-k="snd" aria-label="' + (ME.mine ? (off ? 'Turn microphone on' : 'Turn microphone off') : (off ? 'Turn sound on' : 'Turn sound off')) + '">' + (ME.mine ? (off ? ICON.micOff : ICON.mic) : (off ? ICON.spkOff : ICON.spk)) + '</button>';
    if (ME.native && ME.mine) h += '<button type="button" data-k="flip" aria-label="Flip camera (front or back)">' + ICON.flip + '</button>';
    h += '<button type="button" data-k="hrt" aria-label="Send a heart">' + I.heart + '</button>';
    h += '<button type="button" data-k="fs" aria-label="' + (fsOn ? 'Exit full screen' : 'Full screen') + '">' + (fsOn ? ICON.fsOff : ICON.fs) + '</button>';
    h += '<button type="button" data-k="min" aria-label="Small screen">' + ICON.min + '</button>';
    h += '<button type="button" data-k="x" class="ccl-plain" aria-label="' + (ME.mine ? 'Leave or end live' : 'Leave stream') + '">' + ICON.x + '</button>';
    var d = document.createElement('div'); d.id = 'ccl-ctl'; d.innerHTML = h; m.appendChild(d);
  }

  function setFull(on) {
    var m = media(); if (!m) return;
    m.classList.toggle('ccl-fs', !!on); document.body.classList.toggle('ccl-fsb', !!on);
    // glass panels can trap position:fixed, so full screen lives directly under <body>
    if (on && m.parentNode !== document.body) { m.__home = { p: m.parentNode, n: m.nextSibling }; document.body.appendChild(m); }
    else if (!on && m.__home && !miniOn()) { var hh = m.__home; m.__home = null; hh.p.insertBefore(m, hh.n && hh.n.parentNode === hh.p ? hh.n : null); }
    try {
      if (on && m.requestFullscreen && !document.fullscreenElement) m.requestFullscreen().catch(function () {});
      else if (!on && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    } catch (e) {}
    drawCtl(); setTimeout(function () { replay($('#rframe')); }, 60);
  }
  /* phone back button: leave full screen first (cc-panels.js and cc-nav.js call this) */
  window.ccLiveBack = function () {
    var m = media();
    if (m && m.classList.contains('ccl-fs')) { setFull(false); window.__cclBackAt = Date.now(); return true; }
    return false;
  };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && media() && media().classList.contains('ccl-fs')) setFull(false); });
  document.addEventListener('fullscreenchange', function () { if (!document.fullscreenElement && media() && media().classList.contains('ccl-fs')) setFull(false); });

  /* small screen: the video floats above every tab while the live keeps going */
  function miniOn() { return !!mini(); }
  function minimize() {
    var m = media(); if (!m || !ME || miniOn()) return;
    setFull(false);
    var box = document.createElement('div'); box.id = 'ccl-mini';
    box.__home = { p: m.parentNode, n: m.nextSibling };
    box.innerHTML = '<div id="ccl-mbar"><button type="button" data-k="big" aria-label="Open the live">' + ICON.big + '</button><button type="button" data-k="mx" aria-label="' + (ME.mine ? 'Leave or end live' : 'Leave stream') + '">' + ICON.x + '</button></div>';
    box.appendChild(m); document.body.appendChild(box);
    box.onclick = function (e) {
      var k = e.target.closest('button'); k = k && k.dataset.k;
      if (k === 'mx') { e.stopPropagation(); ME.mine ? askHost(null) : leaveRoom(); }
      else { force = false; try { go('live'); } catch (x) {} }
    };
    var c = $('#ccl-ctl'); if (c) c.remove();
    setTimeout(function () { replay($('#rframe')); }, 60);
  }
  function unmini() {
    var b = mini(); if (!b) return;
    var m = $('#rmedia', b), h = b.__home;
    if (m && h && h.p) h.p.insertBefore(m, h.n && h.n.parentNode === h.p ? h.n : null);
    b.remove(); drawCtl(); setTimeout(function () { replay($('#rframe')); }, 60);
  }

  /* host leaving: end the live, or keep going */
  function askHost(after) {
    if (document.querySelector('.ccl-sh[data-host]')) return;
    var m = document.createElement('div'); m.className = 'ccl-sh'; m.setAttribute('data-host', '1'); m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div class="box g">'
      + '<h3 style="margin:6px 0 6px">You are live</h3>'
      + '<p class="sub" style="margin:0 0 16px">If you leave, your live ends for everyone watching. Or keep it going in the small screen while you use the app.</p>'
      + '<button type="button" class="btn p" data-k="end" style="width:100%">End live</button>'
      + '<button type="button" class="btn g" data-k="go" style="width:100%;margin-top:10px">Continue live</button></div>';
    m.onclick = function (e) {
      var k = e.target === m ? 'close' : (e.target.closest('button') || {}).dataset;
      k = e.target === m ? 'close' : (k && k.k); if (!k) return;
      m.remove();
      if (k === 'end') {
        var id = ME && ME.id;
        (id ? endOnServer(id) : Promise.resolve()).then(function () { say('Your live has ended'); });
        force = true; try { leaveRoom(); if (after) go(after); } finally { force = false; }
      } else if (k === 'go') {
        if (after) { minimize(); keep = true; try { go(after); } finally { keep = false; } } else minimize();
      }
    };
    document.body.appendChild(m);
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('#ccl-ctl button'); if (!b) return;
    var k = b.dataset.k, s = st();
    if (k === 'fs') setFull(!media().classList.contains('ccl-fs'));
    else if (k === 'min') minimize();
    else if (k === 'x') { if (ME && ME.mine) askHost(null); else { setFull(false); leaveRoom(); } }
    else if (k === 'hrt') { var h = $('#lheart'); if (h) h.click(); }
    else if (k === 'flip') {
      if (!s || !s.cam || !window.ccCam) return say('The camera is not on yet');
      b.disabled = true;
      window.ccCam.flip(s.cam).then(function (face) {
        s.facing = face; window.__ccFacing = face;              // a reconnect keeps the camera you picked
        try { var v = $('#rframe .ccl-v'); if (v) s.cam.play(v, { mirror: face !== 'environment' }); } catch (x) {}
        say(face === 'environment' ? 'Back camera' : 'Front camera');
      }).catch(function (er) { say((er && er.message) || 'Could not switch the camera'); }).then(function () { b.disabled = false; });
    }
    else if (k === 'snd' && s) {
      if (ME.mine) { s.micOff = !s.micOff; try { s.mic && s.mic.setEnabled(!s.micOff); } catch (x) {} if (!s.mic) say('No microphone is on'); }
      else { s.muted = !s.muted; try { s.cl.remoteUsers.forEach(function (u) { if (u.audioTrack) { u.audioTrack.setVolume(s.muted ? 0 : 100); if (!s.muted) u.audioTrack.play(); } }); } catch (x) {} }
      drawCtl();
    }
  });

  /* heartbeat: the server ends the live by itself when the host stops answering */
  function beat(id) {
    call('/api/live/' + id + '/host-ping', { body: {} }).then(function (d) {
      if (d && d.status === 'ended' && ME && ME.id === id) { say('Your live has ended'); force = true; try { leaveRoom(); } finally { force = false; } }
      else resumeHost();
    }).catch(function () {});
  }
  function startBeat(id) { stopBeat(); beat(id); HB = setInterval(function () { beat(id); }, 15000); }
  function stopBeat() { if (HB) clearInterval(HB); HB = null; }
  /* The host came back (phone locked, another app, weak signal): if the video connection dropped, join and publish again so the live carries on. */
  var resuming = false;
  function resumeHost() {
    var s = st(), me = ME; if (!me || !me.mine || !me.native || !me.s || resuming || !s || !s.ready) return;
    var bad = !s.cl || s.cl.connectionState === 'DISCONNECTED' || (s.cam && s.cam.getMediaStreamTrack && s.cam.getMediaStreamTrack().readyState === 'ended');
    if (!bad) return;
    resuming = true;
    attach(me.s, $('#rframe'), true).then(function () { drawCtl(); }).catch(function () {}).then(function () { resuming = false; });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && ME && ME.mine) { beat(ME.id); resumeHost(); } });

  /* closing the tab or the browser: ask first, and end the live if they go */
  window.addEventListener('beforeunload', function (e) { if (ME && ME.mine) { e.preventDefault(); e.returnValue = ''; return ''; } });
  // (no end-on-pagehide any more: switching apps must not kill the live. The server ends it after 5 minutes of silence, or when the host taps End live.)

  try {
    var _or = openRoom;
    openRoom = function (s) {
      if (miniOn()) unmini();
      var r = _or.apply(this, arguments);
      try {
        ME = { id: s.id, mine: !!s.mine, native: !!s.native, s: s };
        mountRoomViewers(); drawCtl();
        var re = $('#rend'); if (re) re.onclick = function () { if (ME && ME.mine) askHost(null); else leaveRoom(); };
        if (s && s.native) {
          var f = $('#rframe');
          attach(s, f, !!s.mine).then(function (ok) {
            if (ok === false && s.mine) { endOnServer(s.id); stopBeat(); }
          });
          if (s.mine) startBeat(s.id);
        }
      } catch (e) {}
      return r;
    };
    var _lr = leaveRoom;
    leaveRoom = function () {
      if (keep) return;                                            // moving to another tab with the small screen on: do not leave
      try { stopBeat(); setFull(false); unmini(); detach($('#rframe')); var c = $('#ccl-ctl'); if (c) c.remove(); } catch (e) {}
      ME = null; return _lr.apply(this, arguments);
    };
    var _go = go;
    go = function (v) {
      if (ME && v !== 'live' && !force) {
        if (miniOn()) { keep = true; try { return _go.apply(this, arguments); } finally { keep = false; } }   // already in the small screen: just move on
        if (ME.mine) { askHost(v); return; }                      // host: end the live or continue
        minimize(); keep = true;                                  // a viewer who walks away gets the small screen; X leaves
        try { return _go.apply(this, arguments); } finally { keep = false; }
      }
      var r = _go.apply(this, arguments);
      try {
        if (v === 'live') { if (miniOn()) unmini(); setTimeout(mountHost, 0); }
      } catch (e) {}
      return r;
    };
  } catch (e) {}
  /* a shared link (/?live=ID) opens that live */
  function openShared() {
    var id = (new URLSearchParams(location.search)).get('live'); if (!id) return;
    call('/api/live', { auth: false }).then(function (d) {
      var s = (d.streams || []).filter(function (x) { return x.id === id; })[0];
      if (!s) return say('That live has ended');
      go('live'); setTimeout(function () { openRoom(s); }, 200);
    }).catch(function () {});
  }
  window.addEventListener('load', function () {
    setTimeout(function () { mountHost(); openShared(); }, 600);
  });
  try { var oldFeed = $('#ccl-feed'); if (oldFeed) oldFeed.remove(); } catch (e) {}
  mountHost();
})();
