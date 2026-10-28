/* cc-mbogi.js v1: MBOGI TALK, group video meetings inside Comrade Connect.
   - Lobby (Watch > Mbogi Talk): start a meeting, get a code like abc-defg-hij and a link, or join with a code.
   - Room: Google Meet style grid of people, mic / camera / flip camera / reactions / raise hand / chat, up to 12 people.
   - Video and sound are Agora (same free account as Live). The room, people list, chat and reactions are our own API: /api/mbogi/*.
   Loaded after cc-cam.js and cc-live.js. All text from other people goes in with textContent, never as HTML. */
(function () {
  'use strict';
  if (window.__ccMbogi) return; window.__ccMbogi = 1;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var AGORA = typeof CC_AGORA_ID === 'string' ? CC_AGORA_ID : '';
  var say = function (m) { try { toast(m); } catch (e) {} };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var call = function (p, o) { return window.CC ? CC.call(p, o) : Promise.reject(new Error('Not ready yet. Reload the page and try again.')); };
  var VID = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);   // one id per open tab
  var R = null;                                                                  // the meeting you are in (null = none)
  var RECENT = 'cc_mbogi_recent';

  var SV = function (p, w) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var IC = {
    // the Mbogi Talk icon: a speech bubble with a video camera inside
    logo: '<path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-4 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><rect x="6" y="7.5" width="6.5" height="6" rx="1.5"/><path d="M12.5 10.5L16.5 8v5l-4-2.5"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>',
    micOff: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M3 3l18 18"/>',
    cam: '<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
    camOff: '<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/><path d="M2 2l20 20"/>',
    flip: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2.5 4 2.5S16 14 16 14M9 9.5h.01M15 9.5h.01"/>',
    hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V13M17 9a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L3.5 14a1.6 1.6 0 0 1 2.6-1.9L8 14"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z"/>',
    leave: '<path d="M4 15c4-4 12-4 16 0l-2 2.5-3-1.5v-2.5a9 9 0 0 0-6 0V16l-3 1.5z"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    share: '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"/>',
    send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.6c2.2.7 3.5 2.4 3.5 5.4"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    front: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    back: '<path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>'
  };
  window.ccMbogiIcon = SV(IC.logo);
  var ico = function (k, w) { return SV(IC[k], w); };
  var EMOJI = { heart: '❤️', up: '👍', party: '🎉', clap: '👏', laugh: '😂', wow: '😮', sad: '😢', think: '🤔', down: '👎' };
  var ORDER = ['heart', 'up', 'party', 'clap', 'laugh', 'wow', 'sad', 'think', 'down'];
  var hue = function (n) { var h = 0; n = String(n || ''); for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) % 360; return h; };

  /* ---------- code and link helpers ---------- */
  function parseCode(raw) {
    var s = String(raw || '').toLowerCase(), m = s.match(/[a-z]{3}-[a-z]{4}-[a-z]{3}/); if (m) return m[0];
    var l = s.split('?mbogi=').pop().replace(/[^a-z]/g, ''); return l.length === 10 ? l.slice(0, 3) + '-' + l.slice(3, 7) + '-' + l.slice(7) : '';
  }
  var linkOf = function (code) { return (window.ccOrigin ? window.ccOrigin() : location.origin) + '/?mbogi=' + code; };
  function copy(t, done) {
    try { navigator.clipboard.writeText(t).then(function () { say(done || 'Copied'); }, function () { say(t); }); } catch (e) { say(t); }
  }
  function invite(code, title) {
    var t = 'Join my Mbogi Talk' + (title ? ' "' + title + '"' : '') + ' on Comrade Connect. Code: ' + code, u = linkOf(code);
    if (navigator.share) navigator.share({ title: 'Mbogi Talk', text: t, url: u }).catch(function () {}); else copy(t + ' ' + u, 'Invite copied');
  }
  function recents() { try { return JSON.parse(localStorage.getItem(RECENT) || '[]').filter(function (r) { return r && r.code; }).slice(0, 5); } catch (e) { return []; } }
  function remember(code, title) {
    try { var l = recents().filter(function (r) { return r.code !== code; }); l.unshift({ code: code, title: title || 'Mbogi Talk', at: Date.now() }); localStorage.setItem(RECENT, JSON.stringify(l.slice(0, 5))); } catch (e) {}
  }

  /* ---------- styles ---------- */
  var css = document.createElement('style');
  css.textContent = [
    /* lobby (follows the app theme) */
    '#v-mbogi .mbg-hero{display:flex;gap:14px;align-items:center}',
    '#v-mbogi .mbg-hero .mbg-logo{flex:none;width:52px;height:52px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(135deg,#ffa05a,#ee7a4f);color:#1d0f06}',
    '#v-mbogi .mbg-hero .mbg-logo svg{width:28px;height:28px}',
    '#v-mbogi .mbg-hero h3{margin:0;font-size:19px}#v-mbogi .mbg-hero p{margin:2px 0 0}',
    '#v-mbogi .box{display:grid;gap:12px}#v-mbogi .box h3{margin:0;font-size:17px}',
    '.mbg-big{font:800 28px/1.1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.04em;text-align:center;padding:14px 8px;border-radius:16px;border:1px dashed var(--line,rgba(128,128,128,.4));overflow-wrap:anywhere}',
    '.mbg-row{display:flex;gap:8px;flex-wrap:wrap}.mbg-row>*{flex:1 1 120px}',
    '.mbg-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px}.mbg-btn svg{width:18px;height:18px}',
    '.mbg-rc{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--line,rgba(128,128,128,.25))}',
    '.mbg-rc:first-of-type{border-top:0}.mbg-rc b{display:block;font-size:14px;overflow-wrap:anywhere}.mbg-rc small{opacity:.65;font-family:ui-monospace,Menlo,monospace}',
    /* pre-join sheet extras */
    '.mbg-seg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}',
    '.mbg-seg button{display:grid;justify-items:center;gap:6px;padding:12px 6px;border-radius:14px;border:1.5px solid var(--line,rgba(255,255,255,.2));background:transparent;color:inherit;font:600 12.5px Poppins,Manrope,sans-serif;cursor:pointer}',
    '.mbg-seg button svg{width:24px;height:24px}.mbg-seg button.on{border-color:#ee7a4f;background:rgba(238,122,79,.14)}',
    '.mbg-tg{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-radius:14px;border:1px solid var(--line,rgba(255,255,255,.2));font:600 14px Poppins,Manrope,sans-serif;cursor:pointer;text-align:left;background:transparent;color:inherit;width:100%}',
    '.mbg-tg i{width:42px;height:24px;border-radius:99px;background:rgba(128,128,128,.45);position:relative;flex:none;transition:background .2s}',
    '.mbg-tg i::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .2s}',
    '.mbg-tg.on i{background:#34a853}.mbg-tg.on i::after{transform:translateX(18px)}',
    /* the meeting room: always dark, like Google Meet */
    'body.mbg-on{overflow:hidden}body.mbg-on #tb,body.mbg-on #fab{display:none!important}',
    '#mbg-room{position:fixed;inset:0;z-index:9600;background:#1b1d21;color:#fff;display:flex;flex-direction:column;font-family:Poppins,Manrope,system-ui,sans-serif;padding-top:env(safe-area-inset-top,0px)}',
    '.mbg-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px 4px}',
    '.mbg-top .mbg-ti{min-width:0}.mbg-top b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.mbg-code{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;color:rgba(255,255,255,.72);font:500 12.5px ui-monospace,Menlo,monospace;padding:2px 0;cursor:pointer}.mbg-code svg{width:14px;height:14px}',
    '.mbg-cnt{display:inline-flex;align-items:center;gap:6px;background:#2d3036;border-radius:999px;padding:6px 12px;font:600 13px Poppins,sans-serif;flex:none;border:0;color:#fff;cursor:pointer}.mbg-cnt svg{width:16px;height:16px}',
    '.mbg-grid{flex:1;min-height:0;display:grid;gap:8px;padding:6px 10px;grid-auto-rows:minmax(0,1fr)}',
    '.mbg-t{position:relative;border-radius:16px;overflow:hidden;min-height:0;display:grid;place-items:center;background:linear-gradient(160deg,var(--c1),var(--c2))}',
    '.mbg-t.spk{box-shadow:inset 0 0 0 3px #8ab4f8}',
    '.mbg-v{position:absolute;inset:0;opacity:0}.mbg-t.hasv .mbg-v{opacity:1}',
    '.mbg-v>div,.mbg-v video{width:100%!important;height:100%!important;object-fit:cover}',
    '.mbg-av{width:min(38%,110px);aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,.28);font:700 clamp(26px,9vw,48px) Poppins,sans-serif}',
    '.mbg-t.hasv .mbg-av{display:none}',
    '.mbg-nm{position:absolute;left:10px;bottom:8px;right:44px;font:600 13px Poppins,sans-serif;text-shadow:0 1px 3px rgba(0,0,0,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.mbg-bd{position:absolute;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.55);color:#fff}.mbg-bd svg{width:15px;height:15px}',
    '.mbg-bd.mic{top:8px;right:8px}.mbg-bd.hand{top:8px;left:8px;background:#fbbc04;color:#202124;width:auto;padding:0 10px 0 8px;display:flex;gap:4px;border-radius:99px;font:700 11px Poppins,sans-serif}',
    '.mbg-bar{display:flex;justify-content:center;align-items:center;gap:8px;padding:10px 8px calc(14px + env(safe-area-inset-bottom,0px))}',
    '.mbg-bar button{position:relative;flex:none;width:48px;height:48px;border-radius:50%;border:0;background:#3c4043;color:#fff;display:grid;place-items:center;cursor:pointer;padding:0;transition:background .15s,transform .1s}',
    '.mbg-bar button:active{transform:scale(.94)}.mbg-bar button svg{width:22px;height:22px}',
    '.mbg-bar button.off{background:#f6aea9;color:#601410}.mbg-bar button.on{background:#8ab4f8;color:#202124}',
    '.mbg-bar button.end{width:64px;border-radius:99px;background:#ea4335}',
    '.mbg-bar .dot{position:absolute;top:6px;right:6px;width:10px;height:10px;border-radius:50%;background:#ea4335;border:2px solid #3c4043}',
    '@media(max-width:420px){.mbg-bar{gap:6px}.mbg-bar button{width:43px;height:43px}.mbg-bar button.end{width:54px}.mbg-bar button svg{width:20px;height:20px}}',
    '@media(max-width:350px){.mbg-bar{gap:4px}.mbg-bar button{width:38px;height:38px}.mbg-bar button.end{width:48px}.mbg-bar button svg{width:18px;height:18px}}',
    '.mbg-tray{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom,0px));max-width:calc(100vw - 16px);display:flex;gap:2px;padding:6px 10px;background:#2d3036;border-radius:999px;box-shadow:0 8px 28px rgba(0,0,0,.5);overflow-x:auto;z-index:5}',
    '.mbg-tray button{flex:none;width:38px;height:38px;border:0;background:transparent;font-size:24px;line-height:1;border-radius:50%;cursor:pointer;padding:0}.mbg-tray button:active{transform:scale(1.25)}',
    '.mbg-fl{position:absolute;bottom:calc(90px + env(safe-area-inset-bottom,0px));z-index:4;pointer-events:none;text-align:center;animation:mbg-rise 3.2s ease-out forwards}',
    '.mbg-fl span{display:block;font-size:40px;line-height:1}.mbg-fl small{display:inline-block;margin-top:2px;padding:1px 8px;border-radius:99px;background:rgba(0,0,0,.55);font:600 11px Poppins,sans-serif;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '@keyframes mbg-rise{0%{opacity:0;transform:translateY(0) scale(.6)}12%{opacity:1;transform:translateY(-30px) scale(1.1)}100%{opacity:0;transform:translateY(-52vh) scale(1)}}',
    '@media(prefers-reduced-motion:reduce){.mbg-fl{animation:mbg-fade 2.4s forwards}@keyframes mbg-fade{0%,70%{opacity:1}100%{opacity:0}}}',
    '.mbg-panel{position:absolute;left:0;right:0;bottom:0;height:68%;background:#25272c;border-radius:20px 20px 0 0;display:flex;flex-direction:column;z-index:6;box-shadow:0 -10px 40px rgba(0,0,0,.5)}',
    '@media(min-width:800px){.mbg-panel{left:auto;top:0;width:360px;height:auto;border-radius:0}#mbg-room.pan .mbg-grid{margin-right:360px}}',
    '.mbg-ph{display:flex;align-items:center;justify-content:space-between;padding:10px 12px 0 16px}',
    '.mbg-tabs{display:flex;gap:6px}.mbg-tabs button{border:0;background:transparent;color:rgba(255,255,255,.7);font:600 14px Poppins,sans-serif;padding:8px 12px;border-radius:99px;cursor:pointer}.mbg-tabs button.on{background:#3c4043;color:#fff}',
    '.mbg-px{width:36px;height:36px;border:0;background:transparent;color:#fff;display:grid;place-items:center;cursor:pointer;padding:0}.mbg-px svg{width:20px;height:20px}',
    '.mbg-body{flex:1;min-height:0;overflow:auto;padding:10px 16px;display:grid;gap:8px;align-content:start}',
    '.mbg-m{font-size:13.5px;line-height:1.35;overflow-wrap:anywhere}.mbg-m b{display:block;font-size:12px;opacity:.7}.mbg-m.me{justify-self:end;text-align:right}',
    '.mbg-pp{display:flex;align-items:center;gap:10px;font-size:14px}.mbg-pp .a{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font:700 14px Poppins,sans-serif}',
    '.mbg-pp em{font-style:normal;opacity:.65;font-size:12px}.mbg-pp .hd{margin-left:auto;color:#fbbc04}.mbg-pp .hd svg{width:18px;height:18px}',
    '.mbg-cf{display:flex;gap:8px;padding:10px 12px calc(12px + env(safe-area-inset-bottom,0px))}',
    '.mbg-cf input{flex:1;min-width:0;height:44px;border-radius:99px;border:0;background:#3c4043;color:#fff;padding:0 16px;font:500 14px Poppins,sans-serif;outline:none}',
    '.mbg-cf button{flex:none;width:44px;height:44px;border-radius:50%;border:0;background:#8ab4f8;color:#202124;display:grid;place-items:center;cursor:pointer;padding:0}.mbg-cf button svg{width:20px;height:20px}',
    '.mbg-load{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px;background:#1b1d21;z-index:8;font-size:14px;gap:6px}',
    '.mbg-snd{position:absolute;left:50%;top:70px;transform:translateX(-50%);z-index:7;border:0;border-radius:99px;padding:9px 16px;background:#fff;color:#101422;font:600 13px Poppins,sans-serif;cursor:pointer}'
  ].join('');
  document.head.appendChild(css);

  /* ---------- the Mbogi Talk page (lobby) ---------- */
  var made = null;
  function mount() {
    if ($('#v-mbogi')) return true;
    var live = $('#v-live'); if (!live || !live.parentNode) return false;
    var sec = document.createElement('section'); sec.className = 'view pg'; sec.id = 'v-mbogi';
    sec.innerHTML = '<h2 class="ph">Mbogi Talk</h2>'
      + '<div class="box g"><div class="mbg-hero"><span class="mbg-logo">' + ico('logo', 2) + '</span><div><h3>Mbogi Talk</h3><p class="sub">Video meetings for your mbogi: study groups, clubs, hostel hangouts. Free, up to 12 people.</p></div></div></div>'
      + '<div class="box g" id="mbg-start"><h3>Start a meeting</h3><div class="fld"><input id="mbg-title" maxlength="60" placeholder="Meeting name (optional)" aria-label="Meeting name"></div><button type="button" class="btn p mbg-btn" id="mbg-new">' + ico('cam') + 'New meeting</button><button type="button" class="btn g mbg-btn" id="mbg-link" style="margin-top:8px">' + ico('share') + 'Create meeting link</button></div>'
      + '<div class="box g" id="mbg-made" hidden></div>'
      + '<div class="box g"><h3>Join with a code</h3><div class="fld"><input id="mbg-code" maxlength="60" placeholder="abc-defg-hij" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Meeting code"></div><button type="button" class="btn p" id="mbg-join">Join</button></div>'
      + '<div class="box g" id="mbg-rec" hidden></div>'
      + '<p class="sub" style="font-size:12px">Be kind and keep it clean. Never share phone numbers, passwords or M-Pesa codes in a meeting. The host can end the meeting any time.</p>';
    live.parentNode.insertBefore(sec, live.nextSibling);
    $('#mbg-new').onclick = createMeeting;
    $('#mbg-link').onclick = createLink;
    $('#mbg-join').onclick = function () { var c = parseCode($('#mbg-code').value); if (!c) return say('Type the code, like abc-defg-hij'); openJoin(c); };
    $('#mbg-code').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); $('#mbg-join').click(); } };
    $('#mbg-code').oninput = function () {                       // typed "abcdefghij" becomes abc-defg-hij
      var v = this.value; if (/^[a-z]{10}$/i.test(v.trim())) this.value = parseCode(v);
    };
    var tbar = $('#tb');                                          // hidden tab: the page is reached from Watch > Mbogi Talk (see cc-redesign.js), but go('mbogi') still needs a tab to exist
    if (tbar && !$('#tb button[data-v="mbogi"]')) {
      var b = document.createElement('button'); b.setAttribute('data-v', 'mbogi'); b.setAttribute('aria-label', 'Mbogi Talk'); b.innerHTML = '<svg class="i" viewBox="0 0 24 24">' + IC.logo + '</svg>Mbogi';
      var lb = $('#tb button[data-v="live"]'); if (lb && lb.parentNode === tbar) tbar.insertBefore(b, lb.nextSibling); else tbar.appendChild(b);
    }
    return true;
  }

  function drawLobby() {
    if (!mount()) return;
    var m = $('#mbg-made');
    if (made) {
      m.hidden = false;
      m.innerHTML = '<h3>Your meeting is ready</h3><div class="mbg-big" id="mbg-mc"></div><p class="sub" style="margin:0;text-align:center;overflow-wrap:anywhere" id="mbg-ml"></p>'
        + '<div class="mbg-row"><button type="button" class="btn g mbg-btn" data-k="cc">' + ico('copy') + 'Copy code</button><button type="button" class="btn g mbg-btn" data-k="sh">' + ico('share') + 'Share invite</button></div>'
        + '<button type="button" class="btn p mbg-btn" data-k="go">' + ico('cam') + 'Start now</button>'
        + '<button type="button" class="btn g mbg-btn" data-k="rm" style="margin-top:8px;color:#d9334a">Remove meeting link</button>';
      $('#mbg-mc').textContent = made.code; $('#mbg-ml').textContent = linkOf(made.code);
      m.onclick = function (e) {
        var b = e.target.closest('button'); if (!b || !made) return;
        if (b.dataset.k === 'cc') copy(made.code, 'Code copied'); else if (b.dataset.k === 'sh') invite(made.code, made.title); else if (b.dataset.k === 'go') openJoin(made.code); else if (b.dataset.k === 'rm') removeMeeting(made.code);
      };
    } else m.hidden = true;
    var rc = $('#mbg-rec'), l = recents();
    if (!l.length) rc.hidden = true;
    else {
      rc.hidden = false; rc.innerHTML = '<h3>Recent meetings</h3>';
      l.forEach(function (r) {
        var d = document.createElement('div'); d.className = 'mbg-rc';
        var t = document.createElement('span'), b = document.createElement('b'), s = document.createElement('small'); b.textContent = r.title; s.textContent = r.code; t.append(b, s);
        var j = document.createElement('button'); j.type = 'button'; j.className = 'btn g'; j.textContent = 'Join'; j.onclick = function () { openJoin(r.code); };
        var x = document.createElement('button'); x.type = 'button'; x.className = 'btn g'; x.textContent = 'Remove'; x.style.cssText = 'color:#d9334a;margin-left:6px'; x.onclick = function () { removeMeeting(r.code); };
        d.append(t, j, x); rc.appendChild(d);
      });
    }
  }

  /* the host removes a meeting link: it stops working for everyone and leaves the lists */
  async function removeMeeting(code) {
    if (!window.confirm('Remove this meeting link? Nobody will be able to join with it.')) return;
    var ended = true;
    try { await call('/api/mbogi/' + code + '/end', { body: {} }); } catch (er) { ended = false; }   // only the host can end it; for others this just clears their list
    try { localStorage.setItem(RECENT, JSON.stringify(recents().filter(function (r) { return r.code !== code; }))); } catch (er) {}
    if (made && made.code === code) made = null;
    drawLobby(); say(ended ? 'Meeting link removed' : 'Removed from your list');
  }

  async function createMeeting(e) {
    var b = e.currentTarget, t = $('#mbg-title').value.trim();
    if (!AGORA) return say('Video is not set up yet. The admin must add the video key.');
    b.disabled = true;
    try {
      var d = await call('/api/mbogi/create', { body: { title: t } });
      made = { code: d.code, title: d.title }; remember(d.code, d.title); $('#mbg-title').value = ''; drawLobby();
    } catch (er) { say(er.message); }
    b.disabled = false;
  }

  /* ---------- Create meeting link: makes the meeting, then a sheet with the link ---------- */
  async function createLink(e) {
    var b = e.currentTarget, t = (($('#mbg-title') || {}).value || '').trim();
    if (!AGORA) return say('Video is not set up yet. The admin must add the video key.');
    b.disabled = true;
    try {
      var d = await call('/api/mbogi/create', { body: { title: t } });
      made = { code: d.code, title: d.title }; remember(d.code, d.title); if ($('#mbg-title')) $('#mbg-title').value = ''; drawLobby(); linkSheet(made);
    } catch (er) { say(er.message); }
    b.disabled = false;
  }
  function linkSheet(mt) {
    var link = linkOf(mt.code), text = 'Join my Mbogi Talk' + (mt.title ? ' "' + mt.title + '"' : '') + ' on Comrade Connect: ' + link;
    var m = document.createElement('div'); m.className = 'ccm-sh'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Meeting link');
    m.innerHTML = '<div class="box g"><div class="flex items-center justify-between"><h3>Your meeting link</h3><button type="button" data-k="x" aria-label="Close" style="background:none;border:0;color:inherit;padding:4px;cursor:pointer;line-height:0">' + ico('x') + '</button></div>'
      + '<p class="sub" id="mbg-ls-t" style="margin:6px 0 10px"></p><div class="mbg-big" id="mbg-ls-l" style="font-size:15px;overflow-wrap:anywhere;word-break:break-all"></div>'
      + '<div class="mbg-row"><button type="button" class="btn g mbg-btn" data-k="cl">' + ico('copy') + 'Copy link</button><button type="button" class="btn g mbg-btn" data-k="sh">' + ico('share') + 'Share</button></div>'
      + '<button type="button" class="btn g mbg-btn" data-k="wa">WhatsApp</button>'
      + '<button type="button" class="btn p mbg-btn" data-k="go">' + ico('cam') + 'Start now</button>'
      + '<button type="button" class="btn g" data-k="x">Close</button></div>';
    $('#mbg-ls-t', m).textContent = mt.title || 'Mbogi Talk'; $('#mbg-ls-l', m).textContent = link;
    var xs = m.querySelector('button[data-k="x"] svg'); if (xs) xs.style.cssText = 'width:20px;height:20px;display:block';
    m.onclick = function (e) {
      if (e.target === m) return m.remove();
      var b = e.target.closest('button'); if (!b) return;
      var k = b.dataset.k;
      if (k === 'x') m.remove();
      else if (k === 'cl') copy(link, 'Link copied');
      else if (k === 'sh') invite(mt.code, mt.title);
      else if (k === 'wa') window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
      else if (k === 'go') { m.remove(); openJoin(mt.code); }
    };
    document.body.appendChild(m);
  }

  /* ---------- pre-join sheet: camera choice + mic ---------- */
  async function openJoin(code) {
    if (R) return say('You are already in a meeting');
    if (!AGORA) return say('Video is not set up yet. The admin must add the video key.');
    var info;
    try { info = await call('/api/mbogi/' + code, { auth: false }); } catch (er) { return say(er.status === 404 ? 'No meeting with that code' : er.message); }
    if (info.status !== 'open') return say('That meeting has ended');
    var hasCam = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    if (!hasCam) say('This browser cannot use the camera. You can still listen.');
    var face = hasCam ? 'user' : 'off', mic = hasCam;
    var m = document.createElement('div'); m.className = 'ccm-sh'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div class="box g"><h3></h3><p class="sub" id="mbg-pj-s"></p>'
      + '<div class="mbg-seg" role="radiogroup" aria-label="Camera">'
      + '<button type="button" data-f="user" role="radio">' + ico('front') + 'Front camera</button>'
      + '<button type="button" data-f="environment" role="radio">' + ico('back') + 'Back camera</button>'
      + '<button type="button" data-f="off" role="radio">' + ico('camOff') + 'Camera off</button></div>'
      + '<button type="button" class="mbg-tg" id="mbg-pj-m" role="switch"><span>Microphone</span><i></i></button>'
      + '<button type="button" class="btn p" id="mbg-pj-go">Join now</button><button type="button" class="btn g" data-close data-k="x">Cancel</button></div>';
    $('h3', m).textContent = info.title; $('#mbg-pj-s', m).textContent = 'Host: ' + info.host + '  ·  ' + info.count + ' in the meeting now';
    var paint = function () {
      [].forEach.call(m.querySelectorAll('.mbg-seg button'), function (x) { x.classList.toggle('on', x.dataset.f === face); x.setAttribute('aria-checked', x.dataset.f === face); });
      var t = $('#mbg-pj-m', m); t.classList.toggle('on', mic); t.setAttribute('aria-checked', mic);
    };
    m.onclick = function (e) {
      if (e.target === m) return m.remove();
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.f) { face = b.dataset.f; paint(); }
      else if (b.id === 'mbg-pj-m') { mic = !mic; paint(); }
      else if (b.dataset.k === 'x') m.remove();
      else if (b.id === 'mbg-pj-go') { m.remove(); enter(code, { face: face, mic: mic }); }
    };
    paint(); document.body.appendChild(m);
  }

  /* ---------- the meeting ---------- */
  function tileFor(key) {
    var t = R.tiles[key]; if (t) return t;
    var el = document.createElement('div'); el.className = 'mbg-t';
    var h = hue(key); el.style.setProperty('--c1', 'hsl(' + h + ' 45% 32%)'); el.style.setProperty('--c2', 'hsl(' + ((h + 40) % 360) + ' 50% 22%)');
    el.innerHTML = '<div class="mbg-v"></div><div class="mbg-av"></div><span class="mbg-nm"></span><span class="mbg-bd mic" hidden>' + ico('micOff') + '</span><span class="mbg-bd hand" hidden>' + ico('hand') + 'Hand</span>';
    t = R.tiles[key] = { el: el, v: $('.mbg-v', el), av: $('.mbg-av', el), nm: $('.mbg-nm', el), mic: $('.mic', el), hand: $('.hand', el), playing: null };
    return t;
  }
  function remoteOf(uid) { if (!R || !R.cl || uid == null || uid === '') return null; var us = R.cl.remoteUsers || []; for (var i = 0; i < us.length; i++) if (String(us[i].uid) === String(uid)) return us[i]; return null; }

  function render() {
    if (!R) return;
    var ppl = R.people.slice();
    if (!ppl.some(function (p) { return p.me; })) ppl.push({ viewer: 'me', name: R.name, me: true, uid: R.uid == null ? '' : String(R.uid), hand: R.hand, host: R.host });
    ppl.sort(function (a, b) { return (b.me ? 1 : 0) - (a.me ? 1 : 0); });                    // you first
    var keep = {}, grid = R.grid;
    ppl.forEach(function (p, i) {
      var key = p.me ? 'me' : p.viewer; keep[key] = 1; var t = tileFor(key);
      var nm = (p.me ? 'You' : p.name) + (p.host ? ' (host)' : ''); if (t.nm.textContent !== nm) t.nm.textContent = nm;
      var ch = String(p.name || '?').trim().charAt(0).toUpperCase() || '?'; if (t.av.textContent !== ch) t.av.textContent = ch;
      var hand = p.me ? R.hand : p.hand; t.hand.hidden = !hand;
      var has = false;
      if (p.me) {
        has = !!(R.cam && R.camOn);
        if (has && t.playing !== R.cam) { try { R.cam.play(t.v, { mirror: R.facing !== 'environment' }); t.playing = R.cam; } catch (e) {} }
        t.mic.hidden = R.micOn; t.el.dataset.uid = R.uid == null ? '' : String(R.uid);
      } else {
        var u = remoteOf(p.uid); has = !!(u && u.hasVideo && u.videoTrack);
        if (has && t.playing !== u.videoTrack) { try { u.videoTrack.play(t.v); t.playing = u.videoTrack; } catch (e) {} }
        t.mic.hidden = !(u && !u.hasAudio); t.el.dataset.uid = p.uid == null ? '' : String(p.uid);
      }
      t.el.classList.toggle('hasv', has); if (!has) t.playing = null;
      if (grid.children[i] !== t.el) grid.insertBefore(t.el, grid.children[i] || null);       // only moves a tile that is out of place, so playing video is not interrupted
    });
    Object.keys(R.tiles).forEach(function (k) { if (!keep[k]) { try { R.tiles[k].el.remove(); } catch (e) {} delete R.tiles[k]; } });
    var n = ppl.length, land = innerWidth > innerHeight, cols = n <= 1 ? 1 : n === 2 ? (land ? 2 : 1) : n <= 4 ? 2 : n <= 6 ? (land ? 3 : 2) : n <= 9 ? 3 : (land ? 4 : 3);
    grid.style.gridTemplateColumns = 'repeat(' + cols + ',minmax(0,1fr))';
    $('.mbg-cnt b', R.room).textContent = n;
    if (R.tab === 'people') drawPeople();
  }

  function drawBar() {
    if (!R) return;
    var b = R.bar;
    var btn = function (k, label, icon, cls) { return '<button type="button" data-k="' + k + '" class="' + (cls || '') + '" aria-label="' + label + '">' + ico(icon) + '</button>'; };
    b.innerHTML = btn('mic', R.micOn ? 'Turn microphone off' : 'Turn microphone on', R.micOn ? 'mic' : 'micOff', R.micOn ? '' : 'off')
      + btn('cam', R.camOn ? 'Turn camera off' : 'Turn camera on', R.camOn ? 'cam' : 'camOff', R.camOn ? '' : 'off')
      + (R.camOn ? btn('flip', 'Flip camera (front or back)', 'flip') : '')
      + btn('react', 'Send a reaction', 'smile', R.tray ? 'on' : '')
      + btn('hand', R.hand ? 'Lower your hand' : 'Raise your hand', 'hand', R.hand ? 'on' : '')
      + '<button type="button" data-k="chat" class="' + (R.panel ? 'on' : '') + '" aria-label="Chat and people">' + ico('chat') + (R.unread ? '<i class="dot"></i>' : '') + '</button>'
      + btn('leave', 'Leave the meeting', 'leave', 'end');
  }

  async function makeCam(face) {
    return AgoraRTC.createCameraVideoTrack({ encoderConfig: '480p_1', facingMode: face === 'environment' ? 'environment' : 'user' });
  }

  async function enter(code, o) {
    if (R) return;
    var room = document.createElement('div'); room.id = 'mbg-room'; room.classList.add('ccx-owned'); room.setAttribute('role', 'dialog'); room.setAttribute('aria-modal', 'true'); room.setAttribute('aria-label', 'Mbogi Talk meeting');
    room.innerHTML = '<div class="mbg-load"><div><b>Joining...</b><p class="sub" style="margin:6px 0 0;color:rgba(255,255,255,.7)">Allow the camera and microphone if your phone asks.</p></div></div>'
      + '<header class="mbg-top"><div class="mbg-ti"><b></b><button type="button" class="mbg-code" aria-label="Copy the meeting code"><span></span>' + ico('copy') + '</button></div><button type="button" class="mbg-cnt" aria-label="People in this meeting">' + ico('users') + '<b>1</b></button></header>'
      + '<main class="mbg-grid" aria-live="polite"></main><footer class="mbg-bar"></footer>';
    document.body.appendChild(room); document.body.classList.add('mbg-on');
    R = { code: code, room: room, grid: $('.mbg-grid', room), bar: $('.mbg-bar', room), tiles: {}, people: [], seen: {}, since: '', primed: false, fails: 0,
      micOn: false, camOn: false, facing: o.face === 'environment' ? 'environment' : 'user', hand: false, tray: false, panel: false, tab: 'chat', unread: 0, uid: null, name: 'You', host: false, title: 'Mbogi Talk', msgs: [] };
    $('.mbg-code span', room).textContent = code;
    $('.mbg-code', room).onclick = function () { copy(linkOf(code), 'Meeting link copied'); };
    $('.mbg-cnt', room).onclick = function () { openPanel('people'); };
    R.bar.onclick = onBar; drawBar();
    var me = R;
    try {
      var j = await call('/api/mbogi/' + code + '/join', { body: { v: VID } });
      if (R !== me) return;
      me.name = j.name || 'You'; me.host = !!j.host; me.title = j.title || 'Mbogi Talk'; $('.mbg-top b', room).textContent = me.title; remember(code, me.title);
      await ccCam.loadSdk(); if (R !== me) return;
      try { AgoraRTC.onAudioAutoplayFailed = function () { soundTap(); }; } catch (e) {}
      me.cl = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      me.cl.on('user-published', async function (u, type) {
        try { await me.cl.subscribe(u, type); } catch (e) { return; }
        if (type === 'audio') { try { u.audioTrack.play(); } catch (e) {} }
        render();
      });
      ['user-unpublished', 'user-joined', 'user-left', 'user-info-updated'].forEach(function (ev) { me.cl.on(ev, function () { render(); }); });
      try { me.cl.enableAudioVolumeIndicator(); me.cl.on('volume-indicator', function (vols) { speaking(vols); }); } catch (e) {}
      me.uid = await me.cl.join(AGORA, j.channel, j.token || null, null); if (R !== me) { try { me.cl.leave(); } catch (e) {} return; }
      // your own camera and microphone, as chosen in the sheet. A blocked one never stops you joining.
      var pub = [];
      try { me.mic = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true }); me.micOn = !!o.mic; if (!o.mic) await me.mic.setEnabled(false); pub.push(me.mic); }
      catch (e) { say('Microphone is blocked or missing. People will see you but not hear you.'); }
      if (o.face !== 'off') {
        try { me.cam = await makeCam(me.facing); me.camOn = true; pub.push(me.cam); me.facing = ccCam.facingOf(me.cam); }
        catch (e) { say('Camera is blocked or missing. Allow it for this site, then tap the camera button.'); }
      }
      if (R !== me) { pub.forEach(function (t) { try { t.stop(); t.close(); } catch (e) {} }); try { me.cl.leave(); } catch (e) {} return; }
      if (pub.length) await me.cl.publish(pub);
      $('.mbg-load', room).remove(); drawBar(); render();
      keepAwake(); ping(); me.pingT = setInterval(ping, 3000);
    } catch (er) {
      var why = (er && (er.message || er.code || er.name)) || 'unknown';
      if (/CAN_NOT_GET_GATEWAY_SERVER|INVALID_VENDOR_KEY|DYNAMIC_KEY|TOKEN/i.test(String(why) + (er && er.code))) why = 'The video service refused to connect. The admin must add the Agora App Certificate on the server.';
      say(String(why).slice(0, 140)); try { console.warn('mbogi join failed', er); } catch (x) {}
      if (R === me) leave(true);
    }
  }

  function speaking(vols) {                                       // highlight whoever is talking
    if (!R) return;
    var live = {}; (vols || []).forEach(function (v) { if (v.level > 12) live[String(v.uid === 0 ? R.uid : v.uid)] = 1; });
    Object.keys(R.tiles).forEach(function (k) { var t = R.tiles[k]; t.el.classList.toggle('spk', !!live[t.el.dataset.uid]); });
  }
  function soundTap() {
    if (!R || $('.mbg-snd', R.room)) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'mbg-snd'; b.textContent = 'Tap for sound';
    b.onclick = function () { try { (R.cl.remoteUsers || []).forEach(function (u) { if (u.audioTrack) u.audioTrack.play(); }); } catch (e) {} b.remove(); };
    R.room.appendChild(b);
  }
  var wl = null;
  function keepAwake() { try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { wl = l; }).catch(function () {}); } catch (e) {} }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && R) keepAwake(); });

  /* ---------- talking to the server every 3 seconds: who is here, chat, reactions, hands ---------- */
  async function ping() {
    var me = R; if (!me || me.busy) return; me.busy = true;
    try {
      var d = await call('/api/mbogi/' + me.code + '/ping', { body: { v: VID, uid: me.uid == null ? undefined : String(me.uid), hand: me.hand, since: me.since || undefined } });
      if (R !== me) return;
      me.fails = 0; me.people = d.people || [];
      (d.events || []).forEach(function (ev) {
        if (ev.at && ev.at > me.since) me.since = ev.at;
        if (me.seen[ev.id]) return; me.seen[ev.id] = 1;
        if (ev.kind === 'chat') addMsg(ev, me.primed); else if (me.primed) floatReaction(ev.text, ev.name);
      });
      me.primed = true; render();
    } catch (er) {
      if (R !== me) return;
      if (er && (er.status === 410 || er.status === 404)) { say('The meeting has ended'); leave(true); return; }
      if (++me.fails >= 10) { say('Lost the connection to the meeting'); leave(true); }
    } finally { me.busy = false; }
  }

  function floatReaction(key, name) {
    if (!R || !EMOJI[key]) return;
    var f = document.createElement('div'); f.className = 'mbg-fl'; f.style.left = (8 + Math.random() * 70) + '%';
    var s = document.createElement('span'); s.textContent = EMOJI[key]; var n = document.createElement('small'); n.textContent = name || ''; f.append(s, n);
    R.room.appendChild(f); setTimeout(function () { try { f.remove(); } catch (e) {} }, 3300);
  }

  /* ---------- chat and people panel ---------- */
  function addMsg(ev, count) {
    if (!R) return; R.msgs.push(ev); if (R.msgs.length > 120) R.msgs.shift();
    if (R.panel && R.tab === 'chat') drawChat(); else if (count) { R.unread++; drawBar(); }
  }
  function openPanel(tab) {
    if (!R) return;
    if (R.panel && R.tab === tab) return closePanel();
    R.panel = true; R.tab = tab; R.unread = 0; R.tray = false; var tr = $('.mbg-tray', R.room); if (tr) tr.remove();
    var p = $('.mbg-panel', R.room);
    if (!p) {
      p = document.createElement('aside'); p.className = 'mbg-panel';
      p.innerHTML = '<div class="mbg-ph"><div class="mbg-tabs"><button type="button" data-t="chat">Chat</button><button type="button" data-t="people">People</button></div><button type="button" class="mbg-px" data-t="x" aria-label="Close">' + ico('x') + '</button></div>'
        + '<div class="mbg-body" id="mbg-body"></div><form class="mbg-cf" autocomplete="off"><input maxlength="300" placeholder="Send a message to everyone" aria-label="Message"><button type="submit" aria-label="Send">' + ico('send') + '</button></form>';
      p.onclick = function (e) { var b = e.target.closest('button'); if (!b || !b.dataset.t) return; if (b.dataset.t === 'x') closePanel(); else { R.tab = b.dataset.t; paintPanel(); } };
      $('form', p).onsubmit = function (e) {
        e.preventDefault(); var i = $('input', p), t = i.value.trim(); if (!t || !R) return;
        var btn = $('button', e.target); btn.disabled = true;
        call('/api/mbogi/' + R.code + '/send', { body: { v: VID, kind: 'chat', text: t } }).then(function (c) { i.value = ''; if (R && !R.seen[c.id]) { R.seen[c.id] = 1; if (c.at > R.since) R.since = c.at; c.mine = true; addMsg(c, false); } })
          .catch(function (er) { say(er.message); }).then(function () { btn.disabled = false; });
      };
      R.room.appendChild(p);
    }
    R.room.classList.add('pan'); paintPanel(); drawBar();
  }
  function closePanel() { if (!R) return; R.panel = false; R.room.classList.remove('pan'); var p = $('.mbg-panel', R.room); if (p) p.remove(); drawBar(); }
  function paintPanel() {
    var p = $('.mbg-panel', R.room); if (!p) return;
    [].forEach.call(p.querySelectorAll('.mbg-tabs button'), function (b) { b.classList.toggle('on', b.dataset.t === R.tab); });
    $('form', p).style.display = R.tab === 'chat' ? '' : 'none';
    if (R.tab === 'chat') drawChat(); else drawPeople();
  }
  function drawChat() {
    var bd = $('#mbg-body', R.room); if (!bd || R.tab !== 'chat') return;
    var near = bd.scrollHeight - bd.scrollTop - bd.clientHeight < 90; bd.textContent = '';
    if (!R.msgs.length) { var e = document.createElement('p'); e.className = 'sub'; e.style.color = 'rgba(255,255,255,.6)'; e.textContent = 'No messages yet. Say hi.'; bd.appendChild(e); return; }
    R.msgs.forEach(function (m) {
      var d = document.createElement('div'); d.className = 'mbg-m' + (m.mine ? ' me' : ''); var b = document.createElement('b'); b.textContent = m.mine ? 'You' : m.name; d.append(b, document.createTextNode(m.text)); bd.appendChild(d);
    });
    if (near) bd.scrollTop = bd.scrollHeight;
  }
  function drawPeople() {
    var bd = $('#mbg-body', R.room); if (!bd || R.tab !== 'people') return; bd.textContent = '';
    R.people.forEach(function (p) {
      var d = document.createElement('div'); d.className = 'mbg-pp';
      var a = document.createElement('span'); a.className = 'a'; a.textContent = String(p.name || '?').charAt(0).toUpperCase(); a.style.background = 'hsl(' + hue(p.viewer) + ' 45% 38%)';
      var n = document.createElement('span'); n.textContent = p.me ? p.name + ' (You)' : p.name;
      d.append(a, n);
      if (p.host) { var h = document.createElement('em'); h.textContent = 'Host'; d.appendChild(h); }
      if (p.me ? R.hand : p.hand) { var hd = document.createElement('span'); hd.className = 'hd'; hd.innerHTML = ico('hand'); hd.setAttribute('aria-label', 'Hand raised'); d.appendChild(hd); }
      bd.appendChild(d);
    });
  }

  /* ---------- the bottom bar ---------- */
  async function onBar(e) {
    var b = e.target.closest('button'); if (!b || !R) return;
    var k = b.dataset.k, me = R;
    if (k === 'mic') {
      try {
        if (!me.mic) { me.mic = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true }); await me.cl.publish([me.mic]); me.micOn = true; }
        else { me.micOn = !me.micOn; await me.mic.setEnabled(me.micOn); }
      } catch (er) { say('Microphone is blocked. Allow it for this site.'); }
      drawBar(); render();
    } else if (k === 'cam') {
      try {
        if (!me.cam) { me.cam = await makeCam(me.facing); await me.cl.publish([me.cam]); me.camOn = true; me.facing = ccCam.facingOf(me.cam); }
        else { me.camOn = !me.camOn; await me.cam.setEnabled(me.camOn); }
        var t = me.tiles.me; if (me.camOn && t) t.playing = null;           // play it again in the tile
      } catch (er) { say('Camera is blocked. Allow it for this site.'); }
      drawBar(); render();
    } else if (k === 'flip') {
      b.disabled = true;
      try { me.facing = await ccCam.flip(me.cam); var t2 = me.tiles.me; if (t2) t2.playing = null; say(me.facing === 'environment' ? 'Back camera' : 'Front camera'); }
      catch (er) { say((er && er.message) || 'Could not switch the camera'); }
      b.disabled = false; render();
    } else if (k === 'react') {
      me.tray = !me.tray; var old = $('.mbg-tray', me.room); if (old) old.remove();
      if (me.tray) {
        var tr = document.createElement('div'); tr.className = 'mbg-tray'; tr.setAttribute('role', 'group'); tr.setAttribute('aria-label', 'Reactions');
        ORDER.forEach(function (key) { var x = document.createElement('button'); x.type = 'button'; x.dataset.r = key; x.textContent = EMOJI[key]; x.setAttribute('aria-label', 'React ' + key); tr.appendChild(x); });
        tr.onclick = function (ev) {
          var x = ev.target.closest('button'); if (!x || !R) return;
          floatReaction(x.dataset.r, 'You');
          call('/api/mbogi/' + R.code + '/send', { body: { v: VID, kind: 'react', text: x.dataset.r } }).then(function (c) { if (R && c && c.id) R.seen[c.id] = 1; }).catch(function () {});   // marked as seen so it does not float twice
        };
        me.room.appendChild(tr);
      }
      drawBar();
    } else if (k === 'hand') { me.hand = !me.hand; drawBar(); render(); ping(); say(me.hand ? 'Hand raised' : 'Hand lowered'); }
    else if (k === 'chat') openPanel('chat');
    else if (k === 'leave') { if (me.host) hostSheet(); else leave(); }
  }

  function hostSheet() {
    var m = document.createElement('div'); m.className = 'ccm-sh'; m.style.zIndex = 99999; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div class="box g"><h3>Leave the meeting?</h3><p class="sub">You started this meeting. You can leave and let it carry on, or end it for everyone.</p>'
      + '<button type="button" class="btn p" data-k="end">End for everyone</button><button type="button" class="btn g" data-k="leave">Just leave</button><button type="button" class="btn g" data-close data-k="x">Stay</button></div>';
    m.onclick = function (e) {
      if (e.target === m) return m.remove(); var b = e.target.closest('button'); if (!b) return; m.remove();
      if (b.dataset.k === 'end') { var c = R && R.code; (c ? call('/api/mbogi/' + c + '/end', { body: { v: VID } }).catch(function () {}) : Promise.resolve()).then(function () { say('Meeting ended'); }); leave(); }
      else if (b.dataset.k === 'leave') leave();
    };
    document.body.appendChild(m);
  }

  async function leave(silent) {
    var me = R; if (!me) return; R = null;
    clearInterval(me.pingT);
    try { me.mic && (me.mic.stop(), me.mic.close()); } catch (e) {}
    try { me.cam && (me.cam.stop(), me.cam.close()); } catch (e) {}
    try { me.cl && me.cl.leave().catch(function () {}); } catch (e) {}
    try { wl && wl.release(); wl = null; } catch (e) {}
    call('/api/mbogi/' + me.code + '/leave', { body: { v: VID } }).catch(function () {});
    try { me.room.remove(); } catch (e) {}
    [].forEach.call(document.querySelectorAll('.ccm-sh'), function (x) { x.remove(); });
    document.body.classList.remove('mbg-on');
    if (!silent) say('You left the meeting');
    made = null; drawLobby();
  }

  /* phone back button (cc-panels.js asks us first): close the panel, else ask to leave */
  window.ccMbogiBack = function () {
    if (!R) return false;
    if (R.tray) { onBar({ target: { closest: function () { return { dataset: { k: 'react' } }; } } }); return true; }
    if (R.panel) { closePanel(); return true; }
    if (R.host) hostSheet(); else leave();
    return true;
  };
  window.addEventListener('pagehide', function () {
    if (!R) return;
    try { fetch((typeof CC_API !== 'undefined' ? CC_API : '') + '/api/mbogi/' + R.code + '/leave', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ v: VID }) }).catch(function () {}); } catch (e) {}
  });
  window.addEventListener('resize', function () { if (R) render(); });
  window.addEventListener('beforeunload', function (e) { if (R) { e.preventDefault(); e.returnValue = ''; return ''; } });

  /* ---------- wiring ---------- */
  try {
    var _go = go;
    go = function (v) { var r = _go.apply(this, arguments); if (v === 'mbogi') { try { drawLobby(); } catch (e) {} } return r; };
  } catch (e) {}
  function openShared() {                                           // a shared link (/?mbogi=abc-defg-hij) opens the join sheet
    var c = parseCode((new URLSearchParams(location.search)).get('mbogi') || ''); if (!c) return;
    try { go('mbogi'); } catch (e) {} setTimeout(function () { openJoin(c); }, 300);
  }
  window.ccMbogi = { open: function () { try { go('mbogi'); } catch (e) {} }, join: openJoin };
  mount();
  window.addEventListener('load', function () { setTimeout(function () { mount(); openShared(); }, 700); });
})();
