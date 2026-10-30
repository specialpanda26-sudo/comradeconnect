import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
import { balance } from '../backend/src/account.js';

const ENV = { PAYHERO_API_KEY: 'k', PAYHERO_API_SECRET: 's', PAYHERO_CHANNEL_ID: '777', PAYHERO_CALLBACK_SECRET: 'sec', CALLBACK_URL: 'https://api.test/api/webhooks/payhero?s=sec' };
const fresh = async (t) => { const w = world({ env: ENV }); t.after(() => w.restore()); return w; };
const soon = (n = 7) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
const QS = [
  { type: 'single', text: 'Where do you buy lunch?', options: ['Cafeteria', 'Mama Pima', 'Cook myself'] },
  { type: 'multi', text: 'What do you want cheaper?', options: ['Food', 'Data', 'Rent'] },
  { type: 'text', text: 'What would make campus life better?' },
];
const survey = (o = {}) => ({ title: 'Student food habits', intro: 'Two minutes please', questions: QS, wanted: 3, reward: 10, ends_on: soon(), campus: 'all', ...o });
const give = (w, aid, n) => w.db.rows('wallet_ledger').push({ id: crypto.randomUUID(), aid, delta: n, kind: 'topup', ref: 'seed:' + Math.random(), status: 'available', created_at: new Date().toISOString() });
const bal = (w, aid) => balance(w.env, aid);
const hook = (w, ref, o = {}) => w.call('POST', '/api/webhooks/payhero?s=sec', { body: { response: { ExternalReference: ref, Status: 'SUCCESS', Amount: o.amount, Phone: o.phone || '0712345678', MpesaReceiptNumber: 'RC' + Math.random().toString(36).slice(2, 8).toUpperCase() } } });
const ANS = { q1: 1, q2: [0, 1], q3: 'Cheaper data bundles' };
// a paid, approved, live survey made by `maker`; returns its id
async function live(w, maker, o = {}, wallet = 5000) {
  give(w, maker.aid, wallet);
  const r = await w.call('POST', '/api/surveys', { as: maker, body: survey(o) });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const p = await w.call('POST', `/api/surveys/${r.data.id}/pay`, { as: maker, body: { method: 'wallet' } });
  assert.equal(p.status, 200, JSON.stringify(p.data));
  assert.equal((await w.call('POST', `/api/admin/surveys/${r.data.id}`, { admin: true, body: { action: 'approve' } })).status, 200);
  return r.data.id;
}
// the comrade opens the survey, waits out the minimum time, sends answers
async function answer(w, who, id, a = ANS) {
  const st = await w.call('POST', `/api/surveys/${id}/start`, { as: who });
  if (st.status !== 200) return st;
  const row = w.db.rows('survey_responses').find((x) => x.survey_id === id && x.aid === who.aid);
  row.started_at = new Date(Date.now() - 600e3).toISOString();
  return w.call('POST', `/api/surveys/${id}/answer`, { as: who, body: { answers: a } });
}

test('surveys: rules are enforced, fee is computed from the admin setting, and an unpaid survey stays hidden', async (t) => {
  const w = await fresh(t), maker = await w.user('m');
  assert.equal((await w.call('POST', '/api/surveys', { body: survey() })).status, 401);
  for (const bad of [{ title: 'Hi' }, { questions: [] }, { questions: Array(11).fill(QS[2]) }, { questions: [{ type: 'single', text: 'One option only?', options: ['a'] }] },
    { questions: [{ type: 'single', text: 'Call me on 0712345678', options: ['a', 'b'] }] }, { reward: 1 }, { wanted: 0 }, { wanted: 5000 }, { ends_on: '2020-01-01' }, { ends_on: soon(90) }, { wanted: 1000, reward: 1000 }])
    assert.equal((await w.call('POST', '/api/surveys', { as: maker, body: survey(bad) })).status, 400, JSON.stringify(bad).slice(0, 80));
  const r = await w.call('POST', '/api/surveys', { as: maker, body: survey() });
  assert.equal(r.status, 201); assert.deepEqual([r.data.budget, r.data.fee, r.data.total], [30, 3, 33]);
  assert.equal((await w.call('GET', '/api/surveys')).data.items.length, 0, 'unpaid is not listed');
  assert.equal((await w.call('POST', `/api/admin/surveys/${r.data.id}`, { admin: true, body: { action: 'approve' } })).status, 400, 'cannot approve an unpaid survey');
  assert.equal((await w.call('POST', '/api/admin/settings', { admin: true, body: { values: { survey_fee_percent: 20 } } })).status, 200);
  const r2 = await w.call('POST', '/api/surveys', { as: maker, body: survey() });
  assert.equal(r2.data.fee, 6, 'new surveys use the new fee percent');
  assert.equal((await w.call('POST', '/api/admin/settings', { admin: true, body: { values: { survey_fee_percent: 99 } } })).status, 400);
});

