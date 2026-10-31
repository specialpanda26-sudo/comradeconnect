import { readJson, writeJson } from './paths.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const num = (j) => String(j || '').split('@')[0].split(':')[0];
const BATCH = 25, MIN = 20000, MAX = 45000;

const VARIANTS = [
  (l) => `Niaje comrades 👋\nGot tea but don't want your name on it? Spill it anonymously, no login, no trace.\n\nHow: open the link, tap *Drop Tea / Spill Secret*, type it, post. Done.\n${l}`,
  (l) => `Mambo comrades 🔥\nHostel gossip, campus secrets, things nobody dares say out loud, drop them anonymously and read what other campuses are saying.\n\n1) Open the link\n2) Tap Spill\n3) Post, nobody will know it was you\n${l}`,
  (l) => `Comrades, mnasemaje? 👀\nThere's a campus feed where you can spill anything without your name. No signup drama.\n\nTap the link, hit *Spill*, and share the juicy ones to WhatsApp.\n${l}`,
  (l) => `Hii ni ya comrades tu 🤫\nSpill it. Nobody will know it was you.\nOpen, tap *Spill*, post.\n${l}`,
];

const load = () => readJson('spill-data.json', { skip: [], sent: {} });
const save = (d) => writeJson('spill-data.json', d);
let pending = [], link = '', note = '', running = false, stopFlag = false, done = 0, failed = 0, total = 0, lastMsg = '';

export const spillStatus = () => ({ running, pending: pending.length, done, failed, total, link, message: lastMsg });

async function buildQueue(sock) {
  const d = load(), me = num(sock.user && sock.user.id);
  const all = Object.values(await sock.groupFetchAllParticipating());
  const now = Date.now(), q = [];
  for (const g of all) {
    if (d.skip.includes(g.id)) continue;
    if (d.sent[g.id + '|' + link] && now - d.sent[g.id + '|' + link] < 864e5) continue;
    const mine = (g.participants || []).find((p) => num(p.id) === me);
    if (g.announce && !(mine && mine.admin)) continue;
    q.push({ id: g.id, name: g.subject });
  }
  return { q: q.sort(() => Math.random() - 0.5), all: all.length };
}

async function runBatch(sock) {
  if (running) throw new Error('Already sending. Wait for it or tap Stop.');
  if (!pending.length) throw new Error('No groups left. Start a new message.');
  running = true; stopFlag = false; done = 0; failed = 0;
  const batch = pending.splice(0, BATCH); total = batch.length; let fails = 0;
  lastMsg = 'Sending to ' + total + ' groups, one every 20 to 45 seconds.';
  (async () => {
    for (let i = 0; i < batch.length; i++) {
      const g = batch[i];
      if (stopFlag) { pending.unshift(...batch.slice(i)); lastMsg = 'Stopped.'; break; }
      try {
        let t = pick(VARIANTS)(link); if (note) t = note + '\n\n' + t;
        await sock.sendPresenceUpdate('composing', g.id).catch(() => {});
        await sleep(rnd(1500, 4000));
        await sock.sendMessage(g.id, { text: t });
        const d = load(); d.sent[g.id + '|' + link] = Date.now(); save(d);
        done++; fails = 0;
      } catch (e) {
        failed++;
        if (++fails >= 3) { pending.unshift(...batch.slice(i + 1)); lastMsg = '3 sends failed in a row, stopped to protect your number. Try again later.'; break; }
      }
      await sleep(rnd(MIN, MAX));
    }
    running = false;
    if (!/Stopped|failed in a row/.test(lastMsg)) lastMsg = 'Batch finished.';
  })();
}

export async function spillStart(sock, o) {
  if (!sock || !sock.user) throw new Error('Link WhatsApp first.');
  const l = String((o && o.link) || '').trim();
  if (!/^https?:\/\/\S+$/i.test(l)) throw new Error('Enter a link that starts with https://');
  link = l; note = String((o && o.note) || '').trim().slice(0, 300);
  const b = await buildQueue(sock); pending = b.q;
  if (!pending.length) throw new Error('No groups to send to (' + b.all + ' found; admin-only groups, skipped groups and groups already sent this link in 24 hours are left out).');
  await runBatch(sock);
}
export const spillMore = (sock) => { if (!sock || !sock.user) throw new Error('Link WhatsApp first.'); return runBatch(sock); };
export const spillStop = () => { stopFlag = true; };

// In any group, send ".spill skip" from your own phone to leave that group out; ".spill unskip" to bring it back.
export function attachSpill(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const m of messages || []) {
      try {
        const jid = m.key.remoteJid || '';
        const text = ((m.message && (m.message.conversation || (m.message.extendedTextMessage && m.message.extendedTextMessage.text))) || '').trim();
        if (!m.key.fromMe || !jid.endsWith('@g.us') || !/^[.!\/]spill\s+(un)?skip$/i.test(text)) continue;
        const on = !/unskip/i.test(text), d = load();
        d.skip = d.skip.filter((x) => x !== jid); if (on) d.skip.push(jid); save(d);
        pending = pending.filter((g) => g.id !== jid);
        await sock.sendMessage(jid, { text: on ? 'This group will be skipped.' : 'This group is back on the list.' });
      } catch (e) {}
    }
  });
}
