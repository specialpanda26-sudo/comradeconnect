// Comrade Connect API (Cloudflare Worker). All secrets live here, never in the HTML.
import { json, err, corsHeaders, sb, rows, patch, ago } from './lib.js';
import { feedRoutes } from './feed.js';
import { payRoutes, hooks, manualMode } from './pay.js';
import { accountRoutes, unlockReferrals } from './account.js';
import { marketRoutes, createOrderFromPayment, autoReleaseOrders } from './market.js';
import { messageRoutes } from './messages.js';
import { contentRoutes } from './content.js';
import { mediaRoutes } from './media.js';
import { clubRoutes, clubPaid, ticketPaid, restoreClubOrder, expireClubOrders } from './club.js';
import { adminRoutes } from './admin.js';
import { pruneMedia } from './media.js';
import * as store from './storage.js';
import { PRIVATE_BUCKET } from './storage.js';

// What to do after a payment is confirmed or fails, by purpose.
hooks.onPaid = async (env, p) => {
  if (p.purpose === 'order') await createOrderFromPayment(env, p);
  else if (p.purpose === 'club') await clubPaid(env, p);
  else if (p.purpose === 'ticket') await ticketPaid(env, p);
  else if (p.purpose === 'boost') await patch(env, `posts?id=eq.${p.ref_id}`, { boosted_until: new Date(Date.now() + 24 * 3600e3).toISOString() });
};
hooks.onFailed = async (env, p) => { if (p.purpose === 'club') await restoreClubOrder(env, p.ref_id); };

const ROUTES = [feedRoutes, payRoutes, accountRoutes, marketRoutes, messageRoutes, contentRoutes, mediaRoutes, clubRoutes, adminRoutes];

async function handle(req, env) {
  const url = new URL(req.url);
  const ip = req.headers.get('CF-Connecting-IP') || req.headers.get('True-Client-IP') || (req.headers.get('X-Forwarded-For') || '').split(',')[0].trim() || 'unknown';
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(env) });
  for (const r of ROUTES) { const res = await r(req, env, url, ip); if (res) return res; }
  if (url.pathname === '/api/ai' && req.method === 'POST') return aiRoute(req, env, ip);
  if (url.pathname.startsWith('/api/')) return err(env, 'Not found', 404);
  return json(env, { ok: true, service: 'comrade-connect-api' });
}

// Free AI. Fixed system prompt, per-IP and global daily caps so the free quota can't be drained.
import { bump } from './lib.js';
async function aiRoute(req, env, ip) {
  const b = await req.json().catch(() => ({}));
  const prompt = String(b.prompt || '').slice(0, 1500);
  if (!prompt) return err(env, 'Missing prompt');
  if (!(await bump(env, 'ip:' + ip, Number(env.AI_DAILY_LIMIT || 20)))) return err(env, 'Daily AI limit reached', 429);
  if (!(await bump(env, 'global', Number(env.AI_GLOBAL_LIMIT || 1000)))) return err(env, 'AI is busy today, try tomorrow', 429);
  const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.AI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: 'You are a friendly assistant for Kenyan university students. Keep answers short and safe.' }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  });
  const d = await g.json().catch(() => ({}));
  return json(env, { text: d?.candidates?.[0]?.content?.parts?.[0]?.text || 'AI is busy, try again.' });
}

// Cron (every 15 min): auto-release, referral unlocks, expire stale payments/stock, purge ID images, end old streams, tidy counters.
export async function runCron(env) {
  const out = {};
  out.released = await autoReleaseOrders(env);
  out.referrals = await unlockReferrals(env);
  out.clubExpired = await expireClubOrders(env);
  const stale = await rows(await patch(env, `payments?status=eq.pending&created_at=lte.${ago(Number(env.PENDING_MINUTES || (manualMode(env) ? 90 : 30)) * 60e3)}`, { status: 'expired' }));
  for (const p of stale) await hooks.onFailed(env, p);
  out.expiredPayments = stale.length;
  const purge = await rows(await sb(env, `verifications?select=id,r2_key&r2_key=not.is.null&purge_after=lte.${new Date().toISOString()}&status=neq.pending&limit=50`));
  for (const v of purge) { await store.remove(env, PRIVATE_BUCKET(env), v.r2_key); await patch(env, `verifications?id=eq.${v.id}`, { r2_key: null }); }
  out.purged = purge.length;
  out.media = await pruneMedia(env);
  await patch(env, `live_streams?status=eq.live&created_at=lte.${ago(8 * 3600e3)}`, { status: 'ended', ended_at: new Date().toISOString() });
  await sb(env, `ai_usage?day=lt.${new Date(Date.now() - 3 * 86400e3).toISOString().slice(0, 10)}`, { method: 'DELETE' });
  return out;
}

export { handle };
export default {
  async fetch(req, env) {
    try { return await handle(req, env); }
    catch (e) { console.error('worker error', e && e.message); return json(env, { error: 'Server error' }, 500); }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(runCron(env).catch((e) => console.error('cron error', e && e.message))); },
};
