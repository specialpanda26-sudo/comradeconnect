// Admin: send a phone alert to everyone who has the app, or a test to one handle.
import { json, err, sb, rows, post, enc, str, isAdmin, audit } from './lib.js';
import { notify } from './notifications.js';
import { sendFcm, announceUpdate } from './push.js';

export async function adminPushRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/admin/push')) return null;
  if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);

  if (path === '/api/admin/push' && m === 'GET') {
    const r = await rows(await sb(env, 'push_subs?select=aid,endpoint&limit=5000'));
    return json(env, { devices: r.length, app: r.filter((x) => String(x.endpoint).startsWith('fcm:')).length, accounts: new Set(r.map((x) => x.aid)).size });
  }

  if (path === '/api/admin/push/update' && m === 'POST') {
    const b = await req.json().catch(() => ({}));
    return json(env, { ok: true, ...(await announceUpdate(env, b.force === true)) });
  }

  if (path === '/api/admin/push/send' && m === 'POST') {
    const b = await req.json().catch(() => ({}));
    const title = str(b.title, 60), body = str(b.body, 160), handle = str(b.handle, 40).replace(/^@/, '');
    if (title.length < 2 || body.length < 2) return err(env, 'Add a title and a message');
    if (handle) {                                   // test to one account, and say exactly what Google answered
      let p = await rows(await sb(env, `profiles?select=aid,handle&handle=eq.${enc(handle)}&limit=1`));
      if (!p.length) p = (await rows(await sb(env, `profiles?select=aid,handle&handle=ilike.${enc(handle.replace(/[%*]/g, ''))}&limit=5`))).filter((x) => String(x.handle || '').toLowerCase() === handle.toLowerCase()).slice(0, 1);
      if (!p.length) return err(env, 'No account with that handle');
      const subs = (await rows(await sb(env, `push_subs?select=endpoint,p256dh&aid=eq.${enc(p[0].aid)}&limit=10`))).filter((s) => String(s.endpoint).startsWith('fcm:'));
      const bell = await post(env, 'notifications', { aid: p[0].aid, kind: 'admin', title, body, ref_type: null, ref_id: null }).catch(() => null);
      const report = [bell && bell.ok ? 'Saved in their bell.' : 'Could not save it in their bell.'];
      if (!subs.length) { report.push('That account has no app phone registered. Open the app on that phone, sign in and tap Allow.'); return json(env, { ok: true, report }); }
      for (const s of subs) {
        try {
          const r = await sendFcm(env, s, { title, body, view: 'bell', tag: 'admin', kind: 'admin' });
          report.push(!r ? 'Firebase is not set up on the server (FCM_SERVICE_ACCOUNT)' : r.ok ? 'Sent to an app phone' : 'Google refused it: ' + r.status + ' ' + r.detail);
        } catch (e) { report.push('Failed: ' + ((e && e.message) || 'unknown')); }
      }
      return json(env, { ok: true, report });
    }
    const subs = await rows(await sb(env, 'push_subs?select=aid&limit=5000'));
    let aids = [...new Set(subs.map((x) => x.aid).filter(Boolean))].slice(0, 2000);
    const club = b.audience === 'club';
    if (club) {                                      // only active club members
      const mem = new Set((await rows(await sb(env, 'club_members?select=aid&status=eq.active&limit=5000'))).map((x) => x.aid));
      aids = aids.filter((a) => mem.has(a));
    }
    for (let i = 0; i < aids.length; i += 20) await Promise.all(aids.slice(i, i + 20).map((a) => notify(env, a, 'admin', title, body)));
    await audit(env, 'push.send', 'all', club ? 'club' : 'everyone', title, ip);
    return json(env, { ok: true, accounts: aids.length });
  }
  return null;
}
