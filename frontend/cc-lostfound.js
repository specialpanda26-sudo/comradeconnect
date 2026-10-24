/* cc-lostfound.js: "Lost & Found" tab in Explore. A verified hub for lost and found National IDs, student IDs, phones, cards, keys and bags
   around campus (Kerugoya, Kutus, the gate, the library...). It follows the campus picked in cc-campus.js.
   Rules: no ID or card numbers (the owner proves it in the chat), no phone numbers or links, nobody is named.
   People talk through anonymous messages. Posters with a verified ID get a Verified badge. */
(function () {
'use strict';
var xt = document.getElementById('xt'), body = document.getElementById('xbody');
if (!xt || !body || window.__ccLostFound) return; window.__ccLostFound = 1;

var CATS = ['National ID', 'Student ID', 'Phone', 'ATM card', 'Wallet or bag', 'Keys', 'Laptop', 'Books or notes', 'Other'];
var PLACES = ['Kerugoya town', 'Kutus', 'Campus main gate', 'Library', 'Lecture halls', 'Cafeteria', 'Hostels', 'Matatu stage', 'Market', 'Other'];
var S = { view: 'open', kind: '', cat: 'All', list: [], reunited: 0, busy: false, err: '', loaded: false };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var say = function (t) { try { if (typeof toast === 'function') toast(t); } catch (e) {} };
var call = function (p, o) { return window.CC ? CC.call(p, o) : Promise.reject(new Error('Not ready yet. Reload the page and try again.')); };
var signedIn = function () { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); };
var on = function () { return xt.querySelector('.tab[data-x="lf"].on'); };
var campusName = function () { return (window.ccCampus && ccCampus.name()) || 'your campus'; };

var css = document.createElement('style');
css.textContent = '.lf-top{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between}.lf-top .btn{flex:none}' +
  '.lf-chips{display:flex;gap:8px;overflow-x:auto;padding:2px 0;margin-top:12px}.lf-chips .tab{flex:none}' +
  '.lf-card .lf-h{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.lf-card h3{margin:0;font-size:16px;overflow-wrap:anywhere}' +
  '.lf-card p{margin:8px 0 0;font-size:14px;line-height:1.55;overflow-wrap:anywhere}.lf-meta{font-size:12px;opacity:.7;margin-top:6px}' +
  '.lf-k{flex:none;font-size:11px;font-weight:700;letter-spacing:.04em;padding:4px 10px;border-radius:999px}' +
  '.lf-k.lost{background:rgba(220,60,60,.16);color:var(--bad,#d33)}.lf-k.found{background:rgba(30,160,90,.16);color:var(--good,#1a9a58)}' +
  '.lf-v{display:inline-block;margin-left:6px;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;background:rgba(40,120,255,.14)}' +
  '.lf-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.lf-row .act{font-size:13px}' +
  '.lf-form label{display:block;margin:12px 0 6px;font-size:12px;font-weight:600;opacity:.75}' +
  '.lf-form input,.lf-form select,.lf-form textarea{width:100%;box-sizing:border-box;border-radius:14px;border:1px solid var(--gb,rgba(255,255,255,.28));background:rgba(127,127,127,.12);color:inherit;padding:12px 14px;font:500 15px Poppins,system-ui,sans-serif}' +
  '.lf-form textarea{min-height:76px;resize:vertical}.lf-kind{display:flex;gap:8px}.lf-kind button{flex:1}.lf-err{margin:10px 0 0;font-size:13px;color:var(--bad)}.lf-note{font-size:12px;opacity:.75;margin:10px 0 0;line-height:1.5}';
document.head.appendChild(css);

if (!xt.querySelector('[data-x="lf"]')) xt.insertAdjacentHTML('beforeend', '<button class="tab g" data-x="lf">Lost &amp; Found</button>');

function when(d) {
  var t = Date.parse(d + 'T12:00:00'); if (!t) return '';
  var n = Math.round((Date.now() - t) / 86400000);
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago';
}
function chip(attr, val, label, cur) { return '<button class="tab g' + (cur === val ? ' on' : '') + '" ' + attr + '="' + esc(val) + '">' + esc(label) + '</button>'; }

function paint() {
  if (!on()) return;
  var h = '<div class="lf-top"><div><h3 style="margin:0">Lost &amp; Found at ' + esc(campusName()) + '</h3><p class="sub" style="margin:4px 0 0">IDs, phones, cards and keys. ' + (S.reunited ? '<b>' + S.reunited + '</b> returned to owners.' : 'Help a comrade get theirs back.') + '</p></div>'
    + '<button class="btn p" data-lf="add">Post</button></div>'
    + '<div class="lf-chips">' + chip('data-lfv', 'open', 'Open', S.view === 'open' ? 'open' : '') + chip('data-lfv', 'returned', 'Returned', S.view === 'returned' ? 'returned' : '') + '<span style="width:6px;flex:none"></span>'
    + chip('data-lfk', '', 'Lost and found', S.kind) + chip('data-lfk', 'lost', 'Lost', S.kind) + chip('data-lfk', 'found', 'Found', S.kind) + '</div>'
    + '<div class="lf-chips" style="margin-top:6px">' + ['All'].concat(CATS).map(function (c) { return chip('data-lfc', c, c, S.cat); }).join('') + '</div>';
  if (S.busy && !S.list.length) h += '<p class="sub" style="margin-top:14px">Loading...</p>';
  else if (S.err && !S.list.length) h += '<p class="sub" style="margin-top:14px">' + esc(S.err) + '</p><button class="btn g" data-lf="retry">Try again</button>';
  else if (!S.list.length) h += '<article class="box g" style="margin-top:14px"><h3>' + (S.view === 'returned' ? 'Nothing returned yet' : 'Nothing posted here yet') + '</h3><p class="sub" style="margin-top:6px">Found something? Post it without the number so the real owner can prove it. Lost something? Post it and check back.</p></article>';
  else h += S.list.map(function (x) {
    return '<article class="box g lf-card" style="margin-top:12px"><div class="lf-h"><h3>' + esc(x.title) + (x.verified && window.ccVerified ? window.ccVerified(16) : '') + '</h3><span class="lf-k ' + esc(x.kind) + '">' + (x.kind === 'lost' ? 'LOST' : 'FOUND') + '</span></div>'
      + '<div class="lf-meta">' + esc(x.category) + (x.place ? ' · ' + esc(x.place) : '') + ' · ' + esc(when(x.happenedOn)) + '</div>'
      + (x.details ? '<p>' + esc(x.details) + '</p>' : '')
      + '<div class="lf-row">'
      + (x.status === 'returned' ? '<span class="badge">Returned to owner</span>' : (!x.mine ? '<button class="act" data-lf="dm" data-id="' + esc(x.id) + '">' + (x.kind === 'found' ? 'This is mine' : 'I found it') + '</button>' : '<button class="act" data-lf="ret" data-id="' + esc(x.id) + '">Mark returned</button>'))
      + (x.mine ? '<button class="act" data-lf="rm" data-id="' + esc(x.id) + '">Remove</button>' : '<button class="act" data-lf="rp" data-id="' + esc(x.id) + '">Report</button>') + '</div></article>';
  }).join('');
  body.innerHTML = h;
}
function load() {
  if (S.busy) return; S.busy = true; S.err = ''; paint();
  var q = '?status=' + S.view + (S.kind ? '&kind=' + S.kind : '') + (S.cat !== 'All' ? '&category=' + encodeURIComponent(S.cat) : '');
  call('/api/lostfound' + q, { auth: false }).then(function (d) { S.list = d.items || []; S.reunited = d.reunited || 0; S.loaded = true; })
    .catch(function (e) { S.err = e.message || 'Could not load. Check your connection.'; })
    .then(function () { S.busy = false; paint(); });
}
function show() {
  [].forEach.call(xt.querySelectorAll('.tab'), function (t) { t.classList.toggle('on', t.dataset.x === 'lf'); });
  paint(); load();
}
xt.addEventListener('click', function (e) {
  var t = e.target.closest && e.target.closest('.tab'); if (!t || t.dataset.x !== 'lf') return;
  e.stopPropagation(); e.preventDefault(); show();
}, true);

function addSheet() {
  if (!signedIn()) { say('Sign in to post'); try { if (window.ccAuthPanel) window.ccAuthPanel(); } catch (e) {} return; }
  var kind = 'found', today = new Date().toISOString().slice(0, 10);
  var ov = document.createElement('div'); ov.className = 'cxm'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = '<div class="box g lf-form"><h3>Post to Lost &amp; Found</h3>'
    + '<div class="lf-kind" style="margin-top:10px"><button type="button" class="btn p" data-k="found">I found something</button><button type="button" class="btn g" data-k="lost">I lost something</button></div>'
    + '<label for="lfc">What is it?</label><select id="lfc">' + CATS.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select>'
    + '<label for="lft">Short title</label><input id="lft" maxlength="80" placeholder="e.g. Black Tecno phone with a red cover" autocomplete="off">'
    + '<label for="lfp">Where? (pick or write)</label><input id="lfp" list="lfpl" maxlength="60" placeholder="Kerugoya town, library..." autocomplete="off"><datalist id="lfpl">' + PLACES.map(function (p) { return '<option value="' + p + '">'; }).join('') + '</datalist>'
    + '<label for="lfd">Date</label><input id="lfd" type="date" value="' + today + '" max="' + today + '">'
    + '<label for="lfx">Details (optional)</label><textarea id="lfx" maxlength="300" placeholder="Colour, marks, where it can be collected"></textarea>'
    + '<p class="lf-note">Never type the ID, card or serial number. Keep it so you can ask the other person to prove it. No phone numbers or links: you will chat inside the app.</p>'
    + '<p class="lf-err" id="lfe" role="alert" hidden></p>'
    + '<div class="cxr"><button class="btn p" id="lfg">Post</button><button class="btn g" id="lfq">Cancel</button></div></div>';
  var $ = function (s) { return ov.querySelector(s); };
  var err = function (t) { var n = $('#lfe'); n.textContent = t || ''; n.hidden = !t; };
  ov.close = function () { ov.remove(); };
  ov.addEventListener('click', function (e) { if (e.target === ov) ov.close(); });
  $('#lfq').onclick = ov.close;
  [].forEach.call(ov.querySelectorAll('[data-k]'), function (b) { b.onclick = function () { kind = b.dataset.k; [].forEach.call(ov.querySelectorAll('[data-k]'), function (o) { o.className = 'btn ' + (o.dataset.k === kind ? 'p' : 'g'); }); }; });
  $('#lfg').onclick = function () {
    var b = this, title = $('#lft').value.trim(); err('');
    if (title.length < 3) return err('Add a short title');
    b.disabled = true;
    call('/api/lostfound', { body: { kind: kind, category: $('#lfc').value, title: title, place: $('#lfp').value.trim(), happened_on: $('#lfd').value, details: $('#lfx').value.trim() } })
      .then(function () { ov.close(); say('Posted'); S.view = 'open'; S.kind = ''; S.cat = 'All'; load(); })
      .catch(function (e) { b.disabled = false; err(e.message || 'Could not post'); });
  };
  document.body.appendChild(ov); setTimeout(function () { var n = $('#lft'); if (n) n.focus(); }, 80);
}

body.addEventListener('click', function (e) {
  if (!on()) return;
  var v = e.target.closest('[data-lfv]'); if (v) { S.view = v.dataset.lfv; load(); return; }
  var k = e.target.closest('[data-lfk]'); if (k) { S.kind = k.dataset.lfk; load(); return; }
  var c = e.target.closest('[data-lfc]'); if (c) { S.cat = c.dataset.lfc; load(); return; }
  var b = e.target.closest('[data-lf]'); if (!b) return; var a = b.dataset.lf, id = b.dataset.id;
  e.preventDefault();
  if (a === 'add') return addSheet();
  if (a === 'retry') return load();
  if (!signedIn()) { say('Sign in first'); try { if (window.ccAuthPanel) window.ccAuthPanel(); } catch (x) {} return; }
  if (a === 'dm') {
    var it = S.list.filter(function (x) { return x.id === id; })[0];
    if (typeof window.ccOpenThread !== 'function') return say('Update the app and try again');
    return window.ccOpenThread({ ref: { type: 'lostfound', id: id }, title: it ? it.title.slice(0, 60) : 'Lost & Found' });
  }
  if (a === 'ret') { if (!confirm('Mark this as returned to its owner?')) return; call('/api/lostfound/' + id + '/returned', { body: {} }).then(function () { say('Great, marked returned'); load(); }).catch(function (x) { say(x.message); }); }
  if (a === 'rm') { if (!confirm('Remove this post?')) return; call('/api/lostfound/' + id + '/remove', { body: {} }).then(function () { S.list = S.list.filter(function (x) { return x.id !== id; }); paint(); say('Removed'); }).catch(function (x) { say(x.message); }); }
});
})();
