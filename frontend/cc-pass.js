/* cc-pass.js v4: password fields that hand the work to Google Password Manager (Chrome, Android autofill, Samsung Pass, iCloud Keychain).
   There is no strength meter, no "Suggest" button and no code box here any more: when someone taps a sign-up password field,
   the phone or browser shows its own "Suggest strong password" and offers to save it afterwards.
   What this file does is make every sign-up and change-password screen look like a proper sign-up form to the browser:
   a username field marked autocomplete="username", password fields marked autocomplete="new-password", all inside one real form. */
(function () {
'use strict';
if (window.__ccPass) return; window.__ccPass = 1;

var FORM_ID = 'ccpw-form';
function sharedForm() {                                // only used for screens that are not inside a form already; display:contents so it takes no space
  var f = document.getElementById(FORM_ID);
  if (!f) { f = document.createElement('form'); f.id = FORM_ID; f.autocomplete = 'on'; f.noValidate = true; f.style.display = 'contents'; f.addEventListener('submit', function (e) { e.preventDefault(); }); document.body.appendChild(f); }
  return f;
}
function rootOf(inp) { return inp.closest('form,[role=dialog],.box,#ccsu') || inp.parentNode.parentNode; }
function usernameFor(pw, root) {
  var all = [].slice.call(root.querySelectorAll('input')), idx = all.indexOf(pw);
  for (var i = idx - 1; i >= 0; i--) {
    var t = all[i], hint = (t.id || '') + (t.placeholder || '') + (t.getAttribute('aria-label') || '');
    if ((t.type === 'text' || t.type === 'email' || !t.type) && !/phone|tel|code|mpesa|price|search/i.test(hint)) return t;
  }
  return null;
}

function enhance(pw) {
  var root = rootOf(pw); if (root.__ccpw) return; root.__ccpw = 1;
  var inForm = !!pw.form, user = usernameFor(pw, root);
  var group = [].slice.call(root.querySelectorAll('input[type=password],input[data-ccpw]')).filter(function (i) { return /new-password/.test(i.getAttribute('autocomplete') || ''); });
  if (!inForm) sharedForm();
  if (user) {
    var ac = user.getAttribute('autocomplete');
    if (!ac || ac === 'off') user.setAttribute('autocomplete', user.type === 'email' ? 'email' : 'username');
    if (!user.getAttribute('name')) user.setAttribute('name', 'username');
    if (!inForm) user.setAttribute('form', FORM_ID);
  }
  group.forEach(function (g, i) {
    g.setAttribute('autocomplete', 'new-password'); g.setAttribute('data-ccpw', '1');
    if (!g.getAttribute('name')) g.setAttribute('name', i ? 'confirm_password' : 'password');
    if (!inForm) g.setAttribute('form', FORM_ID);
    g.setAttribute('passwordrules', 'minlength: 8; maxlength: 100; required: lower; required: upper; required: digit;');
  });
}

/* ---------- offer the new password to the password manager once the server accepts it ---------- */
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
      navigator.credentials.store(new PasswordCredential({ id: id, password: password, name: id })).catch(function () {});
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
})();
