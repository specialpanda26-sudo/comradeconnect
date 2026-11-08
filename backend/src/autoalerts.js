import { sb, rows, one } from './lib.js';
import { sendPush } from './push.js';

const KE = 3 * 3600e3, ke = (t = Date.now()) => new Date(t + KE);

export async function takeAutoSlot(env) {
  const max = Math.max(0, Math.min(6, Number(env.AUTO_ALERT_MAX || 2)));
  const day = ke().toISOString().slice(0, 10);
  for (let n = 1; n <= max; n++) {
    try {
      const r = await rows(await sb(env, 'notif_state', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ aid: '__auto:' + day + ':' + n, events_seen_at: new Date().toISOString() }) }));
      if (r.length) return true;
    } catch (e) { return false; }
  }
  return false;
}

const BLOCK = /(killed|dead|death|murder|rape|suicide|shot|massacre|accident|abuse|assault|body found)/i;
const WANT = /(helb|kuccps|university|varsity|students?|strike|fees|exam|bursary|scholarship|campus|loan)/i;
const dec = (s) => String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

export function pickHeadline(xml) {
  const items = String(xml || '').split('<item>').slice(1, 15);
  for (const it of items) {
    const m = it.match(/<title>([\s\S]*?)<\/title>/); if (!m) continue;
    const t = dec(m[1]);
    if (t && WANT.test(t) && !BLOCK.test(t)) return t.slice(0, 120);
  }
  return '';
}

export async function newsAlert(env) {
  if (String(env.NEWS_ALERT || '0') !== '1') return 0;
  const now = ke(); if (now.getUTCHours() !== 12) return 0;
  const day = now.toISOString().slice(0, 10);
  let last = '';
  try { const r = await one(await sb(env, 'notif_state?select=events_seen_at&aid=eq.__news_alert')); last = r ? ke(Date.parse(r.events_seen_at) || 0).toISOString().slice(0, 10) : ''; } catch (e) { return 0; }
  if (last === day) return 0;
  await sb(env, 'notif_state', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ aid: '__news_alert', events_seen_at: new Date().toISOString() }) });
  let xml = ''; try { xml = await (await fetch('https://news.google.com/rss/search?q=' + encodeURIComponent('Kenya university students OR HELB OR KUCCPS when:1d') + '&hl=en-KE&gl=KE&ceid=KE:en')).text(); } catch (e) { return 0; }
  const headline = pickHeadline(xml); if (!headline) return 0;
  if (!(await takeAutoSlot(env))) return 0;
  const subs = await rows(await sb(env, 'push_subs?select=aid&limit=5000'));
  const aids = [...new Set(subs.map((x) => x.aid).filter(Boolean))].slice(0, 2000);
  const payload = { title: 'Campus news', body: headline, view: 'bell', tag: 'news', cat: 'updates', kind: 'news', rep: 'news' };
  for (let i = 0; i < aids.length; i += 20) await Promise.all(aids.slice(i, i + 20).map((a) => sendPush(env, a, payload)));
  return aids.length;
}
