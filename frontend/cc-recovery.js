/* Recovery email page: any email, used only for "Forgot password". Same account as the app (cc_auth in this browser).
   All text is inserted with textContent. */
(function () {
'use strict';
var API = (typeof CC_API !== 'undefined' ? CC_API : '').replace(/\/$/, '');
function $(i) { return document.getElementById(i); }
function auth() { try { return JSON.parse(localStorage.getItem('cc_auth') || 'null'); } catch (e) { return null; } }
function say(t) { $('msg').textContent = t || ''; }
function show(id, on) { $(id).hidden = !on; }
function call(path, body) {
  var a = auth(), h = { 'Content-Type': 'application/json' };
  if (a && a.token) { h['X-Aid'] = a.aid; h['X-Token'] = a.token; }
  return fetch(API + path, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.'); return d; }); });
}
function view(st) {
  show('need', false); show('off', false); show('done', false); show('s1', false); show('s2', false);
  if (st.has_email) return show('done', true);
  if (!st.available) return show('off', true);
  if (st.code_pending) { $('sent').textContent = 'A code was sent to your email. It works for 15 minutes.'; show('s2', true); } else show('s1', true);
}
function load() {
  if (!API) return say('The app is not set up here yet.');
  if (!auth() || !auth().token) return show('need', true);
  call('/api/me/recovery-email').then(view).catch(function (e) { say(e.message); });
}
function busy(b, on, label) { b.disabled = on; if (label) b.textContent = label; }
$('send').addEventListener('click', function () {
  var b = $('send'); say(''); busy(b, true, 'Sending...');
  call('/api/me/recovery-email/start', { email: $('em').value }).then(function (d) {
    $('sent').textContent = 'We sent a code to ' + d.sent_to + '. It works for ' + d.expires_minutes + ' minutes. Check spam too.';
    show('s1', false); show('s2', true); $('cd').focus();
  }).catch(function (e) { say(e.message); }).then(function () { busy(b, false, 'Send me a code'); });
});
$('ok').addEventListener('click', function () {
  var b = $('ok'); say(''); busy(b, true, 'Checking...');
  call('/api/me/recovery-email/confirm', { code: $('cd').value }).then(function () { say('Saved. You can now reset your password by email.'); load(); })
    .catch(function (e) { say(e.message); }).then(function () { busy(b, false, 'Confirm'); });
});
$('again').addEventListener('click', function (ev) { ev.preventDefault(); say(''); show('s2', false); show('s1', true); });
$('unlink').addEventListener('click', function () {
  if (!confirm('Remove your recovery email?')) return;
  call('/api/me/recovery-email/remove', {}).then(function () { say('Removed.'); load(); }).catch(function (e) { say(e.message); });
});
load();
})();
