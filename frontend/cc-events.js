/* Host an event: signed-in comrades create an event, sell tickets, and get a secret door-scan link.
   All text is inserted with textContent, never as HTML. */
(function () {
'use strict';
var CCX = function () { return window.CC; };
var st = document.createElement('style');
st.textContent = '.cchips{display:flex;gap:6px;flex-wrap:wrap}.cchc{all:unset;box-sizing:border-box;cursor:pointer;padding:8px 14px;border-radius:999px;font-size:13px;border:1px solid var(--line,rgba(255,255,255,.2));color:var(--fg,#fff)}.cchc.on{background:var(--fg,#fff);color:var(--bg,#0E0F0B)}.cchr2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cchr2>div,.cchr2 input{min-width:0}' + '.cchost{margin:0 0 14px}.cchost .row,.cchm .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}'
  + '.cchb{all:unset;box-sizing:border-box;cursor:pointer;padding:12px 16px;border-radius:14px;font-size:14px;font-weight:700;text-align:center;border:1px solid var(--line,rgba(255,255,255,.2));color:var(--fg,#fff)}'
  + '.cchb.p{background:var(--fg,#fff);color:var(--bg,#0E0F0B)}.cchb:disabled{opacity:.5}'
  + '.cchm{position:fixed;inset:0;z-index:9999;background:rgba(14,15,11,.82);display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow:auto}'
  + '.cchm>div{max-width:380px;width:100%;margin:auto}.cchm label{display:block;font-size:13px;opacity:.75;margin:12px 0 4px}'
  + '.cchm input,.cchm textarea{width:100%;box-sizing:border-box;padding:12px;border-radius:12px;border:1px solid var(--line,rgba(255,255,255,.2));background:transparent;color:inherit;font:inherit}'
  + '.cchev{border:1px solid var(--line,rgba(255,255,255,.14));border-radius:16px;padding:14px;margin-top:10px}.cchev b{display:block}.cchev small{opacity:.7}'
  + '.cchn{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:10000;background:var(--bg,#0E0F0B);color:var(--fg,#fff);border:1px solid var(--gb,rgba(255,255,255,.16));padding:10px 16px;border-radius:99px;font-size:14px;max-width:90%}';
document.head.appendChild(st);

function h(tag, attrs, kids) {
  var e = document.createElement(tag);
  Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); });
  (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
  return e;
}
function note(t) { var n = h('div', { class: 'cchn', text: t }); document.body.appendChild(n); setTimeout(function () { n.remove(); }, 3500); }
function signedIn() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
function full(p) { return (window.ccOrigin?window.ccOrigin():location.origin) + p; }
function copy(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(function () { note('Link copied'); }, function () { note(t); });
  note(t); return Promise.resolve();
}
function modal(title) {
  var box = h('div', { class: 'box g' }), wrap = h('div', { class: 'cchm' }, [box]);
  box.appendChild(h('h3', { text: title, style: 'margin:0 0 4px' }));
  wrap.close = function () { wrap.remove(); };
  wrap.addEventListener('click', function (e) { if (e.target === wrap) wrap.close(); });
  document.body.appendChild(wrap); return { wrap: wrap, box: box };
}
function field(box, label, attrs, tag) { var id = 'cch' + Math.random().toString(36).slice(2, 8), i = h(tag || 'input', Object.assign({ id: id }, attrs || {})); box.appendChild(h('label', { 'for': id, text: label })); box.appendChild(i); return i; }

function shareLink(box, path, title) {
  box.appendChild(h('p', { text: 'Door scan link. Give it only to the people working your entrance. They open it on any phone, type the 8-digit code from each guest\u2019s ticket, and it marks the ticket used.', style: 'font-size:14px;opacity:.85' }));
  box.appendChild(h('input', { readonly: 'readonly', value: full(path), 'aria-label': 'Door scan link' }));
  var row = h('div', { class: 'row' });
  var c = h('button', { class: 'cchb p', type: 'button', text: 'Copy link' }); c.onclick = function () { copy(full(path)); };
  row.appendChild(c);
  if (navigator.share) { var s = h('button', { class: 'cchb', type: 'button', text: 'Share' }); s.onclick = function () { navigator.share({ title: 'Door scanner: ' + title, url: full(path) }).catch(function () {}); }; row.appendChild(s); }
  var o = h('a', { class: 'cchb', href: path, target: '_blank', rel: 'noopener', text: 'Open scanner' }); row.appendChild(o);
  box.appendChild(row);
}

