import crypto from 'node:crypto';
import * as M from './manager.js';
import { setAi, getKnowledge, setKnowledge } from './ai.js';
import { spillStart, spillMore, spillStop } from './spill.js';

const fails = new Map();
const h = (v) => crypto.createHash('sha256').update(String(v)).digest();
const same = (a, b) => crypto.timingSafeEqual(h(a), h(b));
const ok = (data) => ({ status: 200, data });

// Admin only (X-Admin-Key). Returns { status, data }.
export async function handleWa(method, pathname, body, key, ip, env) {
  const now = Date.now(), f = (fails.get(ip) || []).filter((t) => now - t < 6e5);
  if (f.length >= 10) return { status: 429, data: { error: 'Too many wrong keys. Wait a few minutes.' } };
  if (!env.ADMIN_KEY || !same(key, env.ADMIN_KEY)) { f.push(now); fails.set(ip, f); return { status: 403, data: { error: 'Forbidden' } }; }
  const p = pathname.replace('/api/admin/wa/', '');
  try {
    if (p === 'status' && method === 'GET') return ok(M.status());
    if (p === 'connect' && method === 'POST') { await M.connect(body.mode, body.number); return ok(M.status()); }
    if (p === 'logout' && method === 'POST') { await M.logout(); return ok(M.status()); }
    if (p === 'ai' && method === 'POST') { setAi(!!body.enabled); return ok(M.status()); }
    if (p === 'knowledge' && method === 'GET') return ok({ text: getKnowledge() });
    if (p === 'knowledge' && method === 'POST') { setKnowledge(body.text); return ok({ saved: true }); }
    if (p === 'spill/start' && method === 'POST') { await spillStart(M.getSock(), body); return ok(M.status()); }
    if (p === 'spill/more' && method === 'POST') { await spillMore(M.getSock()); return ok(M.status()); }
    if (p === 'spill/stop' && method === 'POST') { spillStop(); return ok(M.status()); }
    return { status: 404, data: { error: 'Not found' } };
  } catch (e) { return { status: 400, data: { error: String((e && e.message) || 'Failed') } }; }
}
