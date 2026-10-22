/* Explore > Events and Notices, made tappable.
   Events come from the server (comrades add them), each opens a sheet with buy ticket, add to calendar, share and report.
   Notices open a full-text sheet with save, share and report. Loaded after cc-events.js. */
(function () {
'use strict';
var body = document.getElementById('xbody'), tabs = document.getElementById('xt');
if (!body || !tabs) return;
var CCX = function () { return window.CC; };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var store = { get: function (k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
var signedIn = function () { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); };
var toast = function (t) { try { window.toast ? window.toast(t) : null; } catch (e) {} };
var EV = { list: [], at: 0, busy: false, err: '', cat: 'All' }, NC = { cat: 'All' };
var css = document.createElement('style');
css.textContent = '.cxe,.cxn{cursor:pointer}.cxe:active,.cxn:active{transform:scale(.99)}.cxc{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}'
  + '.cxm{position:fixed;inset:0;z-index:9999;background:rgba(14,15,11,.82);display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto}.cxm>.box{max-width:380px;width:100%;margin:auto}'
  + '.cxr{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.cxr>*{flex:1 1 120px}.cxl{margin:8px 0 0;font-size:14px;overflow-wrap:anywhere}.cxl small{opacity:.65;display:block;font-size:12px}';
document.head.appendChild(css);

function rel(d) { var n = Math.round((new Date(d + 'T00:00:00') - new Date(new Date().toDateString())) / 864e5); return n <= 0 ? 'Today' : n === 1 ? 'Tomorrow' : 'In ' + n + ' days'; }
function when(e) { var x = new Date(e.date + 'T00:00:00'); return x.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' }) + (e.time ? ' at ' + e.time : ''); }
function ago(n) { return n < 1 ? 'Today' : n + ' day' + (n > 1 ? 's' : '') + ' ago'; }

/* ---------- sheet ---------- */
function sheet(html) {
  var ov = document.createElement('div'); ov.className = 'cxm'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = '<div class="box g">' + html + '</div>';
  ov.close = function () { ov.remove(); };
  ov.addEventListener('click', function (e) { if (e.target === ov) ov.close(); });
  document.body.appendChild(ov); return ov;
}
function reportFlow(ov, type, id, back) {
  var box = ov.firstChild, reasons = ['Scam or fake', 'Wrong details', 'Inappropriate', 'Something else'];
  box.innerHTML = '<h3>Report this</h3><p class="sub" style="margin-top:6px">Tell us what is wrong. An admin will look at it. Reports are anonymous.</p><div class="cxr" style="flex-direction:column">'
    + reasons.map(function (r) { return '<button class="btn g" data-rs="' + esc(r) + '">' + esc(r) + '</button>'; }).join('') + '<button class="btn g" data-back>Back</button></div>';
  box.onclick = function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-back')) return back();
    b.disabled = true;
    CCX().call('/api/report', { body: { type: type, id: id, reason: b.dataset.rs } }).then(function () { ov.close(); toast('Thanks, we will check it'); })
      .catch(function (er) { b.disabled = false; toast(er.message || 'Could not send the report'); });
  };
}
function shareText(title, text) {
  if (navigator.share) return navigator.share({ title: title, text: text, url: (window.ccOrigin?window.ccOrigin():location.origin) }).catch(function () {});
  var t = text + ' ' + (window.ccOrigin?window.ccOrigin():location.origin); if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast('Copied'); }); return Promise.resolve();
}

/* ---------- calendar file ---------- */
function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function loc(x) { return x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()) + 'T' + pad(x.getHours()) + pad(x.getMinutes()) + '00'; }
function makeIcs(e) {
  var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Comrade Connect//EN', 'BEGIN:VEVENT', 'UID:' + e.id + '@comradeconnect', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'];
  if (e.time) { var s = new Date(e.date + 'T' + e.time + ':00'); L.push('DTSTART:' + loc(s), 'DTEND:' + loc(new Date(s.getTime() + 3 * 36e5))); }
  else { var n = new Date(e.date + 'T00:00:00'); n.setDate(n.getDate() + 1); L.push('DTSTART;VALUE=DATE:' + e.date.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + n.getFullYear() + pad(n.getMonth() + 1) + pad(n.getDate())); }
  L.push('SUMMARY:' + icsEsc(e.title), 'LOCATION:' + icsEsc(e.venue), 'DESCRIPTION:' + icsEsc(e.details), 'END:VEVENT', 'END:VCALENDAR');
  return L.join('\r\n');
}
function addToCalendar(e) {
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([makeIcs(e)], { type: 'text/calendar' })); a.download = 'event-' + e.id.slice(0, 8) + '.ics';
  document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); URL.revokeObjectURL(a.href); }, 500); toast('Calendar file ready, open it to add the event');
}

