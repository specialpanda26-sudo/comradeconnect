// A small in-memory imitation of Supabase PostgREST, just enough for the Worker's queries.
// It enforces primary keys / unique rules and implements Prefer: ignore-duplicates / merge-duplicates, so
// races and double-credits behave like the real database.
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const T = (pk, extra = {}) => ({ pk, uniques: [], defaults: {}, ...extra });
const nn = (...c) => (r) => (c.every((k) => r[k] !== null && r[k] !== undefined) ? c.map((k) => String(r[k])).join('|') : null);
export const SCHEMA = {
  payments: T(['id'], { defaults: { status: 'pending' }, uniques: [nn('receipt')] }),
  orders: T(['id'], { defaults: { status: 'held', dispute_status: 'none', code_attempts: 0, fee: 0, payout_status: 'none', code_hash: null }, uniques: [nn('payment_id')] }),
  ai_usage: T(['aid', 'day'], { defaults: { n: 0 } }),
  posts: T(['id'], { defaults: { hidden: false, verified: false, likes: 0, views: 0, boosted_until: null, zone: '', category: 'General' } }),
  comments: T(['id']), post_likes: T(['post_id', 'aid']), reports: T(['id']),
  profiles: T(['aid'], { defaults: { points: 0, verified: false, role: 'user', banned: false, muted_until: null, handle: null, adult_confirmed: false, google_sub: null }, uniques: [(r) => (r.handle ? r.handle.toLowerCase() : null), nn('referral_code'), nn('google_sub')] }),
  listings: T(['id'], { defaults: { status: 'pending', zone: '', description: '', reject_reason: null } }),
  media: T(['id'], { defaults: { status: 'pending', likes: 0, listing_id: null }, uniques: [nn('r2_key')] }), media_likes: T(['media_id', 'aid']),
  threads: T(['id'], { defaults: { listing_id: null }, uniques: [(r) => [r.a_aid, r.b_aid].sort().join('|') + '|' + (r.listing_id || '')] }),
  messages: T(['id'], { defaults: { read_at: null } }), blocks: T(['blocker_aid', 'blocked_aid']), thread_mutes: T(['thread_id', 'aid']),
  message_reports: T(['id'], { defaults: { status: 'open' } }), content_reports: T(['id'], { defaults: { status: 'open' }, uniques: [nn('target_type', 'target_id', 'reporter_aid')] }),
  rooms: T(['id'], { defaults: { hidden: false } }), study_groups: T(['id'], { defaults: { hidden: false } }), group_members: T(['group_id', 'aid']),
  polls: T(['id'], { defaults: { hidden: false, closes_at: null } }), poll_votes: T(['poll_id', 'aid']),
  hearts_posts: T(['id'], { defaults: { hidden: false } }), hearts_interests: T(['post_id', 'aid']),
  wifi: T(['id'], { defaults: { hidden: false } }), wifi_votes: T(['wifi_id', 'aid']), hostels: T(['id'], { defaults: { hidden: false } }),
  services: T(['id'], { defaults: { hidden: false } }), study_tips: T(['id'], { defaults: { hidden: false, likes: 0 } }), tip_likes: T(['tip_id', 'aid']), zone_ratings: T(['zone', 'aid']),
  referrals: T(['id'], { defaults: { status: 'pending', order_id: null, unlock_at: null }, uniques: [nn('referred_aid')] }),
  wallet_ledger: T(['id'], { defaults: { status: 'available' }, uniques: [nn('kind', 'ref')] }),
  withdrawals: T(['id'], { defaults: { status: 'requested' } }), verifications: T(['id'], { defaults: { status: 'pending' } }),
  club_members: T(['club', 'aid'], { defaults: { status: 'active' } }), club_products: T(['id'], { defaults: { active: true } }), club_stock: T(['product_id'], { defaults: { qty: 0 } }),
  club_orders: T(['id'], { defaults: { status: 'pending', stock_held: true } }), tickets: T(['id'], { defaults: { status: 'valid' }, uniques: [nn('payment_id')] }),
  sponsors: T(['id'], { defaults: { active: true } }), notices: T(['id'], { defaults: { pinned: false, expires_at: null } }), events: T(['id'], { defaults: { hidden: false } }),
  admin_audit_log: T(['id']), live_streams: T(['id'], { defaults: { status: 'live' } }),
};

