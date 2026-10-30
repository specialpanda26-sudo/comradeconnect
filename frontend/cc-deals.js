/* cc-deals.js: "Deals" tab in Explore. Food spots, salons and cyber cafes post a student offer; a comrade taps "Get my code",
   shows the 6-digit code at the counter, and the business enters it to confirm. Follows the campus picked in cc-campus.js.
   Posts wait for an admin to approve them. Businesses owe a small fee per confirmed redemption (set in Admin > Money settings). */
(function () {
'use strict';
var xt = document.getElementById('xt'), body = document.getElementById('xbody');
if (!xt || !body || window.__ccDeals) return; window.__ccDeals = 1;

var CATS = ['Food', 'Salon or barber', 'Cyber and printing', 'Shop', 'Fitness', 'Other'];
var S = { cat: 'All', list: [], fee: 0, busy: false, err: '', ready: true, loaded: false };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var say = function (t) { try { if (typeof toast === 'function') toast(t); } catch (e) {} };
var call = function (p, o) { return window.CC ? CC.call(p, o) : Promise.reject(new Error('Not ready yet. Reload the page and try again.')); };
var signedIn = function () { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); };
var on = function () { return xt.querySelector('.tab[data-x="dl"].on'); };
var campusName = function () { return (window.ccCampus && ccCampus.name()) || 'your campus'; };
var kes = function (n) { return 'KSh ' + Number(n || 0).toLocaleString('en-KE'); };
var needSignIn = function (why) { say(why || 'Sign in first'); try { if (window.ccAuthPanel) window.ccAuthPanel(); } catch (e) {} };

var css = document.createElement('style');
css.textContent = '.dl-top{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between}.dl-top .btn{flex:none}'
  + '.dl-chips{display:flex;gap:8px;overflow-x:auto;padding:2px 0;margin-top:12px}.dl-chips .tab{flex:none}'
  + '.dl-card{margin-top:12px;cursor:pointer}.dl-card:active{transform:scale(.99)}.dl-h{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}'
  + '.dl-biz{margin:0;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;opacity:.7;overflow-wrap:anywhere}'
  + '.dl-t{margin:6px 0 0;font-size:17px;font-weight:600;line-height:1.35;overflow-wrap:anywhere}'
  + '.dl-meta{font-size:12px;opacity:.7;margin-top:8px;line-height:1.5}.dl-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.dl-row>*{flex:1 1 120px}'
  + '.dl-pill{flex:none;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;background:rgba(127,127,127,.18);white-space:nowrap}'
  + '.dl-code{margin:16px 0 6px;text-align:center;font:700 40px/1 Poppins,system-ui,sans-serif;letter-spacing:.22em;padding-left:.22em;overflow-wrap:anywhere}'
  + '.dl-form label{display:block;margin:12px 0 6px;font-size:12px;font-weight:600;opacity:.75}'
  + '.dl-form input,.dl-form select,.dl-form textarea{width:100%;box-sizing:border-box;border-radius:14px;border:1px solid var(--gb,rgba(255,255,255,.28));background:rgba(127,127,127,.12);color:inherit;padding:12px 14px;font:500 15px Poppins,system-ui,sans-serif}'
  + '.dl-form textarea{min-height:70px;resize:vertical}.dl-err{margin:10px 0 0;font-size:13px;color:var(--bad)}.dl-note{font-size:12px;opacity:.75;margin:10px 0 0;line-height:1.5}'
  + '.dl-mine{padding:12px 0;border-top:1px solid var(--gb,rgba(255,255,255,.18))}.dl-mine:first-of-type{border-top:0}.dl-mine b{overflow-wrap:anywhere}';
document.head.appendChild(css);

if (!xt.querySelector('[data-x="dl"]')) xt.insertAdjacentHTML('beforeend', '<button class="tab g" data-x="dl">Deals</button>');

function until(d) {
  var n = Math.round((Date.parse(d + 'T23:59:00') - Date.now()) / 86400000);
  return n <= 0 ? 'last day today' : n === 1 ? 'until tomorrow' : 'for ' + n + ' more days';
}
function chip(attr, val, label, cur) { return '<button class="tab g' + (cur === val ? ' on' : '') + '" ' + attr + '="' + esc(val) + '">' + esc(label) + '</button>'; }
function leftText(x) { return x.left == null ? '' : (x.left === 0 ? 'No places left' : x.left + ' place' + (x.left === 1 ? '' : 's') + ' left'); }

function paint() {
  if (!on()) return;
  var h = '<div class="dl-top"><div><h3 style="margin:0">Student deals at ' + esc(campusName()) + '</h3><p class="sub" style="margin:4px 0 0">Show your code at the counter and get the offer.</p></div>'
    + '<div style="display:flex;gap:8px"><button class="btn g" data-dl="mine">My deals</button><button class="btn p" data-dl="add">Post a deal</button></div></div>'
    + '<div class="dl-chips">' + ['All'].concat(CATS).map(function (c) { return chip('data-dlc', c, c, S.cat); }).join('') + '</div>';
  if (S.busy && !S.list.length) h += '<p class="sub" style="margin-top:14px">Loading...</p>';
  else if (S.err && !S.list.length) h += '<p class="sub" style="margin-top:14px">' + esc(S.err) + '</p><button class="btn g" data-dl="retry">Try again</button>';
  else if (!S.ready) h += '<article class="box g" style="margin-top:14px"><h3>Deals are coming soon</h3><p class="sub" style="margin-top:6px">This feature is not switched on yet. Check back soon.</p></article>';
  else if (!S.list.length) h += '<article class="box g" style="margin-top:14px"><h3>No deals here yet</h3><p class="sub" style="margin-top:6px">Own a food spot, salon or cyber cafe near campus? Post a student offer and comrades will come to you.</p></article>';
  else h += S.list.map(function (x) {
    var c = x.claim, lt = leftText(x);
    return '<article class="box g dl-card" data-dl="open" data-id="' + esc(x.id) + '" role="button" tabindex="0"><div class="dl-h"><p class="dl-biz">' + esc(x.business) + '</p><span class="dl-pill">' + esc(x.category) + '</span></div>'
      + '<p class="dl-t">' + esc(x.title) + '</p>'
      + '<div class="dl-meta">' + (x.place ? esc(x.place) + ' · ' : '') + esc(until(x.validUntil)) + (lt ? ' · ' + esc(lt) : '') + '</div>'
      + '<div class="dl-row">' + (x.mine ? '<span class="badge">Your deal</span>' : c && c.status === 'claimed' ? '<button class="btn p" data-dl="code" data-id="' + esc(x.id) + '">Show my code</button>'
        : c && c.status === 'redeemed' ? '<span class="badge">Used</span>' : c && c.status === 'expired' ? '<span class="badge">Code expired</span>'
        : x.left === 0 ? '<span class="badge">Fully claimed</span>' : '<button class="btn p" data-dl="claim" data-id="' + esc(x.id) + '">Get my code</button>') + '</div></article>';
  }).join('');
  body.innerHTML = h;
}
function load() {
  if (S.busy) return; S.busy = true; S.err = ''; paint();
  call('/api/deals' + (S.cat !== 'All' ? '?category=' + encodeURIComponent(S.cat) : ''), { auth: signedIn() ? undefined : false })
    .then(function (d) { S.list = d.items || []; S.fee = d.fee || 0; S.ready = d.ready !== false; S.loaded = true; })
    .catch(function (e) { S.err = e.message || 'Could not load. Check your connection.'; })
    .then(function () { S.busy = false; paint(); });
}
function show() {
  [].forEach.call(xt.querySelectorAll('.tab'), function (t) { t.classList.toggle('on', t.dataset.x === 'dl'); });
  paint(); load();
}
xt.addEventListener('click', function (e) {
  var t = e.target.closest && e.target.closest('.tab'); if (!t || t.dataset.x !== 'dl') return;
  e.stopPropagation(); e.preventDefault(); show();
}, true);

/* ---------- sheets: every one has a plain Close button, and the X from cc-closex.js taps it ---------- */
function sheet(html) {
  var ov = document.createElement('div'); ov.className = 'cxm'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = '<div class="box g dl-form">' + html + '</div>';
  ov.close = function () { ov.remove(); };
  ov.addEventListener('click', function (e) { if (e.target === ov) ov.close(); });
  document.body.appendChild(ov); return ov;
}
function q(ov, s) { return ov.querySelector(s); }

function codeSheet(x, code, expiresAt) {
  var ov = sheet('<h3 style="padding-right:44px">' + esc(x.business) + '</h3><p class="sub" style="margin:6px 0 0">' + esc(x.title) + '</p>'
    + '<div class="dl-code" aria-label="Your code">' + esc(code) + '</div>'
    + '<p class="dl-note" style="text-align:center">Show this code to the staff before you pay. It works once and runs out ' + esc(new Date(expiresAt).toLocaleString('en-KE', { weekday: 'short', hour: 'numeric', minute: '2-digit' })) + '.</p>'
    + '<div class="cxr"><button class="btn g" data-q>Close</button></div>');
  q(ov, '[data-q]').onclick = ov.close;
}
function claim(x, btn) {
  if (!signedIn()) return needSignIn('Sign in to get your code');
  if (btn) btn.disabled = true;
  call('/api/deals/' + x.id + '/claim', { body: {} })
    .then(function (r) { load(); codeSheet(x, r.code, r.expiresAt); })
    .catch(function (e) { if (btn) btn.disabled = false; say(e.message || 'Could not get your code'); });
}
function showCode(x) {
  call('/api/deals/' + x.id + '/claim', { body: {} }).then(function (r) { codeSheet(x, r.code, r.expiresAt); }).catch(function (e) { say(e.message); load(); });
}

function reportSheet(x) {
  if (!signedIn()) return needSignIn('Sign in to report');
  var why = ['Scam or fake', 'Wrong details', 'Did not honour the offer', 'Something else'];
  var ov = sheet('<h3 style="padding-right:44px">Report this deal</h3><p class="sub" style="margin:6px 0 0">An admin will look at it. Reports are anonymous.</p><div class="cxr" style="flex-direction:column">'
    + why.map(function (r) { return '<button class="btn g" data-r="' + esc(r) + '">' + esc(r) + '</button>'; }).join('') + '<button class="btn g" data-q>Cancel</button></div>');
  q(ov, '[data-q]').onclick = ov.close;
  ov.firstChild.addEventListener('click', function (e) {
    var b = e.target.closest('[data-r]'); if (!b) return; b.disabled = true;
    call('/api/report', { body: { type: 'deal', id: x.id, reason: b.dataset.r } }).then(function () { ov.close(); say('Thanks, we will check it'); }).catch(function (er) { b.disabled = false; say(er.message); });
  });
}

function detail(x) {
  var c = x.claim, lt = leftText(x);
  var ov = sheet('<p class="dl-biz" style="padding-right:44px">' + esc(x.business) + '</p><h3 style="margin:6px 0 0;overflow-wrap:anywhere">' + esc(x.title) + '</h3>'
    + (x.details ? '<p style="margin:12px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6">' + esc(x.details) + '</p>' : '')
    + '<div class="dl-meta">' + esc(x.category) + (x.place ? ' · ' + esc(x.place) : '') + '<br>Valid ' + esc(until(x.validUntil)) + (lt ? ' · ' + esc(lt) : '') + '</div>'
    + '<p class="dl-note">Hosted by the business, not by Comrade Connect. You pay the business directly. Tap Get my code, show it at the counter, and the staff confirm it.</p>'
    + '<div class="cxr">' + (x.mine ? '<button class="btn g" disabled>Your deal</button>' : c && c.status === 'claimed' ? '<button class="btn p" data-a="code">Show my code</button>'
      : c && c.status === 'redeemed' ? '<button class="btn g" disabled>You used this deal</button>' : c && c.status === 'expired' ? '<button class="btn g" disabled>Your code expired</button>'
      : x.left === 0 ? '<button class="btn g" disabled>Fully claimed</button>' : '<button class="btn p" data-a="claim">Get my code</button>')
    + '<button class="btn g" data-a="report">Report</button></div><div class="cxr"><button class="btn g" data-q>Close</button></div>');
  q(ov, '[data-q]').onclick = ov.close;
  ov.firstChild.addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'report') { ov.close(); reportSheet(x); } else if (b.dataset.a === 'claim') { ov.close(); claim(x); } else if (b.dataset.a === 'code') { ov.close(); showCode(x); }
  });
}

