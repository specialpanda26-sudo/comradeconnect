/* Kura on the home screen: a clear button next to "Drop Tea", and a full-screen Kura (leaderboard, vote, apply, my entries).
   Uses window.CC from cc-core.js (call, needSignup, payNow, putFile). Votes are paid with the same M-Pesa sheet as tickets. */
(function () {
'use strict';
var CCx = function () { return window.CC; };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var kes = function (n) { return 'KSh ' + Number(n).toLocaleString('en-KE'); };
var $ = function (id) { return document.getElementById(id); };
var toast = function (t) { try { if (window.toast) window.toast(t); } catch (e) {} };
function call(path, body) { var c = CCx(); if (!c) return Promise.reject(new Error('Still loading. Try again in a moment.')); return c.call(path, body ? { body: body } : { auth: false }); }
function callAuth(path) { return CCx().call(path, {}); }

var S = { home: null, tab: 'board', f: { campus: '', gender: '', division: '', q: '' }, busy: false };
var season = function () { return (S.home && S.home.season) || {}; };
var divName = function (d) { return d.name || d.label || d.id; };

var css = document.createElement('style');
css.textContent = '#tpill.kt:not([hidden]){display:flex;margin-top:14px;padding:8px 16px;font-size:11px;opacity:.8}'
  + '.kgo{background:linear-gradient(135deg,#f5c542,#ff8a3d)!important;color:#000!important;border:0!important;box-shadow:0 8px 24px rgba(255,138,61,.35)}'
  + '.kdot{width:8px;height:8px;border-radius:50%;background:#000;animation:kp 1.6s ease-out infinite}@keyframes kp{0%{box-shadow:0 0 0 0 rgba(0,0,0,.5)}100%{box-shadow:0 0 0 9px rgba(0,0,0,0)}}'
  + '#kura{position:fixed;inset:0;z-index:8000;background:var(--bg);color:var(--fg);overflow:auto;-webkit-overflow-scrolling:touch}#kura[hidden],.kp[hidden]{display:none}'
  + '.kw{max-width:680px;margin:auto;padding:calc(env(safe-area-inset-top,0px) + 14px) 16px 90px}'
  + '.kh{display:flex;align-items:center;justify-content:space-between;gap:10px}.kh h2{margin:0;font:700 22px Poppins,sans-serif}'
  + '.kt2{display:flex;gap:8px;margin:14px 0 4px;overflow-x:auto}.kt2 button{flex:none;padding:9px 18px;border-radius:999px;font:500 12px Poppins,sans-serif;color:var(--mut);background:var(--g);border:1px solid var(--gb);cursor:pointer}.kt2 button.on{background:var(--ink);color:var(--inkfg);border-color:var(--ink);font-weight:600}'
  + '#kura input,#kura select,#kura textarea,.kp input{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:14px;border:1px solid var(--gb);background:var(--g);color:var(--fg);font:400 14px Poppins,sans-serif;margin-top:8px}#kura select option{color:#000}'
  + '.kc{display:flex;gap:12px;align-items:center;padding:12px;border-radius:18px;border:1px solid var(--line);margin-top:10px;background:var(--g);cursor:pointer}'
  + '.kc img,.kph{width:60px;height:60px;flex:none;border-radius:14px;object-fit:cover;background:var(--g);display:grid;place-items:center;font-weight:700}'
  + '.kr{font:700 18px Poppins,sans-serif;min-width:28px;text-align:center}.kc .m{flex:1;min-width:0}.kc b{display:block;overflow-wrap:anywhere}.kc small{color:var(--mut);font-size:12px}'
  + '.kb{padding:10px 16px;border-radius:999px;font:600 12px Poppins,sans-serif;background:var(--ink);color:var(--inkfg);border:0;cursor:pointer;flex:none}.kb.g{background:var(--g);color:var(--fg);border:1px solid var(--gb)}.kb:disabled{opacity:.5}'
  + '.kpk{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-top:10px}.kpk button{padding:12px 8px;border-radius:16px;border:1px solid var(--gb);background:var(--g);color:var(--fg);font:600 13px Poppins,sans-serif;cursor:pointer}.kpk button small{display:block;font-weight:300;color:var(--mut);font-size:11px;margin-top:2px}.kpk button.pop{border-color:#f5c542}'
  + '.kp{position:fixed;inset:0;z-index:8500;background:rgba(0,0,0,.82);overflow:auto;padding:16px;display:flex}.kp>div{margin:auto;width:100%;max-width:420px;background:var(--bg);border:1px solid var(--gb);border-radius:24px;padding:18px}'
  + '.kp .big{width:100%;aspect-ratio:1;object-fit:cover;border-radius:18px;background:var(--g)}.kmsg{font-size:13px;margin-top:10px;min-height:18px}.ksub{color:var(--mut);font-size:13px;line-height:1.6}';
document.head.appendChild(css);

/* ---------- home screen button ---------- */
function hero() {
  var tp = $('tpill'), host = tp && tp.parentNode;
  if (!host || $('kuraGo')) return;
  var b = document.createElement('button'); b.id = 'kuraGo'; b.className = 'btn kgo'; b.innerHTML = '<span class="kdot"></span>Kura: Campus Star Awards';
  var first = host.querySelector('[data-open]') || host.firstElementChild; first.insertAdjacentElement('afterend', b);
  var sub = document.createElement('div'); sub.id = 'kuraSub'; sub.className = 'sub'; sub.style.cssText = 'margin-top:12px;font-size:12px'; sub.textContent = 'Vote for your campus star with M-Pesa, or enter the contest.';
  host.insertBefore(sub, tp); tp.classList.add('kt');
  b.addEventListener('click', openKura);
}
function daysLeft(iso) { if (!iso) return ''; var d = Math.ceil((Date.parse(iso) - Date.now()) / 864e5); return d > 0 ? ' · closes in ' + d + ' day' + (d > 1 ? 's' : '') : ' · voting closed'; }
function loadHome() {
  return call('/api/kura/home').then(function (d) {
    S.home = d; var st = d.stats || {}, sub = $('kuraSub');
    if (sub && st.contestants) sub.textContent = st.contestants + ' contestants · ' + (st.votes || 0) + ' votes' + daysLeft(d.season && d.season.ends_at);
  }).catch(function () {});
}

/* ---------- full screen ---------- */
function shell() {
  var o = $('kura'); if (o) return o;
  o = document.createElement('div'); o.id = 'kura'; o.hidden = true;
  o.innerHTML = '<div class="kw"><div class="kh"><h2>Kura</h2><button class="ib" data-k="close" aria-label="Close"><svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div id="kbody"></div></div>';
  document.body.appendChild(o); o.addEventListener('click', onClick); o.addEventListener('change', onChange); o.addEventListener('input', onInput);
  return o;
}
function openKura() { var o = shell(); o.hidden = false; o.scrollTop = 0; try { if (location.hash !== '#kura') history.replaceState(null, '', '#kura'); } catch (e) {} paint(); loadHome().then(paint); }
function closeKura() { shell().hidden = true; var p = $('kprof'); if (p) p.hidden = true; try { if (location.hash === '#kura') history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }

function paint() {
  var s = season(), t = S.tab, b = $('kbody'); if (!b) return;
  var head = '<p class="ksub" style="margin:10px 0 0">' + esc(s.tagline || 'Back your favourite contestant or enter your own category.') + '</p>'
    + (s.prize_title ? '<p style="margin:10px 0 0"><b>' + esc(s.prize_title) + '</b><span class="ksub"> ' + esc(s.prize_text || '') + '</span></p>' : '')
    + (s.prizes && s.prizes.length ? '<div class="kpk">' + s.prizes.map(function (p) { return '<div class="kc" style="cursor:default;margin:0;display:block"><b>' + esc(p.label) + '</b><small>' + esc(p.sub || '') + '</small></div>'; }).join('') + '</div>' : '')
    + '<p class="ksub" style="margin:8px 0 0">' + (s.voting_open ? 'Voting is open' + daysLeft(s.ends_at) : 'Voting is closed') + '</p>';
  var tabs = '<div class="kt2">' + [['board', 'Leaderboard'], ['apply', 'Enter the contest'], ['mine', 'My entries']].map(function (x) { return '<button data-k="tab" data-t="' + x[0] + '" class="' + (t === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>';
  b.innerHTML = head + tabs + '<div id="kpane"></div>';
  if (t === 'board') paintBoard(); else if (t === 'apply') paintApply(); else paintMine();
}

/* ---------- leaderboard ---------- */
function opts(list, cur, all) { return '<option value="">' + all + '</option>' + list.map(function (x) { var v = typeof x === 'string' ? x : x.id, n = typeof x === 'string' ? x : divName(x); return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join(''); }
function paintBoard() {
  var s = season(), f = S.f;
  $('kpane').innerHTML = '<input id="kq" placeholder="Search a name or category" value="' + esc(f.q) + '" maxlength="40" autocomplete="off">'
    + '<select id="kcamp" aria-label="Campus">' + opts(s.campuses || [], f.campus, 'All campuses') + '</select>'
    + '<select id="kdiv" aria-label="Division">' + opts(s.divisions || [], f.division, 'All divisions') + '</select>'
    + '<select id="kgen" aria-label="Gender"><option value="">Female and male</option><option value="female"' + (f.gender === 'female' ? ' selected' : '') + '>Female</option><option value="male"' + (f.gender === 'male' ? ' selected' : '') + '>Male</option></select>'
    + '<div id="klist"><p class="ksub">Loading...</p></div>';
  loadBoard();
}
function loadBoard() {
  var f = S.f, q = '?campus=' + encodeURIComponent(f.campus) + '&division=' + encodeURIComponent(f.division) + '&gender=' + encodeURIComponent(f.gender) + '&q=' + encodeURIComponent(f.q);
  call('/api/kura/board' + q).then(function (d) {
    var l = $('klist'); if (!l) return;
    l.innerHTML = d.items.length ? d.items.map(card).join('') : '<p class="ksub" style="margin-top:14px">No contestants here yet. Be the first: tap Enter the contest.</p>';
  }).catch(function (e) { var l = $('klist'); if (l) l.innerHTML = '<p class="ksub">' + esc(e.message) + '</p>'; });
}
function photo(c) { return c.photo ? '<img src="' + esc(c.photo) + '" alt="" loading="lazy">' : '<span class="kph">' + esc((c.name || '?').charAt(0).toUpperCase()) + '</span>'; }
function card(c) {
  return '<div class="kc" data-k="open" data-id="' + esc(c.id) + '"><span class="kr">' + c.rank + '</span>' + photo(c)
    + '<span class="m"><b>' + esc(c.name) + (c.verified ? ' &#10003;' : '') + '</b><small>' + esc(c.campus) + ' · ' + esc(c.category) + '</small><small><b style="display:inline">' + (c.votes || 0) + '</b> votes</small></span>'
    + '<button class="kb" data-k="open" data-id="' + esc(c.id) + '">' + (season().voting_open === false ? 'View' : 'Vote') + '</button></div>';
}

/* ---------- one contestant ---------- */
function openProfile(id) {
  var p = $('kprof'); if (!p) { p = document.createElement('div'); p.id = 'kprof'; p.className = 'kp'; document.body.appendChild(p); p.addEventListener('click', onClick); }
  p.hidden = false; p.innerHTML = '<div><p class="ksub">Loading...</p></div>';
  call('/api/kura/c/' + id).then(function (d) { drawProfile(p, d); }).catch(function (e) { p.innerHTML = '<div><p class="ksub">' + esc(e.message) + '</p><button class="kb g" data-k="pclose">Close</button></div>'; });
}
function drawProfile(p, d) {
  var c = d.contestant; S.cur = { id: c.id, name: c.name }; var s = season(), packs = s.packs || [], open = s.voting_open !== false;
  var soc = Object.keys(c.socials || {}).map(function (k) { var x = c.socials[k]; return '<a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer" style="margin-right:12px">' + esc(k) + ' @' + esc(x.handle) + '</a>'; }).join('');
  p.innerHTML = '<div data-id="' + esc(c.id) + '">' + (c.photo ? '<img class="big" src="' + esc(c.photo) + '" alt="">' : '')
    + '<h3 style="margin:14px 0 2px">' + esc(c.name) + (c.verified ? ' &#10003;' : '') + '</h3><p class="ksub" style="margin:0">' + esc(c.campus) + ' · ' + esc(c.category) + ' · ' + esc(c.gender) + '</p>'
    + (c.tagline ? '<p style="margin:10px 0 0">' + esc(c.tagline) + '</p>' : '') + (c.bio ? '<p class="ksub" style="margin:8px 0 0">' + esc(c.bio) + '</p>' : '')
    + (soc ? '<p style="margin:10px 0 0;font-size:13px">' + soc + '</p>' : '')
    + '<p style="margin:14px 0 0"><b>#' + d.rank + '</b> of ' + d.total + ' · <b>' + c.votes + '</b> votes · ' + c.followers + ' followers</p>'
    + (d.above ? '<p class="ksub" style="margin:4px 0 0">' + d.gap + ' more votes to pass ' + esc(d.above) + '</p>' : '')
    + '<button class="kb g" data-k="follow" style="margin-top:10px">' + (d.following ? 'Following' : 'Follow') + '</button>'
    + (open && packs.length ? '<h4 style="margin:18px 0 0">Buy votes</h4><input id="ksn" maxlength="24" placeholder="Your name on the supporters list (optional)" autocomplete="off"><div class="kpk">'
      + packs.map(function (k, i) { return '<button data-k="pack" data-p="' + i + '" class="' + (k.popular ? 'pop' : '') + '">' + k.votes + ' votes<small>' + kes(k.price) + (k.bonus ? ' · incl. ' + k.bonus + ' bonus' : '') + (k.popular ? ' · popular' : '') + '</small></button>'; }).join('') + '</div>'
      : '<p class="ksub" style="margin-top:14px">' + (open ? 'Votes are not available yet.' : 'Voting is closed.') + '</p>')
    + (d.supporters && d.supporters.length ? '<h4 style="margin:18px 0 4px">Top supporters</h4>' + d.supporters.map(function (u, i) { return '<p class="ksub" style="margin:2px 0">' + (i + 1) + '. ' + esc(u.name) + ' · ' + u.votes + ' votes</p>'; }).join('') : '')
    + '<p class="kmsg" id="kpm"></p><button class="kb g" data-k="pclose" style="width:100%">Close</button></div>';
}
function refreshProfile(id) { loadHome().then(function () { var p = $('kprof'); if (p && !p.hidden) call('/api/kura/c/' + id).then(function (d) { drawProfile(p, d); }).catch(function () {}); if (S.tab === 'board') loadBoard(); }); }
function buy(id, idx) {
  var pk = (season().packs || [])[idx]; if (!pk) return;
  var c = CCx(); c.needSignup('vote').then(function (ok) {
    if (!ok) return; var nm = $('ksn') ? $('ksn').value.trim() : '';
    c.payNow({ title: 'Vote for ' + (S.cur && S.cur.name ? S.cur.name : 'this contestant'), unit: pk.price, note: pk.votes + ' votes', done: 'Your votes are counted.', kind: 'kura',
      start: function (phone) { return call('/api/kura/vote', { contestant_id: id, pack: idx, phone: phone, name: nm }); },
      after: function () { return new Promise(function (r) { refreshProfile(id); r(); }); } });
  });
}
function follow(id) {
  CCx().needSignup('follow').then(function (ok) { if (!ok) return; return call('/api/kura/follow', { contestant_id: id }).then(function () { refreshProfile(id); }); }).catch(function (e) { toast(e.message); });
}

/* ---------- apply ---------- */
function paintApply() {
  var s = season(), p = $('kpane');
  if (s.entries_open === false) { p.innerHTML = '<p class="ksub" style="margin-top:14px">Entries are closed for this season.</p>'; return; }
  p.innerHTML = '<p class="ksub" style="margin:14px 0 0">Enter as a contestant. An admin checks every entry before it goes live. Do not put phone numbers or links in your name or bio.</p>'
    + '<input id="ka_name" maxlength="40" placeholder="Stage or creator name"><select id="ka_campus">' + opts(s.campuses || [], '', 'Your campus') + '</select>'
    + '<select id="ka_gender"><option value="">Gender</option><option value="female">Female</option><option value="male">Male</option></select>'
    + '<select id="ka_div">' + opts(s.divisions || [], '', 'Division') + '</select><select id="ka_cat"><option value="">Category</option></select>'
    + '<input id="ka_tag" maxlength="80" placeholder="Tagline (optional)"><textarea id="ka_bio" maxlength="300" rows="3" placeholder="Short bio (optional)"></textarea>'
    + '<input id="ka_ig" maxlength="40" placeholder="Instagram username (optional)" autocapitalize="off"><input id="ka_tt" maxlength="40" placeholder="TikTok username (optional)" autocapitalize="off">'
    + '<input id="ka_email" type="email" maxlength="200" placeholder="Email" autocapitalize="off"><input id="ka_phone" inputmode="numeric" maxlength="10" placeholder="M-Pesa number, like 0712345678">'
    + '<p class="ksub" style="margin:12px 0 0">Your photo</p><input id="ka_photo" type="file" accept="image/*"><p class="kmsg" id="kam"></p><button class="kb" id="ka_go" data-k="submit" style="width:100%;padding:14px">Send my entry</button>';
}
function fillCats() {
  var d = (season().divisions || []).filter(function (x) { return x.id === $('ka_div').value; })[0];
  $('ka_cat').innerHTML = '<option value="">Category</option>' + ((d && d.categories) || []).map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
}
function shrink(file) {
  return new Promise(function (res, rej) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () { var k = Math.min(1, 1200 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(function (b) { b ? res(b) : rej(new Error('That photo could not be read.')); }, 'image/jpeg', 0.85); };
    img.onerror = function () { rej(new Error('That photo could not be read. Pick a JPG or PNG.')); }; img.src = url;
  });
}
function submit() {
  if (S.busy) return; var m = $('kam'), v = function (i) { return ($(i).value || '').trim(); }, say = function (t) { m.textContent = t; };
  var f = $('ka_photo').files[0]; if (!v('ka_name') || !v('ka_campus') || !v('ka_gender') || !v('ka_div') || !v('ka_cat') || !v('ka_email') || !v('ka_phone')) return say('Fill in your name, campus, gender, division, category, email and M-Pesa number.');
  if (!f) return say('Add a clear photo of you.');
  CCx().needSignup('enter').then(function (ok) {
    if (!ok) return; S.busy = true; $('ka_go').disabled = true; say('Uploading your photo...');
    return shrink(f).then(function (blob) {
      return call('/api/kura/photo-url', { content_type: 'image/jpeg', bytes: blob.size }).then(function (u) {
        return CCx().putFile(u.upload_url, blob, 'image/jpeg').then(function (r) { if (!r.ok) throw new Error('The photo did not upload. Try again.'); say('Sending your entry...');
          var soc = {}; if (v('ka_ig')) soc.instagram = v('ka_ig'); if (v('ka_tt')) soc.tiktok = v('ka_tt');
          return call('/api/kura/apply', { name: v('ka_name'), tagline: v('ka_tag'), bio: v('ka_bio'), email: v('ka_email'), phone: v('ka_phone'), campus: v('ka_campus'), gender: v('ka_gender'), division: v('ka_div'), category: v('ka_cat'), photo_key: u.key, socials: soc }); });
      });
    }).then(function () { S.tab = 'mine'; toast('Entry sent. We will review it soon.'); paint(); })
      .catch(function (e) { say(e.message); }).then(function () { S.busy = false; var g = $('ka_go'); if (g) g.disabled = false; });
  });
}

/* ---------- my entries ---------- */
var STAT = { pending: 'Waiting for review', approved: 'Live', rejected: 'Not accepted', hidden: 'Hidden' };
function paintMine() {
  var p = $('kpane'); p.innerHTML = '<p class="ksub" style="margin-top:14px">Loading...</p>';
  CCx().needSignup('see your entries').then(function (ok) {
    if (!ok) { p.innerHTML = '<p class="ksub" style="margin-top:14px">Sign up first, then tap My entries again.</p>'; return; }
    return callAuth('/api/kura/me').then(function (d) {
      var a = d.applications || [];
      p.innerHTML = a.length ? a.map(function (x) { return '<div class="kc" style="cursor:default"><span class="m"><b>' + esc(x.name) + '</b><small>' + esc(x.campus) + ' · ' + esc(x.category) + '</small><small>' + esc(STAT[x.status] || x.status) + (x.status === 'approved' ? ' · ' + (x.votes || 0) + ' votes' : '') + (x.status === 'rejected' && x.note ? ' · ' + esc(x.note) : '') + '</small></span>' + (x.status === 'approved' ? '<button class="kb" data-k="open" data-id="' + esc(x.id) + '">View</button>' : '') + '</div>'; }).join('') : '<p class="ksub" style="margin-top:14px">You have not entered yet. Tap Enter the contest.</p>';
    });
  }).catch(function (e) { p.innerHTML = '<p class="ksub">' + esc(e.message) + '</p>'; });
}

/* ---------- events ---------- */
function onClick(e) {
  var b = e.target.closest('[data-k]'); if (!b) return; var k = b.dataset.k, id = b.dataset.id;
  if (k === 'close') return closeKura();
  if (k === 'tab') { S.tab = b.dataset.t; return paint(); }
  if (k === 'open') { e.stopPropagation(); return openProfile(id); }
  if (k === 'pclose') { $('kprof').hidden = true; return; }
  if (k === 'pack') return buy(($('kprof').firstElementChild || {}).dataset.id, +b.dataset.p);
  if (k === 'follow') return follow(($('kprof').firstElementChild || {}).dataset.id);
  if (k === 'submit') return submit();
}
function onChange(e) {
  var t = e.target.id;
  if (t === 'kcamp') { S.f.campus = e.target.value; loadBoard(); } else if (t === 'kdiv') { S.f.division = e.target.value; loadBoard(); } else if (t === 'kgen') { S.f.gender = e.target.value; loadBoard(); } else if (t === 'ka_div') fillCats();
}
var qt; function onInput(e) { if (e.target.id !== 'kq') return; S.f.q = e.target.value.trim(); clearTimeout(qt); qt = setTimeout(loadBoard, 300); }

function boot() { hero(); loadHome(); if (location.hash === '#kura') openKura(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
window.addEventListener('hashchange', function () { if (location.hash === '#kura') openKura(); });
})();
