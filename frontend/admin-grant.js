/* Admin: "Grant money" tab. Put money straight into a user's wallet (gift, prize, goodwill). Every grant is written to the audit log. */
(function () {
'use strict';
const old = Object.assign({}, LABEL); Object.keys(LABEL).forEach((k) => delete LABEL[k]);
Object.assign(LABEL, old); LABEL.grant = 'Grant money';
let key = Math.random().toString(36).slice(2) + Date.now().toString(36);      // one key per form, so a double tap can never pay twice
SECTIONS.grant = () => ['<div class="card"><h3>Grant money to a wallet</h3><p class="sub">The money lands in the person\'s wallet at once and they can spend it or withdraw it. Use the exact account ID or handle.</p>'
  + '<input id="gr_to" placeholder="Handle or account ID" maxlength="60" autocapitalize="off" autocomplete="off">'
  + '<input id="gr_amt" placeholder="Amount in KSh (1 to 100,000)" inputmode="numeric" maxlength="6">'
  + '<input id="gr_note" placeholder="Reason shown to them (optional)" maxlength="80">'
  + '<div class="row"><button class="p" id="grsend">Send money</button></div></div>'];
document.addEventListener('click', (e) => {
  const b = e.target.closest('#grsend'); if (!b) return;
  const to = $('#gr_to').value.trim(), amt = $('#gr_amt').value.trim(), note = $('#gr_note').value.trim();
  if (!to) return toast('Enter the handle or account ID');
  if (!/^\d{1,6}$/.test(amt) || +amt < 1 || +amt > 100000) return toast('Amount: KSh 1 to 100,000');
  if (!confirm('Send ' + kes(+amt) + ' to ' + to + '? This cannot be undone.')) return;
  const k = key; key = Math.random().toString(36).slice(2) + Date.now().toString(36);
  act(b, () => api('/api/admin/wallet/grant', { to, amount: +amt, note, key: k }), 'Money sent');
});
})();