function createForm() {
  if (!signedIn()) { if (CCX() && CCX().needSignup) CCX().needSignup('add an event'); return; }
  var CATS = ['Party', 'Music', 'Sports', 'Academic', 'Club', 'Faith', 'Other'], cat = 'Party', paid = false;
  var m = modal('Add an event');
  m.box.appendChild(h('p', { text: 'Free or paid, a party or a study meet-up. It shows under Explore > Events for every comrade.', style: 'font-size:14px;opacity:.85;margin:4px 0 0' }));
  var title = field(m.box, 'Event name', { maxlength: '100', placeholder: 'e.g. Friday Night Pool Party' });
  m.box.appendChild(h('label', { text: 'Category' }));
  var chips = h('div', { class: 'cchips' });
  CATS.forEach(function (c) { var b = h('button', { type: 'button', class: 'cchc' + (c === cat ? ' on' : ''), text: c }); b.onclick = function () { cat = c; [].forEach.call(chips.children, function (x) { x.classList.toggle('on', x.textContent === c); }); }; chips.appendChild(b); });
  m.box.appendChild(chips);
  var today = new Date().toISOString().slice(0, 10), two = h('div', { class: 'cchr2' }), dw = h('div'), tw = h('div');
  var date = field(dw, 'Date', { type: 'date', min: today, value: today }), time = field(tw, 'Starts at', { type: 'time', value: '18:00' });
  two.appendChild(dw); two.appendChild(tw); m.box.appendChild(two);
  var venue = field(m.box, 'Venue', { maxlength: '80', placeholder: 'e.g. Kutus Gardens' });
  m.box.appendChild(h('label', { text: 'Entry' }));
  var seg = h('div', { class: 'cchips' }), fb = h('button', { type: 'button', class: 'cchc on', text: 'Free' }), pb = h('button', { type: 'button', class: 'cchc', text: 'Paid tickets' });
  seg.appendChild(fb); seg.appendChild(pb); m.box.appendChild(seg);
  var pw = h('div'); pw.style.display = 'none';
  var price = field(pw, 'Ticket price (KSh)', { type: 'number', inputmode: 'numeric', min: '1', max: '20000', placeholder: '300' });
  var cap = field(pw, 'Maximum guests (optional)', { type: 'number', inputmode: 'numeric', min: '1', max: '5000', placeholder: 'Leave empty for no limit' });
  pw.appendChild(h('p', { text: 'Tickets are sold in the app and checked at the door with a private scan link. You keep the price minus the platform fee, paid into your wallet.', style: 'font-size:13px;opacity:.75;margin:8px 0 0' }));
  m.box.appendChild(pw);
  function setPaid(v) { paid = v; fb.classList.toggle('on', !v); pb.classList.toggle('on', v); pw.style.display = v ? '' : 'none'; }
  fb.onclick = function () { setPaid(false); }; pb.onclick = function () { setPaid(true); };
  var det = field(m.box, 'Details (no phone numbers or links)', { maxlength: '400', rows: '3', placeholder: 'Dress code, who is playing, what to bring...' }, 'textarea');
  var row = h('div', { class: 'row' }), go = h('button', { class: 'cchb p', type: 'button', text: 'Add event' }), x = h('button', { class: 'cchb', type: 'button', text: 'Cancel' });
  x.onclick = function () { m.wrap.close(); };
  go.onclick = function () {
    go.disabled = true;
    CCX().call('/api/my/events', { body: { title: title.value, category: cat, date: date.value, time: time.value, venue: venue.value, ticket_price: paid ? price.value : '', capacity: paid ? cap.value : '', details: det.value } })
      .then(function (d) {
        document.dispatchEvent(new CustomEvent('cc:events-changed'));
        m.box.textContent = ''; m.box.appendChild(h('h3', { text: 'Your event is live', style: 'margin:0 0 4px' }));
        m.box.appendChild(h('p', { text: d.free ? 'Comrades can see it now under Explore > Events.' : 'Comrades can see it now and buy tickets under Explore > Events.', style: 'font-size:14px;opacity:.85' }));
        if (d.scan_path) shareLink(m.box, d.scan_path, title.value);
        var done = h('button', { class: 'cchb', type: 'button', text: 'Done', style: 'margin-top:12px;width:100%' }); done.onclick = function () { m.wrap.close(); }; m.box.appendChild(done);
      }).catch(function (e) { note(e.message || 'Could not add the event'); go.disabled = false; });
  };
  row.appendChild(go); row.appendChild(x); m.box.appendChild(row);
}

