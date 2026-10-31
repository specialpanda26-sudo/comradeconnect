// Comrade Connect API on Render (or any Node 20+ host).
// The API code in backend/src is runtime-neutral (fetch, Request, Response, crypto.subtle), so this file only:
//   1. reads settings from environment variables,  2. turns Node HTTP requests into Request objects,
//   3. adds CORS for your site(s),  4. runs the 15-minute cleanup job.
import http from 'node:http';
import worker, { runCron } from './backend/src/index.js';
import { handleWa } from './wabot/routes.js';
import * as wa from './wabot/send.js';

// Defaults for every non-secret setting. Anything you set in Render's Environment tab wins (an empty value counts as "not set").
const DEFAULTS = {
  ALLOWED_ORIGINS: '', AI_MODEL: 'gemini-3.1-flash-lite', AI_DAILY_LIMIT: '20', AI_GLOBAL_LIMIT: '1000',
  REFERRAL_UNLOCK_DAYS: '7', REFERRAL_REWARD: '20', ESCROW_AUTO_RELEASE_DAYS: '3', PLATFORM_FEE_PERCENT: '7',
  GOOGLE_CLIENT_ID: '', MEDIA_BUCKET: 'cc-media', PRIVATE_BUCKET: 'cc-private',
  BOOST_PRICE: '30', BOOST_PRICE_3D: '70', CLIP_MAX_MB: '25', MEDIA_BUDGET_MB: '800', WITHDRAW_REQUIRES_VERIFIED: '1',
  DEVICE_LOCK: '1', DEVICE_MAX_ACCOUNTS: '3', PASSKEY_RP_ID: 'comradeconnect.co.ke',
};
const env = { ...process.env };
for (const [k, v] of Object.entries(DEFAULTS)) if (env[k] === undefined || env[k] === '') env[k] = v;
// Bridge to the WhatsApp bot (same process). Lets the API send codes and queue promos. Fails soft: if the bot is offline these just say so.
// The send logic (socket check, onWhatsApp check, queue, daily cap) lives in wabot/send.js. Nothing here logs a number or a message.
env.waSend = (phone, text) => wa.sendUrgent(phone, text);
env.waPromo = (phone, text, done) => wa.queuePromo(phone, text, done);
env.waQueue = () => wa.queueStatus();

// Refuse to start half-configured, so a missing secret is obvious in the Render logs instead of failing on a customer.
const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'ADMIN_KEY', 'HASH_PEPPER'].filter((k) => !env[k]);
if (missing.length) { console.error('Missing required environment variables: ' + missing.join(', ')); process.exit(1); }
if (env.ADMIN_KEY.length < 8) console.warn('WARNING: ADMIN_KEY is shorter than 8 characters. Use at least 8.');
if (!env.ALLOWED_ORIGINS || env.ALLOWED_ORIGINS === '*') console.warn('WARNING: ALLOWED_ORIGINS is open to every website. Set it to your site, e.g. https://comradeconnect.co.ke');
for (const k of ['PAYHERO_API_KEY', 'PAYHERO_API_SECRET', 'PAYHERO_CHANNEL_ID', 'PAYHERO_CALLBACK_SECRET', 'CALLBACK_URL']) if (!env[k]) console.warn('WARNING: ' + k + ' is empty. M-Pesa deposits and withdrawals will not work until it is set.');

const MAX_BODY = 30 * 1024 * 1024;
const origins = () => String(env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim().replace(/\/$/, '')).filter(Boolean);

function cors(headers, reqOrigin) {
  const list = origins();
  let allow = '*';
  if (list.length && !list.includes('*')) allow = list.includes(reqOrigin) ? reqOrigin : list[0];
  headers.set('Access-Control-Allow-Origin', allow);
  if (allow !== '*') headers.append('Vary', 'Origin');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key, X-Aid, X-Token, X-Campus, X-Home, X-Device-Id, X-Device-Kind');   // the app adds the two X-Device-* headers to every /api/auth call; leaving them out makes the browser block the call
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  headers.set('Referrer-Policy', 'no-referrer');
  return headers;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > MAX_BODY) { reject(Object.assign(new Error('too big'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

let cronRunning = false;
async function cron() {
  if (cronRunning) return { skipped: true };
  cronRunning = true;
  try { const out = await runCron(env); console.log('cron', JSON.stringify(out)); return out; }
  catch (e) { console.error('cron error', e && e.message); return { error: true }; }
  finally { cronRunning = false; }
}

const send = (res, status, data, extra = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', ...extra }); res.end(JSON.stringify(data)); };

const server = http.createServer(async (req, res) => {
  const reqOrigin = req.headers.origin || '';
  try {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    if (url.pathname === '/healthz') return send(res, 200, { ok: true });
    // Called every 15 minutes by Render Cron or a free pinger (cron-job.org). Also keeps a free Render service awake.
    if (url.pathname === '/internal/cron') {
      if (!env.CRON_SECRET || req.headers['x-cron-secret'] !== env.CRON_SECRET) return send(res, 403, { error: 'Forbidden' });
      return send(res, 200, await cron());
    }
    // WhatsApp bot (admin only): pairing code / QR, Gemini replies, group messages. See wabot/.
    if (url.pathname.startsWith('/api/admin/wa/')) {
      const wh = Object.fromEntries(cors(new Headers(), reqOrigin));
      if (req.method === 'OPTIONS') { res.writeHead(204, wh); return res.end(); }
      let wb = {}; if (req.method === 'POST') { try { const raw = await readBody(req); wb = raw.length ? JSON.parse(raw.toString('utf8')) : {}; } catch (e) { wb = {}; } }
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      const wr = await handleWa(req.method, url.pathname, wb, String(req.headers['x-admin-key'] || ''), ip, env);
      return send(res, wr.status, wr.data, wh);
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    if (!headers.get('cf-connecting-ip') && !headers.get('true-client-ip') && !headers.get('x-forwarded-for')) headers.set('cf-connecting-ip', req.socket.remoteAddress || 'unknown');
    const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const request = new Request(url, { method: req.method, headers, body: hasBody ? await readBody(req) : undefined });
    const out = await worker.fetch(request, env);
    const oh = cors(new Headers(out.headers), reqOrigin);
    res.writeHead(out.status, Object.fromEntries(oh));
    res.end(Buffer.from(await out.arrayBuffer()));
  } catch (e) {
    const status = e && e.status === 413 ? 413 : 500;
    console.error('request error', e && e.message);
    send(res, status, { error: status === 413 ? 'That upload is too large' : 'Server error' }, Object.fromEntries(cors(new Headers(), reqOrigin)));
  }
});
server.requestTimeout = 120000;
server.headersTimeout = 30000;

const port = Number(process.env.PORT) || 10000;
server.listen(port, '0.0.0.0', () => console.log('Comrade Connect API listening on ' + port));
import('./wabot/manager.js').then((m) => m.autostart()).catch((e) => console.error('wabot', e && e.message));
setInterval(cron, 15 * 60 * 1000).unref();
setTimeout(cron, 60 * 1000).unref();
process.on('unhandledRejection', (e) => console.error('unhandled rejection', e && e.message));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
