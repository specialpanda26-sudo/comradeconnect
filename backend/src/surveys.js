// Paid surveys, funded by the person who makes them. The platform never pays rewards from its own pocket.
// Maker pays budget (responses x reward) + a platform fee (admin setting) from the wallet or M-Pesa. An admin approves the survey.
// Each valid answer sends the reward to the comrade's wallet (held for survey_hold_hours so junk can be flagged). Leftover budget goes back.
//   GET  /api/surveys                      live surveys for the campus (X-Campus), with my answer status; also the maker rules
//   POST /api/surveys                      signed in: make a survey (status unpaid until it is paid)
//   GET  /api/surveys/mine                 my answers and my own surveys
//   POST /api/surveys/:id/pay              maker: { method: 'wallet' | 'mpesa', phone }
//   POST /api/surveys/:id/start            comrade: opens the questions and starts the clock
//   POST /api/surveys/:id/answer           comrade: { answers: { q1: 0, q2: [0,2], q3: "text" } }
//   POST /api/surveys/:id/stop | remove    maker: end it early (unused budget returns) or delete an unpaid one
//   GET  /api/surveys/:id/results          maker (or admin): counts per option, text answers, csv
//   POST /api/surveys/:id/flag             maker: { response, note } flag a junk answer inside the hold time
//   GET  /api/admin/surveys                ?status=pending|live|ended|rejected|unpaid|all
//   POST /api/admin/surveys                admin: make a survey funded offline (sponsor paid you outside the app)
//   POST /api/admin/surveys/:id            { action: approve | reject | stop | hide | show | sponsor, note, sponsor_id }
//   GET  /api/admin/surveys/:id/results    results with account ids (admin only)
//   POST /api/admin/surveys/responses/:rid { action: ok | junk }   decide a flagged answer
//   GET  /api/admin/surveys/billing        ?month=YYYY-MM  per maker: rewards paid, fee earned; money held right now
import { json, err, sb, rows, one, post, patch, str, int, UUID, throttle, tooMany, user, authProfile, contactBlock, hasContact, inList, isAdmin, audit, enc, DAY } from './lib.js';
import { campusOf, isAllCampuses, campusOrHome, CAMPUS_IDS, DEFAULT_CAMPUS } from './campus.js';
import { getSettings, feeOf } from './settings.js';
import { notify, notifyAdmins } from './notifications.js';
import { initPayment, payFromWallet, credit, wantsWallet } from './pay.js';
import { normPhone } from './lib.js';

const SETUP = 'Paid surveys are not switched on yet. The admin must run surveys.sql in Supabase (Admin > Site > SQL).';
const MAX_Q = 10, MAX_OPT = 8, MAX_DAYS = 30, TYPES = ['single', 'multi', 'text'];
const COUNTED = 'in.(done,released,flagged)';          // responses that use up a place and a reward
const today = () => new Date().toISOString().slice(0, 10);
const kesDay = (ms) => new Date(ms).toISOString();

export async function surveyPaid(env, p) {
  const s = await one(await sb(env, `surveys?id=eq.${p.ref_id}`));
  if (!s) throw new Error('survey not found for payment ' + p.id);
  const [up] = await rows(await patch(env, `surveys?id=eq.${s.id}&status=eq.unpaid`, { status: 'pending', paid: p.amount, payment_id: p.id }));
  if (!up) { await credit(env, p.aid, p.amount, 'refund', 'svdup:' + p.id, 'Survey was already paid. Money returned.'); return; }   // paid twice: give the second payment back
  await notify(env, s.aid, 'survey', 'Survey paid', `"${s.title}" waits for approval. Your KSh ${p.amount} is held safely.`, 'survey', s.id);
  await notifyAdmins(env, 'survey', 'New survey to approve', s.title, 'survey', s.id);
}