export class MockDB {
  constructor() { this.t = Object.fromEntries(Object.keys(SCHEMA).map((k) => [k, []])); this.log = []; }
  rows(name) { return this.t[name]; }
  // ----- filtering -----
  _cmp(v, op, raw) {
    if (op === 'is') return raw === 'null' ? v === null || v === undefined : String(v) === raw;
    if (op === 'not.is') return !(raw === 'null' ? v === null || v === undefined : String(v) === raw);
    if (op === 'in') return raw.replace(/^\(|\)$/g, '').split(',').map(decodeURIComponent).includes(String(v));
    if (v === null || v === undefined) return false;
    if (op === 'eq') return String(v) === raw;
    if (op === 'neq') return String(v) !== raw;
    const a = typeof v === 'number' ? v : String(v), b = typeof v === 'number' ? Number(raw) : raw;
    return op === 'gt' ? a > b : op === 'gte' ? a >= b : op === 'lt' ? a < b : op === 'lte' ? a <= b : false;
  }
  _match(rows, params) {
    const RES = new Set(['select', 'order', 'limit', 'offset']);
    for (const [k, val] of params) {
      if (RES.has(k)) continue;
      const m = val.match(/^(not\.is|eq|neq|gte|gt|lte|lt|in|is)\.(.*)$/);
      if (!m) throw new Error('mock: unsupported filter ' + k + '=' + val);
      rows = rows.filter((r) => this._cmp(r[k], m[1], m[2]));
    }
    return rows;
  }
  _checkUnique(name, row, ignore) {
    const s = SCHEMA[name];
    const key = (r) => s.pk.map((c) => String(r[c])).join('|');
    for (const o of this.t[name]) {
      if (o === ignore) continue;
      if (key(o) === key(row)) return true;
      for (const u of s.uniques) { const a = u(row); if (a !== null && a === u(o)) return true; }
    }
    return false;
  }
  _pkKey(name, r) { return SCHEMA[name].pk.map((c) => String(r[c])).join('|'); }
  handle(method, path, params, body, prefer) {
    const rep = /return=representation/.test(prefer || '');
    if (path.startsWith('rpc/')) return this.rpc(path.slice(4), body);
    const name = path; if (!SCHEMA[name]) throw new Error('mock: unknown table ' + name);
    if (method === 'GET') {
      let r = this._match(this.t[name], params);
      const ord = params.get('order');
      if (ord) for (const part of ord.split(',').reverse()) { const [c, d] = part.split('.'); r = [...r].sort((x, y) => ((x[c] > y[c]) - (x[c] < y[c])) * (d === 'desc' ? -1 : 1)); }
      const off = Number(params.get('offset') || 0), lim = params.get('limit') ? Number(params.get('limit')) : 1000;
      r = r.slice(off, off + lim).map((x) => ({ ...x }));
      const sel = params.get('select') || '';
      if (name === 'posts' && sel.includes('comments(')) r = r.map((p) => ({ ...p, comments: this.t.comments.filter((c) => c.post_id === p.id).map((c) => ({ text: c.text, created_at: c.created_at })) }));
      if (sel && sel !== '*') {                            // column projection, like PostgREST
        const cols = []; let depth = 0, cur = '';
        for (const ch of sel) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { cols.push(cur); cur = ''; } else cur += ch; }
        cols.push(cur);
        const plain = cols.filter((c) => !c.includes('(')), emb = cols.filter((c) => c.includes('(')).map((c) => c.split('(')[0]);
        if (!plain.includes('*')) r = r.map((row) => Object.fromEntries(Object.entries(row).filter(([k]) => plain.includes(k) || emb.includes(k))));
      }
      return { status: 200, body: r };
    }
    if (method === 'POST') {
      const list = Array.isArray(body) ? body : [body], out = [];
      for (const b of list) {
        const row = { ...SCHEMA[name].defaults, ...b };
        if (SCHEMA[name].pk[0] === 'id' && !row.id) row.id = uuid();
        if (!row.created_at && !['ai_usage', 'club_stock'].includes(name)) row.created_at = now();
        const dupIdx = this.t[name].findIndex((o) => this._pkKey(name, o) === this._pkKey(name, row));
        if (/merge-duplicates/.test(prefer || '') && dupIdx >= 0) { Object.assign(this.t[name][dupIdx], b); out.push({ ...this.t[name][dupIdx] }); continue; }
        if (this._checkUnique(name, row)) {
          if (/ignore-duplicates/.test(prefer || '')) continue;
          return { status: 409, body: { code: '23505', message: 'duplicate key' } };
        }
        this.t[name].push(row); out.push({ ...row });
      }
      return { status: 201, body: rep ? out : [] };
    }
    if (method === 'PATCH') {
      const hit = this._match(this.t[name], params), out = [];
      for (const r of hit) {
        const next = { ...r, ...body };
        if (this._checkUnique(name, next, r)) return { status: 409, body: { code: '23505' } };
        Object.assign(r, body); out.push({ ...r });
      }
      return { status: 200, body: rep ? out : [] };
    }
    if (method === 'DELETE') {
      const hit = new Set(this._match(this.t[name], params));
      this.t[name] = this.t[name].filter((r) => !hit.has(r));
      return { status: 204, body: [] };
    }
    throw new Error('mock: method ' + method);
  }
  rpc(fn, a) {
    const find = (t, f) => this.t[t].find(f);
    if (fn === 'inc_post') { const r = find('posts', (x) => x.id === a.p); if (!r) return { status: 200, body: [] }; r[a.col]++; return { status: 200, body: [{ ...r }] }; }
    if (fn === 'inc_likes') { const r = find(a.t === 'media' ? 'media' : 'study_tips', (x) => x.id === a.p); if (r) r.likes++; return { status: 200, body: r ? r.likes : null }; }
    if (fn === 'take_stock') { const r = find('club_stock', (x) => x.product_id === a.p); if (r && r.qty >= a.n) { r.qty -= a.n; return { status: 200, body: true }; } return { status: 200, body: false }; }
    if (fn === 'wallet_balance') return { status: 200, body: this.t.wallet_ledger.filter((x) => x.aid === a.p && x.status === 'available').reduce((s, x) => s + x.delta, 0) };
    throw new Error('mock: unknown rpc ' + fn);
  }
}

