/* Admin: "Promo" tab. Send a promo email (with the app download button) or an SMS (Africa's Talking) to people who opted in.
   Uses api, SECTIONS, LABEL, esc, toast, $ from admin.html. */
(function () {
'use strict';
LABEL.promo = 'Promo';
const day = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
SECTIONS.promo = () => {
  setTimeout(load, 0);
  return ['<div class="card"><h3>Promo emails and SMS</h3><p class="sub" id="pr_st">Checking...</p><p class="sub">Only people who ticked "Offers and updates" in the app are on the list. Every email and text has an unsubscribe link.</p></div>',
    '<div class="card"><h3>Promo email</h3><p class="sub">The email always has a big Download the app button and the list of good things about Comrade Connect. You only write the top part.</p>'
    + '<input id="pr_c" placeholder="Campaign name (each person gets it once)" maxlength="40" value="promo-' + day() + '" autocapitalize="off">'
    + '<input id="pr_s" placeholder="Subject (empty = built-in)" maxlength="120">'
    + '<input id="pr_h" placeholder="Headline (empty = built-in)" maxlength="100">'
    + '<textarea id="pr_b" rows="4" maxlength="1200" placeholder="Your message. Leave a blank line between paragraphs."></textarea>'
    + '<input id="pr_te" placeholder="Test address, e.g. you@gmail.com" inputmode="email" autocapitalize="off">'
    + '<div class="row"><button id="pr_et">Send test</button><button class="p" id="pr_es">Send next 100</button></div><p class="sub" id="pr_eo"></p></div>',
    '<div class="card"><h3>Promo SMS</h3><p class="sub">Each text is charged by Africa\'s Talking. Keep it short: one text is about 160 characters, and the Stop link is added for you.</p>'
    + '<input id="pr_sc" placeholder="Campaign name" maxlength="40" value="sms-' + day() + '" autocapitalize="off">'
    + '<textarea id="pr_st2" rows="3" maxlength="300" placeholder="Text (empty = built-in)"></textarea>'
    + '<input id="pr_tp" placeholder="Test number, e.g. 0712345678" inputmode="tel">'
    + '<div class="row"><button id="pr_xt">Send test</button><button class="p" id="pr_xs">Send next 100</button></div><p class="sub" id="pr_xo"></p></div>'];
};
async function load() {
  if (!$('#pr_st')) return;
  try {
    const d = await api('/api/admin/promo');
    $('#pr_st').textContent = d.emails + ' emails and ' + d.phones + ' phone numbers have opted in. Email: ' + (d.mail_ready ? 'ready' : 'NOT set up (MAIL_FROM + BREVO_API_KEY)') + '. SMS: ' + (d.sms_ready ? 'ready' + (d.sandbox ? ' (sandbox: no real texts)' : '') : 'NOT set up (AT_USERNAME + AT_API_KEY)') + '. Download link: ' + d.download;
  } catch (e) { $('#pr_st').textContent = 'Could not load: ' + e.message; }
}
async function send(btn, out, body, test) {
  const o = $(out); o.textContent = 'Sending...'; btn.disabled = true;
  try {
    const r = await api('/api/admin/promo/send', body);
    o.textContent = test ? (r.ok ? 'Test sent. Check it now.' : 'Test failed: ' + (r.detail || 'unknown')) : 'Sent ' + r.sent + ', failed ' + r.failed + ', still waiting ' + r.remaining + (r.first_error ? '. First problem: ' + r.first_error : '') + (r.remaining ? '. Tap the button again for the next batch.' : '.');
  } catch (e) { o.textContent = e.message; }
  btn.disabled = false;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('#pr_et,#pr_es,#pr_xt,#pr_xs'); if (!b) return;
  const email = b.id[3] === 'e', test = b.id[4] === 't', v = (id) => ($(id).value || '').trim();
  const body = email ? { channel: 'email', campaign: v('#pr_c'), subject: v('#pr_s'), headline: v('#pr_h'), body: v('#pr_b'), limit: 100 } : { channel: 'sms', campaign: v('#pr_sc'), sms: v('#pr_st2'), limit: 100 };
  if (test) { body.test_to = email ? v('#pr_te') : v('#pr_tp'); if (!body.test_to) return toast('Type where to send the test'); }
  else if (!confirm('Send the next batch of up to 100 ' + (email ? 'emails' : 'texts') + ' to people who opted in?')) return;
  send(b, email ? '#pr_eo' : '#pr_xo', body, test);
});
})();
