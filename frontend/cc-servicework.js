/* cc-servicework.js v1: "My work" photos and videos on Explore > Services.
   A repair person, barber or baker can show finished jobs: up to 6 photos and 2 short MP4/WebM videos (15 MB) per service.
   Owners see an "Add photos or video" button on their own card and a small x on each item. Everyone else sees a swipe strip and taps to view.
   Loaded after cc-core.js. Uploads reuse the same safe path as hostel photos (signed URL, then a check of the real file). */
(function () {
  'use strict';
  var X = window.__ccx; if (!X || !X.XP || !X.XP.sv || window.__ccServiceWork) return; window.__ccServiceWork = 1;
  var MAXP = 6, MAXV = 2, MAXMB = 15;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var say = function (m) { try { toast(m); } catch (e) {} };
  var signedIn = function () { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); };

  var css = document.createElement('style');
  css.textContent = '.sw-box{margin:2px 0 12px}.sw-h{font-size:12px;font-weight:600;opacity:.7;margin:0 0 8px}' +
    '.sw-g{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity}' +
    '.sw-w{position:relative;flex:none;scroll-snap-align:start}.sw-t{display:block;width:104px;height:104px;border-radius:14px;overflow:hidden;padding:0;border:1px solid var(--gb,rgba(255,255,255,.25));background:rgba(127,127,127,.15);position:relative;cursor:pointer}' +
    '.sw-t img,.sw-t video{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}' +
    '.sw-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.28)}.sw-play:after{content:"";border-left:16px solid #fff;border-top:10px solid transparent;border-bottom:10px solid transparent;margin-left:4px}' +
    '.sw-x{position:absolute;top:4px;right:4px;width:26px;height:26px;border-radius:50%;border:0;background:rgba(0,0,0,.65);color:#fff;font-size:16px;line-height:26px;padding:0;cursor:pointer}' +
    '.sw-add{margin-top:8px}.sw-lb{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;flex-direction:column}' +
    '.sw-lb img,.sw-lb video{max-width:100%;max-height:78vh;border-radius:10px}.sw-lb .sw-bar{display:flex;gap:12px;margin-top:16px}.sw-lb button{border:0;border-radius:999px;padding:10px 18px;font:600 14px Poppins,system-ui,sans-serif;background:rgba(255,255,255,.18);color:#fff;cursor:pointer}';
  document.head.appendChild(css);

  function svc(id) { var s = X.exs('sv'); return ((s && s.items) || []).filter(function (x) { return x.id === id; })[0]; }
  function gallery(x) {
    var w = x.works || [], mine = !!x.mine;
    if (!w.length && !mine) return '';
    var h = '<div class="sw-box">' + (w.length ? '<p class="sw-h">Their work</p><div class="sw-g">' + w.map(function (k, i) {
      return '<div class="sw-w"><button class="sw-t" data-sw="view" data-sid="' + esc(x.id) + '" data-i="' + i + '" aria-label="' + (k.type === 'video' ? 'Play video of their work' : 'View photo of their work') + '">'
        + (k.type === 'video' ? '<video muted playsinline preload="metadata" src="' + esc(k.url) + '#t=0.1"></video><span class="sw-play"></span>' : '<img loading="lazy" decoding="async" alt="Photo of their work" src="' + esc(k.url) + '">') + '</button>'
        + (mine ? '<button class="sw-x" data-sw="rm" data-id="' + esc(k.id) + '" data-sid="' + esc(x.id) + '" aria-label="Remove">&times;</button>' : '') + '</div>';
    }).join('') + '</div>' : '');
    if (mine) h += '<button class="act sw-add" data-sw="add" data-sid="' + esc(x.id) + '">' + (w.length ? 'Add more photos or video' : 'Show your work: add photos or a video') + '</button>';
    return h + '</div>';
  }

  var old = X.XP.sv;
  X.XP.sv = function (s, L) {
    var html = old.call(this, s, L);
    try {
      var F = L.filter(function (x) { return s.cat === 'All' || x.category === s.cat; }).sort(function (x, y) { return (y.featured ? 1 : 0) - (x.featured ? 1 : 0); });
      var d = document.createElement('div'); d.innerHTML = html;
      var cards = [].filter.call(d.querySelectorAll('article.box'), function (c) { return !c.querySelector('[data-xa="save"]'); });
      if (cards.length !== F.length) return html;
      cards.forEach(function (c, i) {
        var g = gallery(F[i]); if (!g) return;
        var ps = [].filter.call(c.children, function (n) { return n.tagName === 'P'; }), at = ps[ps.length - 1];
        var box = document.createElement('div'); box.innerHTML = g;
        if (at && at.nextSibling) c.insertBefore(box.firstChild, at.nextSibling); else c.insertBefore(box.firstChild, c.lastElementChild);
      });
      return d.innerHTML;
    } catch (e) { return html; }
  };

  /* picking files: one hidden input outside #xbody so repainting never touches it */
  var fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*,video/mp4,video/webm'; fi.multiple = true; fi.hidden = true; document.body.appendChild(fi);
  fi.onchange = async function () {
    var sid = fi.dataset.sid, files = [].slice.call(fi.files || []); fi.value = '';
    var x = svc(sid); if (!x) return; x.works = x.works || [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i], vid = /^video\//.test(f.type), n = x.works.filter(function (k) { return (k.type === 'video') === vid; }).length;
      if (vid ? n >= MAXV : n >= MAXP) { say(vid ? 'Up to ' + MAXV + ' videos' : 'Up to ' + MAXP + ' photos'); continue; }
      if (!vid && !/^image\//.test(f.type)) { say('Photos or short videos only'); continue; }
      if (vid && !/^video\/(mp4|webm)$/.test(f.type)) { say('Videos must be MP4 or WebM'); continue; }
      if (vid && f.size > MAXMB * 1048576) { say('Videos can be up to ' + MAXMB + ' MB (about 20 seconds)'); continue; }
      try {
        var blob = vid ? f : await X.toJpeg(f), type = vid ? f.type : 'image/jpeg';
        var u = await X.call('/api/media/upload-url', { body: { kind: vid ? 'service_video' : 'service_photo', content_type: type, bytes: blob.size, service_id: sid } });
        var r; try { r = await X.putFile(u.upload_url, blob, type); } catch (e) { throw new Error('The upload did not go through. Check your connection and try again.'); }
        if (!r.ok) throw new Error('The upload did not finish (' + r.status + '). Try again.');
        var d = await X.call('/api/media/' + u.id + '/complete', { body: {} });
        x.works.push({ id: u.id, type: vid ? 'video' : 'photo', url: d.url }); say(vid ? 'Video added' : 'Photo added'); X.paintX();
      } catch (e) { say(e.message || 'Could not add that file'); }
    }
    X.paintX();
  };

  function viewer(x, i) {
    var w = x.works || [], k = w[i]; if (!k) return;
    var o = document.createElement('div'); o.className = 'sw-lb'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
    o.innerHTML = (k.type === 'video' ? '<video controls autoplay playsinline src="' + esc(k.url) + '"></video>' : '<img alt="Their work" src="' + esc(k.url) + '">')
      + '<div class="sw-bar">' + (w.length > 1 ? '<button data-n="-1">Back</button><button data-n="1">Next</button>' : '') + '<button data-n="0">Close</button></div>';
    o.onclick = function (e) {
      var b = e.target.closest('button'), n = b ? +b.dataset.n : (e.target === o ? 0 : null); if (n === null) return;
      o.remove(); if (n) viewer(x, (i + n + w.length) % w.length);
    };
    document.body.appendChild(o);
  }

  var body = document.getElementById('xbody'); if (!body) return;
  body.addEventListener('click', function (e) {
    var b = e.target.closest('[data-sw]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var a = b.dataset.sw, sid = b.dataset.sid, x = svc(sid);
    if (a === 'view') return x && viewer(x, +b.dataset.i);
    if (!signedIn()) { say('Sign in first'); try { if (window.ccAuthPanel) window.ccAuthPanel(); } catch (z) {} return; }
    if (a === 'add') { fi.dataset.sid = sid; fi.click(); return; }
    if (a === 'rm') {
      if (!confirm('Remove this from your work?')) return;
      X.call('/api/services/work/' + b.dataset.id + '/remove', { body: {} }).then(function () { if (x) x.works = (x.works || []).filter(function (k) { return k.id !== b.dataset.id; }); X.paintX(); say('Removed'); }).catch(function (z) { say(z.message); });
    }
  }, true);
})();
