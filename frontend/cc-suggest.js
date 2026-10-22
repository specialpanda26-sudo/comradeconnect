/* Search suggestions as you type, for the Explore search box (#sq) and the Market search box (#mkq).
   Words are inserted with textContent only, never as HTML. Suggestions come from what is already on the phone:
   window.ccSearchTerms() (stories, notices, events) and window.ccMarketTerms() (listing titles). */
(function () {
'use strict';
var SRC = { sq: 'ccSearchTerms', mkq: 'ccMarketTerms' };
var st = document.createElement('style');
st.textContent = '.ccsg{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:60;display:grid;border-radius:16px;overflow:hidden;background:var(--bg,#0E0F0B);border:1px solid var(--line,rgba(255,255,255,.2));box-shadow:0 14px 34px rgba(14,15,11,.45)}' +
  '.ccsg button{all:unset;box-sizing:border-box;cursor:pointer;padding:12px 16px;font-size:14px;color:var(--fg,#fff);border-bottom:1px solid var(--line,rgba(255,255,255,.12));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
  '.ccsg button:last-child{border-bottom:0}.ccsg button:hover,.ccsg button:focus-visible{background:var(--g,rgba(255,255,255,.09))}.ccsg mark{background:none;color:inherit;font-weight:700}';
document.head.appendChild(st);

function words(t) { return String(t || '').toLowerCase().split(/[^a-z0-9']+/).filter(function (w) { return w.length >= 3; }); }
function pick(q, terms) {
  q = q.trim().toLowerCase(); if (q.length < 1) return [];
  var seen = {}, starts = [], inside = [];
  function add(s) {
    var k = String(s || '').trim(); var l = k.toLowerCase();
    if (!k || k.length > 60 || seen[l] || l === q) return; seen[l] = 1;
    if (l.indexOf(q) === 0 || words(l).some(function (w) { return w.indexOf(q) === 0; })) starts.push(k);
    else if (q.length >= 2 && l.indexOf(q) > -1) inside.push(k);
  }
  terms.forEach(function (t) { add(t); words(t).forEach(add); });
  return starts.concat(inside).slice(0, 5);
}
function box(inp) { var f = inp.closest('.fld') || inp.parentNode; var b = f.querySelector('.ccsg'); if (!b) { b = document.createElement('div'); b.className = 'ccsg'; b.setAttribute('role', 'listbox'); b.hidden = true; f.appendChild(b); } return b; }
function hide(inp) { var b = (inp.closest('.fld') || inp.parentNode).querySelector('.ccsg'); if (b) { b.hidden = true; b.textContent = ''; } }
function show(inp) {
  var fn = window[SRC[inp.id]], terms = []; try { terms = typeof fn === 'function' ? fn() || [] : []; } catch (e) { terms = []; }
  var list = pick(inp.value, terms), b = box(inp); b.textContent = '';
  if (!list.length) { b.hidden = true; return; }
  list.forEach(function (s) {
    var o = document.createElement('button'); o.type = 'button'; o.setAttribute('role', 'option'); o.textContent = s;
    o.addEventListener('pointerdown', function (e) { e.preventDefault(); inp.value = s; hide(inp); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.focus(); });
    b.appendChild(o);
  });
  b.hidden = false;
}
document.addEventListener('input', function (e) { var t = e.target; if (t && SRC[t.id] && t.tagName === 'INPUT' && e.isTrusted !== false) show(t); });
document.addEventListener('focusout', function (e) { var t = e.target; if (t && SRC[t.id]) setTimeout(function () { hide(t); }, 150); });
document.addEventListener('keydown', function (e) { var t = e.target; if (e.key === 'Escape' && t && SRC[t.id]) hide(t); });
})();
