// Community content: roommates, study groups, polls, Hearts (18+), Wi-Fi, hostels, services, study tips, zone ratings,
// plus public notices/events/sponsors and the shared report endpoint.
import { wifiParse, wifiMask, WIFI_TEXT } from './wifi.js';
import { campusRow, campusQuery } from './campus.js';
import { hostelParse, hostelText, decorateHostels, isCaretaker } from './hostels.js';
import { json, err, sb, rows, one, post, patch, enc, inList, str, int, UUID, throttle, tooMany, user, authProfile, contactBlock } from './lib.js';

const ok = (v) => v !== null && v !== undefined;
import { decorateServices } from './serviceworks.js';
const CAMPUS_TABLES = new Set(['wifi', 'hostels', 'rooms', 'services']);   // these follow the campus you picked
// Each resource: table, text fields (contact-filtered), a parser that returns the row to insert or an error string.
const R = {
  rooms: { table: 'rooms', per: 5, rtype: 'room', text: ['title', 'details', 'zone'], parse: (b) => {
    const title = str(b.title, 80); if (title.length < 3) return 'Add a title';
    return { kind: b.kind === 'offering' ? 'offering' : 'looking', title, details: str(b.details, 500), rent: int(b.rent, 0, 200000), zone: str(b.zone, 30) };
  } },
  groups: { table: 'study_groups', per: 5, rtype: 'group', text: ['name', 'unit', 'details'], parse: (b) => {
    const name = str(b.name, 60); if (name.length < 3) return 'Add a group name';
    return { name, unit: str(b.unit, 40), details: str(b.details, 300), max_members: int(b.max_members, 2, 100) ?? 10 };
  } },
  polls: { table: 'polls', per: 5, rtype: 'poll', text: ['question'], parse: (b) => {
    const question = str(b.question, 140), options = Array.isArray(b.options) ? b.options.map((o) => str(o, 40)).filter(Boolean) : [];
    if (question.length < 5) return 'Write a question';
    if (options.length < 2 || options.length > 6) return 'Give 2 to 6 options';
    if (hasDup(options)) return 'Options must be different';
    return { question, options, text_extra: options };
  } },
  hearts: { table: 'hearts_posts', per: 3, rtype: 'hearts', adult: true, text: ['content', 'zone'], parse: (b) => {
    const content = str(b.content, 300); if (content.length < 5) return 'Write a little more';
    return { content, zone: str(b.zone, 30) };
  } },
  wifi: { table: 'wifi', per: 8, rtype: 'wifi', text: WIFI_TEXT, parse: wifiParse },
  hostels: { table: 'hostels', per: 5, rtype: 'hostel', text: hostelText, parse: hostelParse },
  services: { table: 'services', per: 5, rtype: 'service', text: ['title', 'category', 'price_note', 'zone', 'details'], parse: (b) => {
    const title = str(b.title, 80); if (title.length < 3) return 'Add a title';
    return { title, category: str(b.category, 30) || 'General', price_note: str(b.price_note, 40) || null, zone: str(b.zone, 30), details: str(b.details, 400) };
  } },
  tips: { table: 'study_tips', per: 10, rtype: 'tip', text: ['unit', 'tip'], parse: (b) => {
    const tip = str(b.tip, 300); if (tip.length < 5) return 'Write the tip';
    return { unit: str(b.unit, 40), tip };
  } },
};
const hasDup = (a) => new Set(a.map((x) => x.toLowerCase())).size !== a.length;
export const HIDE = { room: ['rooms', { hidden: true }, { hidden: false }], group: ['study_groups', { hidden: true }, { hidden: false }], poll: ['polls', { hidden: true }, { hidden: false }],
  hearts: ['hearts_posts', { hidden: true }, { hidden: false }], wifi: ['wifi', { hidden: true }, { hidden: false }], hostel: ['hostels', { hidden: true }, { hidden: false }],
  service: ['services', { hidden: true }, { hidden: false }], spot: ['spots', { hidden: true }, { hidden: false }], tip: ['study_tips', { hidden: true }, { hidden: false }], clip: ['media', { status: 'hidden' }, { status: 'ready' }],
  listing: ['listings', { status: 'removed' }, { status: 'approved' }], event: ['events', { hidden: true }, { hidden: false }] };
