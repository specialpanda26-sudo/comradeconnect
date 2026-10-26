// Admin: send a phone alert to everyone who has the app, or a test to one handle.
import { json, err, sb, rows, enc, str, isAdmin, audit } from './lib.js';
import { notify } from './notifications.js';
import { sendFcm } from './push.js';

export async function adminPushRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/admin/push')) return null;
  if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);

  if (path === '/api/admin/push' && m === 'GET') {
    const r = await rows(await sb(env, 'push_subs?select=aid,endpoint&limit=5000'));
    return json(env, { devices: r.length, app: r.filter((x) => String(x.endpoint).startsWith('fcm:')).length, accounts: new Set(r.map((x) => x.aid)).size });
  }

  if (path === '/api/admin/push/send' && m === 'POST') {
    const b = await req.json().catch(() => ({}));
    const title = str(b.title, 60), body = str(b.body, 160), handle = str(b.handle, 40).replace(/^@/, '');
    if (title.length < 2 || body.length < 2) return err(env, 'Add a title and a message');
    if (handle) {                                   // test to one account, and say exactly what Google answered
      const p = await rows(await sb(env, `profiles?select=aid&handle=eq.${enc(handle)}&limit=1`));
      if (!p.length) return err(env, 'No account with that handle');
      const subs = (await rows(await sb(env, `push_subs?select=endpoint&aid=eq.${enc(p[0].aid)}&limit=10`))).filter((s) => String(s.endpoint).startsWith('fcm:'));
      if (!subs.length) return json(env, { ok: true, report: ['That account has no app phone registered. Open the app on that phone, sign in and tap Allow.'] });
      const report = [];
      for (const s of subs) {
        try {
          const r = await sendFcm(env, s, { title, body, view: 'bell', tag: 'admin' });
          report.push(!r ? 'Firebase is not set up on the server (FCM_SERVICE_ACCOUNT)' : r.ok ? 'Sent to an app phone' : 'Google refused it: ' + r.status + ' ' + r.detail);
        } catch (e) { report.push('Failed: ' + ((e && e.message) || 'unknown')); }
      }
      return json(env, { ok: true, report });
    }
    const subs = await rows(await sb(env, 'push_subs?select=aid&limit=5000'));
    const aids = [...new Set(subs.map((x) => x.aid).filter(Boolean))].slice(0, 2000);
    for (let i = 0; i < aids.length; i += 20) await Promise.all(aids.slice(i, i + 20).map((a) => notify(env, a, 'admin', title, body)));
    await audit(env, 'push.send', 'all', 'everyone', title, ip);
    return json(env, { ok: true, accounts: aids.length });
  }
  return null;
}
