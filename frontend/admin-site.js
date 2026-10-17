/* Admin: Site editor. Change words, links, the announcement banner, switches and extra CSS on the public site.
   Loaded by admin.html after admin-extra.js. Uses api, render, SECTIONS, LABEL, esc, toast. */
(function () {
'use strict';
const S = { fields: null, draft: {}, err: '', log: null };
async function loadS() {
  try { S.log = (await api('/api/admin/audit?limit=60')).log || []; } catch (e) { S.log = null; }
  try { S.fields = (await api('/api/admin/site-content')).fields; S.draft = {}; S.err = ''; } catch (e) { S.fields = null; S.err = e.message; } }

const _load = load;
load = async function () { await _load(); await loadS(); render(); };

// put the tab right after Money and fees
const old = Object.assign({}, LABEL); Object.keys(LABEL).forEach((k) => delete LABEL[k]);
Object.keys(old).forEach((k) => { LABEL[k] = old[k]; if (k === 'settings') LABEL.site = 'Site editor'; });
if (!LABEL.site) LABEL.site = 'Site editor';
LABEL.audit = 'Audit log';

const cur = (f) => (f.key in S.draft ? S.draft[f.key] : f.value);
function field(f) {
  const v = cur(f), id = 'sc_' + f.key;
  if (f.kind === 'flag') return '<label class="sw"><span>' + esc(f.label) + (f.help ? '<small>' + esc(f.help) + '</small>' : '') + '</span><input type="checkbox" data-sc="' + esc(f.key) + '"' + (v ? ' checked' : '') + '><i></i></label>';
  const hint = f.help ? '<small>' + esc(f.help) + '</small>' : '';
  const lab = '<label class="fl" for="' + id + '">' + esc(f.label) + hint + '</label>';
  if (f.multi) return lab + '<textarea id="' + id + '" data-sc="' + esc(f.key) + '" maxlength="' + (f.max || 400) + '" rows="' + (f.kind === 'css' ? 8 : 3) + '"' + (f.kind === 'css' ? ' spellcheck="false" style="font-family:ui-monospace,Menlo,monospace;font-size:12.5px"' : '') + '>' + esc(v) + '</textarea>';
  return lab + '<input id="' + id + '" data-sc="' + esc(f.key) + '" maxlength="' + (f.max || 200) + '" value="' + esc(v) + '" autocomplete="off"' + (f.kind === 'link' ? ' inputmode="url" placeholder="https://"' : '') + '>';
}
SECTIONS.site = () => {
  if (!S.fields) return ['<div class="card"><h3>Site editor</h3><p class="sub">' + esc(S.err || 'Loading...') + '</p><p class="sub">If it says to run the SQL, open Supabase, paste the last block of supabase/schema.sql (v10) and run it.</p></div>'];
  const groups = [];
  S.fields.forEach((f) => { let g = groups.find((x) => x.n === f.group); if (!g) groups.push((g = { n: f.group, f: [] })); g.f.push(f); });
  const intro = '<div class="card"><h3>Edit the site without code</h3><p class="sub">Change something, press Save, and the live site shows it within about a minute. Leave a box empty to go back to the built-in words. Nothing here can break the app: text is always shown as plain text.</p></div>';
  const cards = groups.map((g) => '<div class="card grp"><h3>' + esc(g.n) + '</h3>' + g.f.map(field).join('') + '</div>');
  const bar = '<div class="savebar g" id="scbar"><span id="scmsg">' + (Object.keys(S.draft).length ? Object.keys(S.draft).length + ' change(s) not saved yet' : 'No changes yet') + '</span><button class="p" id="scsave"' + (Object.keys(S.draft).length ? '' : ' disabled') + '>Save changes</button></div>';
  return [intro].concat(cards, [bar]);
};

const NICE = { 'site.update': 'Edited the site', 'settings.update': 'Changed money settings', login: 'Signed in' };
SECTIONS.audit = () => {
  if (!S.log) return ['<div class="card"><h3>Audit log</h3><p class="sub">Could not load the log.</p></div>'];
  if (!S.log.length) return [];
  return [ '<div class="card"><h3>Audit log</h3><p class="sub">Every admin action, newest first. Last ' + S.log.length + ' shown.</p>'
    + S.log.map((r) => '<div class="kv"><span class="sub">' + esc(when(r.created_at)) + '</span><b>' + esc(NICE[r.action] || r.action) + (r.target_type ? ' <span class="sub">(' + esc(r.target_type) + ')</span>' : '') + '</b></div>').join('') + '</div>' ];
};

function mark() {
  const n = Object.keys(S.draft).length, m = document.getElementById('scmsg'), b = document.getElementById('scsave');
  if (m) m.textContent = n ? n + ' change(s) not saved yet' : 'No changes yet';
  if (b) b.disabled = !n;
}
document.addEventListener('input', (e) => {
  const k = e.target.dataset && e.target.dataset.sc; if (!k) return;
  const f = S.fields.find((x) => x.key === k); S.draft[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  if (S.draft[k] === (f.kind === 'flag' ? !!f.value : f.value)) delete S.draft[k];
  mark();
});
document.addEventListener('click', async (e) => {
  const b = e.target.closest('#scsave'); if (!b) return;
  const values = Object.assign({}, S.draft); if (!Object.keys(values).length) return;
  b.disabled = true;
  try { await api('/api/admin/site-content', { values }); toast('Saved. The live site updates within a minute.'); S.draft = {}; await loadS(); render(); }
  catch (x) { toast(x.message); b.disabled = false; }
});
})();
