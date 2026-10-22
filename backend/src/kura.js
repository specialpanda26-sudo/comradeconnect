// Kura: campus voting competition. Contestants apply (admin approves), fans buy votes with M-Pesa, rankings update live.
// Money rules: the vote packs and prices live in the database (kura_season.packs). The browser only sends the pack number,
// so the price can never be changed from the phone. Votes are counted ONLY after the payment is confirmed (hooks.onPaid).
import { json, err, sb, rows, one, post, patch, enc, str, UUID, normPhone, hasContact, randHex, throttle, tooMany, user, authProfile, isAdmin, audit } from './lib.js';
import { initPayment, credit } from './pay.js';
import * as store from './storage.js';

const GENDERS = ['female', 'male'];
const SOCIALS = { instagram: 'https://instagram.com/', tiktok: 'https://www.tiktok.com/@', youtube: 'https://www.youtube.com/@', x: 'https://x.com/', facebook: 'https://facebook.com/', snapchat: 'https://www.snapchat.com/add/' };
const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const arr = (v) => (Array.isArray(v) ? v : []);

export async function getSeason(env) {
  const s = (await one(await sb(env, 'kura_season?id=eq.1'))) || {};
  return {
    title: s.title || 'Campus Star Awards', tagline: s.tagline || '', voting_open: s.voting_open !== false, entries_open: s.entries_open !== false,
    ends_at: s.ends_at || null, prize_title: s.prize_title || '', prize_text: s.prize_text || '', prizes: arr(s.prizes), packs: arr(s.packs), campuses: arr(s.campuses), divisions: arr(s.divisions),
  };
}
const votingOpen = (S) => S.voting_open && (!S.ends_at || Date.parse(S.ends_at) > Date.now());
const photoOf = (env, c) => (c.photo_key ? store.mediaUrl(env, c.photo_key) : null);
const rankSort = (a, b) => b.votes - a.votes || String(a.approved_at || a.created_at).localeCompare(String(b.approved_at || b.created_at)) || String(a.id).localeCompare(String(b.id));
const pub = (env, c) => ({ id: c.id, name: c.name, photo: photoOf(env, c), campus: c.campus, gender: c.gender, division: c.division, category: c.category, tagline: c.tagline || '', votes: c.votes || 0, followers: c.followers || 0, verified: !!c.verified });
const LIST = 'id,name,photo_key,campus,gender,division,category,tagline,votes,followers,verified,created_at,approved_at';
const approved = async (env) => (await rows(await sb(env, `kura_contestants?select=${LIST}&status=eq.approved&limit=3000`))).sort(rankSort);

function publicSeason(S) {
  return { title: S.title, tagline: S.tagline, voting_open: votingOpen(S), entries_open: S.entries_open, ends_at: S.ends_at, prize_title: S.prize_title, prize_text: S.prize_text, prizes: S.prizes, packs: S.packs, campuses: S.campuses, divisions: S.divisions, now: new Date().toISOString() };
}

// Races = contestants who share a campus, category and gender. Each race has a leader and a chaser.
function races(env, list) {
  const g = new Map();
  for (const c of list) { const k = c.campus + '|' + c.category + '|' + c.gender; if (!g.has(k)) g.set(k, []); g.get(k).push(c); }
  const out = [];
  for (const m of g.values()) {
    m.sort(rankSort);
    const lead = m[0], chaser = m[1] || null;
    out.push({ campus: lead.campus, category: lead.category, gender: lead.gender, size: m.length, lead: pub(env, lead), chaser: chaser ? pub(env, chaser) : null, gap: chaser ? lead.votes - chaser.votes + 1 : 0, total: m.reduce((s, x) => s + (x.votes || 0), 0) });
  }
  return out;
}

async function buildHome(env) {
  const S = await getSeason(env), list = await approved(env), all = races(env, list);
  const contested = all.filter((r) => r.chaser);
  const closest = contested.filter((r) => r.lead.votes > 0).sort((a, b) => a.gap - b.gap || b.lead.votes - a.lead.votes).slice(0, 3);
  const live = [...contested].sort((a, b) => b.total - a.total).slice(0, 12);
  return {
    season: publicSeason(S),
    stats: { contestants: list.length, campuses: new Set(list.map((c) => c.campus)).size, votes: list.reduce((s, c) => s + (c.votes || 0), 0) },
    top: list.slice(0, 3).map((c) => pub(env, c)), closest, live,
  };
}

