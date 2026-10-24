/* cc-live.js v1: Live inside Comrade Connect (video by Agora, free plan), a viewers button, and live cards in the Feed.
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
    '.ccl-sh .box{max-width:320px;width:100%;text-align:center}'
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
    st.dead = true; box.__cc = null;
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
      st.cl = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      await st.cl.setClientRole(host ? 'host' : 'audience');
      if (!host) {
        st.cl.on('user-published', async function (u, type) {
          try { await st.cl.subscribe(u, type); } catch (e) { return; }
          if (st.dead) return;
          if (type === 'video') { v.textContent = ''; u.videoTrack.play(v); }
          if (type === 'audio') { try { u.audioTrack.play(); } catch (e) {} }
        });
        st.cl.on('user-unpublished', function (u, type) { if (type === 'video' && !st.dead) { v.textContent = 'The host paused the video'; } });
        v.textContent = 'Waiting for the host video...';
      }
      var tk = null; try { tk = (await call('/api/live/token', { auth: !!host, body: { channel: s.channel, host: !!host } })).token || null; } catch (e) { if (host) throw e; }
      await st.cl.join(AGORA, s.channel, tk, null); if (st.dead) { try { st.cl.leave(); } catch (e) {} return; }
      if (host) {
        var t = await AgoraRTC.createMicrophoneAndCameraTracks({}, { encoderConfig: '720p_2' });
        st.tracks = t; if (st.dead) { detach(box); return; }
        v.textContent = ''; t[1].play(v); await st.cl.publish(t);
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
      var t = $('#ltitle').value.trim(); if (!t) return say('Add a title so people know what is happening');
      if (!AGORA) return say('Live video is not set up yet. The admin must add the video key.');
      var b = e.currentTarget; b.disabled = true;
      try {
        var d = await call('/api/live/start', { body: { title: t, native: true } });
        $('#ltitle').value = '';
        try { earn(10, 'Went live', 1); } catch (x) {}
        openRoom({ id: d.id, title: t, native: true, channel: d.channel, mine: true });
      } catch (er) { say(er.message); }
      b.disabled = false;
    };
  }
  try {
    var _or = openRoom;
    openRoom = function (s) {
      var r = _or.apply(this, arguments);
      try {
        mountRoomViewers();
        if (s && s.native) {
          var f = $('#rframe');
          attach(s, f, !!s.mine).then(function (ok) {
            if (ok === false && s.mine) { call('/api/live/' + s.id + '/end', { body: {} }).catch(function () {}); }
          });
        }
      } catch (e) {}
      return r;
    };
    var _lr = leaveRoom;
    leaveRoom = function () { try { detach($('#rframe')); } catch (e) {} return _lr.apply(this, arguments); };
  } catch (e) {}

  /* ---------- Feed: live cards with like, reshare and comment ---------- */
  var FEED = { live: [], hearted: {}, seen: {}, t: null };
  function feedHost() {
    var f = $('#v-feed'); if (!f) return null;
    var h = $('#ccl-feed');
    if (!h) { h = document.createElement('div'); h.id = 'ccl-feed'; f.insertBefore(h, f.firstChild); }
    return h;
  }
  function cardHtml(s, i) {
    return '<article class="box g ccl-card" data-id="' + esc(s.id) + '">'
      + '<div class="ccl-hd"><span class="live-b">LIVE</span><button type="button" class="ccl-vw" data-a="v" aria-label="Viewers">' + I.eye + '<span class="n">' + (s.viewers || 0) + '</span></button></div>'
      + '<b>' + esc(s.title) + '</b>'
      + '<div class="ccl-box"></div>'
      + '<div class="ccl-ac"><button type="button" data-a="h" class="' + (FEED.hearted[s.id] ? 'on' : '') + '" aria-label="Like">' + I.heart + '<span class="hc">' + (s.hearts || 0) + '</span></button>'
      + '<button type="button" data-a="c" aria-label="Comment">' + I.chat + '<span>Comment</span></button>'
      + '<button type="button" data-a="s" aria-label="Reshare">' + I.share + '<span>Reshare</span></button></div>'
      + '<div class="ccl-cm" aria-live="polite"></div>'
      + '<form class="ccl-f"><div class="fld" style="flex:1;margin:0"><input maxlength="140" placeholder="Say something" aria-label="Comment on the live"></div><button class="act" aria-label="Send">' + I.send + '</button></form>'
      + '</article>';
  }
  function paintFeed() {
    var h = feedHost(); if (!h) return;
    var ids = FEED.live.map(function (s) { return s.id; }).join(',');
    if (h.dataset.ids === ids) return;
    Array.prototype.forEach.call(h.querySelectorAll('.ccl-box'), detach);
    h.dataset.ids = ids; h.innerHTML = FEED.live.map(cardHtml).join('');
    FEED.live.forEach(function (s, i) {
      var c = h.querySelector('[data-id="' + s.id + '"]'); if (!c) return;
      var box = $('.ccl-box', c);
      if (s.native && i === 0) attach(s, box, false);   // the first live keeps playing as soon as you open the Feed
      else if (s.native) box.innerHTML = '<button class="btn p" data-a="w" style="width:100%">Watch</button>';
      else box.innerHTML = '<p class="sub" style="margin:0">This live plays on another site. Open the Live tab to watch it.</p>';
    });
  }
  function onFeedView() { return document.body.dataset.view === 'feed' && !document.hidden; }
  async function loadFeed() {
    if (!onFeedView()) return;
    try { var d = await call('/api/live', { auth: false }); FEED.live = (d.streams || []).filter(function (s) { return s.native; }); }
    catch (e) { return; }
    var h = feedHost(); if (!FEED.live.length && h) { Array.prototype.forEach.call(h.querySelectorAll('.ccl-box'), detach); h.innerHTML = ''; h.dataset.ids = ''; return; }
    paintFeed(); pingFeed();
  }
  async function pingFeed() {
    if (!onFeedView()) return;
    var h = feedHost(); if (!h) return;
    FEED.live.forEach(async function (s) {
      var c = h.querySelector('[data-id="' + s.id + '"]'); if (!c) return;
      try {
        var d = await call('/api/live/' + s.id + '/ping', { auth: false, body: { v: VID, since: c.__at || undefined } });
        if (d.status === 'ended') { FEED.live = FEED.live.filter(function (x) { return x.id !== s.id; }); h.dataset.ids = ''; paintFeed(); return; }
        $('.n', c).textContent = d.viewers; $('.hc', c).textContent = d.hearts;
        var box = $('.ccl-cm', c);
        (d.comments || []).forEach(function (m) {
          if (FEED.seen[m.id]) return; FEED.seen[m.id] = 1; if (m.at > (c.__at || '')) c.__at = m.at;
          var p = document.createElement('p'), b = document.createElement('b'); b.textContent = m.name + ': '; p.append(b, document.createTextNode(m.text)); box.appendChild(p);
          while (box.children.length > 30) box.firstChild.remove();
        });
        box.scrollTop = box.scrollHeight;
      } catch (e) {}
    });
  }
  var pendH = {};
  document.addEventListener('click', function (e) {
    var c = e.target.closest('#ccl-feed .ccl-card'); if (!c) return;
    var id = c.dataset.id, s = FEED.live.filter(function (x) { return x.id === id; })[0], b = e.target.closest('button[data-a]'); if (!s || !b) return;
    var a = b.dataset.a;
    if (a === 'v') viewersSheet(numOf($('.n', c).textContent));
    else if (a === 'w') attach(s, $('.ccl-box', c), false);
    else if (a === 's') shareLive(id, s.title);
    else if (a === 'c') { var i = $('input', c); if (i) i.focus(); }
    else if (a === 'h') {
      FEED.hearted[id] = true; b.classList.add('on'); var hc = $('.hc', c); hc.textContent = numOf(hc.textContent) + 1;
      pendH[id] = Math.min((pendH[id] || 0) + 1, 10);
      if (!pendH.t) pendH.t = setTimeout(function () { pendH.t = null; Object.keys(pendH).forEach(function (k) { if (k === 't') return; var n = pendH[k]; delete pendH[k]; if (n) call('/api/live/' + k + '/heart', { auth: false, body: { n: n } }).catch(function () {}); }); }, 1500);
    }
  });
  document.addEventListener('submit', async function (e) {
    var f = e.target.closest('#ccl-feed .ccl-f'); if (!f) return; e.preventDefault();
    var c = f.closest('.ccl-card'), i = $('input', f), t = i.value.trim(); if (!t) return;
    var btn = $('button', f); btn.disabled = true;
    try { var m = await call('/api/live/' + c.dataset.id + '/comment', { body: { text: t } }); i.value = ''; pingFeed(); }
    catch (er) { say(er.message); }
    btn.disabled = false;
  });

  try {
    var _go = go;
    go = function (v) {
      var r = _go.apply(this, arguments);
      try {
        if (v === 'feed') setTimeout(loadFeed, 0);
        else { var h = $('#ccl-feed'); if (h) { Array.prototype.forEach.call(h.querySelectorAll('.ccl-box'), detach); h.dataset.ids = ''; } }
        if (v === 'live') setTimeout(mountHost, 0);
      } catch (e) {}
      return r;
    };
  } catch (e) {}
  setInterval(function () { if (onFeedView()) { loadFeed(); pingFeed(); } }, 6000);
  document.addEventListener('visibilitychange', function () { if (document.hidden) { var h = $('#ccl-feed'); if (h) { Array.prototype.forEach.call(h.querySelectorAll('.ccl-box'), detach); h.dataset.ids = ''; } } else if (onFeedView()) loadFeed(); });

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
    setTimeout(function () { mountHost(); loadFeed(); openShared(); }, 600);
  });
  mountHost();
})();
