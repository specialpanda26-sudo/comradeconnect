import { sb, rows, one } from './lib.js';
import { sendPush } from './push.js';

const KE = 3 * 3600e3, ke = (t = Date.now()) => new Date(t + KE);

export async function rainAlert(env) {
  if (String(env.WEATHER_ALERT || '1') === '0') return 0;
  const now = ke(); if (now.getUTCHours() !== 7) return 0;
  const day = now.toISOString().slice(0, 10);
  let last = '';
  try { const r = await one(await sb(env, 'notif_state?select=events_seen_at&aid=eq.__rain_alert')); last = r ? ke(Date.parse(r.events_seen_at) || 0).toISOString().slice(0, 10) : ''; } catch (e) { return 0; }
  if (last === day) return 0;
  await sb(env, 'notif_state', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ aid: '__rain_alert', events_seen_at: new Date().toISOString() }) });
  const lat = env.WEATHER_LAT || '-0.4989', lon = env.WEATHER_LON || '37.2786', place = env.WEATHER_PLACE || 'Kerugoya';
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_probability_max,precipitation_sum&timezone=Africa%2FNairobi&forecast_days=1`;
  let d; try { d = await (await fetch(u)).json(); } catch (e) { return 0; }
  const p = Number(d && d.daily && d.daily.precipitation_probability_max && d.daily.precipitation_probability_max[0]) || 0;
  const mm = Number(d && d.daily && d.daily.precipitation_sum && d.daily.precipitation_sum[0]) || 0;
  if (p < 60 && mm < 5) return 0;
  const subs = await rows(await sb(env, 'push_subs?select=aid&limit=5000'));
  const aids = [...new Set(subs.map((x) => x.aid).filter(Boolean))].slice(0, 2000);
  const payload = { title: 'Rain expected today', body: place + ': about ' + p + '% chance of rain. Carry an umbrella.', view: 'feed', tag: 'weather', cat: 'updates', kind: 'weather', rep: 'weather' };
  for (let i = 0; i < aids.length; i += 20) await Promise.all(aids.slice(i, i + 20).map((a) => sendPush(env, a, payload)));
  return aids.length;
}