async function buildBoard(env, url) {
  const q = url.searchParams, campus = str(q.get('campus'), 80), division = str(q.get('division'), 30), gender = str(q.get('gender'), 10), term = str(q.get('q'), 40).toLowerCase();
  let list = await approved(env);
  if (campus) list = list.filter((c) => c.campus === campus);
  if (GENDERS.includes(gender)) list = list.filter((c) => c.gender === gender);
  if (term) list = list.filter((c) => c.name.toLowerCase().includes(term) || c.category.toLowerCase().includes(term));
  const counts = { all: list.length };
  for (const c of list) counts[c.division] = (counts[c.division] || 0) + 1;
  if (division) list = list.filter((c) => c.division === division);
  return { items: list.slice(0, 300).map((c, i) => ({ ...pub(env, c), rank: i + 1 })), counts, total: list.length };
}

async function buildProfile(env, id, aid) {
  const c = await one(await sb(env, `kura_contestants?id=eq.${id}&status=eq.approved`));
  if (!c) return null;
  const list = await approved(env), rank = list.findIndex((x) => x.id === c.id) + 1, above = rank > 1 ? list[rank - 2] : null;
  const vs = await rows(await sb(env, `kura_votes?select=supporter_name,votes,created_at&contestant_id=eq.${c.id}&status=eq.paid&order=created_at.desc&limit=2000`));
  const tally = new Map();
  for (const v of vs) { const n = (v.supporter_name || '').trim(); if (!n) continue; const k = n.toLowerCase(); const t = tally.get(k) || { name: n, votes: 0 }; t.votes += v.votes; tally.set(k, t); }
  const supporters = [...tally.values()].sort((a, b) => b.votes - a.votes).slice(0, 5);
  const squad = vs.slice(0, 20).map((v) => ({ name: (v.supporter_name || '').trim() || 'Anonymous Fan', votes: v.votes, at: v.created_at }));
  let following = false;
  if (aid) following = !!(await one(await sb(env, `kura_follows?select=aid&contestant_id=eq.${c.id}&aid=eq.${enc(aid)}`)));
  const socials = {};
  for (const [k, v] of Object.entries(c.socials || {})) if (SOCIALS[k] && /^[A-Za-z0-9._-]{1,40}$/.test(v)) socials[k] = { handle: v, url: SOCIALS[k] + encodeURIComponent(v) };
  return { contestant: { ...pub(env, c), bio: c.bio || '', socials }, rank, total: list.length, gap: above ? above.votes - c.votes + 1 : 0, above: above ? above.name : null, supporters, squad, following };
}

// A payment for votes was confirmed: count them once.
export async function kuraPaid(env, p) {
  const [v] = await rows(await patch(env, `kura_votes?payment_id=eq.${p.id}&status=eq.pending`, { status: 'paid', paid_at: new Date().toISOString() }));
  let votes, cid;
  if (v) { votes = v.votes; cid = v.contestant_id; }
  else {
    if (await one(await sb(env, `kura_votes?select=id&payment_id=eq.${p.id}`))) return;      // already counted
    const S = await getSeason(env), pack = S.packs.find((x) => Number(x.price) === Number(p.amount));
    cid = p.ref_id; votes = pack ? Math.floor(Number(pack.votes)) : Math.floor(Number(p.amount) / 10);
    if (UUID.test(String(cid)) && votes > 0) await post(env, 'kura_votes', { contestant_id: cid, aid: p.aid, payment_id: p.id, votes, amount: p.amount, status: 'paid', paid_at: new Date().toISOString() });
  }
  const c = UUID.test(String(cid)) ? await one(await sb(env, `kura_contestants?select=id&id=eq.${cid}`)) : null;
  if (!c || !(votes > 0)) { await credit(env, p.aid, p.amount, 'refund', 'pay:' + p.id, 'Kura votes could not be counted, refunded to wallet'); return; }
  await sb(env, 'rpc/kura_add_votes', { method: 'POST', body: JSON.stringify({ p: cid, n: votes }) });
}
export async function kuraFailed(env, p) { await patch(env, `kura_votes?payment_id=eq.${p.id}&status=eq.pending`, { status: 'failed' }); }

