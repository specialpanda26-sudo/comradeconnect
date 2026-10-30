// Ludo online rooms. The server owns the dice and every move; phones only send "roll" and "move token N".
// Stakes are taken from the wallet when a player joins, refunded if the room is cancelled, and the pot (minus fee) goes to the winner.
import { json, err, sb, rows, one, post, patch, enc, user, str, int, throttle, tooMany } from './lib.js';
import { credit } from './pay.js';

// ---------- engine (same board maths as frontend/ludo.html) ----------
const START = [0, 13, 26, 39], SAFE = [0, 13, 26, 39, 8, 21, 34, 47];
const TURN_MS = 20000, AUTO_AFTER = 2;
const die = () => { const a = new Uint32Array(1); let n; do { crypto.getRandomValues(a); n = a[0]; } while (n >= 4294967292); return (n % 6) + 1; };
const cellOf = (c, q) => (START[c] + q) % 52;
const canMove = (q, r) => (q < 0 ? r === 6 : q + r <= 56);
const movable = (st, c, r) => st.pos[c].map((q, t) => (canMove(q, r) ? t : -1)).filter((t) => t >= 0);

function danger(st, c, q) {
  const cell = cellOf(c, q); if (SAFE.includes(cell)) return false;
  return st.order.some((o) => o !== c && st.pos[o].some((x) => { if (x < 0 || x > 50) return false; const d = (cell - cellOf(o, x) + 52) % 52; return d > 0 && d <= 6; }));
}
function capturesAt(st, c, q) {
  const cell = cellOf(c, q); if (SAFE.includes(cell)) return false;
  return st.order.some((o) => o !== c && st.pos[o].some((x) => x >= 0 && x <= 50 && cellOf(o, x) === cell));
}
function botPick(st, c, r) {
  let best = -1, bs = -1;
  for (const t of movable(st, c, r)) {
    const q = st.pos[c][t], nq = q < 0 ? 0 : q + r; let s = nq * 0.1;
    if (nq === 56) s += 100; if (q < 0) s += 40;
    if (nq <= 50 && capturesAt(st, c, nq)) s += 80;
    if (nq <= 50 && SAFE.includes(cellOf(c, nq))) s += 15;
    if (q >= 0 && q <= 50 && danger(st, c, q)) s += 25;
    if (nq > 50) s += 10;
    if (s > bs) { bs = s; best = t; }
  }
  return best;
}
const newState = (colors) => ({ order: colors, pos: Object.fromEntries(colors.map((c) => [c, [-1, -1, -1, -1]])), turn: 0, roll: 0, rn: 0, rv: 0, sixes: 0, deadline: Date.now() + TURN_MS, miss: {}, last: null, log: 'Game started' });
const nextTurn = (st, extra) => { if (!extra) { st.sixes = 0; st.turn = (st.turn + 1) % st.order.length; } st.roll = 0; st.deadline = Date.now() + TURN_MS; };