const cleanQuestions = (env, raw) => {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_Q) return { error: `Add from 1 to ${MAX_Q} questions` };
  const qs = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i] || {}, type = String(r.type || ''), text = str(r.text, 160);
    if (!TYPES.includes(type)) return { error: `Question ${i + 1}: pick single choice, multiple choice or short text` };
    if (text.length < 3) return { error: `Question ${i + 1}: write the question` };
    const q = { id: 'q' + (i + 1), type, text };
    if (type !== 'text') {
      const opts = (Array.isArray(r.options) ? r.options : []).map((o) => str(o, 60)).filter(Boolean);
      if (opts.length < 2 || opts.length > MAX_OPT) return { error: `Question ${i + 1}: give from 2 to ${MAX_OPT} answers to pick from` };
      if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) return { error: `Question ${i + 1}: two answers are the same` };
      q.options = opts;
    }
    qs.push(q);
  }
  return { qs };
};
const checkAnswers = (qs, a) => {
  if (!a || typeof a !== 'object') return { error: 'Answer every question' };
  const out = {};
  for (const q of qs) {
    const v = a[q.id];
    if (q.type === 'single') { const n = Number(v); if (!Number.isInteger(n) || n < 0 || n >= q.options.length) return { error: `Pick an answer for: ${q.text}` }; out[q.id] = n; }
    else if (q.type === 'multi') {
      const l = Array.isArray(v) ? [...new Set(v.map(Number))] : [];
      if (!l.length || l.some((n) => !Number.isInteger(n) || n < 0 || n >= q.options.length)) return { error: `Pick at least one answer for: ${q.text}` };
      out[q.id] = l.sort((x, y) => x - y);
    } else {
      const t = str(v, 300); if (t.length < 2) return { error: `Write a short answer for: ${q.text}` };
      if (hasContact(t)) return { error: 'Remove phone numbers, handles and links from your answer' };
      out[q.id] = t;
    }
  }
  return { answers: out };
};
const filledOf = async (env, id) => (await rows(await sb(env, `survey_responses?select=id&survey_id=eq.${id}&status=${COUNTED}&limit=20000`))).length;
const sponsorsFor = async (env, ids) => {
  const list = [...new Set(ids.filter(Boolean))]; if (!list.length) return {};
  const now = new Date().toISOString(), out = {};
  for (const s of await rows(await sb(env, `sponsors?select=id,name,link,active,starts_at,ends_at&id=${inList(list)}`))) if (s.active && (!s.starts_at || s.starts_at <= now) && (!s.ends_at || s.ends_at >= now)) out[s.id] = { name: s.name, link: s.link };
  return out;
};
const brief = (s, filled) => ({ id: s.id, title: s.title, intro: s.intro || '', campus: s.campus, reward: s.reward, wanted: s.wanted, left: Math.max(0, s.wanted - filled), questions: (s.questions || []).length, endsOn: s.ends_on, minutes: Math.max(1, Math.round((s.questions || []).length * 0.4)) });

// Return the funder's unused budget (and the fee on it). Safe to run again: it only ever sends what is still due, once per amount.
export async function settleSurvey(env, s) {
  const resp = await rows(await sb(env, `survey_responses?select=status&survey_id=eq.${s.id}&limit=20000`));
  const spent = resp.filter((r) => ['done', 'released', 'flagged'].includes(r.status)).length * s.reward;
  if (s.funding === 'offline') { await patch(env, `surveys?id=eq.${s.id}`, { settled: true }); return 0; }
  const due = (s.paid || 0) - spent - feeOf(spent, s.fee_percent) - (s.refunded || 0);
  if (due > 0) {
    const total = (s.refunded || 0) + due, ref = 'svr:' + s.id + ':' + total;
    let ok = await credit(env, s.aid, due, 'survey_refund', ref, 'Unused survey budget returned');
    if (!ok) ok = (await rows(await sb(env, `wallet_ledger?select=id&kind=eq.survey_refund&ref=eq.${enc(ref)}&limit=1`))).length > 0;
    if (!ok) return -1;
    await patch(env, `surveys?id=eq.${s.id}`, { refunded: total });
    await notify(env, s.aid, 'survey', 'Survey budget returned', `KSh ${due} from "${s.title}" is back in your wallet.`, 'wallet', s.id);
  }
  await patch(env, `surveys?id=eq.${s.id}`, { settled: true });
  return Math.max(0, due);
}
const endSurvey = async (env, s, reason) => {
  const [e] = await rows(await patch(env, `surveys?id=eq.${s.id}&status=in.(pending,live)`, { status: 'ended', end_reason: reason, ended_at: new Date().toISOString() }));
  if (!e) return null;
  await settleSurvey(env, e);
  if (reason === 'filled') await notify(env, s.aid, 'survey', 'Survey complete', `"${s.title}" got all ${s.wanted} responses.`, 'survey', s.id);
  return e;
};