function cleanSocials(raw) {
  const out = {};
  for (const k of Object.keys(SOCIALS)) {
    let v = str(raw && raw[k], 60).replace(/^@+/, '');
    if (!v) continue;
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(v)) return { error: 'Use only the username for ' + k + ', like name123 (no links)' };
    out[k] = v;
  }
  return { out };
}

export async function kuraRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/kura') && !path.startsWith('/api/admin/kura')) return null;
  const body = async () => (await req.json().catch(() => ({})));

  // ================= public =================
  if (path === '/api/kura/home' && m === 'GET') return json(env, await buildHome(env));
  if (path === '/api/kura/board' && m === 'GET') return json(env, await buildBoard(env, url));
  let mm = path.match(/^\/api\/kura\/c\/([0-9a-f-]{36})$/);
  if (mm && m === 'GET') {
    const p = await authProfile(req, env).catch(() => null);
    const d = await buildProfile(env, mm[1], p && !p.banned ? p.aid : null);
    return d ? json(env, d) : err(env, 'Contestant not found', 404);
  }

  // ---- check an application with the email and phone it was sent with ----
  if (path === '/api/kura/status' && m === 'POST') {
    if (!(await throttle(env, ip, 'kurastatus', ip, 30, 30))) return tooMany(env);
    const b = await body(), email = str(b.email, 200).toLowerCase(), phone = normPhone(b.phone);
    if (!EMAIL.test(email) || !phone) return err(env, 'Enter the email and the M-Pesa or mobile number you applied with');
    const c = (await rows(await sb(env, `kura_contestants?select=id,name,status,note,payout_phone,email&email=eq.${enc(email)}&limit=5`))).find((x) => normPhone(x.payout_phone) === phone && String(x.email).toLowerCase() === email);
    if (!c) return json(env, { found: false });
    return json(env, { found: true, status: c.status, name: c.name, note: c.status === 'rejected' ? c.note || '' : '', id: c.status === 'approved' ? c.id : null });
  }

  // ================= signed in =================
  if (path === '/api/kura/me' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const mine = await rows(await sb(env, `kura_contestants?select=id,name,status,note,votes,category,campus&aid=eq.${enc(u.aid)}&order=created_at.desc&limit=5`));
    return json(env, { applications: mine });
  }
  if (path === '/api/kura/photo-url' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body(), ct = String(b.content_type || '').toLowerCase(), ext = PHOTO_TYPES[ct], bytes = Math.floor(Number(b.bytes));
    if (!ext) return err(env, 'Photos must be JPG, PNG or WebP');
    if (!(bytes > 0 && bytes <= 5 * 1048576)) return err(env, 'Photo too large (max 5 MB)');
    if (!(await throttle(env, ip, 'kuraphoto', u.aid, 12, 40))) return tooMany(env);
    const key = `kura/${new Date().toISOString().slice(0, 7)}/${randHex(12)}.${ext}`;
    const upload_url = await store.signUpload(env, store.MEDIA_BUCKET(env), key);
    if (!upload_url) return err(env, 'File storage is not ready. Try again later.', 503);
    return json(env, { key, upload_url, content_type: ct }, 201);
  }
  if (path === '/api/kura/apply' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const S = await getSeason(env);
    if (!S.entries_open) return err(env, 'Entries are closed for this season');
    const b = await body();
    const name = str(b.name, 40), tagline = str(b.tagline, 80), bio = str(b.bio, 300), email = str(b.email, 200).toLowerCase(), phone = normPhone(b.phone);
    const campus = str(b.campus, 80), gender = str(b.gender, 10), division = str(b.division, 30), category = str(b.category, 40), key = str(b.photo_key, 120);
    if (name.length < 2) return err(env, 'Add your stage or creator name');
    if (hasContact(name) || hasContact(tagline) || hasContact(bio)) return err(env, 'Remove phone numbers, handles and links from your name and bio. Add your pages in the social fields.');
    if (!S.campuses.includes(campus)) return err(env, 'Choose your campus');
    if (!GENDERS.includes(gender)) return err(env, 'Choose Female or Male');
    const div = S.divisions.find((d) => d.id === division);
    if (!div || !arr(div.categories).includes(category)) return err(env, 'Choose a category');
    if (!EMAIL.test(email)) return err(env, 'Enter a valid email');
    if (!phone) return err(env, 'Enter your M-Pesa number like 0712345678');
    const soc = cleanSocials(b.socials); if (soc.error) return err(env, soc.error);
    if (!/^kura\/\d{4}-\d{2}\/[0-9a-f]{24}\.(jpg|png|webp)$/.test(key)) return err(env, 'Add a clear photo of you');
    const bucket = store.MEDIA_BUCKET(env), head = await store.head(env, bucket, key);
    if (!head || !(head.size > 0) || head.size > 5 * 1048576) return err(env, 'The photo did not arrive. Pick it again.');
    const want = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[key.split('.').pop()];
    if (store.sniff(await store.peek(env, bucket, key)) !== want) { await store.remove(env, bucket, key); return err(env, 'That file is not a real photo'); }
    if (await one(await sb(env, `kura_contestants?select=id&photo_key=eq.${enc(key)}`))) return err(env, 'Pick the photo again');
    if (!(await throttle(env, ip, 'kuraapply', u.aid, 3, 6))) return tooMany(env);
    const r = await post(env, 'kura_contestants', { aid: u.aid, name, photo_key: key, campus, gender, division, category, tagline: tagline || null, bio: bio || null, socials: soc.out, email, payout_phone: phone });
    if (r.status === 409) return err(env, 'This email has already applied. Use Check my application.', 409);
    const row = await one(r);
    if (!row) { console.error('kura apply failed', r.status); return err(env, 'Could not save your application', 500); }
    return json(env, { id: row.id, status: 'pending' }, 201);
  }
  if (path === '/api/kura/vote' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const S = await getSeason(env);
    if (!votingOpen(S)) return err(env, 'Voting is closed');
    const b = await body();
    if (!UUID.test(String(b.contestant_id || ''))) return err(env, 'Pick a contestant');
    const c = await one(await sb(env, `kura_contestants?select=id,name&id=eq.${b.contestant_id}&status=eq.approved`));
    if (!c) return err(env, 'Contestant not found', 404);
    const idx = Math.floor(Number(b.pack)), pack = S.packs[idx];
    if (!pack || !(Number(pack.price) >= 1) || !(Number(pack.votes) >= 1)) return err(env, 'Choose a vote pack');
    const supporter = str(b.name, 24);
    if (supporter && hasContact(supporter)) return err(env, 'Remove phone numbers, handles and links from the name');
    if (!(await throttle(env, ip, 'kuravote', u.aid, 30, 120))) return tooMany(env);
    const r = await initPayment(env, ip, { aid: u.aid, purpose: 'kura', ref_id: c.id, amount: Number(pack.price), phone: b.phone, method: b.method, email: b.email });
    if (r.res) return r.res;
    await post(env, 'kura_votes', { contestant_id: c.id, aid: u.aid, payment_id: r.id, votes: Math.floor(Number(pack.votes)), amount: Number(pack.price), supporter_name: supporter || null });
    return json(env, { id: r.id, url: r.url, amount: Number(pack.price), votes: Math.floor(Number(pack.votes)) }, 201);
  }
  if (path === '/api/kura/follow' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body();
    if (!UUID.test(String(b.contestant_id || ''))) return err(env, 'Pick a contestant');
    const c = await one(await sb(env, `kura_contestants?select=id&id=eq.${b.contestant_id}&status=eq.approved`));
    if (!c) return err(env, 'Contestant not found', 404);
    if (!(await throttle(env, ip, 'kurafollow', u.aid, 60, 200))) return tooMany(env);
    const have = await one(await sb(env, `kura_follows?select=aid&contestant_id=eq.${c.id}&aid=eq.${enc(u.aid)}`));
    if (have) await sb(env, `kura_follows?contestant_id=eq.${c.id}&aid=eq.${enc(u.aid)}`, { method: 'DELETE' });
    else await post(env, 'kura_follows', { contestant_id: c.id, aid: u.aid }, 'resolution=ignore-duplicates,return=representation');
    const n = (await rows(await sb(env, `kura_follows?select=aid&contestant_id=eq.${c.id}&limit=100000`))).length;
    await patch(env, `kura_contestants?id=eq.${c.id}`, { followers: n });
    return json(env, { following: !have, followers: n });
  }

  // ================= admin =================
  if (path.startsWith('/api/admin/kura')) {
    if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);
    const A = (action, id, detail) => audit(env, action, 'kura', id, detail, ip);
    if (path === '/api/admin/kura' && m === 'GET') {
      const S = await getSeason(env);
      const all = await rows(await sb(env, 'kura_contestants?select=*&order=created_at.desc&limit=1000'));
      const full = (c) => ({ ...pub(env, c), status: c.status, bio: c.bio || '', socials: c.socials || {}, email: c.email, phone: c.payout_phone, note: c.note || '', created_at: c.created_at });
      const paid = await rows(await sb(env, 'kura_votes?select=amount,votes&status=eq.paid&limit=100000'));
      return json(env, {
        season: S, pending: all.filter((c) => c.status === 'pending').map(full), contestants: all.filter((c) => c.status !== 'pending').map(full),
        money: { paid: paid.reduce((s, v) => s + (v.amount || 0), 0), votes: paid.reduce((s, v) => s + (v.votes || 0), 0), payments: paid.length },
      });
    }
    mm = path.match(/^\/api\/admin\/kura\/c\/([0-9a-f-]{36})$/);
    if (mm && m === 'POST') {
      const b = await body(), id = mm[1], act = String(b.action || '');
      const c = await one(await sb(env, `kura_contestants?select=id,status&id=eq.${id}`));
      if (!c) return err(env, 'Not found', 404);
      const SET = {
        approve: { status: 'approved', approved_at: new Date().toISOString(), note: null }, reject: { status: 'rejected', note: str(b.note, 200) || null },
        hide: { status: 'hidden' }, unhide: { status: 'approved' }, verify: { verified: true }, unverify: { verified: false },
      };
      if (act === 'delete') { await sb(env, `kura_contestants?id=eq.${id}`, { method: 'DELETE' }); await A('kura_delete', id); return json(env, { ok: true }); }
      if (!SET[act]) return err(env, 'Unknown action');
      if (act === 'unhide' && c.status !== 'hidden') return err(env, 'Only hidden pages can be shown again');
      await patch(env, `kura_contestants?id=eq.${id}`, SET[act]);
      await A('kura_' + act, id);
      return json(env, { ok: true });
    }
    if (path === '/api/admin/kura/season' && m === 'POST') {
      const b = await body(), has = (k) => b[k] !== undefined, row = { updated_at: new Date().toISOString() };
      if (has('title')) { row.title = str(b.title, 60); if (!row.title) return err(env, 'Add a title'); }
      if (has('tagline')) row.tagline = str(b.tagline, 200);
      if (has('voting_open')) row.voting_open = !!b.voting_open;
      if (has('entries_open')) row.entries_open = !!b.entries_open;
      if (has('ends_at')) { if (b.ends_at === '' || b.ends_at === null) row.ends_at = null; else { const t = Date.parse(b.ends_at); if (!Number.isFinite(t)) return err(env, 'The closing time is not a valid date'); row.ends_at = new Date(t).toISOString(); } }
      if (has('prize_title')) row.prize_title = str(b.prize_title, 80);
      if (has('prize_text')) row.prize_text = str(b.prize_text, 240);
      if (has('prizes')) {
        const p = arr(b.prizes).map((x) => ({ label: str(x && x.label, 40), sub: str(x && x.sub, 60) })).filter((x) => x.label);
        if (p.length > 6) return err(env, 'Up to 6 prize boxes');
        row.prizes = p;
      }
      if (has('campuses')) { const c = arr(b.campuses).map((x) => str(x, 80)).filter(Boolean); if (c.length < 1 || c.length > 80) return err(env, 'Add between 1 and 80 campuses'); row.campuses = [...new Set(c)]; }
      if (has('packs')) {
        const p = arr(b.packs).map((x) => ({ votes: Math.floor(Number(x && x.votes)), price: Math.floor(Number(x && x.price)), ...(x && x.bonus > 0 ? { bonus: Math.floor(Number(x.bonus)) } : {}), ...(x && x.popular ? { popular: true } : {}) }));
        if (p.length < 1 || p.length > 8 || p.some((x) => !(x.votes >= 1 && x.votes <= 100000 && x.price >= 1 && x.price <= 100000))) return err(env, 'Vote packs: 1 to 8 packs with votes and a price in KSh');
        row.packs = p;
      }
      await patch(env, 'kura_season?id=eq.1', row);
      await A('kura_season', '1', Object.keys(row).join(','));
      return json(env, { ok: true });
    }
    return err(env, 'Not found', 404);
  }
  return null;
}