test('surveys: the maker pays from the wallet, an admin approves, comrades see it with the sponsor line', async (t) => {
  const w = await fresh(t), maker = await w.user('m'), c = await w.user('c');
  const r = await w.call('POST', '/api/surveys', { as: maker, body: survey() });
  const poor = await w.call('POST', `/api/surveys/${r.data.id}/pay`, { as: maker, body: { method: 'wallet' } });
  assert.equal(poor.status, 402, 'empty wallet cannot pay');
  assert.equal((await w.call('POST', `/api/surveys/${r.data.id}/pay`, { as: c, body: { method: 'wallet' } })).status, 403, 'only the maker pays');
  give(w, maker.aid, 100);
  assert.equal((await w.call('POST', `/api/surveys/${r.data.id}/pay`, { as: maker, body: { method: 'wallet' } })).status, 200);
  assert.equal(await bal(w, maker.aid), 67, 'KSh 33 was taken (30 budget + 3 fee)');
  assert.equal((await w.call('POST', `/api/surveys/${r.data.id}/pay`, { as: maker, body: { method: 'wallet' } })).status, 400, 'cannot pay twice');
  assert.equal((await w.call('GET', '/api/surveys')).data.items.length, 0, 'waits for approval');
  assert.equal((await w.call('GET', '/api/admin/surveys?status=pending', { admin: true })).data.surveys.length, 1);
  const sp = (await w.call('POST', '/api/admin/sponsors', { admin: true, body: { name: 'Mama Pima', blurb: 'Food', link: 'https://example.com' } })).data;
  const spId = sp.id || (sp.sponsor && sp.sponsor.id) || w.db.rows('sponsors')[0].id;
  assert.equal((await w.call('POST', `/api/admin/surveys/${r.data.id}`, { admin: true, body: { action: 'sponsor', sponsor_id: spId } })).status, 200);
  assert.equal((await w.call('POST', `/api/admin/surveys/${r.data.id}`, { body: { action: 'approve' } })).status, 403);
  assert.equal((await w.call('POST', `/api/admin/surveys/${r.data.id}`, { admin: true, body: { action: 'approve' } })).status, 200);
  const list = (await w.call('GET', '/api/surveys', { as: c })).data;
  assert.equal(list.items.length, 1); assert.equal(list.items[0].reward, 10); assert.equal(list.items[0].left, 3); assert.equal(list.items[0].presentedBy.name, 'Mama Pima');
  assert.equal(list.items[0].questions, 3);
  assert.equal(JSON.stringify(list).includes(maker.aid), false, 'the maker is never named');
});

