/* cc-remember.js v1: the phone remembers WHO you were, so a forgotten username or email is easy to get past.
   It keeps two small things on this phone only (localStorage "cc_hint"): your username, and a masked email hint like jo***@gmail.com.
   The full email is never stored here, and the server never shows it back (it only keeps a scrambled copy).
   Used for: filling in the username box on the log-in screens, and a "Your username is @name, your email looks like jo***@gmail.com"
   line on the Forgot password page. "Not you?" wipes it. Text is inserted with textContent only. */
(function () {
  'use strict';
  if (window.__ccRemember) return; window.__ccRemember = 1;
  var KEY = 'cc_hint';
  var api = function () { try { return ((typeof CC_API === 'string' && CC_API) || '').replace(/\/$/, ''); } catch (e) { return ''; } };
  var auth = function () { try { var a = window.ccAuth ? window.ccAuth() : JSON.parse(localStorage.getItem('cc_auth') || 'null'); return a && a.token ? a : null; } catch (e) { return null; } };
  function get() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function set(o) { try { var n = Object.assign(get(), o); localStorage.setItem(KEY, JSON.stringify(n)); } catch (e) {} }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  function mask(e) { var p = String(e || '').trim().toLowerCase().split('@'); if (p.length !== 2 || !p[0] || !p[1]) return ''; return (p[0].length > 2 ? p[0].slice(0, 2) : p[0].slice(0, 1)) + '***@' + p[1]; }
  window.ccHint = { get: get, set: set, clear: clear, mask: mask };

  // 1. learn the username whenever someone is signed in (once per page load)
  function learn() {
    var a = auth(); if (!a || !api()) return;
    fetch(api() + '/api/me', { headers: { 'X-Aid': a.aid, 'X-Token': a.token } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (me) { if (me && me.handle) set({ h: me.handle }); }).catch(function () {});
  }
  var tries = 0, t = setInterval(function () { if (auth()) { clearInterval(t); setTimeout(learn, 2500); } else if (++tries > 40) clearInterval(t); }, 1500);

  // 2. learn the masked email, but only after the server has proved the person owns it (a code was typed correctly)
  var realFetch = window.fetch, pending = '';
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '', path = url.split('?')[0], p = realFetch.apply(this, arguments);
    var body = null; try { body = init && typeof init.body === 'string' ? JSON.parse(init.body) : null; } catch (e) {}
    if (/\/api\/me\/recovery-email\/start$/.test(path) && body && body.email) p.then(function (r) { if (r.ok) pending = mask(body.email); }).catch(function () {});
    if (/\/api\/me\/recovery-email\/confirm$/.test(path)) p.then(function (r) { if (r.ok && pending) set({ m: pending }); }).catch(function () {});
    if (/\/api\/auth\/reset\/confirm$/.test(path) && body && body.email) p.then(function (r) { if (r.ok) set({ m: mask(body.email) }); }).catch(function () {});
    return p;
  };

  // 3. use it on the screens
  function fill(node) {
    var h = get().h; if (!h || !node || node.nodeType !== 1 || !node.querySelector) return;
    ['ccfrst-u', 'ccp-a', 'ccrst-a'].forEach(function (id) {
      var i = node.id === id ? node : node.querySelector('#' + id);
      if (i && !i.value && !i.__ccfilled) { i.__ccfilled = 1; i.value = h; }
    });
    var f1 = node.id === 'ccfgt' ? node : node.querySelector('#ccfgt');
    if (f1 && !f1.__cchint) {
      f1.__cchint = 1;
      var slot = f1.querySelector('#ccfg-f1'), hint = get(); if (!slot) return;
      var box = document.createElement('p'); box.className = 'fp-sub'; box.style.marginTop = '10px';
      box.appendChild(document.createTextNode('This phone remembers: your username is '));
      var b = document.createElement('b'); b.textContent = '@' + hint.h; box.appendChild(b);
      box.appendChild(document.createTextNode(hint.m ? '. Your email looks like ' : '. Type the email you saved on this account.'));
      if (hint.m) { var m = document.createElement('b'); m.textContent = hint.m; box.appendChild(m); box.appendChild(document.createTextNode('.')); }
      var no = document.createElement('button'); no.type = 'button'; no.className = 'fp-link'; no.textContent = 'Not you?';
      no.onclick = function () { clear(); box.remove(); };
      box.appendChild(document.createTextNode(' ')); box.appendChild(no);
      slot.appendChild(box);
    }
  }
  new MutationObserver(function (recs) { recs.forEach(function (r) { [].forEach.call(r.addedNodes, fill); }); }).observe(document.body, { childList: true, subtree: true });
  fill(document.body);
})();
