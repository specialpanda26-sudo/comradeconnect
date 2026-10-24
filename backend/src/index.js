// Comrade Connect API (Cloudflare Worker). All secrets live here, never in the HTML.
import { json, err, corsHeaders, sb, rows, patch, ago } from './lib.js';
import { feedRoutes } from './feed.js';
import { payRoutes, hooks, manualMode, markFailed, reconcileIntasend } from './pay.js';
import { accountRoutes, unlockReferrals } from './account.js';
import { ratingRoutes } from './ratings.js';
import { pulseRoutes } from './pulse.js';
import { marketRoutes, createOrderFromPayment, autoReleaseOrders } from './market.js';
import { messageRoutes } from './messages.js';
import { campusRoutes } from './campus.js';
import { contentRoutes } from './content.js';
import { hostelRoutes, caretakerPaid } from './hostels.js';
import { mediaRoutes } from './media.js';
import { liveRoutes } from './live.js';
import { nativeRoutes } from './native.js';
import { clubRoutes, clubPaid, ticketPaid, restoreClubOrder, expireClubOrders } from './club.js';
import { myEventRoutes } from './myevents.js';
import { wholesaleRoutes, extendWholesale } from './wholesale.js';
import { credit } from './pay.js';
import { adminRoutes } from './admin.js';
import { kuraRoutes, kuraPaid, kuraFailed } from './kura.js';
import { adminUserRoutes } from './admin-users.js';
import { adminJoinRoutes } from './admin-joins.js';
import { adminServiceRoutes } from './admin-services.js';
import { settingsRoutes } from './settings.js';
import { siteContentRoutes } from './sitecontent.js';
import { siteMediaRoutes } from './sitemedia.js';
import { trustRoutes } from './trust.js';
import { pointsRoutes } from './points.js';
import { notificationRoutes } from './notifications.js';
import { engageRoutes } from './engage.js';
import { reconcilePayouts } from './payouts.js';
import { postRuleRoutes, dropUnpaidDrafts } from './postrules.js';
import { sqlRoutes } from './sqlpanel.js';
import { giveBack } from './points.js';
import { pruneMedia } from './media.js';
import { storyRoutes, pruneStories } from './stories.js';
import * as store from './storage.js';
import { PRIVATE_BUCKET } from './storage.js';

// What to do after a payment is confirmed or fails, by purpose.
hooks.onPaid = async (env, p) => {
  if (p.purpose === 'order') await createOrderFromPayment(env, p);
  else if (p.purpose === 'club') await clubPaid(env, p);
  else if (p.purpose === 'ticket') await ticketPaid(env, p);
  else if (p.purpose === 'boost') await boostPost(env, p);
  else if (p.purpose === 'spillfee') await patch(env, `posts?id=eq.${p.ref_id}&fee_pending=gt.0`, { hidden: false, fee_pending: 0, created_at: new Date().toISOString() });   // paid: the spill goes live
  else if (p.purpose === 'topup') await credit(env, p.aid, p.amount, 'topup', 'pay:' + p.id, 'Wallet deposit');
  else if (p.purpose === 'wholesale') await extendWholesale(env, p.aid);
  else if (p.purpose === 'caretaker') await caretakerPaid(env, p);
  else if (p.purpose === 'kura') await kuraPaid(env, p);
};
// A boost adds time on top of any boost still running.
async function boostPost(env, p) {
  const [cur] = await rows(await sb(env, `posts?select=boosted_until&id=eq.${p.ref_id}`));
  const start = Math.max(Date.now(), cur && cur.boosted_until ? Date.parse(cur.boosted_until) : 0);
  await patch(env, `posts?id=eq.${p.ref_id}`, { boosted_until: new Date(start + (p.boost_hours || 24) * 3600e3).toISOString() });
}
hooks.onFailed = async (env, p) => {
  if (p.purpose === 'club') await restoreClubOrder(env, p.ref_id);
  if (p.purpose === 'kura') await kuraFailed(env, p);
  if (p.credit_ksh > 0) await giveBack(env, p.aid, 'pay:' + p.id);   // a failed payment returns the points
};

