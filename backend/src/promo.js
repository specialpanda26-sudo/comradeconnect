// Promo emails and SMS, only for people who ticked "Offers and updates" in the app (Me page).
// Email goes through the same Brevo/Resend setup as the codes. SMS goes through Africa's Talking.
// A send that fails is written down and skipped: it is never retried inside the same campaign, and it never stops the rest.
import { json, err, sb, rows, one, post, patch, enc, str, int, randHex, H, tsEqual, isAdmin, audit, user, throttle, tooMany } from './lib.js';
import { sendMailDetailed, mailReady } from './mail.js';

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const site = (env) => String(env.SITE_URL || 'https://comradeconnect.co.ke').replace(/\/$/, '');
const dlUrl = (env) => String(env.APP_DOWNLOAD_URL || 'https://github.com/specialpanda26-sudo/comradeconnect-releases/releases/latest/download/comrade-connect.apk');
const apiBase = (env, url) => String(env.API_URL || ('https://' + url.host)).replace(/\/$/, '');
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/;
const has = (v) => !!String(v || '').trim();

// Kenyan mobile numbers only: 07.., 01.., 7.., 1.., 254.. or +254..  Returns +254XXXXXXXXX or ''.
export function normPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (/^0[71]\d{8}$/.test(d)) d = '254' + d.slice(1); else if (/^[71]\d{8}$/.test(d)) d = '254' + d;
  return /^254[71]\d{8}$/.test(d) ? '+' + d : '';
}

