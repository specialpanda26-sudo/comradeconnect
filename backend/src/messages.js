// Anonymous messaging: threads, inbox, block, report, 24-hour mute. Clients never see the other person's aid.
import { json, err, sb, rows, one, post, patch, enc, inList, str, UUID, throttle, tooMany, user, contactBlock, ahead, DAY } from './lib.js';

// What a person can start a chat about besides a Market item: [table, text column shown as the chat title]. Hearts chats only start from a match.
const REFS = { wifi: ['wifi', 'place'], post: ['posts', 'content'], room: ['rooms', 'title'], service: ['services', 'title'], group: ['study_groups', 'name'] };
const other = (t, aid) => (t.a_aid === aid ? t.b_aid : t.a_aid);
async function blockedEither(env, x, y) {
  const r = await rows(await sb(env, `blocks?select=blocker_aid,blocked_aid&blocker_aid=${inList([x, y])}&blocked_aid=${inList([x, y])}`));
  return { iBlocked: r.some((b) => b.blocker_aid === x && b.blocked_aid === y), theyBlocked: r.some((b) => b.blocker_aid === y && b.blocked_aid === x) };
}
async function myThread(env, id, aid) {
  const t = UUID.test(id) ? await one(await sb(env, `threads?id=eq.${id}`)) : null;
  return t && (t.a_aid === aid || t.b_aid === aid) ? t : null;
}

