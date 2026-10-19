/* Admin: SQL panel. Lists the SQL the database still needs, with Copy buttons, and a link to the Supabase SQL editor.
   Loaded before admin-dash.js. Uses api, render, SECTIONS, LABEL, esc, toast from admin.html. */
(function () {
'use strict';
let data = null, busy = false, bad = '';
const copy = async (text) => {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;top:0;opacity:0'; document.body.appendChild(t); t.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} t.remove(); return ok;
};
async function check() {
  if (busy) return; busy = true; bad = ''; render();
  try { data = await api('/api/admin/sql'); } catch (e) { bad = e.message; }
  busy = false; render();
}
LABEL.sql = 'SQL';
SECTIONS.sql = () => {
  if (!data && !busy && !bad) setTimeout(check, 0);
  const top = '<div class="card"><h3>Database SQL</h3><p class="sub">Whenever the website needs a new table or column, it shows up here. Tap <b>Copy missing SQL</b>, open the Supabase SQL editor, paste, and Run. Everything is safe to run again.</p>'
    + '<div class="row"><button class="p" id="sqlcheck">' + (busy ? 'Checking...' : 'Check again') + '</button>'
    + (data ? '<a class="btn g" href="' + esc(data.editor_url) + '" target="_blank" rel="noopener" style="text-align:center;padding:10px 16px">Open SQL editor</a>' : '') + '</div></div>';
  if (bad) return [top, '<div class="card"><p class="sub">' + esc(bad) + '</p></div>'];
  if (!data) return [top, '<div class="card"><p class="sub">Checking your database...</p></div>'];
  const n = data.missing_count;
  const sum = '<div class="card"><h3>' + (n ? n + ' part' + (n === 1 ? '' : 's') + ' to run' : 'Your database is up to date') + '</h3>'
    + (n ? '<p class="sub">These sections create tables or columns your database does not have yet. One tap copies them all, in the right order.</p><div class="row"><button class="p" id="sqlall">Copy missing SQL</button></div>'
         : '<p class="sub">Every table and column the code needs was found. Anything below can still be copied if you want to run it again.</p>') + '</div>';
  const label = { missing: 'needs to run', installed: 'installed', unknown: 'could not check', manual: 'run if you added it recently' };
  const need = data.items.filter((x) => x.status === 'missing').map((x) => '<div class="card"><h3>' + esc(x.title) + ' <small>needs to run</small></h3>'
    + '<p class="sub">' + esc(x.file) + '. Missing: ' + esc(x.missing.slice(0, 6).join(', ')) + (x.missing.length > 6 ? ' and ' + (x.missing.length - 6) + ' more' : '') + '</p>'
    + '<details><summary class="sub">Show the SQL</summary><textarea readonly rows="8" style="font:11px/1.4 monospace;width:100%">' + esc(x.sql) + '</textarea></details>'
    + '<div class="row"><button class="p" data-sqlcopy="' + x.id + '">Copy this part</button></div></div>');
  const rest = data.items.filter((x) => x.status !== 'missing');
  const list = rest.length ? '<div class="card"><details><summary><b>All other sections (' + rest.length + ')</b></summary><p class="sub">Already installed or not checkable. Copy one if you want to run it again.</p>'
    + rest.map((x) => '<div class="kv"><span style="text-align:left">' + esc(x.title) + ' <small>' + label[x.status] + '</small></span><button data-sqlcopy="' + x.id + '" style="padding:6px 14px">Copy</button></div>').join('') + '</details></div>' : '';
  return [top, sum].concat(need, list ? [list] : []);
};
document.addEventListener('click', async (e) => {
  if (e.target.closest('#sqlcheck')) { data = null; return check(); }
  if (e.target.closest('#sqlall')) return toast((await copy(data.all_missing)) ? 'Copied. Paste it in the SQL editor and press Run.' : 'Could not copy. Open the sections and copy by hand.');
  const c = e.target.closest('[data-sqlcopy]');
  if (c) { const it = data && data.items[Number(c.dataset.sqlcopy)]; if (it) toast((await copy(it.sql)) ? 'Copied' : 'Could not copy'); }
});
})();
