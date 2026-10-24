// Admin: see who joined what, and remove a join. Covers the club, study groups and Kura entries.
// Removing is always logged in the audit log. A removed club member cannot rejoin by themselves (see club.js).
import { json, err, sb, rows, one, patch, enc, inList, str, UUID, isAdmin, audit } from './lib.js';
import { notify } from './notifications.js';

const handles = async (env, aids) => {
  const ids = [...new Set(aids.filter(Boolean))];
  if (!ids.length) return {};
  const r = await rows(await sb(env, `profiles?select=aid,handle&aid=${inList(ids)}&limit=1000`));
  return Object.fromEntries(r.map((p) => [p.aid, p.handle || '']));
};

export async function adminJoinRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/admin/joins')) return null;
  if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);
  const body = async () => (await req.json().catch(() => ({})));

  if (path === '/api/admin/joins' && m === 'GET') {
    const club = await rows(await sb(env, 'club_members?select=aid,display_name,status,joined_at&status=eq.active&order=joined_at.desc&limit=500'));
    const gm = await rows(await sb(env, 'group_members?select=group_id,aid,joined_at&order=joined_at.desc&limit=1000'));
    const gids = [...new Set(gm.map((x) => x.group_id))];
    const groups = gids.length ? await rows(await sb(env, `study_groups?select=id,name,unit&id=${inList(gids)}&limit=500`)) : [];
    const gname = Object.fromEntries(groups.map((g) => [g.id, g.name + (g.unit ? ' (' + g.unit + ')' : '')]));
    const H = await handles(env, [...club.map((x) => x.aid), ...gm.map((x) => x.aid)]);
    const kura = await rows(await sb(env, 'kura_contestants?select=id,name,campus,category,status,votes,created_at&order=created_at.desc&limit=500').catch(() => ({ json: async () => [] })));
    return json(env, {
      club: club.map((x) => ({ aid: x.aid, handle: H[x.aid] || '', name: x.display_name || '', at: x.joined_at })),
      groups: gm.map((x) => ({ group_id: x.group_id, group: gname[x.group_id] || 'Study group', aid: x.aid, handle: H[x.aid] || '', at: x.joined_at })),
      kura,
    });
  }

  if (path === '/api/admin/joins/remove' && m === 'POST') {
    const b = await body(), kind = str(b.kind, 10);
    if (kind === 'club') {
      const aid = str(b.aid, 60); if (!aid) return err(env, 'Missing account');
      const r = await patch(env, `club_members?club=eq.default&aid=eq.${enc(aid)}`, { status: 'removed' });
      if (!r.ok) return err(env, 'Could not remove that member', 500);
      await audit(env, 'join.remove', 'club', aid, '', ip);
      await notify(env, aid, 'admin', 'Removed from the club', 'An admin removed you from the club.').catch(() => {});
      return json(env, { ok: true });
    }
    if (kind === 'group') {
      const aid = str(b.aid, 60), gid = str(b.group_id, 40);
      if (!aid || !UUID.test(gid)) return err(env, 'Missing details');
      const r = await sb(env, `group_members?group_id=eq.${gid}&aid=eq.${enc(aid)}`, { method: 'DELETE' });
      if (!r.ok) return err(env, 'Could not remove that member', 500);
      await audit(env, 'join.remove', 'group', gid + ':' + aid, '', ip);
      await notify(env, aid, 'admin', 'Removed from a study group', 'An admin removed you from a study group.').catch(() => {});
      return json(env, { ok: true });
    }
    if (kind === 'kura') {
      const id = str(b.id, 40); if (!UUID.test(id)) return err(env, 'Missing details');
      const c = await one(await sb(env, `kura_contestants?select=id&id=eq.${id}`));
      if (!c) return err(env, 'Not found', 404);
      const r = await sb(env, `kura_contestants?id=eq.${id}`, { method: 'DELETE' });
      if (!r.ok) return err(env, 'Could not remove that entry', 500);
      await audit(env, 'join.remove', 'kura', id, '', ip);
      return json(env, { ok: true });
    }
    return err(env, 'Unknown kind');
  }
  return err(env, 'Not found', 404);
}