const ROUTES = [pulseRoutes, campusRoutes, engageRoutes, storyRoutes, notificationRoutes, settingsRoutes, trustRoutes, siteContentRoutes, siteMediaRoutes, feedRoutes, payRoutes, accountRoutes, pointsRoutes, wholesaleRoutes, ratingRoutes, marketRoutes, messageRoutes, hostelRoutes, contentRoutes, nativeRoutes, liveRoutes, mediaRoutes, clubRoutes, myEventRoutes, kuraRoutes, adminUserRoutes, adminJoinRoutes, adminServiceRoutes, postRuleRoutes, sqlRoutes, adminRoutes];

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
const SUPPORT_PROMPT = 'You are the support helper for Comrade Connect, a campus app for university students across Kenya (Kirinyaga, UoN, KU, JKUAT, Moi and many more). Comrade Connect is built and run by Ogolla Tech. Its founder and CEO is Henry O. Odhiambo, and the developers are Christian N. and Peter M. If anyone asks who owns, founded or runs the app, say exactly that and never name anyone else as the owner or CEO. Answer in the language the student uses (English, Swahili or Sheng) in 4 short sentences or fewer. Facts you may use: Market payments are held in escrow; the buyer gets a 6-digit code and gives it to the seller only after checking the item, then the seller is paid; if the buyer says nothing after the seller marks it handed over, the seller is paid automatically after a few days; to dispute, open the order in Market and tap Report a problem before giving the code, and an admin refunds the buyer or pays the seller; refunds go to the in-app wallet; the seller pays a small fee; lost phone: Me > Restore an account with the account ID and recovery code; posts with phone numbers, links, handles or off-site payment requests are blocked; verification: Me > Verification. Never ask for or accept passwords, PINs, recovery codes or handover codes, and tell users never to share them. You cannot see accounts or move money. For payment or account problems point to the Contact tab or comradeconnect.co.ke/contact.html. If you do not know, say so; never invent policies, prices or promises. About the company: Comrade Connect was founded by Henry O. Odhiambo, who is the Founder and CEO of Ogolla Tech. Comrade Connect is built and run by Ogolla Tech. The developers are Christian N. and Peter M. Support email: support@comradeconnect.co.ke. If asked who owns, runs, founded or is the CEO of Comrade Connect, give exactly these facts. Never name any other person as CEO, owner or founder, and never guess about people; if asked about someone else, say you do not have that information.';
const BASE_PROMPT = 'You are a friendly assistant for Kenyan university students. You work inside Comrade Connect, built by Ogolla Tech and founded by Henry O. Odhiambo. Keep answers short and safe. About the company: Comrade Connect was founded by Henry O. Odhiambo, who is the Founder and CEO of Ogolla Tech. Comrade Connect is built and run by Ogolla Tech. The developers are Christian N. and Peter M. Support email: support@comradeconnect.co.ke. If asked who owns, runs, founded or is the CEO of Comrade Connect, give exactly these facts. Never name any other person as CEO, owner or founder, and never guess about people; if asked about someone else, say you do not have that information.';
function aiContents(b, prompt) {
  const past = b.mode === 'support' && Array.isArray(b.history) ? b.history.slice(-6).filter((h) => h && typeof h.t === 'string') : [];
  const c = past.map((h) => ({ role: h.r === 'u' ? 'user' : 'model', parts: [{ text: h.t.slice(0, 800) }] }));
  while (c.length && c[0].role !== 'user') c.shift();
  return [...c, { role: 'user', parts: [{ text: prompt }] }];
}
async function aiRoute(req, env, ip) {
  const b = await req.json().catch(() => ({}));
  const prompt = String(b.prompt || '').slice(0, 1500);
  if (!prompt) return err(env, 'Missing prompt');
  if (!(await bump(env, 'ip:' + ip, Number(env.AI_DAILY_LIMIT || 20)))) return err(env, 'Daily AI limit reached', 429);
  if (!(await bump(env, 'global', Number(env.AI_GLOBAL_LIMIT || 1000)))) return err(env, 'AI is busy today, try tomorrow', 429);
  const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.AI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: b.mode === 'support' ? SUPPORT_PROMPT : BASE_PROMPT }] },
      contents: aiContents(b, prompt),
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
  out.unpaidDrafts = await dropUnpaidDrafts(env).catch(() => -1);
  out.payouts = await reconcilePayouts(env).catch((e) => { console.error('payout reconcile error', e && e.message); return -1; });
  out.intasendChecked = await reconcileIntasend(env).catch((e) => { console.error('intasend reconcile error', e && e.message); return -1; });   // before expiring, so a paid prompt is never expired by mistake
  const stale = await markFailed(env, `payments?status=eq.pending&created_at=lte.${ago(Number(env.PENDING_MINUTES || (manualMode(env) ? 90 : 30)) * 60e3)}`, 'expired', 'no_response', null);
  for (const p of stale) await hooks.onFailed(env, p);
  out.expiredPayments = stale.length;
  const purge = await rows(await sb(env, `verifications?select=id,r2_key&r2_key=not.is.null&purge_after=lte.${new Date().toISOString()}&status=neq.pending&limit=50`));
  for (const v of purge) { await store.remove(env, PRIVATE_BUCKET(env), v.r2_key); await patch(env, `verifications?id=eq.${v.id}`, { r2_key: null }); }
  out.purged = purge.length;
  out.media = await pruneMedia(env);
  out.stories = await pruneStories(env).catch(() => -1);
  await patch(env, `live_streams?status=eq.live&created_at=lte.${ago(8 * 3600e3)}`, { status: 'ended', ended_at: new Date().toISOString() });
  await sb(env, `live_viewers?seen_at=lt.${ago(3600e3)}`, { method: 'DELETE' });
  await sb(env, `live_comments?created_at=lt.${ago(3 * 86400e3)}`, { method: 'DELETE' });
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
