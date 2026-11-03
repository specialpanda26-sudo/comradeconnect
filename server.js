import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker, { runCron } from './backend/src/index.js';
import { handleWa } from './wabot/routes.js';

const DEFAULTS = {
  ALLOWED_ORIGINS: 'https://comradeconnect-1.onrender.com,https://comradeconnect.co.ke,https://www.comradeconnect.co.ke,https://localhost',
  AI_MODEL: 'gemini-3.1-flash-lite', AI_DAILY_LIMIT: '20', AI_GLOBAL_LIMIT: '1000',
  MPESA_PAY_TYPE: 'send', MPESA_PAY_TO: '', MPESA_PAY_NAME: '',
  REFERRAL_UNLOCK_DAYS: '7', REFERRAL_REWARD: '20', ESCROW_AUTO_RELEASE_DAYS: '3', PLATFORM_FEE_PERCENT: '7',
  GOOGLE_CLIENT_ID: '', MEDIA_BUCKET: 'cc-media', PRIVATE_BUCKET: 'cc-private',
  BOOST_PRICE: '30', BOOST_PRICE_3D: '70', CLIP_MAX_MB: '25', MEDIA_BUDGET_MB: '800', WITHDRAW_REQUIRES_VERIFIED: '1',
  DEVICE_LOCK: '1', DEVICE_MAX_ACCOUNTS: '3', PASSKEY_RP_ID: 'comradeconnect.co.ke',
};

const env = { ...process.env };
for (const [k, v] of Object.entries(DEFAULTS)) {
  if (env[k] === undefined || env[k] === '') env[k] = v;
}

const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'ADMIN_KEY', 'HASH_PEPPER'].filter((k) => !env[k]);
if (missing.length) {
  console.error('Missing required environment variables: ' + missing.join(', '));
  process.exit(1);
}
if (env.ADMIN_KEY.length < 8) console.warn('WARNING: ADMIN_KEY is shorter than 8 characters.');
if (!env.ALLOWED_ORIGINS || env.ALLOWED_ORIGINS === '*') console.warn('WARNING: ALLOWED_ORIGINS is open to every website.');
for (const k of ['PAYHERO_API_KEY', 'PAYHERO_API_SECRET', 'PAYHERO_CHANNEL_ID', 'PAYHERO_CALLBACK_SECRET', 'CALLBACK_URL']) {
  if (!env[k]) console.warn('WARNING: ' + k + ' is empty. M-Pesa deposits and withdrawals will not work until it is set.');
}

const MAX_BODY = 30 * 1024 * 1024;
const FRONTEND_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'frontend');

const MIME_TYPES = {
  '.avif': 'image/avif', '.css': 'text/css; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.eot': 'application/vnd.ms-fontobject', '.gif': 'image/gif', '.htm': 'text/html; charset=utf-8',
  '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.ogg': 'audio/ogg', '.otf': 'font/otf', '.pdf': 'application/pdf',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm', '.webm': 'video/webm', '.webp': 'image/webp', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.xml': 'application/xml; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8'
};