// Hourly-ish job: end finished surveys, send the leftover back, release rewards after the hold, drop old unpaid drafts.
export async function surveyCron(env) {
  const S = await getSettings(env), out = { ended: 0, refunded: 0, released: 0, dropped: 0 };
  const live = await rows(await sb(env, `surveys?status=in.(pending,live)&ends_on=lt.${today()}&limit=200`)).catch(() => []);
  for (const s of live) if (await endSurvey(env, s, 'expired')) out.ended++;
  const open = await rows(await sb(env, `surveys?status=in.(ended,rejected)&settled=eq.false&funding=eq.app&limit=100`)).catch(() => []);
  for (const s of open) { const n = await settleSurvey(env, s); if (n > 0) out.refunded += n; }
  const cutoff = new Date(Date.now() - S.survey_hold_hours * 3600e3).toISOString();
  const due = await rows(await sb(env, `survey_responses?status=eq.done&submitted_at=lte.${cutoff}&limit=200`)).catch(() => []);
  for (const r of due) {
    const [got] = await rows(await patch(env, `survey_responses?id=eq.${r.id}&status=eq.done`, { status: 'released' }));
    if (!got) continue;
    await patch(env, `wallet_ledger?kind=eq.survey_reward&ref=eq.${enc('svr:' + r.id)}&status=eq.pending`, { status: 'available' });
    out.released++;
    await notify(env, r.aid, 'wallet', 'Survey reward added', `KSh ${r.reward} is now in your wallet.`, 'wallet', r.id);
  }
  const old = new Date(Date.now() - 3 * DAY).toISOString();
  const drafts = await rows(await sb(env, `surveys?select=id&status=eq.unpaid&created_at=lt.${old}&limit=100`)).catch(() => []);
  if (drafts.length) { await sb(env, `surveys?id=${inList(drafts.map((d) => d.id))}`, { method: 'DELETE' }); out.dropped = drafts.length; }
  return out;
}

