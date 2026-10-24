/* cc-voice.js v1: voice notes on spills and in the live chat.
   - Spill: a "Add a voice note" button under the text box. Record, listen back, post. The text is optional.
   - Live chat: a microphone next to the message box. Tap, speak, tap send.
   Recording uses the phone's microphone (the browser asks once). Notes are limited to 60 seconds (30 in live chat).
   Loaded after the main page script. Icons are outline SVGs, no emoji. */
(function () {
  'use strict';
  if (window.ccVoice) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var say = function (m) { try { toast(m); } catch (e) {} };
  var call = function (p, o) { return window.CC ? CC.call(p, o) : Promise.reject(new Error('Not ready yet. Reload the page and try again.')); };
  var SV = function (p, s) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:' + (s || 20) + 'px;height:' + (s || 20) + 'px">' + p + '</svg>'; };
  var IC = {
    mic: SV('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>'),
    play: SV('<path d="M7 4l13 8-13 8z" fill="currentColor"/>', 16),
    pause: SV('<path d="M8 5v14M16 5v14" stroke-width="3"/>', 16),
    x: SV('<path d="M6 6l12 12M18 6L6 18"/>'),
    send: SV('<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>'),
    stop: SV('<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>', 18)
  };

  var css = document.createElement('style');
  css.textContent = [
    '.ccv-pl{display:inline-flex;align-items:center;gap:10px;padding:6px 14px 6px 6px;border-radius:999px;border:1px solid var(--line,rgba(128,128,128,.4));max-width:100%;min-width:190px;margin:8px 0 2px;vertical-align:middle}',
    '.ccv-pp{width:34px;height:34px;flex:none;border-radius:50%;border:0;background:var(--ink,#101422);color:var(--inkfg,#fff);display:grid;place-items:center;padding:0;cursor:pointer}',
    '.ccv-bar{flex:1;height:4px;border-radius:2px;background:rgba(128,128,128,.3);overflow:hidden;min-width:60px}',
    '.ccv-bar i{display:block;height:100%;width:0;background:currentColor;transition:width .25s linear}',
    '.ccv-pl.on .ccv-bar.u i{width:40%;animation:ccvslide 1.2s ease-in-out infinite alternate}',
    '@keyframes ccvslide{from{margin-left:0}to{margin-left:60%}}',
    '.ccv-t{font:600 12px Poppins,sans-serif;min-width:34px;text-align:right}',
    '.ccv-row{margin-top:12px}',
    '.ccv-rec{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:14px;border:1px solid var(--line,rgba(128,128,128,.4))}',
    '.ccv-dot{width:10px;height:10px;border-radius:50%;background:#e5484d;animation:blink 1s steps(1) infinite}',
    '.ccv-rec b{font:600 14px Poppins,sans-serif;flex:1}',
    '.ccv-ib{width:38px;height:38px;border:0;background:transparent;color:inherit;display:grid;place-items:center;cursor:pointer;padding:0;border-radius:50%}',
    '.ccv-ib.p{background:var(--ink,#101422);color:var(--inkfg,#fff)}',
    '.ccv-lnk{border:0;background:none;color:inherit;text-decoration:underline;font:600 12px Poppins,sans-serif;cursor:pointer;padding:6px}'
  ].join('');
  document.head.appendChild(css);

  /* ---------- recording ---------- */
  function mime() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    var c = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    for (var i = 0; i < c.length; i++) if (MediaRecorder.isTypeSupported(c[i])) return c[i];
    return '';
  }
  function supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && mime()); }
  var fmt = function (s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); };

  /* hooks: tick(sec), done(blob, type, sec), fail(message). Returns { stop, cancel }. */
  function record(max, hooks) {
    var st = { stream: null, mr: null, chunks: [], t0: 0, timer: null, cancelled: false, over: false };
    var ctl = {
      stop: function () { try { if (st.mr && st.mr.state !== 'inactive') st.mr.stop(); } catch (e) {} },
      cancel: function () { st.cancelled = true; ctl.stop(); free(); }
    };
    function free() { clearInterval(st.timer); try { st.stream && st.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(function (stream) {
      if (st.cancelled) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      st.stream = stream;
      var type = mime(); st.mr = new MediaRecorder(stream, { mimeType: type, audioBitsPerSecond: 32000 });
      st.mr.ondataavailable = function (e) { if (e.data && e.data.size) st.chunks.push(e.data); };
      st.mr.onstop = function () {
        free(); if (st.cancelled) return;
        var sec = (Date.now() - st.t0) / 1000;
        if (sec < 1 || !st.chunks.length) return hooks.fail('That was too short. Hold on a little longer and speak.');
        var t = /mp4/.test(type) ? 'video/mp4' : 'video/webm';        // the storage only accepts these two names for audio
        hooks.done(new Blob(st.chunks, { type: t }), t, sec);
      };
      st.mr.start(); st.t0 = Date.now();
      st.timer = setInterval(function () { var s = (Date.now() - st.t0) / 1000; hooks.tick(s); if (s >= max) ctl.stop(); }, 250);
    }).catch(function (e) {
      hooks.fail(/NotAllowed|Permission/i.test(String(e && (e.name || e.message))) ? 'The microphone is blocked. Allow it for this site, then try again.' : 'Could not use the microphone.');
    });
    return ctl;
  }

  /* send the recording to storage, get its key back */
  async function upload(blob, type) {
    var d = await call('/api/voice/upload-url', { body: { content_type: type, bytes: blob.size } });
    var fd = new FormData(); fd.append('cacheControl', '3600'); fd.append('', new Blob([blob], { type: type }));
    var r; try { r = await fetch(d.upload_url, { method: 'PUT', body: fd }); } catch (e) { throw new Error('The voice note did not go through. Check your connection and try again.'); }
    if (!r.ok) throw new Error('The voice note did not upload (' + r.status + '). Try again.');
    return d.key;
  }

  /* ---------- player ---------- */
  var playing = null;
  function player(url) {
    var w = document.createElement('div'); w.className = 'ccv-pl';
    w.innerHTML = '<button type="button" class="ccv-pp" aria-label="Play voice note">' + IC.play + '</button><div class="ccv-bar u"><i></i></div><span class="ccv-t">0:00</span>';
    var a = new Audio(); a.preload = 'none'; a.src = url;
    var b = $('.ccv-pp', w), bar = $('.ccv-bar', w), fill = $('i', bar), t = $('.ccv-t', w);
    function reset() { w.classList.remove('on'); b.innerHTML = IC.play; b.setAttribute('aria-label', 'Play voice note'); }
    b.onclick = function (e) {
      e.stopPropagation();
      if (!a.paused) { a.pause(); return; }
      if (playing && playing !== a) playing.pause();
      playing = a; a.play().catch(function () { say('Could not play this voice note'); reset(); });
    };
    a.onplay = function () { w.classList.add('on'); b.innerHTML = IC.pause; b.setAttribute('aria-label', 'Pause voice note'); };
    a.onpause = reset;
    a.onended = function () { reset(); fill.style.width = '0'; bar.classList.add('u'); t.textContent = '0:00'; };
    a.ontimeupdate = function () {
      t.textContent = fmt(a.currentTime);
      if (isFinite(a.duration) && a.duration > 0) { bar.classList.remove('u'); fill.style.width = Math.min(100, a.currentTime / a.duration * 100) + '%'; }
    };
    a.onerror = function () { reset(); };
    return w;
  }

  /* ---------- spills: voice note under the text box ---------- */
  var V = { pending: null, ctl: null };
  function clearPending() {
    if (V.ctl) { try { V.ctl.cancel(); } catch (e) {} V.ctl = null; }
    if (V.pending && V.pending.url) { try { URL.revokeObjectURL(V.pending.url); } catch (e) {} }
    V.pending = null;
  }
  function mountSpill() {
    var ta = document.getElementById('st'), cnt = document.getElementById('cnt');
    if (!ta || !cnt || document.getElementById('ccv-row') || !supported()) return;
    var row = document.createElement('div'); row.id = 'ccv-row'; row.className = 'ccv-row';
    cnt.insertAdjacentElement('afterend', row);
    function idle() {
      row.innerHTML = '<button type="button" class="btn g" id="ccv-add" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px">' + IC.mic + 'Add a voice note</button>';
      $('#ccv-add', row).onclick = start;
    }
    function start() {
      row.innerHTML = '<div class="ccv-rec"><span class="ccv-dot"></span><b id="ccv-tm">0:00 / 1:00</b><button type="button" class="ccv-ib" id="ccv-cx" aria-label="Cancel recording">' + IC.x + '</button><button type="button" class="ccv-ib p" id="ccv-st" aria-label="Stop recording">' + IC.stop + '</button></div>';
      V.ctl = record(60, {
        tick: function (s) { var e = $('#ccv-tm', row); if (e) e.textContent = fmt(s) + ' / 1:00'; },
        done: function (blob, type, sec) { V.ctl = null; V.pending = { blob: blob, type: type, sec: sec, url: URL.createObjectURL(blob) }; review(); },
        fail: function (m) { V.ctl = null; say(m); idle(); }
      });
      $('#ccv-cx', row).onclick = function () { clearPending(); idle(); };
      $('#ccv-st', row).onclick = function () { if (V.ctl) V.ctl.stop(); };
    }
    function review() {
      row.innerHTML = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"></div>';
      var box = row.firstChild; box.appendChild(player(V.pending.url));
      var rm = document.createElement('button'); rm.type = 'button'; rm.className = 'ccv-lnk'; rm.textContent = 'Remove'; rm.onclick = function () { clearPending(); if (ta.value === 'Voice note') { ta.value = ''; ta.oninput && ta.oninput(); } idle(); };
      box.appendChild(rm);
      if (!ta.value.trim()) { ta.value = 'Voice note'; ta.oninput && ta.oninput(); }   // the post button needs some text; the person can change it
    }
    idle();
    // closing the Drop your tea sheet stops a recording that is still running
    var md = document.getElementById('md');
    if (md) new MutationObserver(function () { if (!md.classList.contains('on') && V.ctl) { clearPending(); idle(); } }).observe(md, { attributes: true, attributeFilter: ['class'] });
  }
  function resetSpill() { clearPending(); var row = document.getElementById('ccv-row'); if (row) { row.innerHTML = ''; row.remove(); mountSpill(); } }

  try {
    var _create = api.create;
    api.create = async function (o) {
      if (!V.pending) return _create.apply(this, arguments);
      say('Sending your voice note...');
      var key = await upload(V.pending.blob, V.pending.type);
      var r = await rq('/api/posts', { aid: ME.aid, content: o.content, category: o.category, zone: o.zone, voice: key });
      resetSpill(); return r;
    };
  } catch (e) {}

  /* a spill with a voice note shows a player under its text */
  var AUD = {};
  function addPlayer(el, url) {
    if (!el || el.querySelector('.ccv-pl')) return;
    var t = el.querySelector('p.t'); if (t && url) t.insertAdjacentElement('afterend', player(url));
  }
  try {
    var _card = card;
    card = function (p) { var el = _card.apply(this, arguments); try { if (p && p.audio) { AUD[p._id] = p.audio; addPlayer(el, p.audio); } } catch (e) {} return el; };
  } catch (e) {}
  try {                                                  // cards drawn before this file loaded
    var feed = document.getElementById('feed');
    var fix = function () {
      Array.prototype.forEach.call(feed.querySelectorAll('.card'), function (el) {
        if (el.querySelector('.ccv-pl')) return;
        var id = el.dataset.id, u = AUD[id]; if (!u) { try { var p = find(id); u = p && p.audio; } catch (e) {} }
        if (u) addPlayer(el, u);
      });
    };
    if (feed) { new MutationObserver(fix).observe(feed, { childList: true }); fix(); }
  } catch (e) {}

  /* ---------- live chat: microphone next to the message box ---------- */
  var L = { ctl: null };
  function mountLive() {
    var f = document.getElementById('lf'); if (!f || document.getElementById('ccv-lm') || !supported()) return;
    var send = f.querySelector('button'); if (!send) return;
    var m = document.createElement('button'); m.type = 'button'; m.className = 'act'; m.id = 'ccv-lm'; m.setAttribute('aria-label', 'Send a voice message'); m.innerHTML = IC.mic;
    f.insertBefore(m, send);
    var bar = document.createElement('div'); bar.id = 'ccv-lbar'; bar.className = 'ccv-rec'; bar.style.display = 'none'; bar.style.marginTop = '12px';
    bar.innerHTML = '<span class="ccv-dot"></span><b id="ccv-ltm">0:00 / 0:30</b><button type="button" class="ccv-ib" id="ccv-lx" aria-label="Cancel voice message">' + IC.x + '</button><button type="button" class="ccv-ib p" id="ccv-ls" aria-label="Send voice message">' + IC.send + '</button>';
    f.insertAdjacentElement('afterend', bar);
    function show(rec) { f.style.display = rec ? 'none' : ''; bar.style.display = rec ? '' : 'none'; }
    m.onclick = function () {
      if (typeof cur === 'undefined' || !cur) return;
      show(true);
      L.ctl = record(30, {
        tick: function (s) { $('#ccv-ltm').textContent = fmt(s) + ' / 0:30'; },
        done: async function (blob, type) {
          L.ctl = null; show(false);
          try {
            if (typeof cur === 'undefined' || !cur) return;
            var id = cur.id, key = await upload(blob, type);
            var c = await call('/api/live/' + id + '/comment', { body: { voice: key } });
            if (typeof cur !== 'undefined' && cur && cur.id === id) addComment(c);
          } catch (er) { say(er.message); }
        },
        fail: function (msg) { L.ctl = null; show(false); say(msg); }
      });
    };
    $('#ccv-lx').onclick = function () { if (L.ctl) L.ctl.cancel(); L.ctl = null; show(false); };
    $('#ccv-ls').onclick = function () { if (L.ctl) L.ctl.stop(); };
  }
  try {
    var _ac = addComment;
    addComment = function (c) {
      var seen = !!(c && seenC.has(c.id));
      _ac.apply(this, arguments);
      if (!seen && c && c.audio) { var box = document.getElementById('lchat'), p = box && box.lastElementChild; if (p) { p.appendChild(player(c.audio)); box.scrollTop = box.scrollHeight; } }
    };
    var _lr = leaveRoom;
    leaveRoom = function () { if (L.ctl) { try { L.ctl.cancel(); } catch (e) {} L.ctl = null; var f = document.getElementById('lf'), b = document.getElementById('ccv-lbar'); if (f) f.style.display = ''; if (b) b.style.display = 'none'; } return _lr.apply(this, arguments); };
  } catch (e) {}

  window.ccVoice = { supported: supported, record: record, upload: upload, player: player };
  mountSpill(); mountLive();
})();
