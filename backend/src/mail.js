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
export async function sendMailDetailed(env, { to, subject, text }) {
  if (!mailReady(env)) return { ok: false, status: 0, detail: 'Mail is not set up: BREVO_API_KEY (or RESEND_API_KEY) and MAIL_FROM must both be set' };
  const brevo = has(env.BREVO_API_KEY);
  let r;
  try {
    r = brevo
      ? await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'api-key': String(env.BREVO_API_KEY).trim() },
        body: JSON.stringify({ sender: parseFrom(env.MAIL_FROM), to: [{ email: to }], subject, textContent: text }),
      })
      : await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + String(env.RESEND_API_KEY).trim() },
        body: JSON.stringify({ from: String(env.MAIL_FROM).trim(), to: [to], subject, text }),
      });
  } catch (e) { console.error('mail: request failed', e && e.message); return { ok: false, status: 0, detail: 'Could not reach the mail provider: ' + (e && e.message) }; }
  let detail = '';
  if (!r.ok) { try { const d = await r.json(); detail = String(d.message || d.error || d.code || JSON.stringify(d)).slice(0, 300); } catch (e) { detail = ''; } }
  console.log('mail: ' + (brevo ? 'brevo' : 'resend') + ' answered ' + r.status + (detail ? ' (' + detail + ')' : ''));
  return { ok: r.ok, status: r.status, detail };
}
export async function sendMail(env, msg) { return (await sendMailDetailed(env, msg)).ok; }

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