test('surveys: paying by M-Pesa goes through the webhook once, and a second payment is returned', async (t) => {
  const w = await fresh(t), maker = await w.user('m');
  const r = (await w.call('POST', '/api/surveys', { as: maker, body: survey() })).data;
  assert.equal((await w.call('POST', `/api/surveys/${r.id}/pay`, { as: maker, body: { method: 'mpesa', phone: '123' } })).status, 400);
  const p = await w.call('POST', `/api/surveys/${r.id}/pay`, { as: maker, body: { method: 'mpesa', phone: '0712345678' } });
  assert.equal(p.status, 200, JSON.stringify(p.data)); assert.equal(p.data.amount, 33);
  const pay = w.row('payments', (x) => x.id === p.data.id); assert.equal(pay.purpose, 'survey'); assert.equal(pay.amount, 33);
  assert.equal(w.db.rows('surveys')[0].status, 'unpaid', 'only the webhook marks it paid');
  assert.equal((await hook(w, pay.request_id, { amount: 33 })).status, 200);
  const s = w.db.rows('surveys')[0]; assert.equal(s.status, 'pending'); assert.equal(s.paid, 33);
  const p2 = await w.call('POST', `/api/surveys/${r.id}/pay`, { as: maker, body: { method: 'mpesa', phone: '0712345678' } });
  assert.equal(p2.status, 400, 'already paid, no second prompt');
  // a second prompt that was answered anyway (two phones, two taps): the money must come back to the wallet, not vanish
  const ref = 'CC-DEP-' + crypto.randomUUID().toUpperCase();
  w.db.rows('payments').push({ id: crypto.randomUUID(), request_id: ref, aid: maker.aid, purpose: 'survey', ref_id: r.id, amount: 33, phone: '254712345678', status: 'pending', created_at: new Date().toISOString() });
  assert.equal((await hook(w, ref, { amount: 33 })).status, 200);
  assert.equal(w.db.rows('surveys')[0].paid, 33, 'the survey is not paid twice');
  assert.equal(await (await import('../backend/src/account.js')).balance(w.env, maker.aid), 33, 'the extra KSh 33 is back in the wallet');
});

test('surveys: a comrade answers once, the reward is held, then released to the wallet by the cron', async (t) => {
  const w = await fresh(t), maker = await w.user('m'), c = await w.user('c'), d = await w.user('d');
  const id = await live(w, maker);
  assert.equal((await w.call('POST', `/api/surveys/${id}/start`, { as: maker })).status, 400, 'maker cannot answer own survey');
  assert.equal((await w.call('POST', `/api/surveys/${id}/answer`, { as: c, body: { answers: ANS } })).status, 400, 'must open it first');
  const st = await w.call('POST', `/api/surveys/${id}/start`, { as: c });
  assert.equal(st.status, 200); assert.equal(st.data.questions.length, 3); assert.equal(st.data.minSeconds, 9);
  const fast = await w.call('POST', `/api/surveys/${id}/answer`, { as: c, body: { answers: ANS } });
  assert.equal(fast.status, 400); assert.match(fast.data.error, /read the questions/, 'too fast');
  w.db.rows('survey_responses')[0].started_at = new Date(Date.now() - 60e3).toISOString();
  for (const bad of [{}, { ...ANS, q1: 7 }, { ...ANS, q2: [] }, { ...ANS, q3: 'x' }, { ...ANS, q3: 'call me 0712345678' }])
    assert.equal((await w.call('POST', `/api/surveys/${id}/answer`, { as: c, body: { answers: bad } })).status, 400, JSON.stringify(bad));
  const ok = await w.call('POST', `/api/surveys/${id}/answer`, { as: c, body: { answers: ANS } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data)); assert.equal(ok.data.reward, 10);
  assert.equal(await bal(w, c.aid), 0, 'held, not spendable yet');
  assert.equal(w.db.rows('wallet_ledger').find((x) => x.kind === 'survey_reward').status, 'pending');
  assert.equal((await w.call('POST', `/api/surveys/${id}/start`, { as: c })).status, 400, 'one answer per account');
  assert.equal((await w.call('GET', '/api/surveys', { as: c })).data.items[0].myStatus, 'done');
  await w.cron(); assert.equal(await bal(w, c.aid), 0, 'still inside the hold time');
  w.db.rows('survey_responses')[0].submitted_at = new Date(Date.now() - 25 * 3600e3).toISOString();
  const cr = await w.cron(); assert.equal(cr.surveys.released, 1);
  assert.equal(await bal(w, c.aid), 10, 'released to the wallet');
  await w.cron(); assert.equal(await bal(w, c.aid), 10, 'never paid twice');
  assert.equal((await w.call('GET', '/api/surveys/mine', { as: c })).data.answered[0].status, 'paid');
  assert.equal((await answer(w, d, id)).status, 200, 'a second comrade can answer');
});