async function serveFrontend(req, res, pathname) {
  if (!['GET', 'HEAD'].includes(req.method)) return false;

  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }

  if (decoded.includes('\\') || decoded.split('/').some((part) => part === '.' || part === '..' || part.startsWith('.'))) {
    return false;
  }

  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  let target = path.resolve(FRONTEND_DIR, relative);
  const root = path.resolve(FRONTEND_DIR) + path.sep;

  if (target !== path.resolve(FRONTEND_DIR) && !target.startsWith(root)) return false;

  try {
    let stat = await fs.promises.stat(target);
    if (stat.isDirectory()) {
      target = path.join(target, 'index.html');
      stat = await fs.promises.stat(target);
    }
    if (!stat.isFile()) return false;
  } catch {
    if (path.extname(relative)) {
      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store'
      });
      res.end('Not found');
      return true;
    }

    target = path.join(FRONTEND_DIR, 'index.html');
    try {
      const stat = await fs.promises.stat(target);
      if (!stat.isFile()) return false;
    } catch {
      return false;
    }
  }

  const ext = path.extname(target).toLowerCase();
  const stat = await fs.promises.stat(target);
  const headers = {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Cache-Control': /\.(?:html?|js|css|webmanifest)$/i.test(target) ? 'no-cache' : 'public, max-age=3600'
  };

  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }

  const stream = fs.createReadStream(target);
  stream.on('error', (e) => {
    console.error('static file error', e && e.message);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
  stream.pipe(res);
  return true;
}

const origins = () => [...new Set([
  'https://comradeconnect-1.onrender.com',
  ...String(env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim().replace(/\/$/, '')).filter(Boolean)
])];

function cors(headers, reqOrigin) {
  const list = origins();
  let allow = '*';
  if (list.length && !list.includes('*')) allow = list.includes(reqOrigin) ? reqOrigin : list[0];

  headers.set('Access-Control-Allow-Origin', allow);
  if (allow !== '*') headers.append('Vary', 'Origin');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key, X-Aid, X-Token, X-Campus, X-Home, X-Device-Id, X-Device-Kind');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  headers.set('Referrer-Policy', 'no-referrer');
  return headers;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;

    req.on('data', (c) => {
      n += c.length;
      if (n > MAX_BODY) {
        reject(Object.assign(new Error('too big'), { status: 413 }));
        req.destroy();
      } else {
        chunks.push(c);
      }
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

let cronRunning = false;

async function cron() {
  if (cronRunning) return { skipped: true };
  cronRunning = true;
  try {
    const out = await runCron(env);
    console.log('cron', JSON.stringify(out));
    return out;
  } catch (e) {
    console.error('cron error', e && e.message);
    return { error: true };
  } finally {
    cronRunning = false;
  }
}

const send = (res, status, data, extra = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...extra });
  res.end(JSON.stringify(data));
};

const server = http.createServer(async (req, res) => {
  const reqOrigin = req.headers.origin || '';

  try {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

    if (url.pathname === '/healthz') return send(res, 200, { ok: true });

    if (url.pathname === '/internal/cron') {
      if (!env.CRON_SECRET || req.headers['x-cron-secret'] !== env.CRON_SECRET) {
        return send(res, 403, { error: 'Forbidden' });
      }
      return send(res, 200, await cron());
    }

    // Admin WhatsApp bot + referral tester live outside the Worker code, so route them here.
    if (url.pathname.startsWith('/api/admin/wa/')) {
      const ch = Object.fromEntries(cors(new Headers(), reqOrigin));
      if (req.method === 'OPTIONS') { res.writeHead(204, ch); return res.end(); }
      let body = {};
      if (!['GET', 'HEAD'].includes(req.method)) {
        try { const raw = (await readBody(req)).toString('utf8'); body = raw ? JSON.parse(raw) : {}; } catch (e) { body = {}; }
      }
      const ip = req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
      const out = await handleWa(req.method, url.pathname, body, req.headers['x-admin-key'] || '', ip, env);
      return send(res, out.status, out.data, ch);
    }

    if (url.pathname !== '/api' && !url.pathname.startsWith('/api/')) {
      if (await serveFrontend(req, res, url.pathname)) return;
    }

    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    }

    if (!headers.get('cf-connecting-ip') && !headers.get('true-client-ip') && !headers.get('x-forwarded-for')) {
      headers.set('cf-connecting-ip', req.socket.remoteAddress || 'unknown');
    }

    const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const request = new Request(url, {
      method: req.method,
      headers,
      body: hasBody ? await readBody(req) : undefined
    });

    const out = await worker.fetch(request, env);
    const oh = cors(new Headers(out.headers), reqOrigin);
    res.writeHead(out.status, Object.fromEntries(oh));
    res.end(Buffer.from(await out.arrayBuffer()));
  } catch (e) {
    const status = e && e.status === 413 ? 413 : 500;
    console.error('request error', e && e.message);
    send(
      res,
      status,
      { error: status === 413 ? 'That upload is too large' : 'Server error' },
      Object.fromEntries(cors(new Headers(), reqOrigin))
    );
  }
});

server.requestTimeout = 120000;
server.headersTimeout = 30000;

const port = Number(process.env.PORT) || 10000;
server.listen(port, '0.0.0.0', () => {
  console.log('Comrade Connect full-stack Web Service listening on ' + port);
});

setInterval(cron, 15 * 60 * 1000).unref();
setTimeout(cron, 60 * 1000).unref();
process.on('unhandledRejection', (e) => console.error('unhandled rejection', e && e.message));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
