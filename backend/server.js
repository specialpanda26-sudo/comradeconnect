// Comrade Connect API for Render (or any Node 18+ host).
// The API code is written for Cloudflare Workers (standard Request/Response), so this file is only a thin
// Node wrapper: it turns each HTTP request into a Request, calls the same handler, runs the 15-minute cron,
// and reads settings from environment variables. Nothing else in backend/src changes.
import http from 'node:http';
import worker, { runCron } from './src/index.js';

// Defaults = the [vars] in wrangler.toml. Anything set in the Render dashboard overrides them.
const DEFAULTS = {
  ALLOWED_ORIGINS: '*', AI_MODEL: 'gemini-3.1-flash-lite', AI_DAILY_LIMIT: '20', AI_GLOBAL_LIMIT: '1000',
  PAYMENT_MODE: 'manual', MPESA_PAY_TYPE: 'send', MPESA_PAY_TO: '', MPESA_PAY_NAME: '',
  REFERRAL_UNLOCK_DAYS: '7', REFERRAL_REWARD: '20', ESCROW_AUTO_RELEASE_DAYS: '3', PLATFORM_FEE_PERCENT: '7',
  GOOGLE_CLIENT_ID: '', MEDIA_BUCKET: 'cc-media', PRIVATE_BUCKET: 'cc-private', BOOST_PRICE: '20',
  CLIP_MAX_MB: '25', MEDIA_BUDGET_MB: '800', WITHDRAW_REQUIRES_VERIFIED: '1',
  DEVICE_LOCK: '1', DEVICE_MAX_ACCOUNTS: '1', PASSKEY_RP_ID: 'comradeconnect.co.ke',
};
const env = { ...DEFAULTS, ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v !== '')) };

// Refuse to run live with missing secrets, so a half-configured server never takes real money.
const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'ADMIN_KEY', 'HASH_PEPPER'];
const missing = REQUIRED.filter((k) => !env[k]);
if (missing.length) { console.error('Missing required environment variables: ' + missing.join(', ')); process.exit(1); }
if (env.ADMIN_KEY.length < 8) { console.error('ADMIN_KEY must be at least 8 characters'); process.exit(1); }
if (env.HASH_PEPPER.length < 24) { console.error('HASH_PEPPER must be at least 24 characters (use: openssl rand -hex 32)'); process.exit(1); }
if (env.PAYMENT_MODE === 'manual' && !env.MPESA_PAY_TO) console.warn('WARNING: MPESA_PAY_TO is empty, so buyers cannot be shown where to pay.');
if (env.PAYMENT_MODE === 'tinypesa' && (!env.TINYPESA_API_KEY || !env.CALLBACK_SECRET)) { console.error('PAYMENT_MODE=tinypesa needs TINYPESA_API_KEY and CALLBACK_SECRET'); process.exit(1); }
if (env.ALLOWED_ORIGINS === '*') console.warn('WARNING: ALLOWED_ORIGINS is "*". Set it to your site address before launch.');

// Browsers accept ONE address in Access-Control-Allow-Origin, so a comma list in ALLOWED_ORIGINS is answered per request.
// The Android app (https://localhost) and a local test site (http://localhost:PORT) are always allowed: they only run on the person's own phone or computer.
const ORIGINS = String(env.ALLOWED_ORIGINS || '*').split(',').map((x) => x.trim().replace(/\/$/, '')).filter(Boolean);
const LOCAL = /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?|capacitor:\/\/localhost|ionic:\/\/localhost)$/;
const corsOrigin = (o) => {
  if (ORIGINS.includes('*')) return '*';
  if (o && (ORIGINS.includes(o) || LOCAL.test(o))) return o;
  return ORIGINS[0] || '*';
};

const MAX_BODY = 1024 * 1024; // 1 MB: photos and clips go straight to Supabase Storage, never through this server

const server = http.createServer(async (nodeReq, nodeRes) => {
  try {
    const chunks = []; let size = 0;
    if (nodeReq.method !== 'GET' && nodeReq.method !== 'HEAD') {
      for await (const c of nodeReq) { size += c.length; if (size > MAX_BODY) { nodeRes.writeHead(413, { 'Content-Type': 'application/json' }); return nodeRes.end('{"error":"That request is too large"}'); } chunks.push(c); }
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(nodeReq.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    const url = `https://${nodeReq.headers.host || 'localhost'}${nodeReq.url}`;
    const req = new Request(url, { method: nodeReq.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
    const res = await worker.fetch(req, env);
    const out = {}; res.headers.forEach((v, k) => { out[k] = v; });
    const allow = corsOrigin(nodeReq.headers.origin);
    if (allow) { out['access-control-allow-origin'] = allow; if (allow !== '*') out['vary'] = 'Origin'; }
    nodeRes.writeHead(res.status, out);
    nodeRes.end(res.body ? Buffer.from(await res.arrayBuffer()) : undefined);
  } catch (e) {
    console.error('server error', e && e.message);
    if (!nodeRes.headersSent) nodeRes.writeHead(500, { 'Content-Type': 'application/json' });
    nodeRes.end('{"error":"Something went wrong on our side. Please try again in a moment."}');
  }
});

// Cron every 15 minutes (auto-release, expiring payments, cleanup). One run at a time.
// Render runs ONE instance of this service; if you ever scale to 2+, move this to a Render Cron Job instead.
let running = false;
const tick = async () => {
  if (running) return; running = true;
  try { console.log('cron', JSON.stringify(await runCron(env))); } catch (e) { console.error('cron error', e && e.message); }
  running = false;
};
setInterval(tick, 15 * 60 * 1000);
setTimeout(tick, 30 * 1000);

const port = Number(process.env.PORT) || 10000;
server.listen(port, '0.0.0.0', () => console.log('Comrade Connect API listening on ' + port));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