// returns the winning colour or null
function applyMove(st, c, t) {
  const r = st.roll; let q = st.pos[c][t], extra = r === 6, hit = false;
  q = q < 0 ? 0 : q + r; st.pos[c][t] = q;
  if (q <= 50 && !SAFE.includes(cellOf(c, q))) {
    const cell = cellOf(c, q);
    for (const o of st.order) if (o !== c) st.pos[o] = st.pos[o].map((x) => (x >= 0 && x <= 50 && cellOf(o, x) === cell ? (hit = true, -1) : x));
    if (hit) extra = true;
  }
  if (q === 56) extra = true;
  st.last = { c, t, hit };
  st.log = hit ? 'Captured! Roll again' : q === 56 ? 'Token home! Roll again' : '';
  if (st.pos[c].every((x) => x === 56)) return c;
  nextTurn(st, extra); return null;
}
function applyRoll(st) {
  const c = st.order[st.turn]; st.roll = die(); st.rn = (st.rn || 0) + 1; st.rv = st.roll; st.deadline = Date.now() + TURN_MS;
  if (st.roll === 6 && ++st.sixes === 3) { st.log = 'Three sixes. Turn lost'; st.roll = 6; st.skip = true; return; }
  if (!movable(st, c, st.roll).length) { st.skip = true; st.log = 'No move'; }
}
// after a roll: finish skips, auto-move for single options. Returns winner colour or null.
function settleRoll(st, forceAuto) {
  const c = st.order[st.turn];
  if (st.skip) { st.skip = false; const keep = false; nextTurn(st, keep); return null; }
  const m = movable(st, c, st.roll);
  if (m.length === 1) return applyMove(st, c, m[0]);
  if (forceAuto) return applyMove(st, c, botPick(st, c, st.roll));
  return null;
}
// play for anyone whose timer ran out (or who is marked auto). Max 40 steps per call.
function autoplay(st, seatOf) {
  let w = null, n = 0;
  while (!w && n++ < 40) {
    const c = st.order[st.turn], seat = seatOf(c);
    const auto = seat.auto || Date.now() > st.deadline;
    if (!auto) break;
    if (!seat.auto && Date.now() > st.deadline) { st.miss[c] = (st.miss[c] || 0) + 1; if (st.miss[c] >= AUTO_AFTER) seat.auto = true; }
    if (!st.roll) applyRoll(st);
    w = settleRoll(st, true);
    if (!seat.auto) break; // a timed-out human only loses this one turn
  }
  return w;
}

// ---------- helpers ----------
const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const mkCode = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => CODE_CH[b % CODE_CH.length]).join('');
const feePct = (env) => Math.min(30, Math.max(0, Number(env.LUDO_FEE_PERCENT ?? 7)));
const kesOn = (env) => env.LUDO_KES_ENABLED === '1';
const COLORS_BY_COUNT = [[], [], [0, 2], [0, 1, 2], [0, 1, 2, 3]];
const nonce = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('');
// every join gets its own ref, so leave then re-join is charged and refunded correctly (old seats without a ref keep the old key)
const sref = (room, s) => `${room.id}:${s.aid}` + (s.ref ? ':' + s.ref : '');
const potOf = (room) => room.stake * room.seats.length;
const prizeOf = (env, room) => Math.floor(potOf(room) * (100 - feePct(env)) / 100);
async function getRoom(env, code) { return one(await sb(env, `ludo_rooms?select=*&code=eq.${enc(String(code || '').toUpperCase())}&limit=1`)); }
// optimistic write: only succeeds if nobody changed the room since we read it
async function save(env, room, fields) {
  const r = await rows(await patch(env, `ludo_rooms?id=eq.${room.id}&version=eq.${room.version}`, { ...fields, version: room.version + 1, updated_at: new Date().toISOString() }));
  return r[0] || null;
}
const colorsFor = (seats) => { const set = COLORS_BY_COUNT[seats.length] || [0, 1, 2, 3]; return set; };
const view = (room, aid) => {
  const st = room.state, seats = room.seats.map((s, i) => ({ handle: s.handle, color: s.color, me: s.aid === aid, auto: !!s.auto, host: s.aid === room.host_aid }));
  const me = room.seats.find((s) => s.aid === aid);
  let mv = [];
  if (st && room.status === 'playing' && me && st.order[st.turn] === me.color && st.roll) mv = movable(st, me.color, st.roll);
  return { code: room.code, mode: room.mode, stake: room.stake, max: room.max_players, status: room.status, pot: room.pot, prize: room.prize, winner: room.winner_aid ? (room.seats.find((s) => s.aid === room.winner_aid) || {}).handle : null, seats, mycolor: me ? me.color : null, host: room.host_aid === aid, state: st ? { pos: st.pos, order: st.order, turn: st.turn, roll: st.roll, rn: st.rn || 0, rv: st.rv || 0, last: st.last, log: st.log, left: Math.max(0, st.deadline - Date.now()) } : null, movable: mv, version: room.version };
};
const refundSeat = (env, room, s, why) => (room.mode === 'kes' && room.stake ? credit(env, s.aid, room.stake, 'ludo_refund', 'ludo:refund:' + sref(room, s), why) : true);
async function refundAll(env, room, why, skipAid) { for (const s of room.seats) if (s.aid !== skipAid) await refundSeat(env, room, s, why); }
async function payout(env, room) {
  if (room.status !== 'done' || room.payout_done || !room.winner_aid) return;
  if (room.mode === 'kes' && room.prize > 0) {
    const ref = 'ludo:win:' + room.id;
    const paid = (await rows(await sb(env, `wallet_ledger?select=ref&ref=eq.${enc(ref)}&limit=1`))).length > 0;   // already paid but the flag write failed
    if (!paid && !(await credit(env, room.winner_aid, room.prize, 'ludo_win', ref, 'Ludo win'))) return;
  }
  await patch(env, `ludo_rooms?id=eq.${room.id}`, { payout_done: true });
}
async function balance(env, aid) {
  const r = await sb(env, 'rpc/wallet_balance', { method: 'POST', body: JSON.stringify({ p: aid }) });
  const n = Number(await r.json().catch(() => 0)); return Number.isFinite(n) ? n : 0;
}
async function lockStake(env, room, seat) {
  if (room.mode !== 'kes' || !room.stake) return true;
  const bal = await balance(env, seat.aid);
  if (bal < room.stake) return `Not enough wallet balance. You have KSh ${bal}. Add KSh ${room.stake - bal} more to join this stake.`;
  if (!(await credit(env, seat.aid, -room.stake, 'ludo_stake', 'ludo:' + sref(room, seat), 'Ludo stake ' + room.code))) return 'Could not lock your stake. Nothing was charged.';
  if ((await balance(env, seat.aid)) < 0) { await refundSeat(env, room, seat, 'Ludo stake returned'); return 'Not enough wallet balance.'; }
  return true;
}
const finishFields = (env, room, seats, w) => ({ status: 'done', winner_aid: seats.find((s) => s.color === w).aid, prize: prizeOf(env, room) });

