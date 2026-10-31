// One global WhatsApp send queue for the whole app (codes and promos share it).
// Why: WhatsApp bans numbers that burst. So: one message at a time, promos wait 8 to 20 seconds between each,
// codes jump the queue (sent within about 2 seconds), a daily cap protects the number, and a ban or limit
// error stops promos for the rest of the day. The day's counter is saved on the disk so a restart cannot reset it.
// Never logs a number or a message text.
import { readJson, writeJson } from './paths.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const FILE = 'send-day.json';
const NOT_SENT = ['WhatsApp bot not linked', 'not on WhatsApp', 'bad number'];
const BAN = /rate-overlimit|forbidden|banned|not-authorized|spam|too many|\b(403|429)\b/i;

// The day rolls over at midnight in Kenya (UTC+3), because that is when the team thinks of a "new day".
const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
export const dailyCap = () => { const n = Number(process.env.WA_PROMO_DAILY_CAP); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 100; };
function day() {
  const d = readJson(FILE, null);
  return d && d.day === today() ? d : { day: today(), n: 0, stopped: '' };
}
const saveDay = (d) => writeJson(FILE, d);
export function stopToday(reason) { const d = day(); d.stopped = String(reason || 'stopped').slice(0, 80); saveDay(d); }

const urgent = [], promo = [];
let running = false, nextPromoAt = 0, wake = null, resumeTimer = null;
const stats = { sent: 0, failed: 0 };

const clean = (e) => String((e && e.message) || e || 'failed').replace(/\d{6,}/g, '#').slice(0, 120);   // strip long digit runs so no number leaks into a detail

// Send ONE message right now. Never throws. Returns { ok, detail }.
async function deliver(phone, text) {
  try {
    const M = await import('./manager.js');
    const sock = M.getSock();
    if (!sock || !sock.user || M.status().status !== 'connected') return { ok: false, detail: 'WhatsApp bot not linked' };
    const digits = String(phone || '').replace(/\D/g, '');
    if (!/^\d{8,15}$/.test(digits)) return { ok: false, detail: 'bad number' };
    const found = await sock.onWhatsApp(digits + '@s.whatsapp.net');
    const hit = Array.isArray(found) ? found[0] : null;
    if (!hit || !hit.exists) return { ok: false, detail: 'not on WhatsApp' };
    await sock.sendMessage(hit.jid || digits + '@s.whatsapp.net', { text: String(text || '') });
    return { ok: true };
  } catch (e) {
    const detail = clean(e), code = e && e.output && e.output.statusCode;
    if (BAN.test(detail) || code === 403 || code === 429) stopToday('WhatsApp limit or ban signal');
    return { ok: false, detail };
  }
}

// Wait, but let a code wake us up early.
const nap = (ms) => new Promise((resolve) => { const t = setTimeout(done, ms); function done() { clearTimeout(t); wake = null; resolve(); } wake = done; });

async function loop() {
  if (running) return;                                    // never two send loops at once
  running = true;
  try {
    while (urgent.length || promo.length) {
      let job = urgent.shift(), isPromo = false;
      if (!job) {
        const d = day();
        if (d.stopped || d.n >= dailyCap()) { armResume(); break; }   // promos wait for tomorrow; they stay in the queue
        const wait = nextPromoAt - Date.now();
        if (wait > 0) { await nap(wait); continue; }      // re-check: a code may have arrived while we slept
        job = promo.shift(); isPromo = true;
        // Last look before sending: is this person still opted in? If we cannot check, we do not send.
        if (job.guard) { let ok = false; try { ok = await job.guard(); } catch (e) {} if (!ok) { try { if (job.done) await job.done({ ok: false, detail: 'opted out' }); } catch (e) {} continue; } }
      }
      let r;
      try { r = await deliver(job.phone, job.text); } catch (e) { r = { ok: false, detail: clean(e) }; }
      if (isPromo) {
        if (!NOT_SENT.includes(r.detail)) { const d = day(); d.n += 1; saveDay(d); }   // counted when we tried to send, so a crash cannot give extra sends; offline or not-on-WhatsApp never reached the socket
        nextPromoAt = Date.now() + rnd(8000, 20000);
        if (r.ok) stats.sent++; else stats.failed++;
        try { if (job.done) await job.done(r); } catch (e) { /* the saver must never stop the queue */ }
      } else {
        job.resolve(r);
        await sleep(rnd(300, 900));                       // tiny gap so two codes do not leave in the same instant
      }
    }
  } finally { running = false; }
}

// Start the loop again at the start of the next Kenyan day, if promos are still waiting.
function armResume() {
  if (resumeTimer || !promo.length) return;
  const nowK = Date.now() + 3 * 3600e3, next = (Math.floor(nowK / 864e5) + 1) * 864e5 - 3 * 3600e3;
  resumeTimer = setTimeout(() => { resumeTimer = null; loop(); }, Math.max(60e3, next - Date.now() + 5000));
  if (resumeTimer.unref) resumeTimer.unref();
}

// A one-time code or any message that must go now. Resolves with { ok, detail }. Never rejects.
export function sendUrgent(phone, text) {
  return new Promise((resolve) => {
    urgent.push({ phone, text, resolve });
    if (wake) wake();
    loop();
  });
}

// A promo: goes to the slow lane. done({ ok, detail }) is called when it has been tried.
export function queuePromo(phone, text, done, guard) {
  promo.push({ phone, text, done, guard });
  loop();
  return promo.length;
}

export async function queueStatus() {
  const d = day();
  let linked = false; try { const M = await import('./manager.js'); linked = M.status().status === 'connected'; } catch (e) {}
  return { waiting: promo.length, sent: stats.sent, failed: stats.failed, today: d.n, cap: dailyCap(), stopped: d.stopped || '', sending: running, linked };
}
