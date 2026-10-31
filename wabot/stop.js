// Inbound STOP for WhatsApp promos. Someone replies STOP, UNSUBSCRIBE or ACHA in a private chat:
// we turn their WhatsApp offers off and answer once. The message is marked so the Gemini reply handler in ai.js skips it.
// Never logs a number or a message.
import { rows, patch, enc } from '../backend/src/lib.js';

let ENV = null;
export const setStopEnv = (e) => { ENV = e; };
const WORDS = /^(stop|unsubscribe|acha)[.!]*$/i;
const replied = new Map();                       // chat -> time of our last answer, so one STOP gets one answer
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const textOf = (m) => String((m.message && (m.message.conversation || (m.message.extendedTextMessage && m.message.extendedTextMessage.text))) || '').trim();
const privateChat = (jid) => jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid');

// A chat id is normally the phone number. Some chats use a hidden id (@lid); newer Baileys adds the real number to the message key.
function digitsOf(m, jid) {
  const raw = jid.endsWith('@s.whatsapp.net') ? jid : (m.key.senderPn || m.key.remoteJidAlt || m.key.participantPn || '');
  const d = String(raw).split('@')[0].split(':')[0].replace(/\D/g, '');
  return d.length >= 9 && d.length <= 15 ? d : '';
}

async function unsubscribe(digits) {
  const num = '+' + digits;
  const gone = await rows(await patch(ENV, `promo_contacts?wa_phone=eq.${enc(num)}&wa_ok=eq.true`, { wa_ok: false, wa_phone: null, updated_at: new Date().toISOString() }));
  for (const g of gone) await patch(ENV, `phone_links?aid=eq.${enc(g.aid)}`, { phone_enc: null }).catch(() => null);   // the number is kept only while opted in
}

export function attachStop(sock) {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type && type !== 'notify') return;
    const hits = [];
    // This loop has no await on purpose: the flag must be set before the AI handler (registered after us) looks at the message.
    for (const m of messages || []) {
      const jid = (m.key && m.key.remoteJid) || '';
      if (!jid || m.key.fromMe || !privateChat(jid) || !WORDS.test(textOf(m))) continue;
      m.__ccStop = true;
      hits.push({ m, jid });
    }
    for (const { m, jid } of hits) {
      try {
        const digits = digitsOf(m, jid);
        if (!ENV || !digits) continue;                                   // cannot tell who this is: say nothing rather than claim something false
        await unsubscribe(digits);
        if (Date.now() - (replied.get(jid) || 0) < 10 * 60e3) continue;
        replied.set(jid, Date.now());
        await sleep(1000 + Math.floor(Math.random() * 2000));
        await sock.sendMessage(jid, { text: 'You are unsubscribed.' });
      } catch (e) { console.log('[wa-stop] could not handle a STOP message'); }
    }
  });
}
