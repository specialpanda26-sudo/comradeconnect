/* Host an event: signed-in comrades create an event, sell tickets, and get a secret door-scan link.
   All text is inserted with textContent, never as HTML. */
(function () {
'use strict';
var CCX = function () { return window.CC; };
var st = document.createElement('style');
st.textContent = '.cchost{margin:0 0 14px}.cchost .row,.cchm .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}'
  + '.cchb{all:unset;box-sizing:border-box;cursor:pointer;padding:12px 16px;border-radius:14px;font-size:14px;font-weight:700;text-align:center;border:1px solid var(--line,rgba(255,255,255,.2));color:var(--fg,#fff)}'
  + '.cchb.p{background:var(--fg,#fff);color:var(--bg,#000)}.cchb:disabled{opacity:.5}'
  + '.cchm{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.82);display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow:auto}'
  + '.cchm>div{max-width:380px;width:100%;margin:auto}.cchm label{display:block;font-size:13px;opacity:.75;margin:12px 0 4px}'
  + '.cchm input,.cchm textarea{width:100%;box-sizing:border-box;padding:12px;border-radius:12px;border:1px solid var(--line,rgba(255,255,255,.2));background:transparent;color:inherit;font:inherit}'
  + '.cchev{border:1px solid var(--line,rgba(255,255,255,.14));border-radius:16px;padding:14px;margin-top:10px}.cchev b{display:block}.cchev small{opacity:.7}'
  + '.cchn{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:10000;background:#111;color:#fff;padding:10px 16px;border-radius:12px;font-size:14px;max-width:90%}';
document.head.appendChild(st);

function h(tag, attrs, kids) {
  var e = document.createElement(tag);
  Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); });
  (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
  return e;
}
function note(t) { var n = h('div', { class: 'cchn', text: t }); document.body.appendChild(n); setTimeout(function () { n.remove(); }, 3500); }
function signedIn() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
function full(p) { return location.origin + p; }
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
  if (!signedIn()) { if (CCX() && CCX().needSignup) CCX().needSignup('host an event'); return; }
  var m = modal('Host an event');
  m.box.appendChild(h('p', { text: 'Throwing a party or show? List it here, sell tickets in the app, and check guests in at the door. You keep the ticket price minus the platform fee, paid into your wallet.', style: 'font-size:14px;opacity:.85;margin:4px 0 0' }));
  var title = field(m.box, 'Event name', { maxlength: '100', placeholder: 'e.g. Friday Night Pool Party' });
  var today = new Date().toISOString().slice(0, 10);
  var date = field(m.box, 'Date', { type: 'date', min: today, value: today });
  var venue = field(m.box, 'Venue', { maxlength: '80', placeholder: 'e.g. Kutus Gardens' });
  var price = field(m.box, 'Ticket price (KSh)', { type: 'number', inputmode: 'numeric', min: '1', max: '20000', placeholder: '300' });
  var cap = field(m.box, 'Maximum guests (optional)', { type: 'number', inputmode: 'numeric', min: '1', max: '5000', placeholder: 'Leave empty for no limit' });
  var det = field(m.box, 'Details (no phone numbers or links)', { maxlength: '400', rows: '3', placeholder: 'Time, dress code, who is playing...' }, 'textarea');
  var row = h('div', { class: 'row' }), go = h('button', { class: 'cchb p', type: 'button', text: 'Create event' }), x = h('button', { class: 'cchb', type: 'button', text: 'Cancel' });
  x.onclick = function () { m.wrap.close(); };
  go.onclick = function () {
    go.disabled = true;
    CCX().call('/api/my/events', { body: { title: title.value, date: date.value, venue: venue.value, ticket_price: price.value, capacity: cap.value, details: det.value } })
      .then(function (d) {
        m.box.textContent = ''; m.box.appendChild(h('h3', { text: 'Your event is live', style: 'margin:0 0 4px' }));
        m.box.appendChild(h('p', { text: 'Comrades can now buy tickets from the Tickets tab.', style: 'font-size:14px;opacity:.85' }));
        shareLink(m.box, d.scan_path, title.value);
        var done = h('button', { class: 'cchb', type: 'button', text: 'Done', style: 'margin-top:12px;width:100%' }); done.onclick = function () { m.wrap.close(); }; m.box.appendChild(done);
      }).catch(function (e) { note(e.message || 'Could not create the event'); go.disabled = false; });
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
        h('small', { text: e.date + ' \u00b7 ' + (e.venue || '') + ' \u00b7 KSh ' + e.ticket_price }),
        h('div', { text: e.sold + (e.capacity ? ' / ' + e.capacity : '') + ' tickets sold \u00b7 ' + e.scanned + ' checked in \u00b7 you earn KSh ' + e.you_earn, style: 'font-size:14px;margin-top:6px' })
      ]);
      if (!e.hidden) {
        var row = h('div', { class: 'row' });
        var cp = h('button', { class: 'cchb p', type: 'button', text: 'Copy door link' }); cp.onclick = function () { copy(full(e.scan_path)); };
        var op = h('a', { class: 'cchb', href: e.scan_path, target: '_blank', rel: 'noopener', text: 'Open scanner' });
        row.appendChild(cp); row.appendChild(op);
        if (!e.sold) { var cx = h('button', { class: 'cchb', type: 'button', text: 'Cancel event' }); cx.onclick = function () { if (!confirm('Cancel this event?')) return; CCX().call('/api/my/events/' + e.id + '/cancel', { body: {} }).then(function () { note('Event cancelled'); m.wrap.close(); }).catch(function (er) { note(er.message); }); }; row.appendChild(cx); }
        card.appendChild(row);
      }
      list.appendChild(card);
    });
  }).catch(function (e) { list.textContent = ''; list.appendChild(h('p', { text: e.message || 'Could not load your events' })); });
}

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
setInterval(mount, 700);
})();