/* ---------- post a deal ---------- */
function addSheet() {
  if (!signedIn()) return needSignIn('Sign in to post a deal');
  var d = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), max = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10), min = new Date().toISOString().slice(0, 10);
  var ov = sheet('<h3 style="padding-right:44px">Post a student deal</h3>'
    + '<label for="dlb">Business name</label><input id="dlb" maxlength="60" placeholder="e.g. Mama Pima Eatery" autocomplete="off">'
    + '<label for="dlt">The offer</label><input id="dlt" maxlength="90" placeholder="e.g. 20% off every meal with your student ID" autocomplete="off">'
    + '<label for="dlc">Type of business</label><select id="dlc">' + CATS.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select>'
    + '<label for="dlp">Where? (landmark)</label><input id="dlp" maxlength="60" placeholder="Next to the main gate" autocomplete="off">'
    + '<label for="dlx">Details (optional)</label><textarea id="dlx" maxlength="300" placeholder="Days, hours, what is included"></textarea>'
    + '<label for="dlu">Last day of the offer</label><input id="dlu" type="date" value="' + d + '" min="' + min + '" max="' + max + '">'
    + '<label for="dlm">Places available (optional)</label><input id="dlm" inputmode="numeric" maxlength="4" placeholder="Leave empty for no limit">'
    + '<label for="dlw">Your WhatsApp number (for billing only, never shown)</label><input id="dlw" inputmode="tel" maxlength="14" placeholder="0712345678" autocomplete="tel">'
    + '<p class="dl-note">' + (S.fee ? 'When you confirm a comrade\'s code you owe <b>' + kes(S.fee) + '</b> for that redemption. We send you the monthly total on WhatsApp.' : 'Confirming comrades\' codes is free for now.') + ' An admin checks every deal before it goes live. No phone numbers or links in the offer text.</p>'
    + '<p class="dl-err" id="dle" role="alert" hidden></p><div class="cxr"><button class="btn p" id="dlg">Send for approval</button><button class="btn g" data-q>Cancel</button></div>');
  var err = function (t) { var n = q(ov, '#dle'); n.textContent = t || ''; n.hidden = !t; };
  q(ov, '[data-q]').onclick = ov.close;
  q(ov, '#dlg').onclick = function () {
    var b = this; err('');
    var biz = q(ov, '#dlb').value.trim(), title = q(ov, '#dlt').value.trim(), ph = q(ov, '#dlw').value.trim();
    if (biz.length < 2) return err('Enter the business name');
    if (title.length < 5) return err('Describe the offer');
    if (!/^(07|01)\d{8}$|^\+?254[17]\d{8}$/.test(ph.replace(/\s/g, ''))) return err('Enter your WhatsApp number, like 0712345678');
    b.disabled = true;
    call('/api/deals', { body: { business: biz, title: title, category: q(ov, '#dlc').value, place: q(ov, '#dlp').value.trim(), details: q(ov, '#dlx').value.trim(), valid_until: q(ov, '#dlu').value, max_claims: q(ov, '#dlm').value.trim(), billing_phone: ph } })
      .then(function () { ov.close(); say('Sent. We will tell you when it is live.'); })
      .catch(function (e) { b.disabled = false; err(e.message || 'Could not send'); });
  };
  setTimeout(function () { var n = q(ov, '#dlb'); if (n) n.focus(); }, 80);
}

