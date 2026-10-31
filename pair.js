/* Pairing panel: paste your number, get an 8-character code, link it in WhatsApp. */
const express = require('express'), fs = require('fs'), path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const spill = require('./spillgroups');
const DIR = process.env.SESSIONS_DIR || path.join(__dirname, 'sessions');
const PASS = process.env.PAIR_PASSWORD || '';
const socks = {};

async function start(number, wantCode) {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(DIR, number));
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, logger: pino({ level: 'silent' }), browser: Browsers.ubuntu('Chrome'), printQRInTerminal: false });
  socks[number] = sock;
  sock.ev.on('creds.update', saveCreds);
  spill(sock, { owners: number });
  require('./spillai')(sock, { owners: number });
  sock.ev.on('connection.update', u => {
    if (u.connection === 'open') console.log('[pair] connected', number);
    if (u.connection === 'close') {
      const c = u.lastDisconnect && u.lastDisconnect.error && u.lastDisconnect.error.output && u.lastDisconnect.error.output.statusCode;
      if (c === DisconnectReason.loggedOut) { fs.rmSync(path.join(DIR, number), { recursive: true, force: true }); delete socks[number]; }
      else if (state.creds.registered) setTimeout(() => start(number), 3000);
    }
  });
  if (wantCode && !state.creds.registered) {
    await new Promise(r => setTimeout(r, 3000));
    return await sock.requestPairingCode(number);
  }
}

const PAGE = `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>Link WhatsApp</title>
<body style="font-family:system-ui;background:#fbf1ed;color:#16130f;max-width:420px;margin:40px auto;padding:0 18px">
<h2>Link your WhatsApp</h2>
<input id=n placeholder="2547XXXXXXXX (with country code)" inputmode=numeric style="width:100%;padding:14px;border-radius:12px;border:1px solid #ccc;font-size:16px;box-sizing:border-box">
<input id=p type=password placeholder="Panel password" style="width:100%;padding:14px;margin-top:10px;border-radius:12px;border:1px solid #ccc;font-size:16px;box-sizing:border-box">
<button onclick=go() style="width:100%;padding:14px;margin-top:10px;border:0;border-radius:999px;background:#16130f;color:#fff;font-size:16px">Get pairing code</button>
<h1 id=c style="letter-spacing:6px;text-align:center"></h1><p id=m></p>
<script>async function go(){c.textContent='';m.textContent='Working...';
const r=await fetch('/pair/code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number:n.value,password:p.value})});
const d=await r.json();if(d.code){c.textContent=d.code;m.textContent='Open WhatsApp > Settings > Linked devices > Link a device > Link with phone number instead, then type this code.'}else m.textContent=d.error||'Failed'}</script>`;

module.exports = function mount(app) {
  app.use(express.json());
  app.get('/pair', (q, r) => r.send(PAGE));
  app.post('/pair/code', async (q, r) => {
    try {
      const number = String((q.body && q.body.number) || '').replace(/\D/g, '');
      if (PASS && (q.body && q.body.password) !== PASS) return r.status(401).json({ error: 'Wrong password' });
      if (number.length < 8 || number.length > 15) return r.status(400).json({ error: 'Enter the number with country code, digits only' });
      if (socks[number]) return r.json({ error: 'This number is already linked' });
      const code = await start(number, true);
      r.json({ code: code && code.match(/.{1,4}/g).join('-') });
    } catch (e) { r.status(500).json({ error: 'Could not get a code, try again in a minute' }); }
  });
  try { fs.mkdirSync(DIR, { recursive: true }); fs.readdirSync(DIR).forEach(n => start(n).catch(() => {})); } catch (e) {}
};

if (require.main === module) {
  const app = express(); module.exports(app);
  app.listen(process.env.PORT || 3000, () => console.log('[pair] panel on /pair'));
}
