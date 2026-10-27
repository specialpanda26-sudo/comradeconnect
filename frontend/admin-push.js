/* Admin: Phone alerts. Send a notification to every phone with the app, or test it on one handle first.
   Loaded before admin-dash.js. Uses api, render, SECTIONS, LABEL, esc, toast from admin.html. */
(function () {
'use strict';
let info = null, busy = false;
LABEL.push = 'Phone alerts';
function fetchInfo() {
  if (busy) return; busy = true;
  api('/api/admin/push').then((d) => { info = d; }).catch(() => { info = { err: 1 }; }).then(() => { busy = false; render(); });
}
SECTIONS.push = () => {
  if (info === null) fetchInfo();
  const n = info && !info.err ? info : null;
  const stat = !info ? 'Counting phones...' : info.err ? 'Could not count phones. Deploy the newest backend, then tap Refresh.'
    : n.app + ' app phone' + (n.app === 1 ? '' : 's') + ' registered (' + n.accounts + ' account' + (n.accounts === 1 ? '' : 's') + ').';
  return ['<div class="card"><h3>Send a phone alert</h3><p class="sub">It pops up on the lock screen of every phone that has the app and allowed notifications. It also appears in their bell. Send a test to your own handle first.</p>'
    + '<p class="sub" id="pu_n"><b>' + esc(stat) + '</b></p>'
    + '<label class="fl" for="pu_t">Title<small>Short, up to 60 characters.</small></label><input id="pu_t" maxlength="60" placeholder="e.g. Maintenance tonight" autocomplete="off">'
    + '<label class="fl" for="pu_b">Message<small>Up to 160 characters.</small></label><textarea id="pu_b" rows="3" maxlength="160" placeholder="e.g. The app will be offline from 10pm to 11pm."></textarea>'
    + '<label class="fl" for="pu_h">Test handle<small>Type your own handle, like @comradeconnect, to test on one account only.</small></label><input id="pu_h" maxlength="40" placeholder="@yourhandle" autocomplete="off">'
    + '<label class="fl" for="pu_a">Send to<small>Everyone with the app, or only club members.</small></label><select id="pu_a"><option value="all">Everyone</option><option value="club">Club members only</option></select>'
    + '<p class="err" id="pu_e"></p><div class="row"><button id="pu_test">Send test</button><button class="p" id="pu_all">Send to everyone</button><button id="pu_r">Refresh</button></div>'
    + '<p class="sub" id="pu_out" style="white-space:pre-line"></p></div>'];
};
const val = (id) => ($('#' + id).value || '').trim();
document.addEventListener('click', async (e) => {
  if (e.target.closest('#pu_r')) { info = null; return render(); }
  const t = e.target.closest('#pu_test'), a = e.target.closest('#pu_all'), btn = t || a; if (!btn) return;
  const title = val('pu_t'), body = val('pu_b'), handle = val('pu_h');
  if (title.length < 2 || body.length < 2) { $('#pu_e').textContent = 'Add a title and a message'; return; }
  if (t && !handle) { $('#pu_e').textContent = 'Type the handle to test on'; return; }
  if (a && !confirm('Send this to every phone with the app (' + ((info && info.accounts) || 0) + ' accounts)?')) return;
  $('#pu_e').textContent = ''; btn.disabled = true;
  try {
    const d = await api('/api/admin/push/send', t ? { title, body, handle } : { title, body, audience: val('pu_a') });
    if (t) $('#pu_out').textContent = (d.report || []).join('\n') || 'Done';
    else { toast('Sent to ' + d.accounts + ' accounts'); $('#pu_out').textContent = 'Sent to ' + d.accounts + ' accounts.'; }
  } catch (x) { $('#pu_e').textContent = x.message; }
  btn.disabled = false;
});
})();