// Replaces global fetch: Supabase -> MockDB; TinyPesa / Cloudflare Stream / Gemini -> canned replies (recorded in `calls`).
export function installFetch(db, supabaseUrl, opts = {}) {
  const calls = [], buckets = {};
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith(supabaseUrl + '/storage/v1/')) return fakeStorage(buckets, supabaseUrl, url, init);
    if (url.startsWith(supabaseUrl)) {
      const u = new URL(url), path = u.pathname.replace('/rest/v1/', '');
      const h = init.headers || {};
      const body = init.body ? JSON.parse(init.body) : undefined;
      const r = db.handle(init.method || 'GET', path, u.searchParams, body, h.Prefer);
      return new Response(r.status === 204 ? null : JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } });
    }
    calls.push({ url, init });
    if (url.includes('tinypesa.com')) return opts.tinypesaFail ? new Response(JSON.stringify({ success: 'false' })) : new Response(JSON.stringify({ success: 'true', request_id: 'REQ' + calls.length }));
    if (url.includes('api.cloudflare.com')) return new Response(JSON.stringify({ success: true, result: { uid: 'live-uid-' + calls.length, rtmps: { url: 'rtmps://live.example/x', streamKey: 'SECRETKEY' } } }));
    if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
      const t = new URL(url).searchParams.get('id_token') || '';
      const [kind, sub] = t.split(':');
      if (kind === 'good') return new Response(JSON.stringify({ iss: 'https://accounts.google.com', aud: 'gid.test', sub, exp: String(Math.floor(Date.now() / 1000) + 3600) }));
      if (kind === 'wrongaud') return new Response(JSON.stringify({ iss: 'accounts.google.com', aud: 'other', sub, exp: String(Math.floor(Date.now() / 1000) + 3600) }));
      return new Response('{"error":"invalid_token"}', { status: 400 });
    }
    return new Response('{}');
  };
  return { calls, buckets, restore: () => { globalThis.fetch = real; } };
}
// First bytes that pass the Worker's file-type check, by file extension.
const MAGIC = { jpg: [0xff, 0xd8, 0xff, 0xe0], png: [0x89, 0x50, 0x4e, 0x47], webp: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], mp4: [0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70], webm: [0x1a, 0x45, 0xdf, 0xa3] };
export const magicFor = (key, tail = '') => Uint8Array.from([...(MAGIC[String(key).split('.').pop()] || []), ...Array(16).fill(0)].slice(0, 16).concat([...new TextEncoder().encode(tail)]));
export class FakeBucket {
  constructor() { this.o = new Map(); }
  put(k, size, body) { this.o.set(k, { size, body: body === undefined ? magicFor(k) : typeof body === 'string' ? magicFor(k, body) : body }); }
  async head(k) { const x = this.o.get(k); return x ? { size: x.size } : null; }
  async get(k) { const x = this.o.get(k); return x ? { body: x.body, size: x.size } : null; }
  async delete(k) { this.o.delete(k); }
}
// Pretends to be the Supabase Storage REST API (signed upload URL, info, ranged download, delete).
function fakeStorage(buckets, supabaseUrl, url, init) {
  const u = new URL(url), p = decodeURIComponent(u.pathname.replace('/storage/v1', '')), method = init.method || 'GET';
  const h = init.headers || {};
  if (h.Authorization !== 'Bearer svc') return new Response('{"error":"unauthorized"}', { status: 401 });
  let m = p.match(/^\/object\/upload\/sign\/([^/]+)\/(.+)$/);
  if (m && method === 'POST') return buckets[m[1]] ? new Response(JSON.stringify({ url: `/object/upload/sign/${m[1]}/${m[2]}?token=tok123` }), { status: 200 }) : new Response('{}', { status: 404 });
  m = p.match(/^\/object\/info\/([^/]+)\/(.+)$/);
  if (m && method === 'GET') { const x = buckets[m[1]] && buckets[m[1]].o.get(m[2]); return x ? new Response(JSON.stringify({ size: x.size, content_type: 'application/octet-stream' })) : new Response('{"error":"not found"}', { status: 404 }); }
  m = p.match(/^\/object\/([^/]+)\/(.+)$/);
  if (m && method === 'GET') {
    const x = buckets[m[1]] && buckets[m[1]].o.get(m[2]); if (!x) return new Response('{"error":"not found"}', { status: 404 });
    let b = x.body; if (typeof b === 'string') b = new TextEncoder().encode(b);
    const r = /bytes=0-(\d+)/.exec(h.Range || ''); if (r) return new Response(b.slice(0, Number(r[1]) + 1), { status: 206 });
    return new Response(b, { status: 200, headers: { 'Content-Type': m[2].endsWith('png') ? 'image/png' : 'image/jpeg' } });
  }
  if (m && method === 'DELETE') { if (buckets[m[1]]) buckets[m[1]].o.delete(m[2]); return new Response('{}'); }
  return new Response('{}', { status: 404 });
}
