/* cc-pass.js: better password fields on every sign-up and change-password screen.
   - Lets Google Password Manager (or Chrome, Samsung Pass, iCloud Keychain) offer "Suggest strong password" and save it afterwards.
   - Shows how strong the password is while you type, and warns if it has appeared in a known data breach (only the first 5 characters of its hash are sent).
   - Offers a strong random password you can use or copy.
   The server runs its own check, so this is guidance, not the gate. Text is inserted with textContent only. */
(function () {
'use strict';
if (window.__ccPass) return; window.__ccPass = 1;

var COMMON = 'password,password1,password12,password123,passw0rd,p@ssw0rd,qwerty,qwerty12,qwerty123,qwertyui,qwertyuiop,asdfghjk,asdfghjkl,zxcvbnm,zxcvbnm1,12345678,123456789,1234567890,11111111,00000000,87654321,abc12345,abcd1234,abcdefgh,iloveyou,iloveyou1,letmein1,welcome1,welcome123,admin123,administrator,monkey123,dragon123,football,football1,baseball,superman,princess,sunshine,master123,shadow123,trustno1,whatever,freedom1,comrade,comrade1,comrade123,comrades,comradeconnect,connect123,kirinyaga,kirinyaga1,kirinyaga123,kyu12345,kenya123,kenya254,kenya2024,kenya2025,kenya2026,nairobi1,nairobi123,mombasa1,kisumu123,nakuru123,mpesa123,mpesa1234,safaricom,harambee,harambee1,jambo123,hakuna123,mamamia1,god12345,jesus123,blessed1,blessing,student1,student123,university,campus123,school123,jomo1234,0722000000,0712345678,0700000000,qazwsxedc,1q2w3e4r,1qaz2wsx,q1w2e3r4,zaq12wsx,pass1234,test1234,user1234'.split(',');
var COMMON_SET = {}; COMMON.forEach(function (w) { COMMON_SET[w] = 1; });
var LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
var COLORS = ['#f87171', '#f87171', '#fbbf24', '#4ade80', '#4ade80'];

/* same rules as backend/src/passwords.js */
function score(pw, handle) {
  pw = String(pw || ''); var low = pw.toLowerCase();
  if (pw.length < 8) return 0;
  if (COMMON_SET[low] || COMMON_SET[low.replace(/[^a-z0-9]/g, '')]) return 0;
  if (/^(.)\1+$/.test(pw)) return 0;
  var pool = (/[a-z]/.test(pw) ? 26 : 0) + (/[A-Z]/.test(pw) ? 26 : 0) + (/[0-9]/.test(pw) ? 10 : 0) + (/[^A-Za-z0-9]/.test(pw) ? 33 : 0);
  var uniq = {}; for (var i = 0; i < pw.length; i++) uniq[pw[i]] = 1; uniq = Object.keys(uniq).length;
  var bits = Math.min(pw.length, uniq * 1.6) * Math.log2(Math.max(pool, 2));
  var seq = 'abcdefghijklmnopqrstuvwxyz0123456789', kb = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'], runs = 0;
  for (var j = 0; j + 3 <= low.length; j++) { var t = low.slice(j, j + 3); if (seq.indexOf(t) >= 0 || kb.some(function (r) { return r.indexOf(t) >= 0; }) || seq.indexOf(t.split('').reverse().join('')) >= 0) runs++; }
  bits -= runs * 3;
  if (/(19|20)\d\d$/.test(pw)) bits -= 8;
  if (/^[A-Z]?[a-z]+\d{1,4}[!@#$%^&*.?]?$/.test(pw)) bits -= 8;
  if (handle && String(handle).length >= 3 && low.indexOf(String(handle).toLowerCase()) >= 0) bits = Math.min(bits, 27);
  return bits < 28 ? 0 : bits < 38 ? 1 : bits < 52 ? 2 : bits < 66 ? 3 : 4;
}
function hint(pw, handle, s) {
  if (!pw) return 'Use at least 8 characters. Longer is stronger.';
  if (pw.length < 8) return 'Add ' + (8 - pw.length) + ' more character' + (8 - pw.length === 1 ? '' : 's') + '.';
  if (handle && handle.length >= 3 && pw.toLowerCase().indexOf(handle.toLowerCase()) >= 0) return 'Do not use your username inside your password.';
  if (s <= 1) return COMMON_SET[pw.toLowerCase()] ? 'This is one of the most common passwords.' : 'Too easy to guess. Make it longer or mix letters, numbers and symbols.';
  if (s === 2) return 'Okay, but a few more characters would make it much harder to guess.';
  if (s === 3) return 'Good. A longer one would be even better.';
  return 'Strong. Save it with Google or copy it somewhere safe.';
}
function suggest() {                                   // 3 blocks of 4 plus one more, no look-alike characters, about 70 bits
  var A = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '', buf = new Uint32Array(16); crypto.getRandomValues(buf);
  for (var i = 0; i < 16; i++) { if (i && i % 4 === 0) out += '-'; out += A[buf[i] % A.length]; }
  return out;
}
function sha1hex(s) { return crypto.subtle.digest('SHA-1', new TextEncoder().encode(s)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('').toUpperCase(); }); }
var pwnCache = {};
function breached(pw) {                                // resolves with a count, or 0 when unknown
  if (!window.crypto || !crypto.subtle || typeof fetch !== 'function') return Promise.resolve(0);
  return sha1hex(pw).then(function (h) {
    var pre = h.slice(0, 5), suf = h.slice(5);
    var get = pwnCache[pre] || (pwnCache[pre] = fetch('https://api.pwnedpasswords.com/range/' + pre, { headers: { 'Add-Padding': 'true' } }).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; }));
    return get.then(function (t) { var n = 0; t.split('\n').forEach(function (l) { var p = l.trim().split(':'); if (p[0] && p[0].toUpperCase() === suf) n = Number(p[1]) || 0; }); return n; });
  }).catch(function () { return 0; });
}

function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
var css = el('style');
css.textContent =
'.ccpw-m{margin:6px 0 4px;font-size:12px;line-height:1.5;color:var(--mut,#bdbdbd)}' +
'.ccpw-bars{display:flex;gap:4px}.ccpw-bars i{flex:1;height:3px;border-radius:2px;background:var(--line,rgba(255,255,255,.18));transition:background .2s}' +
'.ccpw-st{display:flex;justify-content:space-between;gap:10px;margin-top:6px}.ccpw-st b{font-weight:600;color:var(--fg,#fff)}' +
'.ccpw-hint{flex:1}.ccpw-ct{display:flex;gap:16px;flex-wrap:wrap;margin-top:6px}' +
'.ccpw-ct button{all:unset;cursor:pointer;font-size:12px;font-weight:600;color:var(--fg,#fff);text-decoration:underline;text-underline-offset:2px}.ccpw-ct button:focus-visible{outline:2px solid var(--fg,#fff);outline-offset:2px;border-radius:4px}' +
'.ccpw-sg{margin-top:8px;padding:10px 12px;border-radius:12px;border:1px solid var(--gb,rgba(255,255,255,.22));display:flex;align-items:center;justify-content:space-between;gap:10px}' +
'.ccpw-sg code{font:600 15px/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.04em;color:var(--fg,#fff);overflow-wrap:anywhere}';
document.head.appendChild(css);

var FORM_ID = 'ccpw-form';
function sharedForm() {                                // inputs join this form by attribute, so no screen has to be rebuilt
  var f = document.getElementById(FORM_ID);
  if (!f) { f = document.createElement('form'); f.id = FORM_ID; f.autocomplete = 'on'; f.noValidate = true; f.hidden = true; f.addEventListener('submit', function (e) { e.preventDefault(); }); document.body.appendChild(f); }
  return f;
}
function rootOf(inp) { return inp.closest('[role=dialog],.box,#ccsu,form') || inp.parentNode.parentNode; }
function usernameFor(pw, root) {
  var all = [].slice.call(root.querySelectorAll('input')), idx = all.indexOf(pw), u = null;
  for (var i = idx - 1; i >= 0; i--) { var t = all[i]; if ((t.type === 'text' || t.type === 'email' || !t.type) && t.type !== 'password' && !/phone|tel|code|mpesa|price|search/i.test((t.id || '') + (t.placeholder || '') + (t.getAttribute('aria-label') || ''))) { u = t; break; } }
  return u;
}

function enhance(pw) {
  var root = rootOf(pw); if (root.__ccpw) return; root.__ccpw = 1; sharedForm();
  var user = usernameFor(pw, root), group = [].slice.call(root.querySelectorAll('input[type=password],input[data-ccpw]')).filter(function (i) { return /new-password/.test(i.autocomplete || i.getAttribute('autocomplete') || ''); });
  if (user) { user.setAttribute('autocomplete', 'username'); user.setAttribute('name', 'username'); user.setAttribute('form', FORM_ID); }
  group.forEach(function (g, i) { g.setAttribute('autocomplete', 'new-password'); g.setAttribute('name', i ? 'confirm_password' : 'password'); g.setAttribute('form', FORM_ID); g.setAttribute('data-ccpw', '1'); g.setAttribute('passwordrules', 'minlength: 8; maxlength: 100; required: lower; required: upper; required: digit;'); });
  var h = group[0] || pw, holder = h.closest('.fld,.f') || h.parentNode;
  var m = el('div', 'ccpw-m'); m.setAttribute('aria-live', 'polite');
  var bars = el('div', 'ccpw-bars'); for (var b = 0; b < 4; b++) bars.appendChild(el('i'));
  var st = el('div', 'ccpw-st'), hintEl = el('span', 'ccpw-hint'), lab = el('b'); st.appendChild(hintEl); st.appendChild(lab);
  var ct = el('div', 'ccpw-ct'), sug = el('button', '', 'Suggest a strong password'); sug.type = 'button'; ct.appendChild(sug);
  var hasToggle = /show password/i.test(root.textContent || '') || !!root.querySelector('.eye,[id$="eye"]');
  var tog = null; if (!hasToggle) { tog = el('button', '', 'Show password'); tog.type = 'button'; ct.appendChild(tog); }
  m.appendChild(bars); m.appendChild(st); m.appendChild(ct); holder.parentNode.insertBefore(m, holder.nextSibling);

  var seq = 0;
  function paint() {
    var v = h.value, hd = user ? user.value.trim() : '', s = score(v, hd), n = v ? Math.max(1, s) : 0;
    [].forEach.call(bars.children, function (i, k) { i.style.background = k < n ? COLORS[s] : ''; });
    lab.textContent = v ? LABELS[s] : ''; lab.style.color = v ? COLORS[s] : '';
    hintEl.textContent = hint(v, hd, s);
    var mine = ++seq;
    if (v.length >= 8 && s >= 1) clearTimeout(paint.t), paint.t = setTimeout(function () {
      breached(v).then(function (c) { if (mine !== seq || h.value !== v) return; if (c >= 5) { hintEl.textContent = 'This password has appeared in known data breaches. Pick a different one.'; lab.textContent = 'Not safe'; lab.style.color = COLORS[0]; [].forEach.call(bars.children, function (i) { i.style.background = COLORS[0]; }); } });
    }, 600);
  }
  h.addEventListener('input', paint); if (user) user.addEventListener('input', paint); paint();

  var box = null;
  sug.onclick = function () {
    var p = suggest(); group.forEach(function (g) { g.value = p; }); h.dispatchEvent(new Event('input', { bubbles: true }));
    group.forEach(function (g) { g.type = 'text'; }); if (tog) tog.textContent = 'Hide password';
    if (!box) { box = el('div', 'ccpw-sg'); m.appendChild(box); }
    box.textContent = ''; var code = el('code', '', p), cp = el('button', '', 'Copy'); cp.type = 'button'; box.appendChild(code); box.appendChild(cp);
    cp.onclick = function () { (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(p) : Promise.reject()).then(function () { cp.textContent = 'Copied'; }, function () { cp.textContent = 'Press and hold to copy'; }); };
    var note = el('div', 'ccpw-hint', 'This one is yours. Google will ask to save it, or copy it somewhere safe. We cannot recover it for you.'); box.parentNode.insertBefore(note, box.nextSibling);
    note.style.marginTop = '6px';
  };
  if (tog) tog.onclick = function () { var show = group[0].type === 'password'; group.forEach(function (g) { g.type = show ? 'text' : 'password'; }); tog.textContent = show ? 'Hide password' : 'Show password'; };
}

/* ---------- offer the new password to Google Password Manager once the server accepts it ---------- */
var realFetch = window.fetch;
window.fetch = function (input, init) {
  var url = typeof input === 'string' ? input : (input && input.url) || '', p = realFetch.apply(this, arguments);
  if (/\/api\/(auth\/register|me\/credentials)$/.test(url.split('?')[0]) && init && typeof init.body === 'string') {
    var body; try { body = JSON.parse(init.body); } catch (e) { body = null; }
    if (body && body.password && body.handle) p.then(function (r) { return r.clone().json().then(function (d) { return { ok: r.ok, d: d }; }); }).then(function (x) { if (x.ok) saveCredential(body.handle, body.password); }).catch(function () {});
  }
  return p;
};
function saveCredential(id, password) {
  try {
    if (window.PasswordCredential && navigator.credentials && navigator.credentials.store) {
      var cred = new PasswordCredential({ id: id, password: password, name: id }); navigator.credentials.store(cred).catch(function () {});
    }
  } catch (e) {}
}

/* ---------- find the password fields as screens open ---------- */
function scan(node) {
  if (!node || node.nodeType !== 1) return;
  var list = node.matches && node.matches('input[type=password]') ? [node] : [].slice.call(node.querySelectorAll ? node.querySelectorAll('input[type=password]') : []);
  list.forEach(function (i) { if (/new-password/.test(i.getAttribute('autocomplete') || '') && !i.hasAttribute('data-ccpw-done')) { i.setAttribute('data-ccpw-done', '1'); enhance(i); } });
}
new MutationObserver(function (recs) { recs.forEach(function (r) { [].forEach.call(r.addedNodes, scan); }); }).observe(document.body, { childList: true, subtree: true });
scan(document.body);
window.ccPw = { score: score, suggest: suggest, labels: LABELS };
})();