export async function messageRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/messages')) return null;
  const body = async () => (await req.json().catch(() => ({})));

  if (path === '/api/messages/send' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body(), text = str(b.body, 500);
    if (!text) return err(env, 'Write a message');
    const blk = contactBlock(env, text); if (blk) return blk;
    if (!(await throttle(env, ip, 'msg', u.aid, 80, 300))) return tooMany(env);
    let t, target;
    if (b.thread_id) {
      t = await myThread(env, String(b.thread_id), u.aid);
      if (!t) return err(env, 'Conversation not found', 404);
      target = other(t, u.aid);
    } else {
      let listingId = null, refTitle = null;
      if (b.listing_id) {
        if (!UUID.test(String(b.listing_id))) return err(env, 'Not found', 404);
        const l = await one(await sb(env, `listings?select=id,seller_aid,status&id=eq.${b.listing_id}`));
        if (!l || l.status === 'removed' || l.status === 'rejected') return err(env, 'Not found', 404);
        target = l.seller_aid; listingId = l.id;
      } else if (b.ref_type) {                                                  // a Feed story, roommate post, service or study group: the author is found here, never sent to the phone
        const ref = REFS[String(b.ref_type)], rid = String(b.ref_id || '');
        if (!ref || !UUID.test(rid)) return err(env, 'Not found', 404);
        const it = await one(await sb(env, `${ref[0]}?select=id,aid,${ref[1]}&id=eq.${rid}&hidden=eq.false`));
        if (!it) return err(env, 'Not found', 404);
        target = it.aid; listingId = it.id; refTitle = str(it[ref[1]], 60);
      } else target = str(b.to_aid, 64);
      if (!target || target === u.aid) return err(env, 'Not found', 404);
      const tp = await one(await sb(env, `profiles?select=aid,banned&aid=eq.${enc(target)}`));
      if (!tp || tp.banned) return err(env, 'Not found', 404);
      const bl = await blockedEither(env, u.aid, target);
      if (bl.iBlocked) return err(env, 'You blocked this person. Unblock them to send a message.', 403);
      if (bl.theyBlocked) return err(env, 'You cannot message this person', 403);
      if (!(await throttle(env, ip, 'newthread', u.aid, 20, 60))) return tooMany(env);
      const cand = await rows(await sb(env, `threads?a_aid=${inList([u.aid, target])}&b_aid=${inList([u.aid, target])}`));
      t = cand.find((x) => (x.listing_id || null) === listingId);
      if (!t) {
        const res = await post(env, 'threads', { a_aid: u.aid, b_aid: target, listing_id: listingId, ...(refTitle ? { ref_title: refTitle } : {}) });
        t = (await rows(res))[0];
        if (!t) t = (await rows(await sb(env, `threads?a_aid=${inList([u.aid, target])}&b_aid=${inList([u.aid, target])}`))).find((x) => (x.listing_id || null) === listingId);
        if (!t) return err(env, 'Could not start the conversation', 500);
      }
    }
    if (b.thread_id) {
      const bl = await blockedEither(env, u.aid, target);
      if (bl.iBlocked) return err(env, 'You blocked this person. Unblock them to send a message.', 403);
      if (bl.theyBlocked) return err(env, 'You cannot message this person', 403);
    }
    const msg = await one(await post(env, 'messages', { thread_id: t.id, sender_aid: u.aid, body: text }));
    if (!msg) return err(env, 'Could not send', 500);
    await patch(env, `threads?id=eq.${t.id}`, { last_at: msg.created_at });
    return json(env, { thread_id: t.id, message: { id: msg.id, body: msg.body, mine: true, createdAt: Date.parse(msg.created_at) } }, 201);
  }

  if (path === '/api/messages/inbox' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const a = enc(u.aid);
    const ts = [...await rows(await sb(env, `threads?a_aid=eq.${a}&order=last_at.desc&limit=40`)), ...await rows(await sb(env, `threads?b_aid=eq.${a}&order=last_at.desc&limit=40`))]
      .sort((x, y) => (x.last_at < y.last_at ? 1 : -1)).slice(0, 40);
    if (!ts.length) return json(env, { threads: [] });
    const ids = ts.map((t) => t.id), others = [...new Set(ts.map((t) => other(t, u.aid)))];
    const msgs = await rows(await sb(env, `messages?select=thread_id,sender_aid,body,read_at,created_at&thread_id=${inList(ids)}&order=created_at.desc&limit=400`));
    const profs = await rows(await sb(env, `profiles?select=aid,handle&aid=${inList(others)}`));
    const mutes = await rows(await sb(env, `thread_mutes?select=thread_id,muted_until&aid=eq.${a}&thread_id=${inList(ids)}`));
    const blocks = await rows(await sb(env, `blocks?select=blocked_aid&blocker_aid=eq.${a}`));
    const lids = ts.map((t) => t.listing_id).filter(Boolean);
    const ls = lids.length ? await rows(await sb(env, `listings?select=id,title&id=${inList(lids)}`)) : [];
    return json(env, {
      threads: ts.map((t) => {
        const mine = msgs.filter((x) => x.thread_id === t.id), last = mine[0], o = other(t, u.aid);
        const mu = mutes.find((x) => x.thread_id === t.id);
        return {
          id: t.id, with: profs.find((p) => p.aid === o)?.handle || 'Comrade', listing: t.listing_id ? { id: t.listing_id, title: ls.find((l) => l.id === t.listing_id)?.title || t.ref_title || null } : null,
          last: last ? { body: last.body, mine: last.sender_aid === u.aid, at: Date.parse(last.created_at) } : null,
          unread: mine.filter((x) => x.sender_aid !== u.aid && !x.read_at).length,
          muted: !!(mu && new Date(mu.muted_until) > new Date()), blocked: blocks.some((x) => x.blocked_aid === o),
        };
      }),
    });
  }

  let mm = path.match(/^\/api\/messages\/thread\/([0-9a-f-]{36})$/);
  if (mm && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const t = await myThread(env, mm[1], u.aid); if (!t) return err(env, 'Conversation not found', 404);
    const msgs = await rows(await sb(env, `messages?thread_id=eq.${t.id}&order=created_at.asc&limit=200`));
    await patch(env, `messages?thread_id=eq.${t.id}&sender_aid=neq.${enc(u.aid)}&read_at=is.null`, { read_at: new Date().toISOString() });
    return json(env, { messages: msgs.map((x) => ({ id: x.id, body: x.body, mine: x.sender_aid === u.aid, system: x.sender_aid === 'system', createdAt: Date.parse(x.created_at) })) });
  }

  if (m === 'POST' && ['/api/messages/block', '/api/messages/unblock', '/api/messages/mute'].includes(path)) {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body(), t = await myThread(env, String(b.thread_id || ''), u.aid);
    if (!t) return err(env, 'Conversation not found', 404);
    const o = other(t, u.aid);
    if (path.endsWith('/block')) { await post(env, 'blocks', { blocker_aid: u.aid, blocked_aid: o }, 'resolution=ignore-duplicates,return=representation'); return json(env, { blocked: true }); }
    if (path.endsWith('/unblock')) { await sb(env, `blocks?blocker_aid=eq.${enc(u.aid)}&blocked_aid=eq.${enc(o)}`, { method: 'DELETE' }); return json(env, { blocked: false }); }
    const until = ahead(DAY);                                  // fixed 24-hour mute
    await post(env, 'thread_mutes', { thread_id: t.id, aid: u.aid, muted_until: until }, 'resolution=merge-duplicates,return=representation');
    return json(env, { muted_until: until });
  }

  if (path === '/api/messages/report' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body(); const mid = String(b.message_id || '');
    if (!UUID.test(mid)) return err(env, 'Pick a message', 404);
    const msg = await one(await sb(env, `messages?id=eq.${mid}`));
    const t = msg ? await myThread(env, msg.thread_id, u.aid) : null;
    if (!msg || !t || msg.sender_aid === u.aid || msg.sender_aid === 'system') return err(env, 'Message not found', 404);
    if (!(await throttle(env, ip, 'msgreport', u.aid, 10, 40))) return tooMany(env);
    await post(env, 'message_reports', { message_id: msg.id, thread_id: t.id, reporter_aid: u.aid, reported_aid: msg.sender_aid, reason: str(b.reason, 200), snapshot: msg.body });
    return json(env, { ok: true });
  }
  return null;
}