/* ---------- my codes (comrades) and my deals (businesses) ---------- */
function mineSheet() {
  if (!signedIn()) return needSignIn('Sign in to see your deals');
  var ov = sheet('<h3 style="padding-right:44px">My deals</h3><div id="dlm-b"><p class="sub" style="margin-top:10px">Loading...</p></div><div class="cxr"><button class="btn g" data-q>Close</button></div>');
  q(ov, '[data-q]').onclick = ov.close;
  var box = q(ov, '#dlm-b');
  function draw(m) {
    var h = '';
    if (m.claims.length) h += '<p class="sub" style="margin:12px 0 0"><b>Codes I claimed</b></p>' + m.claims.map(function (c) {
      return '<div class="dl-mine"><b>' + esc(c.business) + '</b><div class="sub" style="margin-top:2px">' + esc(c.title) + '</div>'
        + (c.status === 'claimed' ? '<div class="dl-code" style="font-size:30px;margin:10px 0 2px">' + esc(c.code) + '</div><div class="dl-note" style="text-align:center;margin-top:0">Show this at the counter</div>' : '<div class="dl-meta">' + (c.status === 'redeemed' ? 'Used' : 'Expired') + '</div>') + '</div>';
    }).join('');
    if (m.deals.length) h += '<p class="sub" style="margin:14px 0 0"><b>Deals I posted</b></p>' + m.deals.map(function (d) {
      var live = d.status === 'approved';
      return '<div class="dl-mine"><b>' + esc(d.business) + '</b><div class="sub" style="margin-top:2px">' + esc(d.title) + '</div>'
        + '<div class="dl-meta">' + (d.status === 'pending' ? 'Waiting for approval' : d.status === 'rejected' ? 'Not approved' + (d.note ? ': ' + esc(d.note) : '') : d.status === 'ended' ? 'Ended' : 'Live ' + esc(until(d.validUntil)))
        + (live ? '<br>' + d.claimed + ' claimed · ' + d.redeemed + ' confirmed' + (m.fee ? ' · you owe ' + kes(d.redeemed * m.fee) + ' in total' : '') : '') + '</div>'
        + (live ? '<div class="fld" style="margin-top:10px"><input inputmode="numeric" maxlength="6" placeholder="Enter the comrade\'s 6-digit code" aria-label="Customer code" data-in="' + esc(d.id) + '"></div>'
          + '<div class="dl-row"><button class="btn p" data-conf="' + esc(d.id) + '">Confirm code</button><button class="btn g" data-end="' + esc(d.id) + '">End deal</button></div>'
          : '<div class="dl-row"><button class="btn g" data-rm="' + esc(d.id) + '">Remove</button></div>') + '</div>';
    }).join('');
    box.innerHTML = h || '<p class="sub" style="margin-top:10px">Nothing here yet. Claim a deal to get a code, or post a deal for your business.</p>';
  }
  function refresh() {
    call('/api/deals/mine').then(function (m) { if (m.ready === false) box.innerHTML = '<p class="sub" style="margin-top:10px">Deals are not switched on yet.</p>'; else draw(m); })
      .catch(function (e) { box.innerHTML = '<p class="sub" style="margin-top:10px">' + esc(e.message || 'Could not load') + '</p><button class="btn g" data-retry>Try again</button>'; });
  }
  box.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-retry')) return refresh();
    var id = b.dataset.conf || b.dataset.end || b.dataset.rm; if (!id) return;
    if (b.dataset.conf) {
      var inp = box.querySelector('[data-in="' + id + '"]'), code = inp ? inp.value.replace(/\D/g, '') : '';
      if (code.length !== 6) return say('Enter the 6-digit code');
      b.disabled = true;
      call('/api/deals/' + id + '/redeem', { body: { code: code } }).then(function () { say('Confirmed. Give the comrade their offer.'); refresh(); load(); }).catch(function (er) { b.disabled = false; say(er.message || 'Could not confirm'); });
    } else if (b.dataset.end) {
      if (!confirm('End this deal? Comrades will no longer be able to claim it.')) return;
      call('/api/deals/' + id + '/end', { body: {} }).then(function () { say('Deal ended'); refresh(); load(); }).catch(function (er) { say(er.message); });
    } else {
      if (!confirm('Remove this deal from your list?')) return;
      call('/api/deals/' + id + '/remove', { body: {} }).then(function () { refresh(); load(); }).catch(function (er) { say(er.message); });
    }
  });
  refresh();
}

body.addEventListener('click', function (e) {
  if (!on()) return;
  var c = e.target.closest('[data-dlc]'); if (c) { S.cat = c.dataset.dlc; load(); return; }
  var b = e.target.closest('[data-dl]'); if (!b) return; var a = b.dataset.dl, id = b.dataset.id;
  var x = S.list.filter(function (v) { return v.id === id; })[0];
  e.preventDefault();
  if (a === 'add') return addSheet();
  if (a === 'mine') return mineSheet();
  if (a === 'retry') return load();
  if (!x) return;
  if (a === 'claim') { e.stopPropagation(); return claim(x, b); }
  if (a === 'code') { e.stopPropagation(); return showCode(x); }
  if (a === 'open') return detail(x);
});
body.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-dl="open"]')) { e.preventDefault(); e.target.click(); } });
})();