test('surveys: the last place ends the survey, extra answers are refused, and nothing paid ever passes the budget', async (t) => {
  const w = await fresh(t), maker = await w.user('m'), ids = [];
  const id = await live(w, maker, { wanted: 2 });
  for (const n of ['a', 'b']) ids.push(await w.user(n));
  assert.equal((await answer(w, ids[0], id)).status, 200); assert.equal((await answer(w, ids[1], id)).status, 200);
  assert.equal(w.db.rows('surveys')[0].status, 'ended'); assert.equal(w.db.rows('surveys')[0].end_reason, 'filled');
  const late = await w.user('late'); const r = await w.call('POST', `/api/surveys/${id}/start`, { as: late });
  assert.equal(r.status, 400, 'a finished survey is closed');
  assert.equal((await w.call('GET', '/api/surveys')).data.items.length, 0);
  const paidOut = w.db.rows('wallet_ledger').filter((x) => x.kind === 'survey_reward').reduce((s, x) => s + x.delta, 0);
  assert.equal(paidOut, 20);
  assert.equal(w.db.rows('wallet_ledger').filter((x) => x.kind === 'survey_refund').length, 0, 'nothing left over to return except the unused fee part');
  // two answers racing for the last place: only the first in time is paid
  const id2 = await live(w, maker, { wanted: 1, title: 'Second survey here' }), x = await w.user('x'), y = await w.user('y');
  await w.call('POST', `/api/surveys/${id2}/start`, { as: x }); await w.call('POST', `/api/surveys/${id2}/start`, { as: y });
  for (const row of w.db.rows('survey_responses').filter((q) => q.survey_id === id2)) row.started_at = new Date(Date.now() - 600e3).toISOString();
  w.db.rows('survey_responses').push({ id: crypto.randomUUID(), survey_id: id2, aid: 'ghost', status: 'done', answers: ANS, reward: 10, submitted_at: new Date(Date.now() - 5000).toISOString(), created_at: new Date().toISOString() });
  const lose = await w.call('POST', `/api/surveys/${id2}/answer`, { as: x, body: { answers: ANS } });
  assert.equal(lose.status, 400); assert.match(lose.data.error, /just got all/);
  assert.equal(w.db.rows('survey_responses').find((q) => q.aid === x.aid && q.survey_id === id2).status, 'overflow');
  assert.equal(w.db.rows('wallet_ledger').some((q) => q.ref === 'svr:' + w.db.rows('survey_responses').find((z) => z.aid === x.aid && z.survey_id === id2).id), false, 'no reward for the loser');
});

test('surveys: when a survey ends early, unused budget and the fee on it return to the maker once', async (t) => {
  const w = await fresh(t), maker = await w.user('m'), c = await w.user('c'), other = await w.user('o');
  const id = await live(w, maker, { wanted: 10, reward: 10 }, 1000);        // budget 100, fee 10, paid 110
  assert.equal(await bal(w, maker.aid), 890);
  await answer(w, c, id);
  assert.equal((await w.call('POST', `/api/surveys/${id}/stop`, { as: other })).status, 403);
  assert.equal((await w.call('POST', `/api/surveys/${id}/stop`, { as: maker })).status, 200);
  // 1 paid answer = KSh 10 spent + KSh 1 fee kept. Returned: 110 - 10 - 1 = 99
  assert.equal(await bal(w, maker.aid), 989);
  assert.equal(w.db.rows('surveys')[0].refunded, 99);
  await w.cron(); await w.cron(); assert.equal(await bal(w, maker.aid), 989, 'returned only once');
  assert.equal((await w.call('POST', `/api/surveys/${id}/stop`, { as: maker })).status, 400);
  assert.equal((await w.call('POST', `/api/surveys/${id}/start`, { as: other })).status, 400, 'ended survey is closed');
});

