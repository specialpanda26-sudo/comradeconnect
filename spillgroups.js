/* Spill group broadcaster. Owner only. Slow, batched, resumable. */
const fs = require('fs'), path = require('path');
const FILE = path.join(__dirname, 'spill-data.json');
const load = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { skip: [], sent: {} }; } };
const save = d => { try { fs.writeFileSync(FILE, JSON.stringify(d)); } catch {} };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const num = j => String(j || '').split('@')[0].split(':')[0];

const VARIANTS = [
  l => `Niaje comrades 👋\nGot tea but don't want your name on it? Spill it anonymously, no login, no trace.\n\nHow: open the link, tap *Drop Tea / Spill Secret*, type it, post. Done.\n${l}`,
  l => `Mambo comrades 🔥\nHostel gossip, campus secrets, things nobody dares say out loud, drop them anonymously and read what other campuses are saying.\n\n1) Open the link\n2) Tap Spill\n3) Post, nobody will know it was you\n${l}`,
  l => `Comrades, mnasemaje? 👀\nThere's a campus feed where you can spill anything without your name. No signup drama.\n\nTap the link, hit *Spill*, and share the juicy ones to WhatsApp.\n${l}`,
  l => `Hii ni ya comrades tu 🤫\nSpill it. Nobody will know it was you.\nOpen, tap *Spill*, post.\n${l}`
];

module.exports = function spillgroups(sock, opts = {}) {
  const owners = String(opts.owners || process.env.OWNER_NUMBER || '').split(',').map(s => s.replace(/\D/g, '')).filter(Boolean);
  const BATCH = opts.batch || 25, MIN = opts.minDelay || 20000, MAX = opts.maxDelay || 45000;
  let pending = [], link = '', note = '', running = false, stop = false, done = 0;

  const say = (jid, text) => sock.sendMessage(jid, { text }).catch(() => {});

  async function buildQueue(force) {
    const d = load(), me = num(sock.user && sock.user.id);
    const all = Object.values(await sock.groupFetchAllParticipating());
    const now = Date.now(), q = [];
    for (const g of all) {
      if (d.skip.includes(g.id)) continue;
      const k = g.id + '|' + link;
      if (!force && d.sent[k] && now - d.sent[k] < 864e5) continue;
      const mine = (g.participants || []).find(p => num(p.id) === me);
      if (g.announce && !(mine && mine.admin)) continue;
      q.push({ id: g.id, name: g.subject });
    }
    return q.sort(() => Math.random() - .5);
  }

  async function runBatch(reply) {
    if (running) return say(reply, 'Already running. Use .spill status or .spill stop');
    if (!pending.length) return say(reply, 'Nothing left to send. Start a new one: .spill <link>');
    running = true; stop = false; done = 0;
    const batch = pending.splice(0, BATCH); let fails = 0;
    await say(reply, `Sending to ${batch.length} groups, ${pending.length} left after this. About ${Math.round(batch.length * 32 / 60)} min.`);
    for (const g of batch) {
      if (stop) { pending.unshift(g, ...batch.slice(batch.indexOf(g) + 1)); break; }
      try {
        let t = pick(VARIANTS)(link); if (note) t = note + '\n\n' + t;
        await sock.sendPresenceUpdate('composing', g.id).catch(() => {});
        await sleep(rnd(1500, 4000));
        await sock.sendMessage(g.id, { text: t });
        const d = load(); d.sent[g.id + '|' + link] = Date.now(); save(d);
        done++; fails = 0;
      } catch (e) {
        if (++fails >= 3) { pending.unshift(...batch.slice(batch.indexOf(g))); await say(reply, '3 sends failed in a row, stopped to protect your number. Try .spill more later.'); break; }
      }
      await sleep(rnd(MIN, MAX));
    }
    running = false;
    await say(reply, `Batch done. Sent ${done}. ${pending.length} groups left. Send .spill more to continue.`);
  }

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const m of messages || []) {
      try {
        const jid = m.key.remoteJid;
        const text = ((m.message && (m.message.conversation || (m.message.extendedTextMessage && m.message.extendedTextMessage.text))) || '').trim();
        if (!/^[.!\/]spill\b/i.test(text)) continue;
        if (!m.key.fromMe && !owners.includes(num(m.key.participant || jid))) continue;
        const arg = text.replace(/^[.!\/]spill\s*/i, '');
        const reply = jid;
        if (/^stop$/i.test(arg)) { stop = true; await say(reply, 'Stopping after the current group.'); }
        else if (/^status$/i.test(arg)) await say(reply, `${running ? 'Running' : 'Idle'}. Sent this batch: ${done}. Left: ${pending.length}.`);
        else if (/^more$/i.test(arg)) runBatch(reply);
        else if (/^skip$/i.test(arg) || /^unskip$/i.test(arg)) {
          if (!jid.endsWith('@g.us')) { await say(reply, 'Use this inside the group.'); continue; }
          const d = load(), on = /^skip$/i.test(arg);
          d.skip = d.skip.filter(x => x !== jid); if (on) d.skip.push(jid); save(d);
          pending = pending.filter(g => g.id !== jid);
          await say(reply, on ? 'This group will be skipped.' : 'This group is back on the list.');
        } else if (/https?:\/\//i.test(arg)) {
          const m2 = arg.match(/https?:\/\/\S+/i); link = m2[0]; note = arg.replace(link, '').trim();
          pending = await buildQueue(false);
          await say(reply, `Found ${pending.length} groups to send to (skipping admin-only groups, skipped groups, and ones already sent this link in 24h).`);
          runBatch(reply);
        } else await say(reply, 'Use:\n.spill <link> [optional intro]\n.spill more\n.spill stop\n.spill status\n.spill skip (inside a group)\n.spill unskip');
      } catch (e) {}
    }
  });
};