// ---- results ----
const optsText = (q, v) => (q.type === 'text' ? String(v ?? '') : [].concat(v ?? []).map((i) => q.options[i]).filter((x) => x != null).join('; '));
const csvCell = (v) => { let t = String(v ?? ''); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
export function buildResults(s, resp, admin) {
  const list = resp.filter((r) => ['done', 'released', 'flagged'].includes(r.status)).sort((a, b) => (a.submitted_at < b.submitted_at ? -1 : 1));
  const questions = (s.questions || []).map((q) => {
    const o = { id: q.id, type: q.type, text: q.text, answered: list.length };
    if (q.type === 'text') o.answers = list.map((r) => r.answers && r.answers[q.id]).filter(Boolean);
    else { o.options = q.options.map((t) => ({ text: t, count: 0 })); for (const r of list) for (const i of [].concat(r.answers ? r.answers[q.id] : [])) if (o.options[i]) o.options[i].count++; }
    return o;
  });
  const csv = [['#', ...(s.questions || []).map((q) => q.text)].map(csvCell).join(','), ...list.map((r, i) => [i + 1, ...(s.questions || []).map((q) => optsText(q, r.answers && r.answers[q.id]))].map(csvCell).join(','))].join('\n');
  const responses = list.map((r, i) => ({ id: r.id, n: i + 1, flagged: r.status === 'flagged', status: r.status, answers: Object.fromEntries((s.questions || []).map((q) => [q.id, optsText(q, r.answers && r.answers[q.id])])), ...(admin ? { aid: r.aid, flagNote: r.flag_note || '' } : {}) }));
  return { id: s.id, title: s.title, status: s.status, wanted: s.wanted, reward: s.reward, responses: list.length, questions, csv, list: responses };
}

const mineView = (s, filled) => ({ ...brief(s, filled), status: s.status === 'approved' ? 'live' : s.status, note: s.reject_note || '', budget: s.budget, fee: s.fee, total: s.budget + s.fee, paid: s.paid, refunded: s.refunded, filled, endReason: s.end_reason || '', questionsData: s.questions });

export async function surveyRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (!path.startsWith('/api/surveys') && !path.startsWith('/api/admin/surveys')) return null;
  const body = async () => (await req.json().catch(() => ({})));
  const down = () => err(env, SETUP, 503);

  // ================= admin =================
  if (path.startsWith('/api/admin/surveys')) {
    if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);
    if (path === '/api/admin/surveys/billing' && m === 'GET') {
      const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') || '') ? url.searchParams.get('month') : today().slice(0, 7);
      const from = month + '-01T00:00:00.000Z', t = new Date(from); t.setUTCMonth(t.getUTCMonth() + 1);
      const rc = await sb(env, `survey_responses?select=survey_id,status,submitted_at&status=${COUNTED}&submitted_at=gte.${from}&submitted_at=lt.${t.toISOString()}&limit=20000`);
      if (!rc.ok) return json(env, { ready: false, month, makers: [], paidOut: 0, fees: 0, held: 0 });
      const cl = await rows(rc), ids = [...new Set(cl.map((c) => c.survey_id))];
      const ss = ids.length ? await rows(await sb(env, `surveys?select=id,aid,title,reward,fee_percent,funding&id=${inList(ids)}`)) : [];
      const by = {};
      for (const s of ss) { const n = cl.filter((c) => c.survey_id === s.id).length, o = (by[s.aid] ||= { aid: s.aid, surveys: 0, responses: 0, rewards: 0, fee: 0 });
        o.surveys++; o.responses += n; o.rewards += n * s.reward; o.fee += s.funding === 'app' ? feeOf(n * s.reward, s.fee_percent) : 0; }
      const makers = Object.values(by).sort((a, b) => b.rewards - a.rewards);
      const open = await rows(await sb(env, 'surveys?select=id,paid,reward,fee_percent&status=in.(pending,live)&funding=eq.app&limit=1000'));
      let held = 0; for (const s of open) { const n = (await rows(await sb(env, `survey_responses?select=id&survey_id=eq.${s.id}&status=${COUNTED}&limit=20000`))).length; held += Math.max(0, s.paid - n * s.reward - feeOf(n * s.reward, s.fee_percent)); }
      return json(env, { ready: true, month, makers, paidOut: makers.reduce((a, o) => a + o.rewards, 0), fees: makers.reduce((a, o) => a + o.fee, 0), responses: makers.reduce((a, o) => a + o.responses, 0), held });
    }
    if (path === '/api/admin/surveys' && m === 'GET') {
      const st = String(url.searchParams.get('status') || 'pending');
      const r = await sb(env, `surveys?select=*${['pending', 'live', 'ended', 'rejected', 'unpaid'].includes(st) ? '&status=eq.' + st : ''}&order=created_at.desc&limit=200`);
      if (!r.ok) return json(env, { ready: false, surveys: [] });
      const ss = await rows(r), ids = ss.map((s) => s.id);
      const rs = ids.length ? await rows(await sb(env, `survey_responses?select=survey_id,status&survey_id=${inList(ids)}&limit=20000`)) : [];
      const sp = await sponsorsFor(env, ss.map((s) => s.sponsor_id));
      return json(env, { ready: true, surveys: ss.map((s) => { const c = rs.filter((x) => x.survey_id === s.id); return {
        id: s.id, aid: s.aid, campus: s.campus, title: s.title, intro: s.intro || '', status: s.status, hidden: !!s.hidden, funding: s.funding, wanted: s.wanted, reward: s.reward, budget: s.budget, fee: s.fee, paid: s.paid, refunded: s.refunded,
        endsOn: s.ends_on, questions: s.questions, sponsorId: s.sponsor_id || '', sponsor: sp[s.sponsor_id] || null, note: s.reject_note || '', endReason: s.end_reason || '', createdAt: Date.parse(s.created_at),
        answers: c.filter((x) => ['done', 'released', 'flagged'].includes(x.status)).length, flagged: c.filter((x) => x.status === 'flagged').length }; }) });
    }
    if (path === '/api/admin/surveys' && m === 'POST') {          // admin-made survey. The sponsor paid the admin outside the app, so there is no fee and no refund to a wallet.
      const b = await body(), S = await getSettings(env);
      if (b.confirm_received !== true) return err(env, 'Confirm that the sponsor has already paid you the full reward budget');
      const v = await validateNew(env, req, b, S, 'admin'); if (v.res) return v.res;
      const sid = b.sponsor_id && UUID.test(String(b.sponsor_id)) ? b.sponsor_id : null;
      const r = await post(env, 'surveys', { ...v.row, aid: 'admin', funding: 'offline', fee_percent: 0, fee: 0, paid: v.row.budget, status: 'live', approved_at: new Date().toISOString(), sponsor_id: sid, ip }, 'return=representation');
      if (!r.ok) return down();
      const s = await one(r); await audit(env, 'survey.create', 'survey', s.id, 'offline KSh ' + v.row.budget, ip);
      return json(env, { id: s.id, status: 'live' }, 201);
    }
    let am = path.match(/^\/api\/admin\/surveys\/responses\/([0-9a-f-]{36})$/);
    if (am && m === 'POST') {
      const b = await body(), r = await one(await sb(env, `survey_responses?id=eq.${am[1]}`)), a = String(b.action || '');
      if (!r) return err(env, 'Answer not found', 404);
      if (!['done', 'flagged'].includes(r.status)) return err(env, 'This answer is already paid out or closed');
      const s = await one(await sb(env, `surveys?id=eq.${r.survey_id}`));
      if (a === 'ok') await patch(env, `survey_responses?id=eq.${r.id}&status=in.(done,flagged)`, { status: 'done', flag_note: null });
      else if (a === 'junk') {
        await patch(env, `survey_responses?id=eq.${r.id}&status=in.(done,flagged)`, { status: 'rejected' });
        await patch(env, `wallet_ledger?kind=eq.survey_reward&ref=eq.${enc('svr:' + r.id)}&status=eq.pending`, { status: 'void' });
        await notify(env, r.aid, 'survey', 'A survey answer was not accepted', 'It was marked as not a real answer, so no reward was paid.', 'survey', s && s.id);
        if (s && ['ended', 'rejected'].includes(s.status)) await settleSurvey(env, { ...s, settled: false });
      } else return err(env, 'Unknown action');
      await audit(env, 'survey.answer.' + a, 'survey_response', r.id, s ? s.title : '', ip);
      return json(env, { ok: true });
    }
    am = path.match(/^\/api\/admin\/surveys\/([0-9a-f-]{36})\/results$/);
    if (am && m === 'GET') {
      const s = await one(await sb(env, `surveys?id=eq.${am[1]}`)); if (!s) return err(env, 'Survey not found', 404);
      return json(env, buildResults(s, await rows(await sb(env, `survey_responses?survey_id=eq.${s.id}&limit=20000`)), true));
    }
    am = path.match(/^\/api\/admin\/surveys\/([0-9a-f-]{36})$/);
    if (am && m === 'POST') {
      const b = await body(), s = await one(await sb(env, `surveys?id=eq.${am[1]}`)), a = String(b.action || ''), note = str(b.note, 200);
      if (!s) return err(env, 'Survey not found', 404);
      if (a === 'approve') {
        if (s.status !== 'pending') return err(env, 'Only a paid survey that is waiting can be approved');
        if (s.ends_on < today()) return err(env, 'This survey has already passed its end date');
        await patch(env, `surveys?id=eq.${s.id}&status=eq.pending`, { status: 'live', approved_at: new Date().toISOString(), reject_note: null, hidden: false });
        await notify(env, s.aid, 'survey', 'Your survey is live', `"${s.title}" is now shown to comrades.`, 'survey', s.id);
      } else if (a === 'reject') {
        if (s.status !== 'pending') return err(env, 'Only a survey that is waiting can be rejected');
        await patch(env, `surveys?id=eq.${s.id}&status=eq.pending`, { status: 'rejected', reject_note: note || null, ended_at: new Date().toISOString(), end_reason: 'rejected' });
        await settleSurvey(env, { ...s, status: 'rejected' });
        await notify(env, s.aid, 'survey', 'Your survey was not approved', (note || 'It did not meet our rules.') + ' Your money was returned to your wallet.', 'survey', s.id);
      } else if (a === 'stop') { if (!(await endSurvey(env, s, 'stopped'))) return err(env, 'This survey is not running'); }
      else if (a === 'hide' || a === 'show') await patch(env, `surveys?id=eq.${s.id}`, { hidden: a === 'hide' });
      else if (a === 'sponsor') {
        const sid = b.sponsor_id ? String(b.sponsor_id) : null;
        if (sid && !UUID.test(sid)) return err(env, 'Pick a sponsor');
        if (sid && !(await rows(await sb(env, `sponsors?select=id&id=eq.${sid}`))).length) return err(env, 'Sponsor not found', 404);
        await patch(env, `surveys?id=eq.${s.id}`, { sponsor_id: sid });
      } else return err(env, 'Unknown action');
      await audit(env, 'survey.' + a, 'survey', s.id, note || s.title, ip);
      return json(env, { ok: true });
    }
    return err(env, 'Not found', 404);
  }

  // ================= public list =================
  if (path === '/api/surveys' && m === 'GET') {
    const me = req.headers.get('X-Token') ? await authProfile(req, env) : null, S = await getSettings(env);
    const rules = { feePercent: S.survey_fee_percent, minReward: S.survey_min_reward, maxResponses: S.survey_max_responses, holdHours: S.survey_hold_hours, maxDays: MAX_DAYS, maxQuestions: MAX_Q };
    const r = await sb(env, `surveys?status=eq.live&hidden=eq.false&ends_on=gte.${today()}&order=created_at.desc&limit=100`);
    if (!r.ok) return json(env, { ready: false, items: [], rules });
    const all = isAllCampuses(req), camp = campusOf(req) || DEFAULT_CAMPUS;
    const ss = (await rows(r)).filter((s) => all || s.campus === 'all' || s.campus === camp), ids = ss.map((s) => s.id);
    const rs = ids.length ? await rows(await sb(env, `survey_responses?select=survey_id,aid,status&survey_id=${inList(ids)}&limit=20000`)) : [];
    const sp = await sponsorsFor(env, ss.map((s) => s.sponsor_id));
    const items = ss.map((s) => { const c = rs.filter((x) => x.survey_id === s.id), mine = me && c.find((x) => x.aid === me.aid);
      return { ...brief(s, c.filter((x) => ['done', 'released', 'flagged'].includes(x.status)).length), presentedBy: sp[s.sponsor_id] || null, ownSurvey: !!me && me.aid === s.aid, myStatus: mine ? (mine.status === 'started' ? 'started' : mine.status === 'rejected' ? 'rejected' : 'done') : null }; })
      .filter((x) => x.left > 0);
    return json(env, { ready: true, items, rules });
  }

  // ================= make a survey =================
  if (path === '/api/surveys' && m === 'POST') {
    const u = await user(req, env, true); if (u instanceof Response) return u;
    const b = await body(), S = await getSettings(env);
    const v = await validateNew(env, req, b, S, u.aid); if (v.res) return v.res;
    if (!(await throttle(env, ip, 'surveymake', u.aid, 5, 20))) return tooMany(env);
    const r = await post(env, 'surveys', { ...v.row, aid: u.aid, ip }, 'return=representation');
    if (!r.ok) return down();
    const s = await one(r);
    return json(env, { id: s.id, status: 'unpaid', budget: s.budget, fee: s.fee, total: s.budget + s.fee }, 201);
  }

  if (path === '/api/surveys/mine' && m === 'GET') {
    const u = await user(req, env); if (u instanceof Response) return u;
    const a = enc(u.aid), rr = await sb(env, `survey_responses?aid=eq.${a}&order=created_at.desc&limit=50`);
    if (!rr.ok) return json(env, { ready: false, answered: [], made: [] });
    const resp = await rows(rr), ids = [...new Set(resp.map((x) => x.survey_id))];
    const ts = ids.length ? await rows(await sb(env, `surveys?select=id,title&id=${inList(ids)}`)) : [];
    const made = await rows(await sb(env, `surveys?aid=eq.${a}&order=created_at.desc&limit=50`));
    const mr = made.length ? await rows(await sb(env, `survey_responses?select=survey_id,status&survey_id=${inList(made.map((x) => x.id))}&limit=20000`)) : [];
    return json(env, { ready: true,
      answered: resp.filter((x) => x.status !== 'started').map((x) => ({ id: x.id, title: (ts.find((t) => t.id === x.survey_id) || {}).title || 'Survey', reward: x.reward, status: x.status === 'released' ? 'paid' : x.status === 'rejected' || x.status === 'overflow' ? 'not paid' : 'waiting', at: Date.parse(x.submitted_at || x.created_at) })),
      made: made.filter((s) => !s.hidden || s.status !== 'unpaid').map((s) => mineView(s, mr.filter((x) => x.survey_id === s.id && ['done', 'released', 'flagged'].includes(x.status)).length)) });
  }

  const mm = path.match(/^\/api\/surveys\/([0-9a-f-]{36})\/(pay|start|answer|stop|remove|results|flag)$/);
  if (!mm) return null;
  const id = mm[1], act = mm[2];
  const u = await user(req, env, m === 'POST'); if (u instanceof Response) return u;
  const s = await one(await sb(env, `surveys?id=eq.${id}`));
  if (!s) return err(env, 'Survey not found', 404);
  const owner = s.aid === u.aid, S = await getSettings(env);

  if (act === 'results' && m === 'GET') {
    if (!owner) return err(env, 'Only the person who made this survey can see its results', 403);
    return json(env, buildResults(s, await rows(await sb(env, `survey_responses?survey_id=eq.${s.id}&limit=20000`)), false));
  }
  if (m !== 'POST') return null;

  if (['pay', 'stop', 'remove', 'flag'].includes(act) && !owner) return err(env, 'Only the person who made this survey can do that', 403);

  if (act === 'pay') {
    if (s.status !== 'unpaid') return err(env, 'This survey is already paid');
    if (s.ends_on < today()) return err(env, 'The end date has passed. Make the survey again with a new end date.');
    const b = await body(), total = s.budget + s.fee;
    if (!(await throttle(env, ip, 'surveypay', u.aid, 10, 30))) return tooMany(env);
    if (wantsWallet(b) || b.method === 'wallet') {
      const r = await payFromWallet(env, ip, { aid: u.aid, purpose: 'survey', ref_id: s.id, amount: total, note: 'Survey budget' });
      return r.res || json(env, { id: r.id, paid: true });
    }
    if (!normPhone(b.phone)) return err(env, 'Enter a Safaricom or Airtel number like 0712345678');
    const r = await initPayment(env, ip, { aid: u.aid, purpose: 'survey', ref_id: s.id, amount: total, phone: b.phone });
    return r.res || json(env, { id: r.id, amount: total });
  }
  if (act === 'remove') {
    if (s.status !== 'unpaid') return err(env, 'Only an unpaid survey can be deleted. Stop it instead.');
    await sb(env, `surveys?id=eq.${s.id}&status=eq.unpaid`, { method: 'DELETE' });
    return json(env, { ok: true });
  }
  if (act === 'stop') {
    if (!['pending', 'live'].includes(s.status)) return err(env, 'This survey is not running');
    await endSurvey(env, s, 'stopped');
    return json(env, { ok: true });
  }
  if (act === 'flag') {
    const b = await body(), rid = String(b.response || '');
    if (!UUID.test(rid)) return err(env, 'Pick an answer to flag');
    if (S.survey_hold_hours <= 0) return err(env, 'Rewards are paid at once, so answers cannot be flagged.');
    const [r] = await rows(await patch(env, `survey_responses?id=eq.${rid}&survey_id=eq.${s.id}&status=eq.done&submitted_at=gte.${new Date(Date.now() - S.survey_hold_hours * 3600e3).toISOString()}`, { status: 'flagged', flag_note: str(b.note, 200) || null }));
    if (!r) return err(env, 'That answer cannot be flagged any more. The hold time has passed or it was already handled.', 409);
    await notifyAdmins(env, 'survey', 'Survey answer flagged', `"${s.title}": the maker says an answer is junk.`, 'survey', s.id);
    return json(env, { ok: true });
  }

  // ---- comrade: start / answer ----
  if (owner) return err(env, 'You cannot answer your own survey');
  if (s.status !== 'live' || s.hidden || s.ends_on < today()) return err(env, 'This survey is no longer open');
  const camp = campusOf(req); if (s.campus !== 'all' && camp && camp !== s.campus) return err(env, 'This survey is for students of another campus');
  const mine = await one(await sb(env, `survey_responses?survey_id=eq.${s.id}&aid=eq.${enc(u.aid)}`));

  if (act === 'start') {
    if (mine && mine.status !== 'started') return err(env, 'You already answered this survey');
    if (!(await throttle(env, ip, 'surveystart', u.aid, 40, 120))) return tooMany(env);
    const filled = await filledOf(env, s.id);
    if (filled >= s.wanted) { await endSurvey(env, s, 'filled'); return err(env, 'Sorry, this survey just got all the answers it needed'); }
    if (!mine) { const r = await post(env, 'survey_responses', { survey_id: s.id, aid: u.aid, status: 'started', started_at: new Date().toISOString() }, 'resolution=ignore-duplicates,return=representation'); if (!r.ok) return down(); }
    const sp = await sponsorsFor(env, [s.sponsor_id]);
    return json(env, { id: s.id, title: s.title, intro: s.intro || '', reward: s.reward, minSeconds: s.min_seconds, holdHours: S.survey_hold_hours,
      questions: (s.questions || []).map((q) => ({ id: q.id, type: q.type, text: q.text, ...(q.options ? { options: q.options } : {}) })), presentedBy: sp[s.sponsor_id] || null });
  }

  if (act === 'answer') {
    if (!mine) return err(env, 'Open the survey first');
    if (mine.status !== 'started') return err(env, 'You already answered this survey');
    if (!(await throttle(env, ip, 'surveyans', u.aid, 20, 60))) return tooMany(env);
    const b = await body(), c = checkAnswers(s.questions || [], b.answers); if (c.error) return err(env, c.error);
    const wait = Math.ceil(s.min_seconds - (Date.now() - Date.parse(mine.started_at)) / 1000);
    if (wait > 0) return err(env, `Please read the questions properly. You can send your answers in ${wait} second${wait === 1 ? '' : 's'}.`);
    const hold = S.survey_hold_hours > 0;
    const sent = new Date().toISOString();
    const [mark] = await rows(await patch(env, `survey_responses?id=eq.${mine.id}&status=eq.started`, { status: hold ? 'done' : 'released', answers: c.answers, reward: s.reward, submitted_at: sent }));
    if (!mark) return err(env, 'You already answered this survey', 409);
    // Places go to the first answers in time order, so two people sending at once can never push the paid total past the budget.
    const firsts = await rows(await sb(env, `survey_responses?select=id&survey_id=eq.${s.id}&status=${COUNTED}&order=submitted_at.asc,id.asc&limit=${s.wanted}`));
    if (!firsts.some((x) => x.id === mine.id)) { await patch(env, `survey_responses?id=eq.${mine.id}`, { status: 'overflow', reward: 0 }); await endSurvey(env, s, 'filled'); return err(env, 'Sorry, this survey just got all the answers it needed. You were not charged anything and no reward is due.'); }
    const ok = await credit(env, u.aid, s.reward, 'survey_reward', 'svr:' + mine.id, 'Survey: ' + s.title, hold ? 'pending' : 'available');
    if (!ok && !(await rows(await sb(env, `wallet_ledger?select=id&kind=eq.survey_reward&ref=eq.${enc('svr:' + mine.id)}&limit=1`))).length) {
      await patch(env, `survey_responses?id=eq.${mine.id}`, { status: 'started', submitted_at: null, answers: null, reward: 0 });
      return err(env, 'We could not add your reward right now. Please try again in a minute.', 503);
    }
    await notify(env, u.aid, 'wallet', 'Survey answered', hold ? `KSh ${s.reward} will reach your wallet in ${S.survey_hold_hours} hours.` : `KSh ${s.reward} was added to your wallet.`, 'wallet', mine.id);
    if (firsts.length >= s.wanted) await endSurvey(env, s, 'filled');
    return json(env, { ok: true, reward: s.reward, holdHours: S.survey_hold_hours });
  }
  return null;
}