// ---------- routes ----------
export async function ludoRoutes(req, env, url, ip) {
  const path = url.pathname; if (!path.startsWith('/api/ludo/')) return null;
  const m = req.method, act = path.slice(10);
  const u = await user(req, env, m !== 'GET'); if (u instanceof Response) return u;
  const body = m === 'POST' ? await req.json().catch(() => ({})) : {};
  const minS = Number(env.LUDO_MIN_STAKE || 10), maxS = Number(env.LUDO_MAX_STAKE || 5000);

  if (act === 'config' && m === 'GET') return json(env, { kes: kesOn(env), fee: feePct(env), min: minS, max: maxS, balance: await balance(env, u.aid) });

  if (act === 'mine' && m === 'GET') {
    const r = await rows(await sb(env, `ludo_rooms?select=code&status=in.(waiting,playing)&seats=cs.${enc(JSON.stringify([{ aid: u.aid }]))}&order=created_at.desc&limit=1`));
    return json(env, { code: r[0] ? r[0].code : null });
  }

  if (act === 'rooms' && m === 'GET') {
    const mode = url.searchParams.get('mode') === 'kes' ? 'kes' : 'pts';
    const r = await rows(await sb(env, `ludo_rooms?select=code,stake,max_players,seats,mode&status=eq.waiting&mode=eq.${mode}&created_at=gte.${new Date(Date.now() - 30 * 60e3).toISOString()}&order=created_at.desc&limit=30`));
    return json(env, { rooms: r.map((x) => ({ code: x.code, stake: x.stake, max: x.max_players, host: (x.seats[0] || {}).handle, n: x.seats.length })) });
  }

  if (act === 'room' && m === 'GET') {
    let room = await getRoom(env, url.searchParams.get('code')); if (!room) return err(env, 'Room not found', 404);
    if (room.status !== 'waiting' && !room.seats.some((s) => s.aid === u.aid)) return err(env, 'This match is private', 403);
    if (room.status === 'playing' && room.state) {
      const st = structuredClone(room.state), seats = structuredClone(room.seats), me = seats.find((s) => s.aid === u.aid);
      // a player who was marked away and opens the match again (back=1) takes their seat back from the bot
      if (me && me.auto && url.searchParams.get('back') === '1') { me.auto = false; st.miss[me.color] = 0; if (st.order[st.turn] === me.color && !st.roll) st.deadline = Date.now() + TURN_MS; }
      const w = autoplay(st, (c) => seats.find((s) => s.color === c));
      if (JSON.stringify(st) !== JSON.stringify(room.state) || JSON.stringify(seats) !== JSON.stringify(room.seats)) {
        const f = { state: st, seats };
        if (w !== null) Object.assign(f, finishFields(env, room, seats, w));
        const saved = await save(env, room, f); if (saved) room = saved; else room = (await getRoom(env, room.code)) || room;
      }
    }
    await payout(env, room);
    return json(env, view(room, u.aid));
  }

  if ((act === 'create' || act === 'join') && !(await throttle(env, ip, 'ludojoin', u.aid, 60))) return tooMany(env);   // daily cap on room creation/joins only; rolls and moves are not limited

  if (act === 'create' && m === 'POST') {
    const mode = body.mode === 'kes' ? 'kes' : 'pts';
    if (mode === 'kes' && !kesOn(env)) return err(env, 'Cash games are not open yet. Play with points.', 403);
    if (mode === 'kes' && body.confirm18 !== true) return err(env, 'Confirm you are 18 or older');
    const stake = mode === 'pts' ? (int(body.stake, 0, 1000) ?? 0) : int(body.stake, minS, maxS), max = int(body.max, 2, 4);
    if (stake === null || max === null) return err(env, `Stake must be KSh ${minS} to ${maxS}`);
    const open = await rows(await sb(env, `ludo_rooms?select=id&status=in.(waiting,playing)&seats=cs.${enc(JSON.stringify([{ aid: u.aid }]))}&limit=1`));
    if (open.length) return err(env, 'Finish or leave your current room first', 409);
    const seat = { aid: u.aid, handle: str(u.handle, 24) || 'Player', color: 0, ref: nonce() };
    const row = { code: mkCode(), host_aid: u.aid, mode, stake, max_players: max, seats: [seat], pot: stake };
    const r = await one(await post(env, 'ludo_rooms', row)); if (!r) return err(env, 'Could not create the room', 500);
    const ok = await lockStake(env, r, seat);
    if (ok !== true) {   // host never paid: close the room and return the stake of anyone who joined in the meantime (not the host)
      for (let i = 0; i < 3; i++) { const cur = (await getRoom(env, r.code)) || r; if (await save(env, cur, { status: 'cancelled' })) { await refundAll(env, cur, 'Ludo room cancelled', u.aid); break; } }
      return err(env, ok, 402);
    }
    return json(env, view(r, u.aid));
  }

  const room0 = await getRoom(env, body.code); if (!room0) return err(env, 'Room not found', 404);
  const mine = (room) => room.seats.find((s) => s.aid === u.aid);

  if (act === 'join' && m === 'POST') {
    if (room0.status !== 'waiting') return err(env, 'This room already started', 409);
    if (mine(room0)) return json(env, view(room0, u.aid));
    if (room0.seats.length >= room0.max_players) return err(env, 'Room is full', 409);
    if (room0.mode === 'kes' && body.confirm18 !== true) return err(env, 'Confirm you are 18 or older');
    const other = await rows(await sb(env, `ludo_rooms?select=id&status=in.(waiting,playing)&seats=cs.${enc(JSON.stringify([{ aid: u.aid }]))}&limit=1`));
    if (other.length) return err(env, 'Finish or leave your current room first', 409);
    const seat = { aid: u.aid, handle: str(u.handle, 24) || 'Player', color: 0, ref: nonce() };
    const lock = await lockStake(env, room0, seat); if (lock !== true) return err(env, lock, 402);
    const seats = [...room0.seats, seat];
    const f = { seats, pot: room0.stake * seats.length };
    if (seats.length === room0.max_players) { const cols = colorsFor(seats); seats.forEach((s, i) => (s.color = cols[i])); f.status = 'playing'; f.state = newState(cols); }
    const saved = await save(env, room0, f);
    if (!saved) { await refundSeat(env, room0, seat, 'Ludo room changed'); return err(env, 'Room changed. Try again.', 409); }
    return json(env, view(saved, u.aid));
  }

  if (act === 'start' && m === 'POST') {   // host starts early with 2 or 3 players
    if (room0.host_aid !== u.aid || room0.status !== 'waiting') return err(env, 'Only the host can start a waiting room', 403);
    if (room0.seats.length < 2) return err(env, 'Need at least 2 players');
    const seats = structuredClone(room0.seats), cols = colorsFor(seats); seats.forEach((s, i) => (s.color = cols[i]));
    const saved = await save(env, room0, { seats, status: 'playing', state: newState(cols) });
    return saved ? json(env, view(saved, u.aid)) : err(env, 'Room changed. Try again.', 409);
  }

  if (act === 'leave' && m === 'POST') {
    if (room0.status !== 'waiting' || !mine(room0)) return err(env, 'You can only leave before the match starts', 409);
    if (room0.host_aid === u.aid) {
      const saved = await save(env, room0, { status: 'cancelled' }); if (!saved) return err(env, 'Room changed. Try again.', 409);
      await refundAll(env, room0, 'Ludo room cancelled'); return json(env, { ok: true });
    }
    const left = room0.seats.filter((s) => s.aid !== u.aid);
    const saved = await save(env, room0, { seats: left, pot: room0.stake * left.length }); if (!saved) return err(env, 'Room changed. Try again.', 409);
    await refundSeat(env, room0, mine(room0), 'Left Ludo room');
    return json(env, { ok: true });
  }

  if ((act === 'roll' || act === 'move') && m === 'POST') {
    let room = room0; if (room.status !== 'playing' || !room.state) return err(env, 'Match is not running', 409);
    const seats = structuredClone(room.seats), st = structuredClone(room.state), me = seats.find((s) => s.aid === u.aid);
    if (!me) return err(env, 'You are not in this match', 403);
    if (st.order[st.turn] !== me.color) return err(env, 'Not your turn', 409);
    me.auto = false; let w = null;
    if (act === 'roll') {
      if (st.roll) return err(env, 'Already rolled', 409);
      applyRoll(st); st.miss[me.color] = 0; w = settleRoll(st, false);
    } else {
      const t = int(body.token, 0, 3); if (t === null || !st.roll || !movable(st, me.color, st.roll).includes(t)) return err(env, 'That token cannot move', 409);
      w = applyMove(st, me.color, t);
    }
    const f = { state: st, seats };
    if (w !== null) Object.assign(f, finishFields(env, room, seats, w));
    const saved = await save(env, room, f); if (!saved) return err(env, 'Game moved on. Refreshing.', 409);
    await payout(env, saved);
    return json(env, view(saved, u.aid));
  }
  return err(env, 'Not found', 404);
}

// Cron: cancel waiting rooms older than 30 min (refund), cancel playing rooms idle for 20 min (everyone left, refund), retry unpaid winners.
export async function ludoCleanup(env) {
  let n = 0;
  const waiting = await rows(await sb(env, `ludo_rooms?select=*&status=eq.waiting&created_at=lte.${new Date(Date.now() - 30 * 60e3).toISOString()}&limit=50`));
  const idle = await rows(await sb(env, `ludo_rooms?select=*&status=eq.playing&updated_at=lte.${new Date(Date.now() - 20 * 60e3).toISOString()}&limit=50`));
  for (const r of [...waiting, ...idle]) { const s = await save(env, r, { status: 'cancelled' }); if (s) { await refundAll(env, r, 'Ludo room cancelled'); n++; } }
  const unpaid = await rows(await sb(env, `ludo_rooms?select=*&status=eq.done&payout_done=eq.false&limit=50`));
  for (const r of unpaid) await payout(env, r);
  return n + unpaid.length;
}
