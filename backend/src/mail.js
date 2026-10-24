// Sends one plain-text email through Resend (https://resend.com, free tier). Needs RESEND_API_KEY and MAIL_FROM
// (an address on a domain you verified in Resend, e.g. "Comrade Connect <no-reply@comradeconnect.co.ke>").
// Never logs the recipient or the message, so codes and addresses stay out of the logs.
export const mailReady = (env) => !!(String(env.RESEND_API_KEY || '').trim() && String(env.MAIL_FROM || '').trim());
export async function sendMail(env, { to, subject, text }) {
  if (!mailReady(env)) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + String(env.RESEND_API_KEY).trim() },
    body: JSON.stringify({ from: String(env.MAIL_FROM).trim(), to: [to], subject, text }),
  }).catch((e) => { console.error('mail: request failed', e && e.message); return null; });
  if (!r || !r.ok) { console.error('mail: provider refused', r ? r.status : 'no response'); return false; }
  return true;
}