// Shared rules for a new survey (maker or admin). Returns { res } on a problem, else { row } ready to insert.
async function validateNew(env, req, b, S, aid) {
  const title = str(b.title, 90), intro = str(b.intro, 300);
  if (title.length < 5) return { res: err(env, 'Give the survey a title of at least 5 letters') };
  const q = cleanQuestions(env, b.questions); if (q.error) return { res: err(env, q.error) };
  const blk = contactBlock(env, title, intro, ...q.qs.flatMap((x) => [x.text, ...(x.options || [])])); if (blk) return { res: blk };
  const wanted = int(b.wanted, 1, S.survey_max_responses); if (wanted === null) return { res: err(env, `Responses wanted must be from 1 to ${S.survey_max_responses}`) };
  const reward = int(b.reward, S.survey_min_reward, 5000); if (reward === null) return { res: err(env, `Pay each comrade at least KSh ${S.survey_min_reward}`) };
  const end = String(b.ends_on || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end < today()) return { res: err(env, 'Pick the last day the survey stays open') };
  if (end > new Date(Date.now() + MAX_DAYS * DAY).toISOString().slice(0, 10)) return { res: err(env, `A survey can stay open for at most ${MAX_DAYS} days`) };
  const campus = b.campus === 'all' ? 'all' : CAMPUS_IDS.includes(b.campus) ? b.campus : (aid === 'admin' ? 'all' : campusOrHome(req));
  const budget = wanted * reward;
  if (budget > 250000) return { res: err(env, 'The budget (responses times reward) cannot go above KSh 250,000') };
  const pct = S.survey_fee_percent;
  return { row: { campus, title, intro: intro || null, questions: q.qs, wanted, reward, fee_percent: pct, budget, fee: feeOf(budget, pct), ends_on: end, min_seconds: Math.max(5, S.survey_min_seconds_per_q * q.qs.length) } };
}
