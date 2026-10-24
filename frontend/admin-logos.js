/* Admin: Logos. Upload the main logo and, if you want, a different one for each place a logo shows. Empty place = the main logo. Nothing set = the built-in logo. */
(function () {
'use strict';
const SL = [['logo_header', 'Top bar'], ['logo_loader', 'Loading screen'], ['logo_lock', 'Lock screen'], ['logo_landing', 'Get started page'], ['logo_welcome', 'Welcome card and first-run tour'], ['logo_receipt', 'Order receipt'], ['logo_popups', 'Get the app popup']];
const Lg = { v: null, err: '', busy: '' };
async function loadL() {
  try { const f = (await api('/api/admin/site-content')).fields, o = {}; f.forEach((x) => { o[x.key] = x.value; }); Lg.v = o; Lg.err = ''; } catch (e) { Lg.v = null; Lg.err = e.message; }
}
const _ll = load; load = async function () { await _ll(); await loadL(); render(); };
LABEL.logos = 'Logos';

const slotL = (k, n) => {
  const u = Lg.v[k];
  return '<div class="kv" style="align-items:center;gap:10px;flex-wrap:wrap"><b style="flex:1 1 140px">' + esc(n) + '</b>'
    + (u ? '<img src="' + esc(u) + '" alt="" style="width:56px;height:56px;object-fit:contain;border-radius:10px;background:#222">' : '<span class="sub">' + (k === 'logo_main' ? 'Built-in logo' : 'Uses the main logo') + '</span>')
    + '<label class="p" style="padding:8px 14px;border-radius:999px;cursor:pointer">' + (Lg.busy === k ? 'Uploading...' : (u ? 'Change' : 'Upload'))
    + '<input type="file" accept="image/jpeg,image/png,image/webp" data-lg="' + k + '" hidden></label>'
    + (u ? '<button data-lgx="' + k + '">Remove</button>' : '') + '</div>';
};
SECTIONS.logos = () => {
  if (!Lg.v) return ['<div class="card"><h3>Logos</h3><p class="sub">' + esc(Lg.err || 'Loading...') + '</p></div>'];
  return [
    '<div class="card"><h3>Main logo</h3><p class="sub">Used on every page that does not have its own logo below. Use a PNG or WebP with a see-through background, at least 512 px wide, under 5 MB. It shows exactly as uploaded. Remove it to go back to the built-in logo.</p>' + slotL('logo_main', 'Main logo') + '</div>',
    '<div class="card"><h3>Logo for each page</h3><p class="sub">Optional. A page with no logo of its own uses the main logo. The live site updates within about a minute.</p>' + SL.map((s) => slotL(s[0], s[1])).join('') + '</div>'
  ];
};
async function saveL(values) { await api('/api/admin/site-content', { values }); await loadL(); render(); }
document.addEventListener('change', async (e) => {
  const k = e.target.dataset && e.target.dataset.lg; if (!k) return;
  const f = e.target.files[0]; if (!f) return;
  try {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 5242880) throw new Error('JPG, PNG or WebP under 5 MB');
    Lg.busy = k; render();
    const u = await api('/api/admin/site-upload-url', { content_type: f.type }), fd = new FormData();
    fd.append('cacheControl', '3600'); fd.append('', f);
    const r = await fetch(u.upload_url, { method: 'PUT', body: fd });
    if (!r.ok) throw new Error('The picture did not upload. Try again.');
    Lg.busy = ''; await saveL({ [k]: u.url }); toast('Saved. The live site updates within a minute.');
  } catch (x) { Lg.busy = ''; render(); toast(x.message); }
});
document.addEventListener('click', async (e) => {
  const x = e.target.closest('[data-lgx]'); if (!x) return;
  try { await saveL({ [x.dataset.lgx]: '' }); toast('Removed. The built-in logo is back.'); } catch (y) { toast(y.message); }
});
})();
