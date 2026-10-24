/* cc-papers.js: "Papers" tab in Explore. A library of past papers, CATs, lecture notes and revision notes, filed by course code and year.
   Comrades share a Google Drive / Mega / Dropbox / OneDrive link (we store only the link, so it costs nothing).
   Search by course code, filter by type and year, say "Helpful", report bad links, remove your own. Follows the campus picked in cc-campus.js. */
(function () {
'use strict';
var xt = document.getElementById('xt'), body = document.getElementById('xbody');
if (!xt || !body || window.__ccPapers) return; window.__ccPapers = 1;

var KINDS = ['Past paper', 'CAT', 'Lecture notes', 'Revision notes'];
var S = { kind: '', year: '', q: '', list: [], busy: false, err: '', loaded: false };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var say = function (t) { try { if (typeof toast === 'function') toast(t); } catch (e) {} };
var call = function (p, o) { return window.CC ? CC.call(p, o) : Promise.reject(new Error('Not ready yet. Reload the page and try again.')); };
var signedIn = function () { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); };
var on = function () { return xt.querySelector('.tab[data-x="pp"].on'); };
var campusName = function () { return (window.ccCampus && ccCampus.name()) || 'your campus'; };
var thisYear = new Date().getFullYear();

var css = document.createElement('style');
css.textContent = '.pp-top{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between}.pp-top .btn{flex:none}' +
  '.pp-q{width:100%;box-sizing:border-box;margin-top:12px;border-radius:14px;border:1px solid var(--gb,rgba(255,255,255,.28));background:rgba(127,127,127,.12);color:inherit;padding:12px 14px;font:500 15px Poppins,system-ui,sans-serif}' +
  '.pp-chips{display:flex;gap:8px;overflow-x:auto;padding:2px 0;margin-top:10px}.pp-chips .tab{flex:none}' +
  '.pp-course{margin:18px 0 6px;font-size:15px;font-weight:700;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.pp-course span{font-size:12px;font-weight:500;opacity:.65}' +
  '.pp-card{margin-top:8px}.pp-card .pp-h{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.pp-card h3{margin:0;font-size:15px;overflow-wrap:anywhere}' +
  '.pp-card p{margin:6px 0 0;font-size:13px;line-height:1.5;overflow-wrap:anywhere}.pp-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.pp-row .act{font-size:13px}' +
  '.pp-form label{display:block;margin:12px 0 6px;font-size:12px;font-weight:600;opacity:.75}' +
  '.pp-form input,.pp-form select,.pp-form textarea{width:100%;box-sizing:border-box;border-radius:14px;border:1px solid var(--gb,rgba(255,255,255,.28));background:rgba(127,127,127,.12);color:inherit;padding:12px 14px;font:500 15px Poppins,system-ui,sans-serif}' +
  '.pp-form textarea{min-height:70px;resize:vertical}.pp-err{margin:10px 0 0;font-size:13px;color:var(--bad)}.pp-note{font-size:12px;opacity:.75;margin:10px 0 0;line-height:1.5}';
document.head.appendChild(css);

if (!xt.querySelector('[data-x="pp"]')) xt.insertAdjacentHTML('beforeend', '<button class="tab g" data-x="pp">Papers</button>');
function chip(attr, val, label, cur) { return '<button class="tab g' + (cur === val ? ' on' : '') + '" ' + attr + '="' + esc(val) + '">' + esc(label) + '</button>'; }

function paint() {
  if (!on()) return;
  var years = []; for (var y = thisYear; y >= thisYear - 8; y--) years.push(y);
  var keep = document.getElementById('ppq'), had = keep && document.activeElement === keep;
  var h = '<div class="pp-top"><div><h3 style="margin:0">Papers at ' + esc(campusName()) + '</h3><p class="sub" style="margin:4px 0 0">Past papers, CATs and notes by course. Share yours.</p></div><button class="btn p" data-pp="add">Share</button></div>'
    + '<input class="pp-q" id="ppq" placeholder="Search a course, e.g. MAT 110" maxlength="30" autocomplete="off" value="' + esc(S.q) + '">'
    + '<div class="pp-chips">' + chip('data-ppk', '', 'All types', S.kind) + KINDS.map(function (k) { return chip('data-ppk', k, k, S.kind); }).join('') + '</div>'
    + '<div class="pp-chips" style="margin-top:6px">' + chip('data-ppy', '', 'Any year', S.year) + years.map(function (y) { return chip('data-ppy', String(y), String(y), S.year); }).join('') + '</div>';
  if (S.busy && !S.list.length) h += '<p class="sub" style="margin-top:14px">Loading...</p>';
  else if (S.err && !S.list.length) h += '<p class="sub" style="margin-top:14px">' + esc(S.err) + '</p><button class="btn g" data-pp="retry">Try again</button>';
  else if (!S.list.length) h += '<article class="box g" style="margin-top:14px"><h3>Nothing here yet</h3><p class="sub" style="margin-top:6px">Be the first to share. Paste a Drive or Mega link to a past paper or your lecture notes and help the next comrade.</p></article>';
  else {
    var cur = '';
    S.list.forEach(function (x) {
      if (x.courseCode !== cur) { cur = x.courseCode; h += '<div class="pp-course">' + esc(cur) + '<span>' + esc(x.courseName) + '</span></div>'; }
      h += '<article class="box g pp-card"><div class="pp-h"><h3>' + esc(x.title) + '</h3><span class="badge">' + esc(x.year) + '</span></div>'
        + '<p class="sub" style="margin:4px 0 0">' + esc(x.kind) + '</p>' + (x.details ? '<p>' + esc(x.details) + '</p>' : '')
        + '<div class="pp-row"><a class="btn p" style="text-decoration:none;padding:9px 18px" href="' + esc(x.link) + '" target="_blank" rel="noopener noreferrer nofollow">Open</a>'
        + '<button class="act' + (x.liked ? ' liked' : '') + '" data-pp="like" data-id="' + esc(x.id) + '">Helpful' + (x.likes ? ' ' + x.likes : '') + '</button>'
        + (x.mine ? '<button class="act" data-pp="rm" data-id="' + esc(x.id) + '">Remove</button>' : '<button class="act" data-pp="rp" data-id="' + esc(x.id) + '">Report</button>') + '</div></article>';
    });
  }
  body.innerHTML = h;
  if (had) { var n = document.getElementById('ppq'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }
}
var timer = 0;
function load() {
  S.busy = true; S.err = ''; paint();
  var q = '?' + (S.kind ? 'kind=' + encodeURIComponent(S.kind) + '&' : '') + (S.year ? 'year=' + S.year + '&' : '') + (S.q ? 'q=' + encodeURIComponent(S.q) : '');
  call('/api/papers' + q, { auth: false }).then(function (d) { S.list = d.papers || []; S.loaded = true; })
    .catch(function (e) { S.err = e.message || 'Could not load. Check your connection.'; })
    .then(function () { S.busy = false; paint(); });
}
function show() {
  [].forEach.call(xt.querySelectorAll('.tab'), function (t) { t.classList.toggle('on', t.dataset.x === 'pp'); });
  paint(); load();
}
xt.addEventListener('click', function (e) {
  var t = e.target.closest && e.target.closest('.tab'); if (!t || t.dataset.x !== 'pp') return;
  e.stopPropagation(); e.preventDefault(); show();
}, true);
body.addEventListener('input', function (e) {
  if (!on() || e.target.id !== 'ppq') return;
  S.q = e.target.value.trim(); clearTimeout(timer); timer = setTimeout(load, 450);
});

function addSheet() {
  if (!signedIn()) { say('Sign in to share'); try { if (window.ccAuthPanel) window.ccAuthPanel(); } catch (e) {} return; }
  var years = ''; for (var y = thisYear; y >= thisYear - 15; y--) years += '<option>' + y + '</option>';
  var ov = document.createElement('div'); ov.className = 'cxm'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = '<div class="box g pp-form"><h3>Share a paper or notes</h3>'
    + '<label for="ppt">Type</label><select id="ppt">' + KINDS.map(function (k) { return '<option>' + k + '</option>'; }).join('') + '</select>'
    + '<label for="ppc">Course code</label><input id="ppc" maxlength="12" placeholder="e.g. MAT 110" autocomplete="off">'
    + '<label for="ppn">Course name (optional)</label><input id="ppn" maxlength="80" placeholder="e.g. Calculus I" autocomplete="off">'
    + '<label for="ppyr">Year</label><select id="ppyr">' + years + '</select>'
    + '<label for="ppti">Title</label><input id="ppti" maxlength="100" placeholder="e.g. Sem 1 main exam" autocomplete="off">'
    + '<label for="ppl">Share link</label><input id="ppl" type="url" maxlength="300" placeholder="https://drive.google.com/..." autocomplete="off">'
    + '<label for="ppd">Notes (optional)</label><textarea id="ppd" maxlength="300" placeholder="With answers? Scanned? Which lecturer?"></textarea>'
    + '<p class="pp-note">Upload to Google Drive, Mega, Dropbox or OneDrive, set sharing to "anyone with the link", then paste the link here. Only share material you are allowed to share.</p>'
    + '<p class="pp-err" id="ppe" role="alert" hidden></p><div class="cxr"><button class="btn p" id="ppg">Share</button><button class="btn g" id="ppx">Cancel</button></div></div>';
  var $ = function (s) { return ov.querySelector(s); };
  var err = function (t) { var n = $('#ppe'); n.textContent = t || ''; n.hidden = !t; };
  ov.close = function () { ov.remove(); };
  ov.addEventListener('click', function (e) { if (e.target === ov) ov.close(); });
  $('#ppx').onclick = ov.close;
  $('#ppg').onclick = function () {
    var b = this; err('');
    var o = { kind: $('#ppt').value, course_code: $('#ppc').value.trim(), course_name: $('#ppn').value.trim(), year: +$('#ppyr').value, title: $('#ppti').value.trim(), link: $('#ppl').value.trim(), details: $('#ppd').value.trim() };
    if (o.course_code.length < 3) return err('Add the course code');
    if (o.title.length < 3) return err('Add a short title');
    if (!/^https:\/\//i.test(o.link)) return err('Paste the share link (it starts with https)');
    b.disabled = true;
    call('/api/papers', { body: o }).then(function () { ov.close(); say('Shared. Thank you!'); S.kind = ''; S.year = ''; S.q = ''; load(); })
      .catch(function (e) { b.disabled = false; err(e.message || 'Could not share'); });
  };
  document.body.appendChild(ov); setTimeout(function () { var n = $('#ppc'); if (n) n.focus(); }, 80);
}

body.addEventListener('click', function (e) {
  if (!on()) return;
  var k = e.target.closest('[data-ppk]'); if (k) { S.kind = k.dataset.ppk; load(); return; }
  var y = e.target.closest('[data-ppy]'); if (y) { S.year = y.dataset.ppy; load(); return; }
  var b = e.target.closest('[data-pp]'); if (!b) return; var a = b.dataset.pp, id = b.dataset.id;
  e.preventDefault();
  if (a === 'add') return addSheet();
  if (a === 'retry') return load();
  if (!signedIn()) { say('Sign in first'); try { if (window.ccAuthPanel) window.ccAuthPanel(); } catch (x) {} return; }
  if (a === 'like') { b.disabled = true; call('/api/papers/' + id + '/like', { body: {} }).then(function (r) { var p = S.list.filter(function (x) { return x.id === id; })[0]; if (p) { p.likes = r.likes; p.liked = r.liked; } paint(); }).catch(function (x) { b.disabled = false; say(x.message); }); }
  if (a === 'rm') { if (!confirm('Remove this from the library?')) return; call('/api/papers/' + id + '/remove', { body: {} }).then(function () { S.list = S.list.filter(function (x) { return x.id !== id; }); paint(); say('Removed'); }).catch(function (x) { say(x.message); }); }
  if (a === 'rp') { var why = prompt('What is wrong with this link? (wrong course, broken, not allowed)'); if (why === null) return; call('/api/report', { body: { type: 'paper', id: id, reason: String(why).slice(0, 200) } }).then(function () { say('Reported. Thank you'); }).catch(function (x) { say(x.message); }); }
});
})();