/* ---------- events ---------- */
function loadEvents(force) {
  if (EV.busy || (!force && Date.now() - EV.at < 45000)) return;
  EV.busy = true;
  CCX().call('/api/events', { auth: false }).then(function (d) { EV.list = d.events || []; EV.err = ''; EV.at = Date.now(); })
    .catch(function (e) { EV.err = e.message || 'Could not load events'; })
    .then(function () { EV.busy = false; if (tab() === 'ev') paint(); });
}
function evHtml() {
  var cats = ['All'].concat(EV.list.map(function (e) { return e.category || 'Other'; }).filter(function (c, i, a) { return a.indexOf(c) === i; }));
  if (EV.list.some(function (e) { return !e.ticket_price; })) cats.push('Free');
  if (cats.indexOf(EV.cat) < 0) EV.cat = 'All';
  var shown = EV.list.filter(function (e) { return EV.cat === 'All' || (EV.cat === 'Free' ? !e.ticket_price : (e.category || 'Other') === EV.cat); });
  return '<p class="sub">Upcoming campus events. Tap one for details, tickets and your calendar.</p>'
    + '<div class="cxr" style="margin:0"><button class="btn p" data-xadd>Add an event</button><button class="btn g" data-xmine>My events</button></div>'
    + (cats.length > 2 ? '<div class="tabs z" style="padding:0;margin-top:4px">' + cats.map(function (c) { return '<button class="tab g' + (c === EV.cat ? ' on' : '') + '" data-xc="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' : '')
    + (EV.err && !EV.list.length ? '<p class="sub" style="margin-top:14px">' + esc(EV.err) + '</p><button class="btn g" data-xretry>Try again</button>'
      : !EV.at && !EV.list.length ? '<p class="sub" style="margin-top:14px">Loading events...</p>'
      : !shown.length ? '<p class="sub" style="margin-top:14px">No events here yet. Be the first to add one.</p>'
      : shown.map(function (e) {
        var going = store.get('cc_er').indexOf(e.id) >= 0;
        return '<article class="box g cxe" data-xe="' + esc(e.id) + '" role="button" tabindex="0"><div class="flex items-center justify-between" style="gap:8px"><span><span class="badge">' + rel(e.date) + '</span><span class="badge" style="margin-left:6px">' + esc(e.category || 'Other') + '</span></span><span class="badge">' + (e.ticket_price ? 'KSh ' + e.ticket_price : 'Free') + '</span></div>'
          + '<p style="margin:12px 0 4px;font-weight:600;overflow-wrap:anywhere">' + esc(e.title) + '</p>'
          + '<p class="sub" style="margin:0">' + esc(when(e)) + (e.venue ? '<br>' + esc(e.venue) : '') + (e.left != null && e.left > 0 && e.left <= 20 ? '<br>' + e.left + ' tickets left' : '') + (e.ticket_price && e.left === 0 ? '<br>Sold out' : '') + (going ? '<br>You are going' : '') + '</p></article>';
      }).join(''));
}
function openEvent(e) {
  var going = store.get('cc_er').indexOf(e.id) >= 0, soldOut = e.ticket_price && e.left === 0;
  var ov = sheet('<div class="flex items-center justify-between" style="gap:8px;padding-right:44px"><span><span class="badge">' + rel(e.date) + '</span><span class="badge" style="margin-left:6px">' + esc(e.category || 'Other') + '</span></span></div>'
    + '<h3 style="margin:12px 0 0;overflow-wrap:anywhere">' + esc(e.title) + '</h3>'
    + '<p class="cxl"><small>When</small>' + esc(when(e)) + '</p>'
    + (e.venue ? '<p class="cxl"><small>Where</small>' + esc(e.venue) + '</p>' : '')
    + (e.organizer ? '<p class="cxl"><small>Hosted by</small>' + esc(e.organizer) + '</p>' : '')
    + '<p class="cxl"><small>Entry</small>' + (e.ticket_price ? 'KSh ' + e.ticket_price + ' per ticket' + (e.left != null ? ', ' + e.left + ' left' : '') : 'Free, no ticket needed') + '</p>'
    + (e.details ? '<p class="cxl" style="white-space:pre-wrap"><small>Details</small>' + esc(e.details) + '</p>' : '')
    + (e.hosted ? '<p class="note" style="margin-top:12px;font-size:13px;opacity:.8">Hosted by a comrade, not by Comrade Connect. Pay only through the app and report anything that looks wrong.</p>' : '')
    + '<div class="cxr">' + (e.ticket_price ? (soldOut ? '<button class="btn g" disabled>Sold out</button>' : '<button class="btn p" data-buy style="flex-basis:100%">Buy a ticket, KSh ' + e.ticket_price + '</button>') : '<button class="btn p" data-going style="flex-basis:100%">' + (going ? 'Going. Tap to undo' : 'I am going') + '</button>')
    + '<button class="btn g" data-cal>Add to calendar</button><button class="btn g" data-share>Share</button></div>'
    + '<div class="cxr"><button class="btn g" data-report>Report</button><button class="btn g" data-close>Close</button></div>');
  ov.firstChild.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-close')) ov.close();
    else if (b.hasAttribute('data-cal')) addToCalendar(e);
    else if (b.hasAttribute('data-share')) shareText(e.title, e.title + ', ' + when(e) + (e.venue ? ' at ' + e.venue : '') + '.');
    else if (b.hasAttribute('data-going')) { var g = store.get('cc_er'), i = g.indexOf(e.id); i >= 0 ? g.splice(i, 1) : g.push(e.id); store.set('cc_er', g); b.textContent = i >= 0 ? 'I am going' : 'Going. Tap to undo'; paint(); }
    else if (b.hasAttribute('data-report')) { if (!signedIn()) { CCX().needSignup('report an event'); return; } reportFlow(ov, 'event', e.id, function () { ov.close(); openEvent(e); }); }
    else if (b.hasAttribute('data-buy')) {
      if (!signedIn()) { ov.close(); CCX().needSignup('buy a ticket'); return; }
      ov.close();
      CCX().payNow({ title: e.title, unit: e.ticket_price, note: when(e) + (e.venue ? ', ' + e.venue : ''), done: 'Your ticket and its QR code are in the Club, under Tickets.',
        start: function (phone) { return CCX().call('/api/tickets/buy', { body: { event_id: e.id, phone: phone } }); }, after: function () { loadEvents(true); return Promise.resolve(); } });
    }
  });
}

