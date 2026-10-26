/* cc-care.js v1: "Request a review".
   Whenever a toast error shows (#toast), or a call to the API fails (status 400 or more, except 401), a small pill appears for 8 seconds.
   Tap it, add an optional note (and the M-Pesa number if the call was a withdrawal), and it goes to the admin panel: POST /api/support/report. */
(function () {
  'use strict';
  if (window.__ccCare) return; window.__ccCare = 1;
  var API = typeof CC_API === 'string' ? CC_API.replace(/\/$/, '') : '';
  if (!API) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var ERR = /could not|couldn't|cannot|can't|failed|error|went wrong|not reach|try again|not allowed|too many|did not|didn't|unable|invalid|not switched on|not set up|expired|denied|check your|not ready/i;
  var fail = null, cur = null, pill = null, hideT = 0, sheetEl = null, ownT = 0, lastTxt = '', lastAt = 0;
  var X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var say = function (m) { ownT = Date.now(); try { toast(m); } catch (e) {} };

  /* remember the last failed call to our API */
  var of = window.fetch;
  window.fetch = function (u, o) {
    var p = of.apply(this, arguments);
    try {
      var url = typeof u === 'string' ? u : (u && u.url) || '';
      if (url.indexOf(API) === 0) {
        var path = url.slice(API.length).split('?')[0], method = String((o && o.method) || (u && u.method) || 'GET').toUpperCase();
        p.then(function (r) { if (r && r.status >= 400 && r.status !== 401) note(path, method, r.status, r); }, function () {});
      }
    } catch (e) {}
    return p;
  };
  function note(path, method, status, resp) {
    if (path.indexOf('/api/support/') === 0 || path === '/api/me/phone') return;
    var f = { path: path, method: method, status: status, msg: '', at: Date.now() };
    fail = f;
    try { resp.clone().json().then(function (d) { if (d && d.error) f.msg = String(d.error); }, function () {}); } catch (e) {}
    if (method !== 'GET') show(f, '');          // a failed read only counts when a toast follows it (see onToast)
  }

  /* error toasts */
  function onToast() {
    var t = $('#toast'); if (!t) return;
    var txt = (t.textContent || '').trim(); if (!txt || !t.classList.contains('on')) return;
    if (Date.now() - ownT < 900) return;
    if (txt === lastTxt && Date.now() - lastAt < 400) return;
    lastTxt = txt; lastAt = Date.now();
    var recent = fail && Date.now() - fail.at < 3000;
    if (recent || ERR.test(txt)) show(recent ? fail : null, txt);
  }
  function watch() {
    var t = $('#toast'); if (!t) return false;
    new MutationObserver(onToast).observe(t, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return true;
  }
  if (!watch()) document.addEventListener('DOMContentLoaded', watch);

  /* the pill */
  function show(f, text) {
    if (sheetEl) return;
    cur = { f: f, text: text || (f && f.msg) || '' };
    if (!pill) {
      pill = document.createElement('button'); pill.type = 'button'; pill.className = 'ccc-pill'; pill.hidden = true;
      pill.setAttribute('aria-label', 'Request a review'); pill.textContent = 'Request a review';
      pill.onclick = openSheet; document.body.appendChild(pill);
    }
    pill.hidden = false; void pill.offsetWidth; pill.classList.add('on');
    clearTimeout(hideT); hideT = setTimeout(hide, 8000);
  }
  function hide() {
    clearTimeout(hideT); if (!pill) return;
    pill.classList.remove('on'); var p = pill; setTimeout(function () { if (!p.classList.contains('on')) p.hidden = true; }, 350);
  }

  /* the sheet */
  function openSheet() {
    if (sheetEl || !cur) return;
    var c = cur, wd = !!(c.f && c.f.path.indexOf('/api/wallet/withdraw') === 0);
    hide();
    var m = document.createElement('div'); m.className = 'ccc-sh'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Request a review');
    m.innerHTML = '<div class="box g ccc-box"><div class="ccc-h"><h3>Request a review</h3><button type="button" class="ccc-x" data-k="x" aria-label="Close">' + X + '</button></div>'
      + '<p class="sub ccc-msg">An admin will look at what went wrong.</p><p class="sub ccc-msg" id="ccc-m" style="font-weight:600"></p>'
      + (wd ? '<div class="fld" style="margin-top:10px"><input id="ccc-p" inputmode="numeric" maxlength="13" autocomplete="tel" placeholder="M-Pesa number, e.g. 0712345678" aria-label="M-Pesa number"></div>' : '')
      + '<div class="fld" style="margin-top:10px"><textarea id="ccc-n" maxlength="500" placeholder="Add a note (optional)" aria-label="Note"></textarea></div>'
      + '<p class="sub ccc-e" id="ccc-e"></p><div class="two"><button type="button" class="btn g" data-k="x">Cancel</button><button type="button" class="btn p" id="ccc-go">Send</button></div></div>';
    var shown = c.text || (c.f && c.f.msg) || 'Something went wrong.';
    $('#ccc-m', m).textContent = shown;
    document.body.appendChild(m); sheetEl = m;
    var close = function () { m.remove(); sheetEl = null; };
    var ph = $('#ccc-p', m);
    if (ph) {
      fetch(API + '/api/me/phone').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d && d.phone && !ph.value) ph.value = d.phone; }).catch(function () {});
    }
    m.onclick = function (e) {
      if (e.target === m) return close();
      var b = e.target.closest('button'); if (b && b.dataset.k === 'x') close();
    };
    $('#ccc-go', m).onclick = function () {
      var btn = this, er = $('#ccc-e', m); er.textContent = '';
      var body = {
        kind: 'error', page: String((document.body && document.body.dataset.view) || '').slice(0, 60),
        message: String(c.text || (c.f && c.f.msg) || 'Something went wrong').slice(0, 300),
        detail: c.f ? (c.f.method + ' ' + c.f.path + ' ' + c.f.status + (c.f.msg ? ': ' + c.f.msg : '')).slice(0, 400) : '',
        note: $('#ccc-n', m).value.trim().slice(0, 500)
      };
      if (ph) {
        var phone = ph.value.replace(/[\s+-]/g, '').replace(/^254(?=[17]\d{8}$)/, '0');
        if (!/^(07|01)\d{8}$/.test(phone)) { er.textContent = 'Enter the M-Pesa number like 0712345678.'; return; }
        body.phone = phone;
      }
      btn.disabled = true;
      fetch(API + '/api/support/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (x) {
          if (!x.ok) { er.textContent = (x.d && x.d.error) || 'Could not send it. Try again in a moment.'; btn.disabled = false; return; }
          close(); say('Sent. An admin will look at it');
        })
        .catch(function () { er.textContent = 'Could not reach the server. Check your internet and try again.'; btn.disabled = false; });
    };
  }
})();
