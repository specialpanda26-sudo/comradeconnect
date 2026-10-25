/* cc-upload.js: glass upload progress (percent, finishing, done, failed). Used by putFile in cc-core.js. */
(function () {
  if (window.ccUpload) return;
  var css = document.createElement('style');
  css.textContent = '#ccu{position:fixed;left:0;right:0;bottom:calc(86px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center;z-index:99990;pointer-events:none;opacity:0;transform:translateY(16px);transition:.25s}'
    + '#ccu.on{opacity:1;transform:none}'
    + '#ccu .b{pointer-events:auto;width:min(92vw,360px);padding:14px 16px;border-radius:20px;background:linear-gradient(135deg,var(--gl-a,rgba(255,255,255,.13)),var(--gl-b,rgba(255,255,255,.03)));border:1px solid var(--gl-br,rgba(255,255,255,.3));backdrop-filter:blur(28px) saturate(1.4);-webkit-backdrop-filter:blur(28px) saturate(1.4);box-shadow:0 10px 40px rgba(0,0,0,.35);color:inherit}'
    + '#ccu .t{display:flex;align-items:center;gap:10px;font-weight:600;font-size:14px}'
    + '#ccu .t span{flex:1}#ccu .t em{font-style:normal;opacity:.75;font-variant-numeric:tabular-nums}'
    + '#ccu .m{height:6px;border-radius:6px;background:rgba(255,255,255,.14);margin-top:10px;overflow:hidden}'
    + '#ccu .m i{display:block;height:100%;width:0;border-radius:6px;background:linear-gradient(90deg,#7c8cff,#A8DCE7);transition:width .2s}'
    + '#ccu.fin .m i{width:100%!important;background-size:200% 100%;animation:ccus 1.1s linear infinite}'
    + '#ccu.ok .m i{width:100%!important;animation:none}#ccu.bad .m i{width:100%!important;background:#ff6b7a;animation:none}'
    + '@keyframes ccus{to{background-position:-200% 0}}'
    + '#ccu .sp{width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,.25);border-top-color:#A8DCE7;animation:ccur .8s linear infinite}'
    + '#ccu.ok .sp,#ccu.bad .sp{animation:none;border:0;display:grid;place-items:center;font-size:15px;line-height:18px}'
    + '@keyframes ccur{to{transform:rotate(360deg)}}';
  document.head.appendChild(css);
  var el, tm;
  function box() {
    if (el) return el;
    el = document.createElement('div'); el.id = 'ccu'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<div class="b"><div class="t"><div class="sp"></div><span></span><em></em></div><div class="m"><i></i></div></div>';
    document.body.appendChild(el); return el;
  }
  function set(cls, text, pct, icon) {
    var e = box(); clearTimeout(tm);
    e.className = 'on ' + cls;
    e.querySelector('span').textContent = text;
    e.querySelector('em').textContent = pct == null ? '' : pct + '%';
    e.querySelector('.sp').textContent = icon || '';
    if (pct != null) e.querySelector('.m i').style.width = pct + '%';
  }
  function hide(ms) { clearTimeout(tm); tm = setTimeout(function () { if (el) el.className = ''; }, ms); }
  window.ccUpload = {
    start: function (what) { set('', 'Uploading ' + (what || 'your file') + '...', 0); },
    progress: function (p) { p = Math.max(0, Math.min(100, Math.round(p))); if (p >= 100) set('fin', 'Finishing up...', null); else set('', 'Uploading...', p); },
    done: function (msg) { set('ok', msg || 'Upload finished', null, '\u2713'); hide(2200); },
    fail: function (msg) { set('bad', msg || 'Upload failed. Try again.', null, '!'); hide(4500); }
  };
})();
