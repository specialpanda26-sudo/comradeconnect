// Sponsor cards: count views and taps on the server (proof for advertisers) and publish the package prices.
//   POST /api/sponsors/hit      public: { id, kind: 'view' | 'tap' }
//   GET  /api/sponsor-packages  public: package names and prices (prices are set in Admin > Money)
import { json, err, sb, UUID, bump } from './lib.js';
import { getSettings } from './settings.js';

export async function sponsorRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (path !== '/api/sponsors/hit' && path !== '/api/sponsor-packages') return null;

  if (path === '/api/sponsor-packages' && m === 'GET') {
    const S = await getSettings(env);
    return json(env, { packages: [
      { id: 'Week banner', price: S.sponsor_price_week, days: 7 },
      { id: 'Month banner', price: S.sponsor_price_month, days: 30 },
      { id: 'Sponsored post', price: S.sponsor_price_post, days: 7 },
    ] });
  }

  if (path === '/api/sponsors/hit' && m === 'POST') {
    const b = await req.json().catch(() => ({}));
    const id = String(b.id || ''), kind = b.kind === 'tap' ? 'tap' : 'view';
    if (!UUID.test(id)) return err(env, 'Unknown sponsor');
    if (!(await bump(env, `sph:i:${ip}:${kind}`, kind === 'tap' ? 60 : 400))) return json(env, { ok: true });   // over the daily limit: quietly ignore, never an error for the visitor
    await sb(env, 'rpc/sponsor_hit', { method: 'POST', body: JSON.stringify({ p: id, k: kind }) });
    return json(env, { ok: true });
  }

  return err(env, 'Not found', 404);
}