export const smsReady = (env) => has(env.AT_USERNAME) && has(env.AT_API_KEY);
// Africa's Talking: one SMS to one number. Returns { ok, detail }. Never logs the number or the text.
export async function sendSms(env, to, message) {
  if (!smsReady(env)) return { ok: false, detail: 'SMS is not set up: AT_USERNAME and AT_API_KEY must both be set' };
  const username = String(env.AT_USERNAME).trim(), sandbox = username === 'sandbox';
  const body = new URLSearchParams({ username, to, message });
  if (has(env.AT_SENDER_ID)) body.set('from', String(env.AT_SENDER_ID).trim());
  try {
    const r = await fetch(sandbox ? 'https://api.sandbox.africastalking.com/version1/messaging' : 'https://api.africastalking.com/version1/messaging', {
      method: 'POST', headers: { apiKey: String(env.AT_API_KEY).trim(), Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    const d = await r.json().catch(() => null);
    const rec = (d && d.SMSMessageData && d.SMSMessageData.Recipients) || [];
    const good = r.ok && rec.length > 0 && rec.every((x) => [100, 101, 102].includes(Number(x.statusCode)));
    const detail = good ? '' : String((rec[0] && rec[0].status) || (d && d.SMSMessageData && d.SMSMessageData.Message) || ('HTTP ' + r.status)).slice(0, 200);
    console.log('sms: africastalking answered ' + r.status + (detail ? ' (' + detail + ')' : ''));
    return { ok: good, detail };
  } catch (e) { return { ok: false, detail: 'Could not reach Africa\'s Talking: ' + (e && e.message) }; }
}

const BENEFITS = [
  ['Spill it, nobody will know it was you', 'Share tea, secrets and campus news on the anonymous feed. No name, no phone, no trace.'],
  ['Buy and sell safely', 'The Market holds the buyer\'s money until the item is handed over, so nobody gets scammed.'],
  ['Earn while you study', 'Collect points, invite friends for rewards and cash out to M-Pesa from your wallet.'],
  ['More than a feed', 'Live streams, videos, Kura campus contests, Ludo games, Lost and Found, hostels and paid surveys.'],
  ['Never miss out', 'Phone alerts for replies, deals and campus events, even when the app is closed.'],
];

export function promoEmail(env, o) {
  const s = site(env), dl = dlUrl(env), support = String(env.SUPPORT_EMAIL || 'support@comradeconnect.co.ke');
  const paras = String(o.body || '').split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  const lead = paras.length ? paras : ['Comrade Connect is the campus app for Kenyan university comrades. Get it on your phone and everything is one tap away.'];
  const text = `${o.headline}\n\n${lead.join('\n\n')}\n\n${BENEFITS.map((b) => '- ' + b[0] + ': ' + b[1]).join('\n')}\n\nDownload the Android app: ${dl}\nOr open the website: ${s}\n\nYou get this because you chose to receive updates and offers in the app. Stop any time: ${o.unsub}\nHelp: ${support}\n`;
  const rowsHtml = BENEFITS.map((b) => `<tr><td style="padding:0 0 14px"><div style="font:700 14px Arial,sans-serif;color:#101422">${esc(b[0])}</div><div style="font:13px/1.55 Arial,sans-serif;color:#4a5068;margin-top:3px">${esc(b[1])}</div></td></tr>`).join('');
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#eef0f5">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(lead[0].slice(0, 110))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td align="center" style="background:#101422;padding:28px 20px 22px"><img src="${esc(s)}/icon-192.png" width="72" height="72" alt="Comrade Connect" style="display:block;border-radius:18px;border:0"></td></tr>
<tr><td style="padding:28px 26px 4px"><div style="font:700 22px/1.3 Arial,sans-serif;color:#101422">${esc(o.headline)}</div>${lead.map((p) => `<p style="font:14px/1.65 Arial,sans-serif;color:#2b3040;margin:12px 0 0">${esc(p)}</p>`).join('')}</td></tr>
<tr><td align="center" style="padding:22px 26px 8px"><a href="${esc(dl)}" style="display:inline-block;background:#101422;color:#ffffff;text-decoration:none;font:700 16px Arial,sans-serif;padding:15px 34px;border-radius:999px">Download the app</a><div style="font:12px Arial,sans-serif;color:#7a8199;margin-top:10px">Android. Tap the file when it finishes, then Install.</div></td></tr>
<tr><td style="padding:22px 26px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table></td></tr>
<tr><td align="center" style="padding:4px 26px 24px"><a href="${esc(s)}" style="font:600 13px Arial,sans-serif;color:#101422">Or use the website: ${esc(s.replace(/^https?:\/\//, ''))}</a></td></tr>
<tr><td style="padding:0 26px 26px"><div style="border-top:1px solid #e6e9f2;padding-top:14px;font:12px/1.6 Arial,sans-serif;color:#7a8199">You get this email because you chose to receive updates and offers in Comrade Connect. <a href="${esc(o.unsub)}" style="color:#101422">Unsubscribe</a> at any time. Need help? Write to <a href="mailto:${esc(support)}" style="color:#101422">${esc(support)}</a>.</div></td></tr>
</table></td></tr></table></body></html>`;
  return { text, html };
}

const page = (title, msg, form) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head><body style="margin:0;background:#101422;color:#fff;font:16px/1.6 Arial,sans-serif;display:grid;place-items:center;min-height:100vh;padding:20px"><div style="max-width:380px;text-align:center"><h1 style="font-size:22px">${esc(title)}</h1><p style="color:#c9cee0">${esc(msg)}</p>${form || ''}</div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

// ---- WhatsApp promo. Opt-in only (wa_ok = true). Messages go through the slow queue in wabot/send.js ----
const WA_DEFAULT = 'Comrade Connect: spill anonymously, buy and sell safely, earn rewards. Download the app: https://comradeconnect.co.ke';
const waText = (msg, link) => `${msg}\n\nUnsubscribe: ${link}\nReply STOP to stop these messages.`;
async function sendWhatsApp(env, b, url, ip) {
  if (typeof env.waPromo !== 'function' || typeof env.waSend !== 'function' || typeof env.waQueue !== 'function') return err(env, 'WhatsApp is not available on this server.', 400);
  const msg = str(b.wa, 600) || WA_DEFAULT, base = apiBase(env, url);
  if (b.test_to) {                                              // a test goes to ONE number you type, is not counted, and is not written down
    const to = normPhone(b.test_to);
    if (!to) return err(env, 'Enter a Kenyan number to test');
    let r; try { r = await env.waSend(to, waText(msg, `${base}/u/TESTTEST`)); } catch (e) { r = { ok: false, detail: 'error' }; }
    return json(env, { ok: !!(r && r.ok), test: true, detail: (r && r.detail) || '' });
  }
  const campaign = str(b.campaign, 40).replace(/[^A-Za-z0-9_-]/g, '');
  if (campaign.length < 3) return err(env, 'Give the campaign a name (3 to 40 letters or numbers). Each name is sent to a person only once.');
  const q = await env.waQueue();
  if (!q.linked) return err(env, 'The WhatsApp bot is not linked. Link it in the WhatsApp tab first.', 400);
  if (q.stopped) return err(env, 'WhatsApp sending is stopped for today (' + q.stopped + '). Try again tomorrow.', 400);
  if (q.waiting >= 300) return err(env, 'The queue still has ' + q.waiting + ' messages waiting. Wait for it to get shorter.', 400);
  const everyone = await rows(await sb(env, 'promo_contacts?select=id,wa_phone,unsub_token&wa_ok=eq.true&order=created_at.asc&limit=50000'));
  const done = new Set((await rows(await sb(env, `promo_sends?select=to_key&campaign=eq.${enc(campaign)}&channel=eq.whatsapp&limit=100000`))).map((x) => x.to_key));
  const seen = new Set(), todo = [];
  for (const c of everyone) { const k = String(c.wa_phone || ''); if (!k || done.has(k) || seen.has(k)) continue; seen.add(k); todo.push({ ...c, key: k }); }
  const batch = todo.slice(0, Math.min(100, int(b.limit, 1, 100) || 100));
  let queued = 0;
  for (const c of batch) {
    // Claim the person for this campaign BEFORE queuing. If the row already exists, someone else queued them, so we skip: this is what stops a double send.
    const claim = await rows(await post(env, 'promo_sends', { campaign, channel: 'whatsapp', to_key: c.key, contact_id: c.id, ok: false, detail: 'queued' }, 'resolution=ignore-duplicates,return=representation'));
    if (!claim.length) continue;
    env.waPromo(c.key, waText(msg, `${base}/u/${c.unsub_token}`),
      async (r) => { await patch(env, `promo_sends?campaign=eq.${enc(campaign)}&channel=eq.whatsapp&to_key=eq.${enc(c.key)}`, { ok: !!r.ok, detail: r.ok ? null : String(r.detail || '').slice(0, 200) }).catch(() => null); },
      async () => { const w = await one(await sb(env, `promo_contacts?select=wa_ok&id=eq.${enc(c.id)}&limit=1`)); return !!(w && w.wa_ok); });
    queued++;
  }
  await audit(env, 'promo.send', 'promo', campaign, { channel: 'whatsapp', queued }, ip);
  return json(env, { ok: true, queued, remaining: todo.length - batch.length, queue: await env.waQueue() });
}

export async function promoRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;

  // ---- public: unsubscribe (a page with a button, so mail scanners that open links cannot unsubscribe anyone by accident) ----
  const um = path.match(/^\/u\/([A-Za-z0-9]{8,40})$/);
  if (um || path === '/api/promo/unsub') {
    const t = um ? um[1] : String(url.searchParams.get('t') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
    if (t.length < 8) return page('Link not valid', 'This unsubscribe link is not complete.');
    if (m === 'POST') {
      if (!(await throttle(env, ip, 'promounsub', t, 20, 40))) return page('Try again later', 'Too many tries. Please wait a few minutes.');
      await patch(env, `promo_contacts?unsub_token=eq.${enc(t)}`, { email_ok: false, sms_ok: false, unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      const wa = await patch(env, `promo_contacts?unsub_token=eq.${enc(t)}&wa_ok=eq.true`, { wa_ok: false, wa_phone: null }).then((r) => rows(r)).catch(() => []);   // WhatsApp too (columns come from promo.sql)
      for (const g of wa) await patch(env, `phone_links?aid=eq.${enc(g.aid)}`, { phone_enc: null }).catch(() => null);
      return page('You are unsubscribed', 'You will not get promo emails or texts from Comrade Connect any more. You can switch them back on in the app under Me > Offers and updates.');
    }
    return page('Unsubscribe?', 'Stop promo emails and texts from Comrade Connect?', `<form method="post" action="${esc(path + (um ? '' : '?t=' + t))}"><button style="margin-top:12px;border:0;border-radius:999px;padding:14px 28px;background:#fff;color:#101422;font:700 15px Arial,sans-serif;cursor:pointer">Yes, unsubscribe me</button></form>`);
  }

  // ---- signed-in person: read and change their own choice ----
  if (path === '/api/me/promo') {
    const u = await user(req, env, m === 'POST'); if (u instanceof Response) return u;
    const cur = await one(await sb(env, `promo_contacts?select=*&aid=eq.${enc(u.aid)}&limit=1`));
    const lk = await one(await sb(env, `phone_links?select=phone_hash,last4,verified_at&aid=eq.${enc(u.aid)}&limit=1`));   // the verified WhatsApp number, if any
    if (m === 'GET') return json(env, { email: cur ? cur.email || '' : '', phone: cur ? cur.phone || '' : '', email_ok: !!(cur && cur.email_ok), sms_ok: !!(cur && cur.sms_ok), sms_available: smsReady(env), wa_ok: !!(cur && cur.wa_ok), wa_linked: !!(lk && lk.verified_at), wa_last4: lk && lk.verified_at ? lk.last4 || '' : '' });
    if (m !== 'POST') return err(env, 'Not found', 404);
    if (!(await throttle(env, ip, 'promoopt', u.aid, 12, 40))) return tooMany(env);
    const b = await req.json().catch(() => ({}));
    const email = EMAIL.test(str(b.email, 120)) ? str(b.email, 120).toLowerCase() : '', phone = normPhone(b.phone);
    if (b.email_ok && !email) return err(env, 'Enter a real email address');
    if (b.sms_ok && !phone) return err(env, 'Enter a Kenyan number like 0712345678');
    // WhatsApp offers need a VERIFIED number. The person types it again and it must match the one they linked (compared as a keyed hash).
    let wphone = '';
    if (b.wa_ok) {
      if (!lk || !lk.verified_at) return err(env, 'Link your WhatsApp number first (tap Link my WhatsApp number).');
      wphone = normPhone(b.wa_phone);
      if (!wphone || !tsEqual(lk.phone_hash, await H(env, 'phone:' + wphone))) return err(env, 'Type the WhatsApp number you linked' + (lk.last4 ? ' (it ends in ' + lk.last4 + ')' : '') + '.');
    }
    const wok = !!wphone;
    const eok = !!b.email_ok && !!email, sok = !!b.sms_ok && !!phone, now = new Date().toISOString(), any = eok || sok || wok;
    if (cur) {
      await patch(env, `promo_contacts?aid=eq.${enc(u.aid)}`, { email: email || cur.email || null, phone: phone || cur.phone || null, email_ok: eok, sms_ok: sok, consent_at: any ? now : cur.consent_at, consent_ip: any ? ip : cur.consent_ip, unsubscribed_at: any ? null : (cur.unsubscribed_at || now), updated_at: now });
    } else if (any) {
      const r = await post(env, 'promo_contacts', { aid: u.aid, email: email || null, phone: phone || null, email_ok: eok, sms_ok: sok, consent_at: now, consent_ip: ip, unsub_token: randHex(8) });
      if (!r.ok) return err(env, 'Could not save. Ask the admin to run supabase/promo.sql first.', 500);
    }
    if (b.wa_ok !== undefined) {   // older app versions do not send this: they leave WhatsApp as it was
      const w = await patch(env, `promo_contacts?aid=eq.${enc(u.aid)}`, { wa_ok: wok, wa_phone: wok ? wphone : null });
      if (wok && !w.ok) return err(env, 'Could not save. Ask the admin to run supabase/promo.sql first.', 500);
      await patch(env, `phone_links?aid=eq.${enc(u.aid)}`, { phone_enc: wok ? wphone : null }).catch(() => null);   // the number is kept only while they are opted in
    }
    return json(env, { ok: true, email_ok: eok, sms_ok: sok, wa_ok: wok });
  }

  // ---- admin ----
  if (!path.startsWith('/api/admin/promo')) return null;
  if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);
  if (path === '/api/admin/promo/queue' && m === 'GET') return json(env, typeof env.waQueue === 'function' ? await env.waQueue() : { waiting: 0, sent: 0, failed: 0, today: 0, cap: 0, stopped: '', linked: false });
  if (path === '/api/admin/promo' && m === 'GET') {
    const all = await rows(await sb(env, 'promo_contacts?select=email,phone,email_ok,sms_ok,wa_ok,wa_phone&limit=50000'));
    return json(env, { emails: new Set(all.filter((c) => c.email_ok && c.email).map((c) => c.email.toLowerCase())).size, phones: new Set(all.filter((c) => c.sms_ok && c.phone).map((c) => c.phone)).size,
      whatsapps: new Set(all.filter((c) => c.wa_ok && c.wa_phone).map((c) => c.wa_phone)).size, wa_linked: !!(typeof env.waQueue === 'function' && (await env.waQueue()).linked),
      mail_ready: mailReady(env), sms_ready: smsReady(env), sandbox: String(env.AT_USERNAME || '').trim() === 'sandbox', sender: has(env.AT_SENDER_ID) ? String(env.AT_SENDER_ID).trim() : '', download: dlUrl(env), api: apiBase(env, url) });
  }
  if (path === '/api/admin/promo/send' && m === 'POST') {
    const b = await req.json().catch(() => ({})), channel = b.channel === 'sms' ? 'sms' : 'email';
    if (b.channel === 'whatsapp') return sendWhatsApp(env, b, url, ip);
    const campaign = str(b.campaign, 40).replace(/[^A-Za-z0-9_-]/g, '');
    const o = { headline: str(b.headline, 100) || 'Everything campus, in one app', body: str(b.body, 1200) };
    const subject = str(b.subject, 120) || 'Comrade Connect: the campus app, now on your phone';
    const sms = str(b.sms, 300) || 'Comrade Connect: spill anonymously, buy and sell safely, earn rewards. Get the app: ' + site(env).replace(/^https?:\/\//, '');
    if (channel === 'email' && !mailReady(env)) return err(env, 'Email is not set up. Add MAIL_FROM and BREVO_API_KEY (or RESEND_API_KEY) on Render.', 400);
    if (channel === 'sms' && !smsReady(env)) return err(env, 'SMS is not set up. Add AT_USERNAME and AT_API_KEY on Render (Africa\'s Talking).', 400);
    const base = apiBase(env, url);
    const deliver = async (c) => channel === 'email'
      ? sendMailDetailed(env, { to: c.email, subject, ...promoEmail(env, { ...o, unsub: `${base}/u/${c.unsub_token}` }) })
      : sendSms(env, c.phone, `${sms} Stop: ${base}/u/${c.unsub_token}`);
    if (b.test_to) {                                              // a test goes to ONE address you type, is not counted, and is not written down
      const to = channel === 'email' ? (EMAIL.test(str(b.test_to, 120)) ? str(b.test_to, 120) : '') : normPhone(b.test_to);
      if (!to) return err(env, channel === 'email' ? 'Enter a real email address to test' : 'Enter a Kenyan number to test');
      const r = await deliver({ email: to, phone: to, unsub_token: 'TESTTEST' });
      return json(env, { ok: r.ok, test: true, detail: r.detail || '' });
    }
    if (campaign.length < 3) return err(env, 'Give the campaign a name (3 to 40 letters or numbers). Each name is sent to a person only once.');
    const flag = channel === 'sms' ? 'sms_ok' : 'email_ok', col = channel === 'sms' ? 'phone' : 'email';
    const everyone = await rows(await sb(env, `promo_contacts?select=id,email,phone,unsub_token&${flag}=eq.true&order=created_at.asc&limit=50000`));
    const done = new Set((await rows(await sb(env, `promo_sends?select=to_key&campaign=eq.${enc(campaign)}&channel=eq.${channel}&limit=100000`))).map((x) => x.to_key));
    const seen = new Set(), todo = [];
    for (const c of everyone) { const k = String(c[col] || '').toLowerCase(); if (!k || done.has(k) || seen.has(k)) continue; seen.add(k); todo.push({ ...c, key: k }); }
    const batch = todo.slice(0, int(b.limit, 1, 300) || 100);
    let sent = 0, failed = 0, firstError = '';
    for (let i = 0; i < batch.length; i += 5) {
      await Promise.all(batch.slice(i, i + 5).map(async (c) => {
        let r; try { r = await deliver(c); } catch (e) { r = { ok: false, detail: String(e && e.message).slice(0, 150) }; }
        if (r.ok) sent++; else { failed++; if (!firstError) firstError = r.detail || 'failed'; }
        await post(env, 'promo_sends', { campaign, channel, to_key: c.key, contact_id: c.id, ok: !!r.ok, detail: r.ok ? null : String(r.detail || '').slice(0, 200) }, 'resolution=ignore-duplicates,return=minimal').catch(() => null);
      }));
    }
    await audit(env, 'promo.send', 'promo', campaign, { channel, sent, failed }, ip);
    return json(env, { ok: true, sent, failed, remaining: todo.length - batch.length, first_error: firstError });
  }
  return null;
}
