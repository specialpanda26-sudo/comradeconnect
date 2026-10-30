// "Today on campus" phone alert: one push a day at about 7pm Kenya time to everyone with alerts on.
// Called by the 15-minute cron. It sends once per day (remembered in notif_state). Set TODAY_NUDGE=0 on Render to switch it off.
import { sb, rows, one } from './lib.js';
import { sendPush } from './push.js';

const KE = 3 * 3600e3, ke = (t = Date.now()) => new Date(t + KE);
export async function dailyNudge(env) {
  if (String(env.TODAY_NUDGE || '1') === '0') return 0;
  const now = ke(); if (now.getUTCHours() !== 19) return 0;
  const day = now.toISOString().slice(0, 10);
  let last = '';
  try { const r = await one(await sb(env, 'notif_state?select=events_seen_at&aid=eq.__today_nudge')); last = r ? ke(Date.parse(r.events_seen_at) || 0).toISOString().slice(0, 10) : ''; } catch (e) { return 0; }
  if (last === day) return 0;
  await sb(env, 'notif_state', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ aid: '__today_nudge', events_seen_at: new Date().toISOString() }) });   // claim today first
  const evs = await rows(await sb(env, `events?select=id&hidden=eq.false&starts_on=eq.${day}&limit=50`)).catch(() => []);
  const body = (evs.length ? evs.length + (evs.length === 1 ? ' event' : ' events') + ' on campus today. ' : '') + 'Vote in the poll and check in to keep your streak.';
  const subs = await rows(await sb(env, 'push_subs?select=aid&limit=5000'));
  const aids = [...new Set(subs.map((x) => x.aid).filter(Boolean))].slice(0, 2000);
  const payload = { title: 'Today on campus', body, view: 'feed', tag: 'today', cat: 'updates', kind: 'today', rep: 'today' };
  for (let i = 0; i < aids.length; i += 20) await Promise.all(aids.slice(i, i + 20).map((a) => sendPush(env, a, payload)));
  return aids.length;
}