test('surveys: past the end date the cron ends it and returns the budget; a rejected survey returns everything', async (t) => {
  const w = await fresh(t), maker = await w.user('m');
  const id = await live(w, maker, { wanted: 5, reward: 10 }, 1000);
  w.db.rows('surveys')[0].ends_on = '2020-01-01';
  assert.equal((await w.call('GET', '/api/surveys')).data.items.length, 0, 'expired surveys are not listed');
  const cr = await w.cron(); assert.equal(cr.surveys.ended, 1);
  assert.equal(w.db.rows('surveys')[0].end_reason, 'expired'); assert.equal(await bal(w, maker.aid), 1000, 'full budget and fee back');
  const m2 = await w.user('m2'); give(w, m2.aid, 100);
  const r = (await w.call('POST', '/api/surveys', { as: m2, body: survey() })).data;
  await w.call('POST', `/api/surveys/${r.id}/pay`, { as: m2, body: { method: 'wallet' } });
  assert.equal(await bal(w, m2.aid), 67);
  const rej = await w.call('POST', `/api/admin/surveys/${r.id}`, { admin: true, body: { action: 'reject', note: 'Too vague' } });
  assert.equal(rej.status, 200); assert.equal(await bal(w, m2.aid), 100, 'rejected: everything returned');
  assert.equal((await w.call('GET', '/api/surveys/mine', { as: m2 })).data.made[0].note, 'Too vague');
});

test('surveys: results show counts, text answers and csv to the maker only, and never reveal who answered', async (t) => {
  const w = await fresh(t), maker = await w.user('m'), a = await w.user('a'), b = await w.user('b'), other = await w.user('o');
  const id = await live(w, maker, { wanted: 5 });
  await answer(w, a, id); await answer(w, b, id, { q1: 0, q2: [1], q3: '=HYPERLINK("x")' });
  assert.equal((await w.call('GET', `/api/surveys/${id}/results`, { as: other })).status, 403);
  const r = (await w.call('GET', `/api/surveys/${id}/results`, { as: maker })).data;
  assert.equal(r.responses, 2);
  assert.deepEqual(r.questions[0].options.map((o) => o.count), [1, 1, 0]);
  assert.deepEqual(r.questions[1].options.map((o) => o.count), [1, 2, 0]);
  assert.equal(r.questions[2].answers.length, 2);
  assert.match(r.csv.split('\n')[0], /Where do you buy lunch/); assert.equal(r.csv.split('\n').length, 3);
  assert.equal(r.csv.includes('"\'=HYPERLINK'), true, 'spreadsheet formulas are neutralised');
  assert.equal(JSON.stringify(r).includes(a.aid), false); assert.equal(JSON.stringify(r).includes(b.aid), false);
  const ad = (await w.call('GET', `/api/admin/surveys/${id}/results`, { admin: true })).data;
  assert.equal(ad.list.some((x) => x.aid === a.aid), true, 'admin can see account ids');
  assert.equal((await w.call('GET', `/api/admin/surveys/${id}/results`)).status, 403);
});

test('surveys: a junk answer flagged by the maker stops the reward, admin decides, and the budget comes back', async (t) => {
  const w = await fresh(t), maker = await w.user('m'), a = await w.user('a'), b = await w.user('b');
  const id = await live(w, maker, { wanted: 2 }, 1000);
  await answer(w, a, id); await answer(w, b, id);             // survey is full and ended
  const list = (await w.call('GET', `/api/surveys/${id}/results`, { as: maker })).data.list;
  assert.equal((await w.call('POST', `/api/surveys/${id}/flag`, { as: a, body: { response: list[0].id } })).status, 403, 'only the maker flags');
  assert.equal((await w.call('POST', `/api/surveys/${id}/flag`, { as: maker, body: { response: list[0].id, note: 'asdf asdf' } })).status, 200);
  await w.cron(); w.db.rows('survey_responses').forEach((r) => { if (r.status === 'flagged') r.submitted_at = new Date(Date.now() - 48 * 3600e3).toISOString(); });
  await w.cron();
  const flagged = w.db.rows('survey_responses').find((r) => r.status === 'flagged'); assert.ok(flagged, 'a flagged answer is never released by the cron');
  assert.equal((await w.call('POST', `/api/surveys/${id}/flag`, { as: maker, body: { response: list[0].id } })).status, 409, 'already flagged');
  assert.equal((await w.call('GET', '/api/admin/surveys?status=ended', { admin: true })).data.surveys[0].flagged, 1);
  const before = await bal(w, maker.aid);
  assert.equal((await w.call('POST', `/api/admin/surveys/responses/${flagged.id}`, { admin: true, body: { action: 'junk' } })).status, 200);
  assert.equal(w.db.rows('survey_responses').find((r) => r.id === flagged.id).status, 'rejected');
  assert.equal(w.db.rows('wallet_ledger').find((x) => x.ref === 'svr:' + flagged.id).status, 'void', 'the reward is cancelled');
  assert.ok((await bal(w, maker.aid)) > before, 'the unused reward returns to the maker'); assert.equal(await bal(w, flagged.aid), 0);
  assert.equal((await w.call('POST', `/api/admin/surveys/responses/${flagged.id}`, { admin: true, body: { action: 'junk' } })).status, 400);
  await w.cron(); assert.equal(await bal(w, flagged.aid), 0);
});

