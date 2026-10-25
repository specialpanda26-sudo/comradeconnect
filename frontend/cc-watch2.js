/* cc-watch2.js v1: the new Watch page.
   Videos: "live now" banner, a Share a moment card (Record, Upload clip, Go live), a Latest clips title and a counter, a friendly empty state.
   Live: the host's picture and name on every live card, and a friendly empty state.
   It only rearranges and relabels. Record, upload, likes, report, delete, reels, rooms, chat and hearts are the old code, untouched.
   All text goes in with textContent, never as HTML (the only innerHTML is fixed icons). Load after cc-redesign-watch.js. */
(function () {
  'use strict';
  if (window.__ccW2) return; window.__ccW2 = 1;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var AVATAR = /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/;
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  var ICON = {
    rec: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10l5-3v10l-5-3z"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></svg>',
    live: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/></svg>'
  };
  function goLiveTab() { var b = $('#tb button[data-v="live"]'); if (b) b.click(); else { try { go('live'); } catch (e) {} } }
  function setBtn(b, icon, label) { if (!b) return; b.innerHTML = icon; b.appendChild(document.createTextNode(label)); }

  /* ---------- Videos ---------- */
  function videos() {
    var v = $('#v-videos'); if (!v || v.dataset.w2) return;
    var rec = $('#vrec', v), up = $('#vup', v), fld = $('.fld', v), vl = $('#vl', v);
    if (!rec || !up || !fld || !vl) return;                       // the old page is not here yet: try again soon
    v.dataset.w2 = '1'; v.classList.add('w2');

    var subs = v.querySelectorAll(':scope > .sub');
    if (subs[0]) subs[0].hidden = true;                           // the intro moves into the card
    var foot = subs[subs.length - 1];
    if (foot && foot !== subs[0]) { foot.className = 'sub w2-foot'; foot.textContent = 'Clips are saved on a video host so everyone can watch. Please do not film people without their consent.'; }

    var bar = el('button', 'w2-livebar'); bar.type = 'button'; bar.id = 'w2-livebar'; bar.hidden = true;
    bar.appendChild(el('i')); bar.appendChild(el('span', '', '')); bar.appendChild(el('b', '', 'Watch'));
    bar.onclick = goLiveTab;

    var card = el('div', 'w2-create');
    card.appendChild(el('h3', '', 'Share a moment'));
    card.appendChild(el('p', '', 'Show what is happening on campus. Record on your phone, upload a clip or go live. Please do not film people without their consent.'));
    var tiles = el('div', 'w2-tiles');
    setBtn(rec, ICON.rec, 'Record'); setBtn(up, ICON.up, 'Upload clip');
    rec.className = ''; up.className = '';
    var gl = el('button'); gl.type = 'button'; gl.id = 'w2-golive'; setBtn(gl, ICON.live, 'Go live'); gl.onclick = function () { goLiveTab(); setTimeout(function () { var t = $('#ltitle'); if (t) { try { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.focus({ preventScroll: true }); } catch (e) {} } }, 350); };
    tiles.appendChild(rec); tiles.appendChild(up); tiles.appendChild(gl);
    card.appendChild(tiles); card.appendChild(fld);

    var sec = el('div', 'w2-sec'); sec.appendChild(el('h3', '', 'Latest clips')); var cnt = el('span', '', ''); cnt.id = 'w2-count'; sec.appendChild(cnt);

    vl.parentNode.insertBefore(bar, vl); vl.parentNode.insertBefore(card, vl); vl.parentNode.insertBefore(sec, vl);
    var two = $('.two', v); if (two && !two.children.length) two.remove();

    function count() { var n = vl.querySelectorAll('.vcard').length; cnt.textContent = n ? n + (n === 1 ? ' clip' : ' clips') : ''; sec.hidden = !n; }
    try { new MutationObserver(count).observe(vl, { childList: true }); } catch (e) {}
    count(); liveBar();
  }

  /* ---------- "N live now" banner on the Videos tab ---------- */
  function liveBar() {
    var b = $('#w2-livebar'); if (!b) return;
    var l = (window.ccLiveStrip && ccLiveStrip.list()) || [];
    b.hidden = !l.length;
    if (l.length) b.children[1].textContent = l.length === 1 ? ((l[0].host && l[0].host.handle ? '@' + String(l[0].host.handle).replace(/^@/, '') : 'Someone') + ' is live now') : l.length + ' comrades are live now';
  }
  window.addEventListener('cc-live-updated', liveBar);

  /* ---------- Live: host on every card, friendly empty state ---------- */
  function liveCards() {
    var lv = $('#v-live'), box = $('#lvl'); if (!lv || !box) return;
    lv.classList.add('w2');
    var list = []; try { list = LIVES || []; } catch (e) {}
    var arts = box.querySelectorAll('article.box');
    arts.forEach(function (a, i) {
      if (a.querySelector('.w2-host')) return;
      var s = list[i], h = s && s.host; if (!h) return;
      var row = el('div', 'w2-host'), av = el('span', 'w2-av');
      if (h.avatar && AVATAR.test(h.avatar)) { var im = new Image(); im.alt = ''; im.src = h.avatar; av.appendChild(im); }
      else av.textContent = String(h.handle || 'C').replace(/^@/, '').charAt(0).toUpperCase();
      row.appendChild(av); row.appendChild(el('b', '', '@' + String(h.handle || 'Comrade').replace(/^@/, '')));
      var t = a.querySelector('h3'); if (t) a.insertBefore(row, t); else a.appendChild(row);
    });
    var empty = box.querySelector('.w2-empty');
    var plain = box.querySelector(':scope > p.sub');
    if (!arts.length && plain && !empty && /Nobody is live/i.test(plain.textContent)) {
      var e = el('div', 'w2-empty'); e.appendChild(el('b', '', 'Nobody is live right now')); e.appendChild(el('span', '', 'Be the first. Start a live from your phone and comrades can watch, chat and send hearts.'));
      var btn = el('button', 'btn p', 'Go live'); btn.type = 'button';
      btn.onclick = function () { var t = $('#ltitle'); if (t) { try { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.focus({ preventScroll: true }); } catch (x) {} } };
      e.appendChild(btn); box.insertBefore(e, plain);
    }
  }
  function watchLive() {
    var box = $('#lvl'); if (!box || box.__w2) return; box.__w2 = 1;
    try { new MutationObserver(liveCards).observe(box, { childList: true }); } catch (e) {}
    liveCards();
  }

  function run() { videos(); watchLive(); }
  function start() { run(); var n = 0, iv = setInterval(function () { run(); if (++n > 30) clearInterval(iv); }, 500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