/* ---------- notices ---------- */
function ntHtml() {
  var NT = window.ccNT || [], cats = ['All'].concat(NT.map(function (n) { return n.c || 'General'; }).filter(function (c, i, a) { return a.indexOf(c) === i; }));
  if (cats.indexOf(NC.cat) < 0) NC.cat = 'All';
  var saved = store.get('cc_ns');
  return '<p class="sub">Campus notices in one place. Nothing is posted here until an admin verifies it. Tap a notice to read it all.</p>'
    + (cats.length > 2 ? '<div class="tabs z" style="padding:0">' + cats.map(function (c) { return '<button class="tab g' + (c === NC.cat ? ' on' : '') + '" data-xnc="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' : '')
    + (!NT.length ? '<p class="sub" style="margin-top:14px">No notices yet.</p>' : NT.filter(function (n) { return NC.cat === 'All' || (n.c || 'General') === NC.cat; }).map(function (n) {
      return '<article class="box g cxn" data-xn="' + esc(n.id) + '" role="button" tabindex="0"><span><span class="badge">' + (n.p ? 'Pinned' : 'Verified') + '</span><span class="badge" style="margin-left:6px">' + esc(n.c || 'General') + '</span></span>'
        + '<p style="margin:12px 0 4px;font-weight:600;overflow-wrap:anywhere">' + esc(n.t) + '</p><p class="sub cxc" style="margin:0 0 12px">' + esc(n.b) + '</p>'
        + '<div class="bar"><span class="views">' + ago(n.a) + '</span><span class="views">' + (saved.indexOf(n.id) >= 0 ? 'Saved' : 'Read more') + '</span></div></article>';
    }).join(''));
}
function openNotice(n) {
  var saved = function () { return store.get('cc_ns').indexOf(n.id) >= 0; };
  var ov = sheet('<div style="padding-right:44px"><span class="badge">' + (n.p ? 'Pinned' : 'Verified') + '</span><span class="badge" style="margin-left:6px">' + esc(n.c || 'General') + '</span></div>'
    + '<h3 style="margin:12px 0 0;overflow-wrap:anywhere">' + esc(n.t) + '</h3><p class="sub" style="margin:4px 0 0">Posted ' + ago(n.a).toLowerCase() + '</p>'
    + '<p style="margin:14px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6">' + esc(n.b) + '</p>'
    + '<div class="cxr"><button class="btn p" data-save>' + (saved() ? 'Saved. Tap to remove' : 'Save') + '</button><button class="btn g" data-share>Share</button></div>'
    + '<div class="cxr"><button class="btn g" data-report>Report a problem</button><button class="btn g" data-close>Close</button></div>');
  ov.firstChild.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-close')) ov.close();
    else if (b.hasAttribute('data-share')) shareText(n.t, n.t + ': ' + String(n.b || '').slice(0, 140));
    else if (b.hasAttribute('data-save')) { var s = store.get('cc_ns'), i = s.indexOf(n.id); i >= 0 ? s.splice(i, 1) : s.push(n.id); store.set('cc_ns', s); b.textContent = i >= 0 ? 'Save' : 'Saved. Tap to remove'; paint(); }
    else if (b.hasAttribute('data-report')) { if (!signedIn()) { CCX().needSignup('report a notice'); return; } reportFlow(ov, 'notice', n.id, function () { ov.close(); openNotice(n); }); }
  });
}

