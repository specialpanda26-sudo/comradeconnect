// Sends one plain-text email. Uses Brevo if BREVO_API_KEY is set, otherwise Resend if RESEND_API_KEY is set.
// Both need MAIL_FROM, e.g. "Comrade Connect <noreply@comradeconnect.co.ke>" (an address/domain verified with the provider).
// Never logs the recipient or the message, so codes and addresses stay out of the logs.
const has = (v) => !!String(v || '').trim();
export const mailReady = (env) => has(env.MAIL_FROM) && (has(env.BREVO_API_KEY) || has(env.RESEND_API_KEY));

function parseFrom(v) {
  const s = String(v).trim(), m = s.match(/^(.*)<([^>]+)>$/);
  return m ? { name: m[1].trim().replace(/^"|"$/g, '') || undefined, email: m[2].trim() } : { email: s };
}

// Returns { ok, status, detail }. detail is the provider's own explanation when it refuses (never the recipient or the message).
export async function sendMailDetailed(env, { to, subject, text, html }) {
  if (!mailReady(env)) return { ok: false, status: 0, detail: 'Mail is not set up: BREVO_API_KEY (or RESEND_API_KEY) and MAIL_FROM must both be set' };
  const brevo = has(env.BREVO_API_KEY);
  let r;
  try {
    r = brevo
      ? await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'api-key': String(env.BREVO_API_KEY).trim() },
        body: JSON.stringify({ sender: parseFrom(env.MAIL_FROM), to: [{ email: to }], subject, textContent: text, ...(html ? { htmlContent: html } : {}) }),
      })
      : await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + String(env.RESEND_API_KEY).trim() },
        body: JSON.stringify({ from: String(env.MAIL_FROM).trim(), to: [to], subject, text, ...(html ? { html } : {}) }),
      });
  } catch (e) { console.error('mail: request failed', e && e.message); return { ok: false, status: 0, detail: 'Could not reach the mail provider: ' + (e && e.message) }; }
  let detail = '';
  if (!r.ok) { try { const d = await r.json(); detail = String(d.message || d.error || d.code || JSON.stringify(d)).slice(0, 300); } catch (e) { detail = ''; } }
  console.log('mail: ' + (brevo ? 'brevo' : 'resend') + ' answered ' + r.status + (detail ? ' (' + detail + ')' : ''));
  return { ok: r.ok, status: r.status, detail };
}
export async function sendMail(env, msg) { return (await sendMailDetailed(env, msg)).ok; }