const AUTOHIDE = new Set(['room', 'group', 'poll', 'hearts', 'wifi', 'hostel', 'service', 'tip', 'clip', 'spot']);   // listings and users wait for an admin

const pub = (r, me) => { const { aid, ip, hidden, ...rest } = r; return { ...rest, createdAt: Date.parse(r.created_at), mine: !!me && me.aid === aid }; };

async function adultBlock(env, u) { return u.adult_confirmed ? null : err(env, 'Confirm you are 18 or older to use Hearts', 403); }

export async function contentRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  const body = async () => (await req.json().catch(() => ({})));

  // ---- public notices / events / sponsors ----
  if (m === 'GET' && path === '/api/notices') {
    const now = new Date().toISOString();
    const r = (await rows(await sb(env, 'notices?order=created_at.desc&limit=50'))).filter((n) => !n.expires_at || n.expires_at >= now).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).slice(0, 20);
    return json(env, { notices: r.map((n) => ({ id: n.id, title: n.title, body: n.body, pinned: n.pinned, createdAt: Date.parse(n.created_at) })) });
  }
  if (m === 'GET' && path === '/api/events') {
    const today = new Date().toISOString().slice(0, 10);
    const r = await rows(await sb(env, `events?hidden=eq.false&starts_on=gte.${today}${campusQuery(req)}&order=starts_on.asc&limit=50`));
    const hosts = [...new Set(r.filter((e) => e.owner_aid).map((e) => e.owner_aid))];
    const names = hosts.length ? await rows(await sb(env, `profiles?select=aid,handle&aid=${inList(hosts)}`)) : [];
    const capped = r.filter((e) => e.capacity), sold = capped.length ? await rows(await sb(env, `tickets?select=event_id&event_id=${inList(capped.map((e) => e.id))}&status=neq.void&limit=5000`)) : [];
    return json(env, { events: r.map((e) => ({ id: e.id, title: e.title, date: e.starts_on, time: e.starts_at || undefined, category: e.category || 'Other', venue: e.venue, details: e.details, ticket_price: e.ticket_price, hosted: !!e.owner_aid, capacity: e.capacity,
      organizer: e.owner_aid ? '@' + (names.find((x) => x.aid === e.owner_aid)?.handle || 'comrade') : undefined,
      left: e.capacity ? Math.max(0, e.capacity - sold.filter((t) => t.event_id === e.id).length) : undefined })) });
  }
  if (m === 'GET' && path === '/api/sponsors') {
    const now = new Date().toISOString();
    const r = (await rows(await sb(env, 'sponsors?active=eq.true&order=created_at.desc&limit=20'))).filter((s) => (!s.starts_at || s.starts_at <= now) && (!s.ends_at || s.ends_at >= now));
    return json(env, { sponsors: r.map((s) => ({ id: s.id, name: s.name, blurb: s.blurb, link: s.link })) });
  }

  // ---- reports on anything (queue for admins; auto-hide at 3 different reporters for hideable types) ----
  if (path === '/api/report' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body(), type = String(b.type || ''), id = str(b.id, 64);
    if (!(type in HIDE) && type !== 'user' && type !== 'notice') return err(env, 'Unknown item');
    if (!id) return err(env, 'Unknown item');
    if (!(await throttle(env, ip, 'report', u.aid, 30, 100))) return tooMany(env);
    await post(env, 'content_reports', { target_type: type, target_id: id, reporter_aid: u.aid, reason: str(b.reason, 200) }, 'resolution=ignore-duplicates,return=representation');
    if (AUTOHIDE.has(type) && UUID.test(id)) {
      const reps = await rows(await sb(env, `content_reports?select=reporter_aid&target_type=eq.${type}&target_id=eq.${id}&status=eq.open`));
      if (new Set(reps.map((x) => x.reporter_aid)).size >= 3) await patch(env, `${HIDE[type][0]}?id=eq.${id}`, HIDE[type][1]);
    }
    return json(env, { ok: true });
  }

  // ---- zone ratings ----
  if (path === '/api/c/zones' && m === 'GET') {
    const r = await rows(await sb(env, 'zone_ratings?select=zone,safety,noise,value&limit=5000'));
    const z = {};
    for (const x of r) { const o = (z[x.zone] ||= { zone: x.zone, n: 0, s: 0, no: 0, v: 0 }); o.n++; o.s += x.safety || 0; o.no += x.noise || 0; o.v += x.value || 0; }
    return json(env, { zones: Object.values(z).map((o) => ({ zone: o.zone, ratings: o.n, safety: +(o.s / o.n).toFixed(1), noise: +(o.no / o.n).toFixed(1), value: +(o.v / o.n).toFixed(1) })) });
  }
  if (path === '/api/c/zones/rate' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body(), zone = str(b.zone, 30), safety = int(b.safety, 1, 5), noise = int(b.noise, 1, 5), value = int(b.value, 1, 5);
    if (!zone || !safety || !noise || !value) return err(env, 'Rate safety, noise and value from 1 to 5');
    const blk = contactBlock(env, zone); if (blk) return blk;
    if (!(await throttle(env, ip, 'zonerate', u.aid, 20, 80))) return tooMany(env);
    await post(env, 'zone_ratings', { zone, aid: u.aid, safety, noise, value }, 'resolution=merge-duplicates,return=representation');
    return json(env, { ok: true });
  }

  if (path === '/api/c/wifi/map' && req.method === 'GET') {            // every shared network that has a real location, for the map
    const me = req.headers.get('X-Token') ? await authProfile(req, env) : null;
    const kd = url.searchParams.get('kind');
    const r = await rows(await sb(env, `wifi?hidden=eq.false&lat=not.is.null${campusQuery(req)}&order=created_at.desc&limit=500${['spot', 'share', 'reseller'].includes(kd) ? '&kind=eq.' + kd : ''}`));
    const v = r.length ? await rows(await sb(env, `wifi_votes?select=wifi_id,value&wifi_id=${inList(r.map((x) => x.id))}`)) : [];
    const items = r.map((x) => {
      const sc = v.filter((y) => y.wifi_id === x.id), p = wifiMask(pub(x, me), me);
      return { id: p.id, kind: p.kind, place: p.place, zone: p.zone, business: p.business, ssid: p.ssid, password: p.password, has_password: p.has_password, locked: p.locked, speed_note: p.speed_note,
        lat: p.lat, lng: p.lng, score: sc.reduce((t, y) => t + y.value, 0), votes: sc.length, tech: p.tech, packages: p.packages, mine: p.mine };
    });
    return json(env, { items });
  }
  const mm = path.match(/^\/api\/c\/(rooms|groups|polls|hearts|wifi|hostels|services|tips)(?:\/([0-9a-f-]{36})\/(join|leave|vote|interest|like|remove))?$/);
  if (!mm) return null;
  const res = R[mm[1]], id = mm[2], act = mm[3];

  // ---- list ----
  if (!id && m === 'GET') {
    let me = req.headers.get('X-Token') ? await authProfile(req, env) : null;
    if (res.adult) { if (!me) return err(env, 'Please sign in again', 401); const blk = await adultBlock(env, me); if (blk) return blk; }
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1), limit = Math.min(30, Math.max(1, parseInt(url.searchParams.get('limit')) || 15));
    let q = `${res.table}?hidden=eq.false&order=${mm[1] === 'services' ? 'featured.desc,' : ''}created_at.desc&limit=${limit + 1}&offset=${(page - 1) * limit}`;
    const zone = url.searchParams.get('zone'); if (zone && zone !== 'All' && res.table !== 'polls' && res.table !== 'study_tips' && res.table !== 'study_groups') q += mm[1] === 'services' ? `&or=(zone.eq.${enc(zone.slice(0, 30))},zone.eq.)` : `&zone=eq.${enc(zone.slice(0, 30))}`;
    const kd = url.searchParams.get('kind'); if (res.table === 'wifi' && ['spot', 'share', 'reseller'].includes(kd)) q += '&kind=eq.' + kd;
    if (res.table === 'hostels' && ['vacancy', 'review'].includes(kd)) q += '&kind=eq.' + kd;
    if (CAMPUS_TABLES.has(res.table)) q += campusQuery(req);
    let lr = await sb(env, q); if (!lr.ok && q.includes('featured.desc,')) lr = await sb(env, q.replace('featured.desc,', ''));
    const r = await rows(lr); const list = r.slice(0, limit), ids = list.map((x) => x.id);
    let items = list.map((x) => pub(x, me));
    if (mm[1] === 'hostels') items = await decorateHostels(env, items, me);
    if (mm[1] === 'services') items = await decorateServices(env, items);
    if (ids.length && mm[1] === 'polls') {
      const v = await rows(await sb(env, `poll_votes?select=poll_id,aid,option_idx&poll_id=${inList(ids)}`));
      items = items.map((p) => { const mine = v.find((x) => x.poll_id === p.id && me && x.aid === me.aid);
        const counts = p.options.map((_, i) => v.filter((x) => x.poll_id === p.id && x.option_idx === i).length);
        return { ...p, counts, voted: mine ? mine.option_idx : null, closed: !!(p.closes_at && new Date(p.closes_at) < new Date()) }; });
    } else if (ids.length && mm[1] === 'groups') {
      const g = await rows(await sb(env, `group_members?select=group_id,aid&group_id=${inList(ids)}`));
      items = items.map((x) => ({ ...x, members: g.filter((y) => y.group_id === x.id).length, joined: !!me && g.some((y) => y.group_id === x.id && y.aid === me.aid) }));
    } else if (ids.length && mm[1] === 'wifi') {
      const v = await rows(await sb(env, `wifi_votes?select=wifi_id,aid,value&wifi_id=${inList(ids)}`));
      items = items.map((x) => ({ ...x, score: v.filter((y) => y.wifi_id === x.id).reduce((s, y) => s + y.value, 0), votes: v.filter((y) => y.wifi_id === x.id).length, my_vote: v.find((y) => y.wifi_id === x.id && me && y.aid === me.aid)?.value ?? 0 }));
      items = items.map((x) => wifiMask(x, me));
    } else if (ids.length && mm[1] === 'hearts' && me) {
      const mine = await rows(await sb(env, `hearts_interests?select=post_id&aid=eq.${enc(me.aid)}&post_id=${inList(ids)}`));
      items = items.map((x) => ({ ...x, interested: mine.some((y) => y.post_id === x.id) }));
    }
    return json(env, { items, hasMore: r.length > limit });
  }

  // ---- create ----
  if (!id && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    if (res.adult) { const blk = await adultBlock(env, u); if (blk) return blk; }
    const b = await body(), parsed = res.parse(b);
    if (typeof parsed === 'string') return err(env, parsed);
    if (mm[1] === 'hostels' && parsed.kind === 'vacancy' && !(await isCaretaker(env, u.aid))) return err(env, 'Register as a hostel caretaker first to post vacancies', 403);
    const { text_extra, ...rowData } = parsed;
    const blk = contactBlock(env, ...res.text.map((f) => rowData[f]), ...(text_extra || [])); if (blk) return blk;
    if (!(await throttle(env, ip, 'c:' + mm[1], u.aid, res.per, res.per * 4))) return tooMany(env);
    const r = await one(await post(env, res.table, { ...rowData, ...(CAMPUS_TABLES.has(res.table) ? campusRow(req) : {}), aid: u.aid, ip }));
    return r ? json(env, pub(r, u), 201) : err(env, 'Could not save', 500);
  }

  // ---- actions on one item ----
  if (id && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    if (!(await throttle(env, ip, 'cact', u.aid, 300, 1200))) return tooMany(env);
    const b = await body();
    const item = await one(await sb(env, `${res.table}?id=eq.${id}&hidden=eq.false`));
    if (!item) return err(env, 'Not found', 404);

    if (mm[1] === 'polls' && act === 'vote') {
      const idx = int(b.option, 0, 5);
      if (idx === null || idx >= item.options.length) return err(env, 'Pick one of the options');
      if (item.closes_at && new Date(item.closes_at) < new Date()) return err(env, 'This poll is closed', 409);
      const ins = await rows(await post(env, 'poll_votes', { poll_id: id, aid: u.aid, option_idx: idx }, 'resolution=ignore-duplicates,return=representation'));
      if (!ins.length) return err(env, 'You already voted', 409);                       // primary key (poll_id, aid): one vote per person
      const v = await rows(await sb(env, `poll_votes?select=option_idx&poll_id=eq.${id}`));
      return json(env, { counts: item.options.map((_, i) => v.filter((x) => x.option_idx === i).length), voted: idx });
    }
    if (mm[1] === 'groups' && (act === 'join' || act === 'leave')) {
      if (act === 'leave') { await sb(env, `group_members?group_id=eq.${id}&aid=eq.${enc(u.aid)}`, { method: 'DELETE' }); return json(env, { joined: false }); }
      const cur = await rows(await sb(env, `group_members?select=aid&group_id=eq.${id}`));
      if (cur.some((x) => x.aid === u.aid)) return json(env, { joined: true, members: cur.length });
      if (cur.length >= item.max_members) return err(env, 'This group is full', 409);
      await post(env, 'group_members', { group_id: id, aid: u.aid }, 'resolution=ignore-duplicates,return=representation');
      const after = await rows(await sb(env, `group_members?select=aid&group_id=eq.${id}`));
      if (after.length > item.max_members) {                                            // two people took the last seat: this one backs out
        await sb(env, `group_members?group_id=eq.${id}&aid=eq.${enc(u.aid)}`, { method: 'DELETE' });
        return err(env, 'This group is full', 409);
      }
      return json(env, { joined: true, members: Math.min(after.length, item.max_members) });
    }
    if (mm[1] === 'wifi' && act === 'remove') {                                        // the owner takes a network or plan down; the password is wiped too
      if (item.aid !== u.aid) return err(env, 'Only the person who posted this can remove it', 403);
      await patch(env, `wifi?id=eq.${id}`, { hidden: true, password: null });
      return json(env, { ok: true });
    }
    if (mm[1] === 'wifi' && act === 'vote') {
      const value = Number(b.value);
      if (value !== 1 && value !== -1) return err(env, 'Vote up or down');
      await post(env, 'wifi_votes', { wifi_id: id, aid: u.aid, value }, 'resolution=merge-duplicates,return=representation');
      const v = await rows(await sb(env, `wifi_votes?select=value&wifi_id=eq.${id}`));
      return json(env, { score: v.reduce((s, x) => s + x.value, 0), votes: v.length, my_vote: value });
    }
    if (mm[1] === 'tips' && act === 'like') {
      const ins = await rows(await post(env, 'tip_likes', { tip_id: id, aid: u.aid }, 'resolution=ignore-duplicates,return=representation'));
      if (!ins.length) return json(env, { likes: item.likes });
      const r = await sb(env, 'rpc/inc_likes', { method: 'POST', body: JSON.stringify({ t: 'study_tips', p: id }) });
      return json(env, { likes: await r.json().catch(() => item.likes + 1) });
    }
    if (mm[1] === 'hearts' && act === 'interest') {
      const blk = await adultBlock(env, u); if (blk) return blk;
      if (item.aid === u.aid) return err(env, 'That is your own post', 400);
      await post(env, 'hearts_interests', { post_id: id, aid: u.aid }, 'resolution=ignore-duplicates,return=representation');
      // Match = the author is also interested in one of MY posts. The other person is never revealed, only the new chat.
      const mine = await rows(await sb(env, `hearts_posts?select=id&aid=eq.${enc(u.aid)}`));
      let matched = false, thread_id = null;
      if (mine.length) {
        const back = await rows(await sb(env, `hearts_interests?select=post_id&aid=eq.${enc(item.aid)}&post_id=${inList(mine.map((x) => x.id))}&limit=1`));
        matched = back.length > 0;
      }
      if (matched) {
        const cand = await rows(await sb(env, `threads?a_aid=${inList([u.aid, item.aid])}&b_aid=${inList([u.aid, item.aid])}`));
        let t = cand.find((x) => !x.listing_id);
        if (!t) { t = (await rows(await post(env, 'threads', { a_aid: u.aid, b_aid: item.aid })))[0]; }
        if (t) { thread_id = t.id; await post(env, 'messages', { thread_id: t.id, sender_aid: 'system', body: 'You matched on Hearts. Say hi, and keep your number private.' }); }
      }
      return json(env, { interested: true, matched, thread_id });
    }
  }
  return null;
}
