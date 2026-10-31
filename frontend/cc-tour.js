/* cc-tour.js v1: first login = waving heart + welcome banner, then a spotlight tour (1/7 ... 7/7), then Tech starts talking.
   Shows once, for people who opened the app signed out and then signed in. Replay: Me > Take the tour, or Tech > Start tour.
   window.ccStartTour() runs the tour only. window.ccWelcomeTour() runs the whole first-login flow. */
(function () {
  'use strict';
  if (window.__ccTour) return; window.__ccTour = 1;
  var DONE = 'cc_tour7', PEND = 'cc_tour7_pend', busy = false;
  var $ = function (s) { return document.querySelector(s); };
  var ls = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; };
  var signedIn = function () { try { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); } catch (e) { return false; } };
  var handle = function () { try { var h = (typeof ME !== 'undefined' && ME && ME.handle) || ''; return String(h).replace(/[<>&"]/g, ''); } catch (e) { return ''; } };

  var STEPS = [
    ['#tkr', 'Meet Tech', 'I am Tech, your guide. Tap me any time for help, the full docs or to talk to support.'],
    ['#fab', 'Spill it, nobody will know', 'Tap Spill to post a story. Your handle never shows on it.'],
    ['#tb button[data-v="feed"]', 'Home', 'The Feed. Read what comrades are spilling and filter by zone or category.'],
    ['#tb button[data-v="videos"]', 'Videos', 'Watch short campus clips and share the good ones.'],
    ['#tb button[data-v="market"]', 'Market', 'Buy and sell safely. Your money stays in escrow until you confirm the item with your 6-digit code.'],
    ['#tb button[data-v="explore"]', 'Explore', 'Events, notices, roommates, study groups and Hearts (18+).'],
    ['#tb button[data-v="rewards"]', 'Rewards', 'Check in daily, spill, comment and share to earn points. Spend them on perks.'],
    ['#tb button[data-v="me"]', 'Me', 'Your profile, wallet, settings and recovery options are all here.']
  ];

  function css() {
    if ($('#cctour-css')) return;
    var s = document.createElement('style'); s.id = 'cctour-css';
    s.textContent = [
      '#cctwl{position:fixed;inset:0;z-index:99000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:calc(24px + env(safe-area-inset-top,0px)) 20px calc(24px + env(safe-area-inset-bottom,0px));background:#101422;color:#fff;overflow:auto;font-family:Poppins,system-ui,sans-serif;animation:cctwin .4s ease both}',
      '#cctwl:before{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(90% 55% at 50% 12%,rgba(168,220,231,.28),transparent 70%)}',
      '@keyframes cctwin{from{opacity:0}}#cctwl.out{opacity:0;transition:opacity .35s ease;pointer-events:none}',
      '#cctwl .x{all:unset;box-sizing:border-box;position:absolute;top:calc(14px + env(safe-area-inset-top,0px));right:16px;width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.08);color:#fff;display:grid;place-items:center;padding:0;cursor:pointer}',
      '#cctwl .x svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round}',
      '#cctwl .hz{position:relative;width:min(220px,58vw);animation:cctwfl 3.2s ease-in-out infinite}@keyframes cctwfl{50%{transform:translateY(-8px)}}',
      '#cctwl .hz svg{display:block;width:100%;height:auto;overflow:visible}',
      '#cctwl .hb{transform-origin:100px 150px;transform-box:view-box;animation:cctwbeat 1.5s ease-in-out infinite}@keyframes cctwbeat{0%,100%{transform:scale(1)}14%{transform:scale(1.07)}28%{transform:scale(1)}42%{transform:scale(1.05)}}',
      '#cctwl .wv{transform-origin:176px 102px;transform-box:view-box;animation:cctwwave .6s ease-in-out infinite alternate}@keyframes cctwwave{from{transform:rotate(-16deg)}to{transform:rotate(20deg)}}',
      '#cctwl .ey{transform-origin:center;transform-box:fill-box;animation:cctwblink 4s infinite}@keyframes cctwblink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}',
      '#cctwl .sp{animation:cctwsp 1.2s ease-in-out infinite}#cctwl .sp.b{animation-delay:.3s}@keyframes cctwsp{0%,100%{opacity:.15}50%{opacity:.9}}',
      '#cctwl .cd{position:relative;width:min(400px,100%);box-sizing:border-box;padding:22px 20px 18px;border-radius:26px;text-align:center;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);animation:cctwup .6s .25s ease both}',
      '@keyframes cctwup{from{opacity:0;transform:translateY(16px)}}',
      '#cctwl .k{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#A8DCE7;font-weight:700;margin:0 0 6px}',
      '#cctwl h2{font-size:24px;line-height:1.2;margin:0 0 8px;font-weight:800}',
      '#cctwl p{margin:0;font-size:13.5px;line-height:1.6;color:rgba(255,255,255,.78)}',
      '#cctwl .ch{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:14px 0 4px}#cctwl .ch span{padding:6px 12px;border-radius:999px;font-size:12px;font-weight:600;background:rgba(168,220,231,.14);color:#A8DCE7;border:1px solid rgba(168,220,231,.3)}',
      '#cctwl .bt{display:flex;flex-direction:column;gap:10px;margin-top:16px}',
      '#cctwl .bt button{all:unset;box-sizing:border-box;text-align:center;border:0;border-radius:999px;padding:13px 18px;font:700 14px Poppins,system-ui,sans-serif;cursor:pointer}',
      '#cctwl .bt .p{background:#A8DCE7;color:#101422}#cctwl .bt .g{background:transparent;color:rgba(255,255,255,.75)}',
      '#cctr{position:fixed;inset:0;z-index:99100}',
      '#cctr .bk{position:absolute;inset:0}',
      '#cctr .ho{position:absolute;border:2px dashed #A8DCE7;border-radius:16px;box-shadow:0 0 0 100vmax rgba(8,11,20,.74);pointer-events:none;transition:left .35s cubic-bezier(.4,0,.2,1),top .35s cubic-bezier(.4,0,.2,1),width .35s cubic-bezier(.4,0,.2,1),height .35s cubic-bezier(.4,0,.2,1)}',
      '#cctr .tp{position:absolute;box-sizing:border-box;width:min(340px,calc(100vw - 24px));padding:20px 20px 18px;border-radius:18px;background:#A8DCE7;color:#101422;font-family:Poppins,system-ui,sans-serif;box-shadow:0 18px 40px rgba(0,0,0,.45);transition:left .35s cubic-bezier(.4,0,.2,1),top .35s cubic-bezier(.4,0,.2,1)}',
      '#cctr .tp:after{content:"";position:absolute;width:18px;height:18px;background:#A8DCE7;left:var(--ax,40px);transform:rotate(45deg);border-radius:3px}',
      '#cctr .tp.dn:after{top:-8px}#cctr .tp.up:after{bottom:-8px}',
      '#cctr .tp p,#cctr .tp div{border:0!important;box-shadow:none!important;background:none!important}',
      '#cctr .nm{font-size:14px;font-weight:700;margin:0 0 10px;opacity:.75}',
      '#cctr .tt{font-size:17px;font-weight:800;line-height:1.3;margin:0 36px 8px 0}',
      '#cctr .tx{font-size:14px;line-height:1.55;margin:0;font-weight:500}',
      '#cctr .x{all:unset;box-sizing:border-box;position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:50%;border:0;background:transparent;color:#101422;display:grid;place-items:center;padding:0;cursor:pointer}',
      '#cctr .x svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round}',
      '#cctr .rw{display:flex;justify-content:space-between;gap:10px;margin-top:16px}',
      '#cctr .rw button{all:unset;box-sizing:border-box;text-align:center;border:0;border-radius:12px;padding:11px 20px;background:#fff;color:#101422;font:700 14px Poppins,system-ui,sans-serif;cursor:pointer}',
      '#cctr .rw button[hidden]{display:block;visibility:hidden}',
      '#tkb .ccm{display:flex;flex-direction:column;gap:8px;margin:0 0 4px}',
      '#tkb .ccm div{align-self:flex-start;max-width:92%;padding:9px 13px;border-radius:16px 16px 16px 4px;background:var(--g);border:1px solid var(--gb);color:var(--fg);font-size:13px;line-height:1.5;animation:ccmin .3s ease both}',
      '@keyframes ccmin{from{opacity:0;transform:translateY(6px)}}',
      '#tkb .ccm .ty{display:flex;gap:4px;padding:12px 14px}#tkb .ccm .ty i{width:6px;height:6px;border-radius:50%;background:var(--mut);animation:ccty 1s infinite}#tkb .ccm .ty i:nth-child(2){animation-delay:.15s}#tkb .ccm .ty i:nth-child(3){animation-delay:.3s}@keyframes ccty{50%{transform:translateY(-4px);opacity:.4}}',
      '@media(prefers-reduced-motion:reduce){#cctwl *,#cctr *{animation:none!important;transition:none!important}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  var X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function heartSvg() {
    return '<svg viewBox="0 0 240 190" aria-hidden="true"><defs><linearGradient id="cctwg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9EBF2"/><stop offset="1" stop-color="#7FC4D4"/></linearGradient></defs>'
      + '<g class="wv"><path d="M176 102 Q200 100 210 72" fill="none" stroke="#7FC4D4" stroke-width="13" stroke-linecap="round"/><circle cx="211" cy="62" r="15" fill="#A8DCE7"/><path d="M200 52 Q196 44 202 42" fill="none" stroke="#7FC4D4" stroke-width="5" stroke-linecap="round"/></g>'
      + '<g class="hb"><path d="M100 176C40 130 16 96 16 66 16 40 36 24 58 24 78 24 92 34 100 48 108 34 122 24 142 24 164 24 184 40 184 66 184 96 160 130 100 176Z" fill="url(#cctwg)"/>'
      + '<ellipse cx="56" cy="52" rx="16" ry="9" fill="#fff" opacity=".35" transform="rotate(-28 56 52)"/>'
      + '<ellipse class="ey" cx="74" cy="84" rx="7" ry="10" fill="#101422"/><ellipse class="ey" cx="126" cy="84" rx="7" ry="10" fill="#101422"/>'
      + '<circle cx="62" cy="106" r="9" fill="#fff" opacity=".3"/><circle cx="138" cy="106" r="9" fill="#fff" opacity=".3"/>'
      + '<path d="M84 108 Q100 126 116 108" fill="none" stroke="#101422" stroke-width="5" stroke-linecap="round"/></g>'
      + '<g fill="none" stroke="#A8DCE7" stroke-width="4" stroke-linecap="round"><path class="sp" d="M224 70 Q232 62 230 50"/><path class="sp b" d="M222 84 Q236 80 238 66"/></g></svg>';
  }

  function welcome(done) {
    css();
    var h = handle(), el = document.createElement('div');
    el.id = 'cctwl'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Welcome to Comrade Connect');
    el.innerHTML = '<button type="button" class="x" aria-label="Close">' + X + '</button>'
      + '<div class="hz">' + heartSvg() + '</div>'
      + '<div class="cd"><p class="k">Welcome to Comrade Connect</p><h2>' + (h ? 'Hi ' + h + '!' : 'Hi comrade!') + '</h2>'
      + '<p>The campus app for Kenyan comrades. Spill the tea anonymously, buy and sell safely with escrow, find roommates, events and Hearts. Use it on the web or install the app on your phone.</p>'
      + '<div class="ch"><span>Anonymous feed</span><span>Safe market</span><span>Hearts</span><span>Events</span></div>'
      + '<div class="bt"><button type="button" class="p">Show me around</button><button type="button" class="g">Skip for now</button></div></div>';
    document.body.appendChild(el);
    var closed = false;
    function close(go) {
      if (closed) return; closed = true; el.classList.add('out');
      setTimeout(function () { el.remove(); done(go); }, 330);
    }
    el.querySelector('.x').onclick = function () { close(false); };
    el.querySelector('.g').onclick = function () { close(false); };
    el.querySelector('.p').onclick = function () { close(true); };
    setTimeout(function () { var b = el.querySelector('.p'); if (b) b.focus({ preventScroll: true }); }, 450);
  }

  function visible(el) { if (!el) return false; var r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; }

  function tour(done) {
    css();
    var list = STEPS.filter(function (s) { return visible($(s[0])); });
    if (!list.length) { done(false); return; }
    var i = 0, n = list.length, root = document.createElement('div');
    root.id = 'cctr'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'App tour');
    root.innerHTML = '<div class="bk"></div><div class="ho"></div><div class="tp dn"><button type="button" class="x" aria-label="Close tour">' + X + '</button><p class="nm"></p><p class="tt"></p><p class="tx"></p><div class="rw"><button type="button" data-b="p">Previous</button><button type="button" data-b="n">Next</button></div></div>';
    document.body.appendChild(root);
    var ho = root.querySelector('.ho'), tp = root.querySelector('.tp');
    function place() {
      var t = $(list[i][0]); if (!visible(t)) return;
      var r = t.getBoundingClientRect(), pad = 6, vw = window.innerWidth, vh = window.innerHeight;
      var L = r.left - pad, T = r.top - pad, W = r.width + pad * 2, H = r.height + pad * 2;
      ho.style.left = L + 'px'; ho.style.top = T + 'px'; ho.style.width = W + 'px'; ho.style.height = H + 'px';
      var cw = tp.offsetWidth, ch = tp.offsetHeight, gap = 16, below = vh - (T + H), above = T;
      var dn = below >= ch + gap || below >= above;
      var top = dn ? T + H + gap : T - ch - gap; top = Math.max(10, Math.min(top, vh - ch - 10));
      var left = Math.max(12, Math.min(L + W / 2 - cw / 2, vw - cw - 12));
      tp.className = 'tp ' + (dn ? 'dn' : 'up'); tp.style.left = left + 'px'; tp.style.top = top + 'px';
      tp.style.setProperty('--ax', Math.max(18, Math.min(L + W / 2 - left - 9, cw - 36)) + 'px');
    }
    function draw() {
      var s = list[i];
      root.querySelector('.nm').textContent = (i + 1) + '/' + n;
      root.querySelector('.tt').textContent = s[1];
      root.querySelector('.tx').textContent = s[2];
      root.querySelector('[data-b="p"]').hidden = i === 0;
      root.querySelector('[data-b="n"]').textContent = i === n - 1 ? 'Finish' : 'Next';
      place();
    }
    var ended = false;
    function end(finished) {
      if (ended) return; ended = true;
      window.removeEventListener('resize', place); document.removeEventListener('keydown', key, true);
      root.remove(); done(finished);
    }
    function key(e) {
      if (e.key === 'Escape') { e.preventDefault(); end(false); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' && i) { e.preventDefault(); i--; draw(); }
    }
    function next() { if (i === n - 1) end(true); else { i++; draw(); } }
    root.querySelector('.x').onclick = function () { end(false); };
    root.querySelector('[data-b="n"]').onclick = next;
    root.querySelector('[data-b="p"]').onclick = function () { if (i) { i--; draw(); } };
    window.addEventListener('resize', place); document.addEventListener('keydown', key, true);
    draw(); setTimeout(place, 60);
    setTimeout(function () { var b = root.querySelector('[data-b="n"]'); if (b) b.focus({ preventScroll: true }); }, 80);
  }

  function techTalks() {
    var r = $('#tkr'), b = $('#tkb'); if (!r || !b) return;
    if (!b.classList.contains('on')) r.click();
    setTimeout(function () {
      var head = b.querySelector('.tk-h'), row = b.querySelector('.tr');
      if (!head || !row) return;
      var t = head.querySelector('.tk-t'); if (t) t.textContent = 'Tech';
      var h = handle(), box = document.createElement('div'); box.className = 'ccm';
      var rowHtml = row.outerHTML; row.remove();
      var p = b.querySelector('.tk-p'); if (p) p.remove();
      b.appendChild(box);
      var msgs = [
        'Hi ' + (h || 'comrade') + ', I am Tech. Welcome in!',
        'That was the quick tour. If anything is unclear, just ask me.',
        'Need help with a payment or an order? Tap Ask support and I will open a ticket for you.'
      ], k = 0;
      function say() {
        if (!b.contains(box)) return;
        if (k >= msgs.length) { b.insertAdjacentHTML('beforeend', rowHtml); return; }
        var ty = document.createElement('div'); ty.className = 'ty'; ty.innerHTML = '<i></i><i></i><i></i>'; box.appendChild(ty);
        setTimeout(function () {
          if (!b.contains(box)) return;
          ty.className = ''; ty.textContent = msgs[k++]; setTimeout(say, 450);
        }, 800);
      }
      setTimeout(say, 300);
    }, 80);
  }

  function finish(talk) {
    ls(DONE, '1'); ls(PEND, null); ls('cs_tour', '1');
    var pill = $('#tpill'); if (pill) pill.hidden = true;
    if (talk) setTimeout(techTalks, 250);
  }

  function run(first) {
    if (busy) return; busy = true;
    var over = function () { busy = false; };
    if (first) {
      welcome(function (go) {
        if (!go) { finish(true); over(); return; }
        tour(function (fin) { finish(true); over(); });
      });
    } else {
      tour(function (fin) { if (fin) { ls(DONE, '1'); ls('cs_tour', '1'); } over(); });
    }
  }
  window.ccStartTour = function () { run(false); };
  window.ccWelcomeTour = function () { run(true); };

  // Old tour buttons now open this one: Me > Take the tour, Home tour pill, welcome pop-up, Tech > Start tour
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('#atour,#wlT,#tpill,#tkb [data-a="go"]');
    if (!a) return;
    e.preventDefault(); e.stopPropagation();
    var d = $('#dm'); if (d && d.classList.contains('on')) { var x = d.querySelector('.xb'); if (x) x.click(); }
    var b = $('#tkb'); if (b) b.classList.remove('on');
    setTimeout(window.ccStartTour, 150);
  }, true);

  // First login detection: opened signed out (remember it), then signed in and nothing else is on top of the screen.
  function blocked() {
    var o = document.querySelectorAll('#ccfrst,#ccsu,#dm.on,#lk.on,[id^="cclock"],[role="dialog"],[aria-modal="true"]');
    for (var i = 0; i < o.length; i++) if (o[i].id !== 'ck' && visible(o[i])) return true;
    return false;
  }
  if (!signedIn() && !ls(DONE)) ls(PEND, '1');
  var waited = 0, poll = setInterval(function () {
    waited += 700;
    if (ls(DONE) || waited > 60 * 60 * 1000) { clearInterval(poll); return; }
    if (!signedIn()) { ls(PEND, '1'); return; }
    if (ls(PEND) !== '1' || busy || document.hidden || blocked()) return;
    clearInterval(poll); setTimeout(function () { if (!blocked()) run(true); }, 900);
  }, 700);
})();
