// Sends one plain-text email. Uses Brevo if BREVO_API_KEY is set, otherwise Resend if RESEND_API_KEY is set.
// Both need MAIL_FROM, e.g. "Comrade Connect <noreply@comradeconnect.co.ke>" (an address/domain verified with the provider).
// Never logs the recipient or the message, so codes and addresses stay out of the logs.
const has = (v) => !!String(v || '').trim();
export const mailReady = (env) => has(env.MAIL_FROM) && (has(env.BREVO_API_KEY) || has(env.RESEND_API_KEY));

function parseFrom(v) {
  const s = String(v).trim(), m = s.match(/^(.*)<([^>]+)>$/);
  return m ? { name: m[1].trim().replace(/^"|"$/g, '') || undefined, email: m[2].trim() } : { email: s };
}

export async function sendMail(env, { to, subject, text }) {
  if (!mailReady(env)) return false;
  let r;
  if (has(env.BREVO_API_KEY)) {
    r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'api-key': String(env.BREVO_API_KEY).trim() },
      body: JSON.stringify({ sender: parseFrom(env.MAIL_FROM), to: [{ email: to }], subject, textContent: text }),
    }).catch((e) => { console.error('mail: request failed', e && e.message); return null; });
  } else {
    r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + String(env.RESEND_API_KEY).trim() },
      body: JSON.stringify({ from: String(env.MAIL_FROM).trim(), to: [to], subject, text }),
    }).catch((e) => { console.error('mail: request failed', e && e.message); return null; });
  }
  if (!r || !r.ok) { console.error('mail: provider refused', r ? r.status : 'no response'); return false; }
  return true;
}
