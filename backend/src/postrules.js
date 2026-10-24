// Paid posts: a spill that talks about money (selling data bundles, prices, packages...) must pay a small fee before it goes live.
// The admin controls this completely: every rule is a list of words plus a fee (admin > Site > Post rules). If several rules match,
// the highest fee applies (they are not added together). Admins posting notices never pay.
import { json, err, sb, rows, one, post, patch, enc, str, isAdmin, audit, ago } from './lib.js';

const norm = (t) => ' ' + String(t || '').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ') + ' ';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// "{money}" in a rule means any price written like 50 bob, 100/=, ksh 200, 30sh.
const MONEY = /(?:\bksh\.?\s*\d|\bkes\.?\s*\d|\b\d[\d,]*\s*(?:bob|bop|ksh|kes|shs?|\/=)(?![a-z]))/;
export function ruleHits(rule, content) {
  const text = norm(content);
  return String(rule.words || '').split(/[,\n]/).map((w) => w.trim().toLowerCase()).filter(Boolean).some((w) => {
    if (w === '{money}') return MONEY.test(text);
    return new RegExp('(?<![a-z0-9])' + esc(w).replace(/\s+/g, '\\s+') + '(?![a-z0-9])').test(text);
  });
}
export async function loadRules(env, all = false) {
  const r = await sb(env, `post_rules?select=*&order=created_at.asc&limit=200${all ? '' : '&active=eq.true'}`);
  return r.ok ? rows(r) : [];                      // table not created yet: no rules, nothing is charged
}
// What a post must pay: { fee, rule } (fee 0 = free).
export async function feeFor(env, content) {
  let best = { fee: 0, rule: null };
  for (const r of await loadRules(env)) if (r.fee > best.fee && ruleHits(r, content)) best = { fee: r.fee, rule: r.label };
  return best;
}
export async function dropUnpaidDrafts(env) {      // a post nobody paid for within a day is thrown away
  const r = await rows(await sb(env, `posts?select=id&fee_pending=gt.0&created_at=lt.${ago(24 * 3600e3)}&limit=200`)).catch(() => []);
  for (const p of r) await sb(env, `posts?id=eq.${p.id}&fee_pending=gt.0`, { method: 'DELETE' });
  return r.length;
}

export async function postRuleRoutes(req, env, url, ip) {
  const path = url.pathname, m = req.method;
  if (path !== '/api/admin/post-rules' && !path.startsWith('/api/admin/post-rules/')) return null;
  if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);
  const A = (a, id, d) => audit(env, a, 'post_rule', id, d, ip);
  const body = async () => (await req.json().catch(() => ({})));
  const clean = (b, isNew) => {
    const row = {};
    if (isNew || b.label !== undefined) { const l = str(b.label, 60); if (l.length < 2) return { error: 'Give the rule a name' }; row.label = l; }
    if (isNew || b.words !== undefined) { const w = String(b.words || '').split(/[,\n]/).map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 60); if (!w.length) return { error: 'Add at least one word' }; row.words = w.join(', ').slice(0, 1200); }
    if (isNew || b.fee !== undefined) { const f = Number(b.fee); if (!Number.isInteger(f) || f < 1 || f > 5000) return { error: 'The fee must be a whole number of shillings, 1 to 5000' }; row.fee = f; }
    if (b.active !== undefined) row.active = !!b.active;
    return row;
  };
  if (path === '/api/admin/post-rules' && m === 'GET') {
    const r = await sb(env, 'post_rules?select=*&order=created_at.asc&limit=200');
    return json(env, { rules: r.ok ? await rows(r) : null });
  }
  if (path === '/api/admin/post-rules' && m === 'POST') {
    const f = clean(await body(), true); if (f.error) return err(env, f.error);
    const r = await one(await post(env, 'post_rules', { ...f, active: true }));
    if (!r) return err(env, 'Could not save. Run the newest SQL in Supabase (end of schema.sql), then try again.', 500);
    await A('post_rule.create', r.id, `${r.label}: KSh ${r.fee}`);
    return json(env, { rule: r }, 201);
  }
  const mm = path.match(/^\/api\/admin\/post-rules\/([0-9a-f-]{36})$/);
  if (mm && m === 'POST') {
    const b = await body();
    if (b.action === 'delete') { await sb(env, `post_rules?id=eq.${mm[1]}`, { method: 'DELETE' }); await A('post_rule.delete', mm[1], null); return json(env, { ok: true }); }
    const f = clean(b, false); if (f.error) return err(env, f.error);
    if (!Object.keys(f).length) return err(env, 'Nothing to change');
    const r = await one(await patch(env, `post_rules?id=eq.${mm[1]}`, f));
    if (!r) return err(env, 'Rule not found', 404);
    await A('post_rule.update', r.id, JSON.stringify(f).slice(0, 200));
    return json(env, { rule: r });
  }
  return err(env, 'Not found', 404);
}