// ---------- Branded email for one-time codes (logo, big code, expiry time, steps, safety tips). Plain text is sent too. ----------
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function codeEmail(env, o) {
  const site = String(env.SITE_URL || 'https://comradeconnect.co.ke').replace(/\/$/, ''), support = String(env.SUPPORT_EMAIL || 'support@comradeconnect.co.ke');
  const mins = Number(o.minutes) || 15, until = new Date(Date.now() + mins * 60e3).toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', hour12: true });
  const hi = o.name ? 'Hi ' + o.name + ',' : 'Hello,';
  const steps = o.steps || [], tips = ['Comrade Connect staff will never ask you for this code, on WhatsApp, a call or anywhere else.', 'Do not share it, even with someone who says they are from us.'];
  const text = `${o.heading}\n\n${hi}\n${o.lead}\n\nYour Comrade Connect code is ${o.code}\n\nIt works for ${mins} minutes (until about ${until} Nairobi time) and can be used once.\n\nWhat to do:\n${steps.map((s, i) => (i + 1) + '. ' + s).join('\n')}\n\n${o.ignore}\n\nStay safe:\n- ${tips.join('\n- ')}\n\nNeed help? Write to ${support}\nComrade Connect, the campus app for Kenyan comrades. ${site}`;
  const li = steps.map((s, i) => `<tr><td style="width:28px;vertical-align:top;padding:0 0 10px"><div style="width:22px;height:22px;border-radius:11px;background:#101422;color:#ffffff;font:700 12px/22px Arial,sans-serif;text-align:center">${i + 1}</div></td><td style="padding:1px 0 10px;font:14px/1.5 Arial,sans-serif;color:#2b3040">${esc(s)}</td></tr>`).join('');
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#eef0f5">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Your code is ${esc(o.code)}. It works for ${mins} minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td align="center" style="background:#101422;padding:28px 20px 22px"><img src="${site}/icon-192.png" width="72" height="72" alt="Comrade Connect" style="display:block;border-radius:18px;border:0"><div style="font:700 18px Arial,sans-serif;color:#ffffff;margin-top:12px;letter-spacing:.5px">COMRADE CONNECT</div><div style="font:12px Arial,sans-serif;color:#9aa3bd;margin-top:2px">The campus app for Kenyan comrades</div></td></tr>
<tr><td style="padding:28px 26px 8px"><div style="font:700 20px Arial,sans-serif;color:#101422">${esc(o.heading)}</div><p style="font:14px/1.6 Arial,sans-serif;color:#2b3040;margin:12px 0 0">${esc(hi)}<br>${esc(o.lead)}</p></td></tr>
<tr><td align="center" style="padding:18px 26px 6px"><div style="background:#f3f5fa;border:1px solid #dfe3ee;border-radius:14px;padding:18px 10px"><div style="font:12px Arial,sans-serif;color:#6b7390;text-transform:uppercase;letter-spacing:1.5px">Your code</div><div style="font:700 36px 'Courier New',monospace;letter-spacing:10px;color:#101422;margin-top:6px;padding-left:10px">${esc(o.code)}</div></div><div style="font:13px/1.5 Arial,sans-serif;color:#6b7390;margin-top:10px">Works for <b>${mins} minutes</b> (until about <b>${until}</b> Nairobi time). One use only.</div></td></tr>
<tr><td style="padding:18px 26px 0"><div style="font:700 14px Arial,sans-serif;color:#101422;margin-bottom:10px">What to do</div><table role="presentation" cellpadding="0" cellspacing="0" width="100%">${li}</table></td></tr>
<tr><td style="padding:6px 26px 0"><div style="background:#fff6e5;border:1px solid #f3dca8;border-radius:12px;padding:12px 14px;font:13px/1.55 Arial,sans-serif;color:#5b4410"><b>Stay safe.</b> ${esc(tips[0])} ${esc(tips[1])}</div><p style="font:13px/1.6 Arial,sans-serif;color:#2b3040;margin:14px 0 0">${esc(o.ignore)}</p></td></tr>
<tr><td style="padding:22px 26px 26px"><div style="border-top:1px solid #e6e9f2;padding-top:14px;font:12px/1.6 Arial,sans-serif;color:#7a8199">Need help? Write to <a href="mailto:${esc(support)}" style="color:#101422">${esc(support)}</a><br>Comrade Connect, by Ogolla Tech, Kenya. <a href="${esc(site)}" style="color:#101422">${esc(site.replace(/^https?:\/\//, ''))}</a><br>You got this email because someone used this address on Comrade Connect.</div></td></tr>
</table></td></tr></table></body></html>`;
  return { text, html };
}


// What an admin needs to know before sending a test: which provider, and whether the From address will be accepted and delivered.
export function mailDiagnosis(env) {
  const from = has(env.MAIL_FROM) ? parseFrom(env.MAIL_FROM).email : '';
  const dom = from.split('@')[1] || '';
  const notes = [];
  if (!has(env.MAIL_FROM)) notes.push('MAIL_FROM is empty.');
  if (!has(env.BREVO_API_KEY) && !has(env.RESEND_API_KEY)) notes.push('Neither BREVO_API_KEY nor RESEND_API_KEY is set.');
  if (/^(gmail|googlemail|yahoo|outlook|hotmail|icloud)\./i.test(dom)) notes.push('MAIL_FROM is a free-mail address (@' + dom + '). Gmail and Yahoo reject or spam mail that claims to come from their own domain but is sent by someone else. Use an address on your own domain, verified at your mail provider.');
  if (!has(env.BREVO_API_KEY) && has(env.RESEND_API_KEY) && /^(resend\.dev)$/i.test(dom)) notes.push('onboarding@resend.dev can only send to the email that owns the Resend account.');
  return { provider: has(env.BREVO_API_KEY) ? 'brevo' : has(env.RESEND_API_KEY) ? 'resend' : 'none', from_domain: dom || null, ready: mailReady(env), notes };
}
