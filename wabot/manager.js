import fs from 'node:fs';
import path from 'node:path';
import { DIR, ensureDir } from './paths.js';
import { attachAi, aiInfo } from './ai.js';
import { attachSpill, spillStatus } from './spill.js';

const AUTH = path.join(DIR, 'auth');
const S = { status: 'idle', number: '', qr: '', code: '', error: '' };
let sock = null, mode = '', pairNumber = '', codeAsked = false, tries = 0, timer = null, libs = null, gen = 0;

async function loadLibs() {
  if (libs) return libs;
  const b = await import('@whiskeysockets/baileys');
  const g = (n) => b[n] || (b.default && b.default[n]);
  const make = typeof b.makeWASocket === 'function' ? b.makeWASocket : typeof b.default === 'function' ? b.default : b.default && b.default.default;
  const pino = (await import('pino')).default;
  let QR = null; try { QR = (await import('qrcode')).default; } catch (e) {}
  libs = { make, multi: g('useMultiFileAuthState'), Reason: g('DisconnectReason'), version: g('fetchLatestBaileysVersion'), Browsers: g('Browsers'), pino, QR };
  return libs;
}

const wipe = () => { try { fs.rmSync(AUTH, { recursive: true, force: true }); } catch (e) {} };
const reset = () => { S.qr = ''; S.code = ''; };

async function start() {
  const my = ++gen; clearTimeout(timer);
  try {
    const L = await loadLibs(); ensureDir();
    const { state, saveCreds } = await L.multi(AUTH);
    let version; try { version = (await L.version()).version; } catch (e) {}
    if (my !== gen) return;
    const s = L.make({ auth: state, version, logger: L.pino({ level: 'silent' }), browser: L.Browsers.ubuntu('Chrome'), printQRInTerminal: false, markOnlineOnConnect: false, syncFullHistory: false });
    sock = s;
    s.ev.on('creds.update', saveCreds);
    attachAi(s); attachSpill(s);
    s.ev.on('connection.update', async (u) => {
      if (my !== gen) return;
      const { connection, lastDisconnect, qr } = u;
      if (qr && !s.authState.creds.me) {
        if (mode === 'code') {
          if (!codeAsked && pairNumber) {
            codeAsked = true;
            try { const c = await s.requestPairingCode(pairNumber); if (my !== gen) return; S.code = String(c).match(/.{1,4}/g).join('-'); S.status = 'code'; S.qr = ''; S.error = ''; }
            catch (e) { S.status = 'idle'; reset(); S.error = 'Could not get a code. Check the number and try again.'; }
          }
        } else {
          try { S.qr = L.QR ? await L.QR.toDataURL(qr, { margin: 1, width: 300 }) : ''; } catch (e) { S.qr = ''; }
          if (my !== gen) return;
          S.status = 'qr'; S.error = S.qr ? '' : 'QR needs the qrcode package on the server.';
        }
      }
      if (connection === 'open') {
        S.status = 'connected'; S.number = String((s.user && s.user.id) || '').split('@')[0].split(':')[0]; reset(); S.error = ''; tries = 0;
      }
      if (connection === 'close') {
        const c = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode;
        if (c === L.Reason.loggedOut) { wipe(); sock = null; S.status = 'idle'; S.number = ''; reset(); S.error = 'WhatsApp logged this device out. Link again.'; return; }
        const linked = !!s.authState.creds.me;
        if (linked || c === L.Reason.restartRequired) { S.status = S.status === 'connected' ? 'reconnecting' : 'connecting'; timer = setTimeout(start, 2000); }
        else if (mode === 'qr' && ++tries < 8) timer = setTimeout(start, 1500);
        else { S.status = 'idle'; reset(); S.error = 'Timed out. Tap the button to try again.'; }
      }
    });
  } catch (e) {
    S.status = 'idle'; reset();
    S.error = /Cannot find|ERR_MODULE_NOT_FOUND/.test(String(e.message)) ? 'The WhatsApp library is not installed on the server. Redeploy so it can install.' : 'Could not start: ' + String(e.message).slice(0, 120);
  }
}

export async function connect(m, number) {
  if (S.status === 'connected' || S.status === 'reconnecting') throw new Error('WhatsApp is already linked. Disconnect first.');
  mode = m === 'qr' ? 'qr' : 'code';
  pairNumber = String(number || '').replace(/\D/g, '');
  if (mode === 'code' && (pairNumber.length < 8 || pairNumber.length > 15)) throw new Error('Enter the number with country code, digits only, like 2547XXXXXXXX');
  try { if (sock && sock.end) sock.end(undefined); } catch (e) {}
  gen++; wipe(); codeAsked = false; tries = 0; reset(); S.error = ''; S.number = ''; S.status = 'connecting';
  await start();
}

export async function logout() {
  try { if (sock) await sock.logout(); } catch (e) {}
  try { if (sock && sock.end) sock.end(undefined); } catch (e) {}
  gen++; clearTimeout(timer); sock = null; wipe(); reset(); S.status = 'idle'; S.number = ''; S.error = '';
}

export const getSock = () => sock;
export const status = () => ({ ...S, ai: aiInfo(), spill: spillStatus() });

// On server start: if a WhatsApp is already linked, reconnect by itself.
export function autostart() {
  try {
    const f = path.join(AUTH, 'creds.json');
    if (!fs.existsSync(f) || !JSON.parse(fs.readFileSync(f, 'utf8')).me) return;
    S.status = 'connecting'; start();
  } catch (e) {}
}
