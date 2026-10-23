/* Admin: Landing & backgrounds. Upload pictures for the page before login and for the background of each tab. */
(function () {
'use strict';
const SL = [1, 2, 3, 4, 5].map((i) => ['landing_img_' + i, 'Landing picture ' + i]);
const BG = [['bg_all', 'Everywhere (default)'], ['bg_feed', 'Feed'], ['bg_videos', 'Videos'], ['bg_live', 'Live'], ['bg_market', 'Market'], ['bg_explore', 'Explore'], ['bg_rewards', 'Rewards'], ['bg_me', 'Me']];
const TX = [['landing_cta', 'Main button text', 'Get started'], ['landing_login_q', 'Words before Log in', 'Already have an account?']];
const G = { v: null, err: '', busy: '' };
async function loadG() {
  try { const f = (await api('/api/admin/site-content')).fields, o = {}; f.forEach((x) => { o[x.key] = x.value; }); G.v = o; G.err = ''; } catch (e) { G.v = null; G.err = e.message; }
}
const _l = load; load = async function () { await _l(); await loadG(); render(); };
LABEL.landing = 'Landing & backgrounds';

const slot = (k, n) => {
  const u = G.v[k];
  return '<div class="kv" style="align-items:center;gap:10px;flex-wrap:wrap"><b style="flex:1 1 140px">' + esc(n) + '</b>'
    + (u ? '<img src="' + esc(u) + '" alt="" style="width:64px;height:48px;object-fit:cover;border-radius:10px">' : '<span class="sub">Not set</span>')
    + '<label class="p" style="padding:8px 14px;border-radius:999px;cursor:pointer">' + (G.busy === k ? 'Uploading...' : (u ? 'Change' : 'Upload'))
    + '<input type="file" accept="image/jpeg,image/png,image/webp" data-lp="' + k + '" hidden></label>'
    + (u ? '<button data-lpx="' + k + '">Remove</button>' : '') + '</div>';
};
SECTIONS.landing = () => {
  if (!G.v) return ['<div class="card"><h3>Landing & backgrounds</h3><p class="sub">' + esc(G.err || 'Loading...') + '</p></div>'];
  return [
    '<div class="card"><h3>Page before login</h3><p class="sub">Pictures rotate on the page people see first, under the Get started button. JPG, PNG or WebP under 5 MB. With none set, the built-in colours show.</p>' + SL.map((s) => slot(s[0], s[1])).join('') + '</div>',
    '<div class="card"><h3>Background pictures</h3><p class="sub">Pick which tab each picture runs behind. "Everywhere" is used on any tab without its own picture.</p>' + BG.map((s) => slot(s[0], s[1])).join('') + '</div>',
    '<div class="card"><h3>Landing words</h3>'
      + '<label class="fl" for="lp_cap">Slide words<small>One slide per line: Title | small text</small></label><textarea id="lp_cap" rows="4" maxlength="600" data-lt="landing_captions">' + esc(G.v.landing_captions) + '</textarea>'
      + TX.map((t) => '<label class="fl" for="lp_' + t[0] + '">' + esc(t[1]) + '<small>Built-in: ' + esc(t[2]) + '</small></label><input id="lp_' + t[0] + '" data-lt="' + t[0] + '" maxlength="50" value="' + esc(G.v[t[0]]) + '">').join('')
      + '<label class="sw"><span>Show logo and name over the pictures<small>Off = your pictures replace the logo and the Comrade Connect name</small></span><input type="checkbox" data-lt="landing_brand"' + (G.v.landing_brand ? ' checked' : '') + '><i></i></label>'
      + '<label class="sw"><span>Turn OFF the landing page</span><input type="checkbox" data-lt="landing_off"' + (G.v.landing_off ? ' checked' : '') + '><i></i></label>'
      + '<button class="p" id="lp_save" style="margin-top:14px;width:100%">Save words</button></div>'
  ];
};
async function save(values) { await api('/api/admin/site-content', { values }); await loadG(); render(); }
document.addEventListener('change', async (e) => {
  const k = e.target.dataset && e.target.dataset.lp; if (!k) return;
  const f = e.target.files[0]; if (!f) return;
  try {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 5242880) throw new Error('JPG, PNG or WebP under 5 MB');
    G.busy = k; render();
    const u = await api('/api/admin/site-upload-url', { content_type: f.type }), fd = new FormData();
    fd.append('cacheControl', '3600'); fd.append('', f);
    const r = await fetch(u.upload_url, { method: 'PUT', body: fd });
    if (!r.ok) throw new Error('The picture did not upload. Try again.');
    G.busy = ''; await save({ [k]: u.url }); toast('Saved. The live site updates within a minute.');
  } catch (x) { G.busy = ''; render(); toast(x.message); }
});
document.addEventListener('click', async (e) => {
  const x = e.target.closest('[data-lpx]');
  if (x) { try { await save({ [x.dataset.lpx]: '' }); toast('Removed'); } catch (y) { toast(y.message); } return; }
  if (!e.target.closest('#lp_save')) return;
  const v = {}; document.querySelectorAll('[data-lt]').forEach((n) => { v[n.dataset.lt] = n.type === 'checkbox' ? n.checked : n.value; });
  try { await save(v); toast('Saved'); } catch (y) { toast(y.message); }
});
})();
