/* cc-reelcomments.js: real comments on reels and clips.
   The Reels screen in index.html kept comments in memory only. This takes over the comment button and the Post button for clips that live
   on the server, so comments are shared, counted, and the owner is told. Everyone is shown by a made-up alias. Text uses textContent only. */
(function () {
'use strict';
var R = document.getElementById('rlroot');
if (!R || window.__ccReelComments) return; window.__ccReelComments = 1;

var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
var cur = null, store = {}, counts = {}, posting = false;

function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function say(t) { try { if (typeof toast === 'function') toast(t); } catch (e) {} }
function call(p, o) { return window.CC ? CC.call(p, o) : Promise.reject(new Error('Not ready yet. Reload the page and try again.')); }
function connected() { return typeof CC_API === 'string' && CC_API.indexOf('YOUR-SUBDOMAIN') < 0; }
function vid(id) { try { return VIDS.find(function (v) { return v.id === id; }); } catch (e) { return null; } }
function countOf(id) { if (counts[id] != null) return counts[id]; var v = vid(id); return v && v.comments ? v.comments : 0; }

var css = el('style');
css.textContent =
'#rlcl .rcc{margin:0 0 12px;font-size:14px;line-height:1.5;overflow-wrap:anywhere}' +
'#rlcl .rcc b{font-weight:600;margin-right:6px}#rlcl .rcc i{font-style:normal;font-size:11px;padding:1px 7px;margin-right:6px;border-radius:999px;border:1px solid currentColor;opacity:.75}' +
'#rlcl .rcc button{all:unset;cursor:pointer;margin-left:8px;font-size:12px;opacity:.6;text-decoration:underline}#rlcl .rcc button:focus-visible{outline:2px solid currentColor;outline-offset:2px}' +
'#rlcl .rcm{opacity:.65;font-size:14px}#rlcs[disabled]{opacity:.5}';
document.head.appendChild(css);

/* ---------- counts under each reel ---------- */
function fill() {
  [].forEach.call(R.querySelectorAll('.rl'), function (sec) {
    var b = sec.querySelector('[data-a="cmt"] span'); if (b) b.textContent = String(countOf(sec.dataset.id));
  });
}
var rls = document.getElementById('rls');
if (rls) { new MutationObserver(fill).observe(rls, { childList: true }); fill(); }

/* ---------- the list inside the sheet ---------- */
function draw() {
  var box = document.getElementById('rlcl'), head = document.querySelector('#rlcm > b');
  if (!box || !cur) return;
  var st = store[cur] || { items: [], loading: true };
  box.textContent = '';
  if (head) head.textContent = countOf(cur) ? 'Comments (' + countOf(cur) + ')' : 'Comments';
  if (st.loading) { box.appendChild(el('p', 'rcm', 'Loading comments...')); return; }
  if (st.error) { var p = el('p', 'rcm', st.error + ' '); var rt = el('button', '', 'Try again'); rt.type = 'button'; rt.onclick = function () { open(cur); }; p.appendChild(rt); box.appendChild(p); return; }
  if (!st.items.length) { box.appendChild(el('p', 'rcm', 'No comments yet. Start the conversation.')); return; }
  st.items.forEach(function (c) {
    var p = el('p', 'rcc'); p.appendChild(el('b', '', c.mine ? 'You' : c.alias));
    if (c.creator) p.appendChild(el('i', '', 'Creator'));
    p.appendChild(document.createTextNode(c.text));
    if (c.can_remove) {
      var x = el('button', '', 'Remove'); x.type = 'button'; x.setAttribute('aria-label', 'Remove this comment');
      x.onclick = function () {
        var id = cur;
        call('/api/clips/' + id + '/comments/' + c.id + '/remove', { body: {} }).then(function () {
          store[id].items = store[id].items.filter(function (y) { return y.id !== c.id; });
          counts[id] = Math.max(0, countOf(id) - 1); var v = vid(id); if (v) v.comments = counts[id]; fill(); if (cur === id) draw();
        }).catch(function (e) { say(e.message); });
      };
      p.appendChild(x);
    }
    box.appendChild(p);
  });
  box.scrollTop = box.scrollHeight;
}
function open(id) {
  cur = id; store[id] = { items: (store[id] && store[id].items) || [], loading: true };
  var sh = document.getElementById('rlcm'); if (sh) sh.classList.add('on');
  draw();
  call('/api/clips/' + id + '/comments', { auth: false }).then(function (d) {
    store[id] = { items: d.comments || [], loading: false };
    if ((d.comments || []).length > countOf(id) && !d.hasMore) { counts[id] = d.comments.length; fill(); }
    if (cur === id) draw();
  }).catch(function (e) { store[id] = { items: [], loading: false, error: e.message || 'Could not load comments.' }; if (cur === id) draw(); });
}

/* ---------- posting ---------- */
function send() {
  var inp = document.getElementById('rlci'), btn = document.getElementById('rlcs');
  if (!cur || !inp || posting) return;
  var text = inp.value.trim(); if (!text) return;
  var id = cur; posting = true; btn.disabled = true;
  call('/api/clips/' + id + '/comments', { body: { text: text } }).then(function (d) {
    var st = store[id] || (store[id] = { items: [] }); st.items.push(d.comment); st.loading = false;
    counts[id] = d.count; var v = vid(id); if (v) v.comments = d.count;
    inp.value = ''; fill(); if (cur === id) draw();
  }).catch(function (e) { say(e.message || 'Could not post your comment.'); })
    .then(function () { posting = false; btn.disabled = false; });
}

/* ---------- take over the two buttons for server clips (runs before the page's own handler) ---------- */
R.addEventListener('click', function (e) {
  if (!connected()) return;
  var b = e.target.closest && e.target.closest('button'); if (!b) return;
  if (b.id === 'rlcs') { if (cur && UUID.test(cur)) { e.stopImmediatePropagation(); send(); } return; }
  var sec = b.closest('.rl');
  if (b.dataset.a === 'cmt' && sec && UUID.test(sec.dataset.id)) { e.stopImmediatePropagation(); open(sec.dataset.id); }
}, true);
var inp = document.getElementById('rlci');
if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (cur && UUID.test(cur)) send(); } });
})();