function myEvents() {
  if (!signedIn()) { if (CCX() && CCX().needSignup) CCX().needSignup('see your events'); return; }
  var m = modal('My events'), list = h('div'); m.box.appendChild(list);
  list.appendChild(h('p', { text: 'Loading...', style: 'opacity:.7' }));
  var close = h('button', { class: 'cchb', type: 'button', text: 'Close', style: 'margin-top:14px;width:100%' }); close.onclick = function () { m.wrap.close(); }; m.box.appendChild(close);
  CCX().call('/api/my/events').then(function (d) {
    list.textContent = '';
    if (!d.events.length) { list.appendChild(h('p', { text: 'You have not hosted an event yet.', style: 'opacity:.7' })); return; }
    d.events.forEach(function (e) {
      var card = h('div', { class: 'cchev' }, [
        h('b', { text: e.title + (e.hidden ? ' (cancelled)' : '') }),
        h('small', { text: e.date + (e.time ? ' ' + e.time : '') + ' \u00b7 ' + (e.venue || '') + ' \u00b7 ' + (e.ticket_price ? 'KSh ' + e.ticket_price : 'Free') }),
        h('div', { text: !e.ticket_price ? 'Free event, no tickets to sell' : e.sold + (e.capacity ? ' / ' + e.capacity : '') + ' tickets sold \u00b7 ' + e.scanned + ' checked in \u00b7 you earn KSh ' + e.you_earn, style: 'font-size:14px;margin-top:6px' })
      ]);
      if (!e.hidden) {
        var row = h('div', { class: 'row' });
        if (e.scan_path) {
          var cp = h('button', { class: 'cchb p', type: 'button', text: 'Copy door link' }); cp.onclick = function () { copy(full(e.scan_path)); };
          var op = h('a', { class: 'cchb', href: e.scan_path, target: '_blank', rel: 'noopener', text: 'Open scanner' });
          row.appendChild(cp); row.appendChild(op);
        }
        if (!e.sold) { var cx = h('button', { class: 'cchb', type: 'button', text: 'Cancel event' }); cx.onclick = function () { if (!confirm('Cancel this event?')) return; CCX().call('/api/my/events/' + e.id + '/cancel', { body: {} }).then(function () { note('Event cancelled'); m.wrap.close(); }).catch(function (er) { note(er.message); }); }; row.appendChild(cx); }
        card.appendChild(row);
      }
      list.appendChild(card);
    });
  }).catch(function (e) { list.textContent = ''; list.appendChild(h('p', { text: e.message || 'Could not load your events' })); });
}

var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
// "My tickets" card: the QR holds only the 8-digit code (digits made by our server), so it is safe to draw as SVG.
window.ccTk = {
  bar: function () { return ''; },
  card: function (t) {
    var badge = t.status === 'valid' ? 'Valid' : t.status === 'used' ? 'Used' : 'Cancelled', digits = String(t.code || '').replace(/\D/g, ''), qr = '';
    if (t.status === 'valid' && digits.length === 8 && window.ccQR) { try { qr = '<div style="background:#fff;border-radius:14px;padding:6px;display:inline-block;margin-top:12px">' + window.ccQR.svg(digits, 170) + '</div>'; } catch (e) { qr = ''; } }
    return '<div class="box g" style="margin-top:12px"><div class="flex items-center justify-between"><b>' + esc(t.event || 'Event') + '</b><span class="badge">' + badge + '</span></div>'
      + '<p class="sub" style="margin:6px 0 0">' + esc(t.date || '') + (t.venue ? ', ' + esc(t.venue) : '') + '</p>'
      + (t.status === 'valid' && digits.length === 8 ? qr + '<p style="font-size:26px;letter-spacing:.12em;font-weight:700;margin:10px 0 4px">' + esc(digits.slice(0, 4) + ' ' + digits.slice(4)) + '</p><p class="note" style="margin:0">Show this at the door. Do not share it. It works once.</p>' : '') + '</div>';
  }
};

function mount() {
  var host = document.getElementById('ccart');
  if (!host || host.querySelector('.cchost')) return;
  var card = h('div', { class: 'box g cchost' }, [
    h('b', { text: 'Hosting something?' }),
    h('div', { text: 'Create your event, sell tickets here and check guests in at the door with a scan link.', style: 'font-size:14px;opacity:.8;margin-top:2px' }),
    (function () {
      var r = h('div', { class: 'row' }), a = h('button', { class: 'cchb p', type: 'button', text: 'Host an event' }), b = h('button', { class: 'cchb', type: 'button', text: 'My events' });
      a.onclick = createForm; b.onclick = myEvents; r.appendChild(a); r.appendChild(b); return r;
    })()
  ]);
  host.insertBefore(card, host.firstChild);
}
window.ccEvents = { create: createForm, mine: myEvents };
setInterval(mount, 700);
})();
