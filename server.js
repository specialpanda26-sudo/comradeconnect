// Comrade Connect API on Render (or any Node 20+ host).
// The API code in backend/src is runtime-neutral (fetch, Request, Response, crypto.subtle), so this file only:
//   1. reads settings from environment variables,  2. turns Node HTTP requests into Request objects,
//   3. adds CORS for your site(s),  4. runs the 15-minute cleanup job.
import http from 'node:http';
import worker, { runCron } from './backend/src/index.js';

// Defaults for every non-secret setting. Anything you set in Render's Environment tab wins (an empty value counts as "not set").
const DEFAULTS = {
  ALLOWED_ORIGINS: '', AI_MODEL: 'gemini-3.1-flash-lite', AI_DAILY_LIMIT: '20', AI_GLOBAL_LIMIT: '1000',
  PAYMENT_MODE: 'manual', MPESA_PAY_TYPE: 'send', MPESA_PAY_TO: '', MPESA_PAY_NAME: '',
  REFERRAL_UNLOCK_DAYS: '7', REFERRAL_REWARD: '20', ESCROW_AUTO_RELEASE_DAYS: '3', PLATFORM_FEE_PERCENT: '3',
  GOOGLE_CLIENT_ID: '', MEDIA_BUCKET: 'cc-media', PRIVATE_BUCKET: 'cc-private',
  BOOST_PRICE: '30', BOOST_PRICE_3D: '70', CLIP_MAX_MB: '25', MEDIA_BUDGET_MB: '800', WITHDRAW_REQUIRES_VERIFIED: '1',
};
const env = { ...process.env };
for (const [k, v] of Object.entries(DEFAULTS)) if (env[k] === undefined || env[k] === '') env[k] = v;

// Refuse to start half-configured, so a missing secret is obvious in the Render logs instead of failing on a customer.
const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'ADMIN_KEY', 'HASH_PEPPER'].filter((k) => !env[k]);
if (missing.length) { console.error('Missing required environment variables: ' + missing.join(', ')); process.exit(1); }
if (env.ADMIN_KEY.length < 24) console.warn('WARNING: ADMIN_KEY is short. Use a long random value (openssl rand -hex 32).');
if (!env.ALLOWED_ORIGINS || env.ALLOWED_ORIGINS === '*') console.warn('WARNING: ALLOWED_ORIGINS is open to every website. Set it to your site, e.g. https://comradeconnect.co.ke');
if (env.PAYMENT_MODE === 'manual' && !env.MPESA_PAY_TO) console.warn('WARNING: MPESA_PAY_TO is empty, buyers will not see where to send money.');

const MAX_BODY = 30 * 1024 * 1024;
const origins = () => String(env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim().replace(/\/$/, '')).filter(Boolean);

function cors(headers, reqOrigin) {
  const list = origins();
  let allow = '*';
  if (list.length && !list.includes('*')) allow = list.includes(reqOrigin) ? reqOrigin : list[0];
  headers.set('Access-Control-Allow-Origin', allow);
  if (allow !== '*') headers.append('Vary', 'Origin');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key, X-Aid, X-Token');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('X-Content-Type-Options', 'nosniff');
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
setInterval(cron, 15 * 60 * 1000).unref();
setTimeout(cron, 60 * 1000).unref();
process.on('unhandledRejection', (e) => console.error('unhandled rejection', e && e.message));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
