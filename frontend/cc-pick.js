/* cc-pick.js: glass pop-up pickers for Kura dropdowns + home button spacing */
(function () {
  'use strict'; if (window.__ccPick) return; window.__ccPick = 1;
  var css = [
    '#kura select.cp-h,#kura .ccw{display:none!important}',
    '.cp-t{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 16px;border-radius:18px;border:1px solid var(--gb);background:var(--g);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:var(--fg);font:500 13px Poppins,sans-serif;text-align:left;cursor:pointer;margin-top:6px}',
    '.cp-t:active{transform:scale(.985)}.cp-t i{font-style:normal;color:#A8DCE7}.cp-t.ph span{color:var(--mut)}',
    '#ccpk{position:fixed;inset:0;z-index:9500;display:grid;align-items:end;background:rgba(16,20,34,.55);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}',
    '#ccpk .p{width:min(520px,100%);margin:0 auto;max-height:78vh;display:flex;flex-direction:column;padding:10px 16px calc(18px + env(safe-area-inset-bottom,0px));border-radius:28px 28px 0 0;background:rgba(16,20,34,.84);color:#fff;border:1px solid var(--gb);border-bottom:0;box-shadow:0 -20px 60px rgba(0,0,0,.5);-webkit-backdrop-filter:blur(26px) saturate(160%);backdrop-filter:blur(26px) saturate(160%);animation:ccpu .32s cubic-bezier(.2,.9,.3,1.1)}',
    ':root[data-theme="light"] #ccpk .p{background:rgba(255,255,255,.9);color:#101422}',
    '@keyframes ccpu{from{transform:translateY(46px);opacity:0}}',
    '#ccpk .h{width:42px;height:4px;border-radius:9px;background:var(--gb);margin:2px auto 12px}',
    '#ccpk h4{margin:0 0 12px;font:600 17px Poppins,sans-serif}',
    '#ccpk input{width:100%;margin:0 0 10px;padding:12px 14px;border:1px solid var(--gb);border-radius:14px;background:color-mix(in srgb,currentColor 6%,transparent);color:inherit;font:400 14px Poppins,sans-serif}',
    '#ccpk .l{overflow:auto;display:grid;gap:8px;padding-bottom:4px}',
    '#ccpk .r{display:flex;align-items:center;justify-content:space-between;width:100%;padding:14px 16px;border-radius:18px;border:1px solid var(--line);background:color-mix(in srgb,currentColor 5%,transparent);color:inherit;font:500 14px Poppins,sans-serif;text-align:left;cursor:pointer}',
    '#ccpk .r b{color:#A8DCE7;display:none}#ccpk .r.on{border-color:#A8DCE7;background:color-mix(in srgb,#A8DCE7 18%,transparent)}#ccpk .r.on b{display:block}',
    'div:has(>#tpill){display:flex;flex-wrap:wrap;gap:12px;align-items:center}#tpill{margin-top:0!important}#kuraSub{flex-basis:100%;margin:0!important}',
    '@supports not selector(:has(*)){[data-cc=cta_primary],#kuraGo{margin:0 10px 12px 0}}'
  ].join('');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  function upd(b) {
    var s = b.__s, o = s.options[s.selectedIndex], t = o ? o.text : 'Choose', sp = b.firstChild;
    if (sp.textContent !== t) sp.textContent = t;
    b.classList.toggle('ph', !o || !s.value);
  }
  function mk(s) {
    if (s.__cp) return; s.__cp = 1; s.classList.add('cp-h');
    var b = document.createElement('button'); b.type = 'button'; b.className = 'cp-t'; b.__s = s;
    b.innerHTML = '<span></span><i>\u25BE</i>'; var a = s.closest('.ccw') || s; a.parentNode.insertBefore(b, a.nextSibling); upd(b);
  }
  var q = 0;
  function scan() {
    q = 0; var k = document.getElementById('kura'); if (!k) return;
    [].forEach.call(k.querySelectorAll('select'), mk);
    [].forEach.call(k.querySelectorAll('.cp-t'), function (b) { if (b.__s.isConnected) upd(b); else b.remove(); });
  }
  new MutationObserver(function () { if (!q) q = requestAnimationFrame(scan); }).observe(document.body, { childList: true, subtree: true });
  function open(b) {
    var s = b.__s, lb = s.closest('label'), ttl = (s.getAttribute('aria-label') || (lb && lb.childNodes[0] && lb.childNodes[0].textContent) || 'option').trim();
    var opts = [].filter.call(s.options, function (o) { return o.text && !o.disabled && !(o.value === '' && /^(choose|select)/i.test(o.text)); });
    var el = document.createElement('div'); el.id = 'ccpk';
    el.innerHTML = '<div class="p" role="dialog" aria-modal="true"><div class="h"></div><h4></h4>' + (opts.length > 8 ? '<input placeholder="Search" autocomplete="off">' : '') + '<div class="l"></div></div>';
    el.querySelector('h4').textContent = 'Choose ' + ttl.toLowerCase();
    var l = el.querySelector('.l'), on;
    opts.forEach(function (o) {
      var r = document.createElement('button'); r.type = 'button'; r.className = 'r' + (o.value === s.value ? ' on' : '');
      r.innerHTML = '<span></span><b>\u2713</b>'; r.firstChild.textContent = o.text; if (r.className.indexOf('on') > 0) on = r;
      r.onclick = function () { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); close(); scan(); };
      l.appendChild(r);
    });
    var inp = el.querySelector('input');
    if (inp) inp.oninput = function () { var v = inp.value.toLowerCase(); [].forEach.call(l.children, function (r) { r.style.display = r.firstChild.textContent.toLowerCase().indexOf(v) < 0 ? 'none' : ''; }); };
    function close() { el.remove(); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    el.addEventListener('click', function (e) { if (e.target === el) close(); });
    document.addEventListener('keydown', esc); document.body.appendChild(el);
    if (on) on.scrollIntoView({ block: 'center' });
  }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.cp-t'); if (b) { e.preventDefault(); open(b); } });
  scan();
})();