/* ---------- take over the Events and Notices tabs ---------- */
var busy = false, obs;
function tab() { var t = tabs.querySelector('.tab.on'); return t ? t.dataset.x : ''; }
function paint() {
  var t = tab(); if (t !== 'ev' && t !== 'nt') return;
  busy = true; body.innerHTML = t === 'ev' ? evHtml() : ntHtml(); if (obs) obs.takeRecords(); busy = false;
  if (t === 'ev') loadEvents(false);
}
obs = new MutationObserver(function () { if (!busy) paint(); });
obs.observe(body, { childList: true });
body.addEventListener('click', function (e) {
  var t = e.target.closest('[data-xe],[data-xn],[data-xadd],[data-xmine],[data-xc],[data-xnc],[data-xretry]'); if (!t) return;
  if (t.hasAttribute('data-xe')) { var ev = EV.list.filter(function (x) { return x.id === t.dataset.xe; })[0]; if (ev) openEvent(ev); }
  else if (t.hasAttribute('data-xn')) { var n = (window.ccNT || []).filter(function (x) { return String(x.id) === t.dataset.xn; })[0]; if (n) openNotice(n); }
  else if (t.hasAttribute('data-xadd')) { if (window.ccEvents) window.ccEvents.create(); }
  else if (t.hasAttribute('data-xmine')) { if (window.ccEvents) window.ccEvents.mine(); }
  else if (t.hasAttribute('data-xc')) { EV.cat = t.dataset.xc; paint(); }
  else if (t.hasAttribute('data-xnc')) { NC.cat = t.dataset.xnc; paint(); }
  else if (t.hasAttribute('data-xretry')) { EV.err = ''; loadEvents(true); }
});
body.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-xe],[data-xn]')) { e.preventDefault(); e.target.click(); } });
document.addEventListener('cc:events-changed', function () { EV.at = 0; loadEvents(true); });
tabs.addEventListener('click', function () { setTimeout(paint, 0); });
paint();
})();
