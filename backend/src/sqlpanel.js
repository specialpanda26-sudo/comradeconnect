// Admin SQL panel: shows which SQL files / sections the database still needs, so the admin can copy and run them.
// It reads the SQL packed into sqltext.js, finds the tables and columns each section creates, and asks Supabase
// whether they exist. Sections whose tables or columns are missing are listed as "needs to run".
import { json, err, sb, isAdmin } from './lib.js';
import FILES from './sqltext.js';

const HEAD = /^-- (?:v\d+[^\n]*|-{4,} [^\n]*)$/;
const clean = (ln) => ln.replace(/^--\s*/, '').replace(/^-+\s*|\s*-+$/g, '').replace(/\s*(Safe to run again|Run once)[^.]*\.?/i, '').trim().slice(0, 100);

// Cuts one file into sections at its "-- v12: ..." / "-- ---------- title ----------" comment headers.
// A section only starts once the one before it has real SQL, so comment blocks stay with the SQL they describe.
export function split(file, text) {
  const out = []; let cur = { title: '', lines: [], sql: false };
  for (const ln of text.split('\n')) {
    if (HEAD.test(ln) && cur.sql) { out.push(cur); cur = { title: '', lines: [], sql: false }; }
    if (HEAD.test(ln) && !cur.title) cur.title = clean(ln);
    cur.lines.push(ln);
    if (ln.trim() && !ln.trim().startsWith('--')) cur.sql = true;
  }
  if (cur.lines.some((l) => l.trim())) out.push(cur);
  return out.map((s, i) => ({ file, title: out.length === 1 ? file : (s.title || (i === 0 ? 'Base tables' : 'Part ' + (i + 1))), sql: s.lines.join('\n').replace(/^\n+|\n+$/g, '') + '\n' }));
}
// The tables and columns a piece of SQL creates (only "if not exists" forms, which are safe to run again).
export function objects(sql) {
  const tables = new Set(), cols = new Set();
  for (const m of sql.matchAll(/create table if not exists\s+(?:public\.)?(\w+)/gi)) tables.add(m[1]);
  for (const m of sql.matchAll(/alter table\s+(?:if exists\s+)?(?:public\.)?(\w+)([^;]*);/gi))
    for (const c of m[2].matchAll(/add column if not exists\s+(\w+)/gi)) cols.add(m[1] + '.' + c[1]);
  return { tables: [...tables], cols: [...cols].filter((c) => !tables.has(c.split('.')[0])) };   // columns of a brand-new table are covered by the table itself
}
const editorUrl = (env) => { const m = /^https:\/\/([a-z0-9]+)\.supabase\.co/i.exec(String(env.SUPABASE_URL || '')); return m ? `https://supabase.com/dashboard/project/${m[1]}/sql/new` : 'https://supabase.com/dashboard'; };

export async function sqlRoutes(req, env, url) {
  if (url.pathname !== '/api/admin/sql' || req.method !== 'GET') return null;
  if (!isAdmin(req, env)) return err(env, 'Not allowed', 403);
  const sections = Object.entries(FILES).flatMap(([f, t]) => split(f, t));
  const probes = new Map();       // "table" or "table.column" -> 'ok' | 'missing' | 'unknown'
  const check = async (key) => {
    if (probes.has(key)) return;
    const [t, c] = key.split('.');
    let st = 'unknown';
    try { const r = await sb(env, `${t}?select=${c || '*'}&limit=0`); st = r.ok ? 'ok' : (r.status === 404 || r.status === 400) ? 'missing' : 'unknown'; } catch (e) { st = 'unknown'; }
    probes.set(key, st);
  };
  const want = sections.map((s) => ({ s, o: objects(s.sql) }));
  const keys = [...new Set(want.flatMap(({ o }) => [...o.tables, ...o.cols]))];
  for (let i = 0; i < keys.length; i += 12) await Promise.all(keys.slice(i, i + 12).map(check));
  const items = want.map(({ s, o }, i) => {
    const all = [...o.tables, ...o.cols], missing = all.filter((k) => probes.get(k) === 'missing');
    const status = !all.length ? 'manual' : missing.length ? 'missing' : all.some((k) => probes.get(k) === 'unknown') ? 'unknown' : 'installed';
    return { id: i, file: s.file, title: s.title, status, missing, checked: all.length, bytes: s.sql.length, sql: s.sql };
  });
  const need = items.filter((x) => x.status === 'missing');
  const note = '-- Run in Supabase > SQL Editor. Every line is safe to run again.\n\n';
  const all_missing = need.length ? note + need.map((x) => `-- ===== ${x.file}: ${x.title} =====\n${x.sql}`).join('\n') + "\nnotify pgrst, 'reload schema';\n" : '';
  return json(env, { items, missing_count: need.length, all_missing, editor_url: editorUrl(env) });
}