test('surveys: admin-made survey is funded offline (no fee, no wallet refund) and the billing summary adds up', async (t) => {
  const w = await fresh(t), maker = await w.user('m'), c = await w.user('c');
  assert.equal((await w.call('POST', '/api/admin/surveys', { admin: true, body: survey() })).status, 400, 'must confirm the sponsor paid');
  const a = await w.call('POST', '/api/admin/surveys', { admin: true, body: { ...survey({ title: 'Sponsor survey about data' }), confirm_received: true } });
  assert.equal(a.status, 201); assert.equal(a.data.status, 'live');
  assert.equal((await w.call('POST', '/api/admin/surveys', { body: { ...survey(), confirm_received: true } })).status, 403);
  assert.equal((await answer(w, c, a.data.id)).status, 200);
  await w.call('POST', `/api/admin/surveys/${a.data.id}`, { admin: true, body: { action: 'stop' } });
  assert.equal(w.db.rows('wallet_ledger').filter((x) => x.kind === 'survey_refund').length, 0);
  const id = await live(w, maker, { wanted: 4, reward: 10 }, 1000), d = await w.user('d');
  await answer(w, d, id);
  const bill = (await w.call('GET', '/api/admin/surveys/billing', { admin: true })).data;
  assert.equal(bill.responses, 2); assert.equal(bill.paidOut, 20); assert.equal(bill.fees, 1, 'fee only on the app-funded survey: 10% of KSh 10');
  assert.equal(bill.held, 44 - 10 - 1 + 0, 'KSh 44 paid in, 10 paid out, 1 fee earned');
  assert.equal(bill.makers.find((m) => m.aid === maker.aid).rewards, 10);
  assert.equal((await w.call('GET', '/api/admin/surveys/billing')).status, 403);
});

test('surveys: campus rules, hide, remove an unpaid one, and the instant-pay mode when the hold is 0', async (t) => {
  const w = await fresh(t), maker = await w.user('m'), c = await w.user('c');
  const id = await live(w, maker, { campus: 'uon' });
  assert.equal((await w.call('GET', '/api/surveys', { as: c, campus: 'kirinyaga' })).data.items.length, 0, 'other campus does not see it');
  assert.equal((await w.call('GET', '/api/surveys', { as: c, campus: 'uon' })).data.items.length, 1);
  assert.equal((await w.call('POST', `/api/surveys/${id}/start`, { as: c, campus: 'kirinyaga' })).status, 400);
  await w.call('POST', `/api/admin/surveys/${id}`, { admin: true, body: { action: 'hide' } });
  assert.equal((await w.call('GET', '/api/surveys', { campus: 'uon' })).data.items.length, 0, 'hidden');
  await w.call('POST', `/api/admin/surveys/${id}`, { admin: true, body: { action: 'show' } });
  const d = (await w.call('POST', '/api/surveys', { as: maker, body: survey({ title: 'Draft that I delete' }) })).data;
  assert.equal((await w.call('POST', `/api/surveys/${d.id}/remove`, { as: maker })).status, 200);
  assert.equal(w.db.rows('surveys').some((s) => s.id === d.id), false);
  await w.call('POST', '/api/admin/settings', { admin: true, body: { values: { survey_hold_hours: 0 } } });
  const r = await answer(w, c, id); assert.equal(r.status, 200);
  assert.equal(await bal(w, c.aid), 10, 'hold 0 pays at once');
});
