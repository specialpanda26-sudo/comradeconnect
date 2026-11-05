// Key proxy for the referral bot's AI brain.
// The real GEMINI_API_KEY stays on this server. The bot sends REFBOT_AI_TOKEN instead (in the x-goog-api-key header),
// and this file swaps in the real key. No token set on the server = the proxy is off (503).
import crypto from 'node:crypto';

const h = (v) => crypto.createHash('sha256').update(String(v)).digest();
const same = (a, b) => crypto.timingSafeEqual(h(a), h(b));
const fails = new Map();          // ip -> times of wrong tokens
const hits = [];                  // times of good calls (global rate limit)
const MAX_BODY = 8 * 1024 * 1024; // a screenshot is a few hundred KB, so 8 MB is plenty
const PER_MIN = 40;               // good calls per minute, all bots together

const json = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > MAX_BODY) { reject(Object.assign(new Error('too big'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Returns true when it handled the request.
export async function handleRefbotAi(req, res, url, env) {
  const P = '/api/refbot-ai/';
  if (!url.pathname.startsWith(P)) return false;
  const upstream = String(env.REFBOT_AI_UPSTREAM || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
  const ip = req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  if (!env.REFBOT_AI_TOKEN || !env.GEMINI_API_KEY) return json(res, 503, { error: 'AI proxy is not switched on' }), true;

  const now = Date.now();
  const f = (fails.get(ip) || []).filter((t) => now - t < 6e5);
  if (f.length >= 10) return json(res, 429, { error: 'Too many wrong tokens. Wait a few minutes.' }), true;
  const given = req.headers['x-goog-api-key'] || '';
  if (!given || !same(given, env.REFBOT_AI_TOKEN)) { f.push(now); fails.set(ip, f); return json(res, 403, { error: 'Forbidden' }), true; }

  while (hits.length && now - hits[0] > 6e4) hits.shift();
  if (hits.length >= PER_MIN) return json(res, 429, { error: 'Slow down' }), true;

  // Only two calls are allowed: list models, and generateContent. Nothing else reaches Google.
  const rest = url.pathname.slice(P.length);                 // e.g. models/gemini-2.5-flash:generateContent
  const okList = req.method === 'GET' && rest === 'models';
  const okGen = req.method === 'POST' && /^models\/[A-Za-z0-9._-]+:generateContent$/.test(rest);
  if (!okList && !okGen) return json(res, 404, { error: 'Not found' }), true;

  hits.push(now);
  try {
    const body = okGen ? await readBody(req) : undefined;
    const r = await fetch(upstream + '/' + rest + (okList ? '?pageSize=200' : ''), {
      method: req.method,
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY, ...(okGen ? { 'Content-Type': 'application/json' } : {}) },
      body,
      signal: AbortSignal.timeout(60000),
    });
    const out = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/json' });
    res.end(out);
  } catch (e) {
    json(res, e && e.status === 413 ? 413 : 502, { error: e && e.status === 413 ? 'Too large' : 'AI upstream failed' });
  }
  return true;
}
