/* Admin: Post rules. Spills that match a rule must pay its fee before they go live (for example data resellers listing their prices).
   Loaded before admin-dash.js. Uses api, load, render, SECTIONS, LABEL, esc, act, toast, $ from admin.html. */
(function () {
'use strict';
let rules = null;
const _load = load;
load = async function () { await _load(); try { rules = (await api('/api/admin/post-rules')).rules; } catch (e) { rules = null; } render(); };
LABEL.postrules = 'Post rules';
SECTIONS.postrules = () => {
  const add = '<div class="card"><h3>New post rule</h3><p class="sub">When a spill contains any of these words, the writer must pay the fee before it goes live. If several rules match, the highest fee applies. Write <b>{money}</b> to also catch prices like "50 bob", "ksh 200" or "100/=".</p>'
    + '<input id="pr_l" placeholder="Rule name, e.g. Data resellers" maxlength="60" autocomplete="off">'
    + '<textarea id="pr_w" rows="3" placeholder="Words, separated by commas: data, bundle, airtime, {money}" maxlength="1200"></textarea>'
    + '<input id="pr_f" inputmode="numeric" placeholder="Fee in KSh, e.g. 25" maxlength="4" autocomplete="off"><div class="row"><button class="p" id="pradd">Add rule</button></div></div>';
  if (!rules) return [add, '<div class="card"><p class="sub">The rules could not load. Run the newest SQL in Supabase (end of schema.sql), then tap Refresh.</p></div>'];
  return [add].concat(rules.map((r) => '<div class="card" data-prid="' + esc(r.id) + '"><h3>' + esc(r.label) + ' <small>' + (r.active ? 'on' : 'off') + '</small></h3>'
    + '<input data-f="label" value="' + esc(r.label) + '" maxlength="60"><textarea data-f="words" rows="3" maxlength="1200">' + esc(r.words) + '</textarea>'
    + '<input data-f="fee" inputmode="numeric" value="' + esc(String(r.fee)) + '" maxlength="4">'
    + '<div class="row"><button class="p" data-prsave="' + esc(r.id) + '">Save</button><button data-prtoggle="' + esc(r.id) + '" data-on="' + (r.active ? 1 : 0) + '">' + (r.active ? 'Turn off' : 'Turn on') + '</button><button class="bad" data-prdel="' + esc(r.id) + '">Delete</button></div></div>'));
};
document.addEventListener('click', (e) => {
  const a = e.target.closest('#pradd');
  if (a) {
    const fee = Number($('#pr_f').value.trim());
    if (!Number.isInteger(fee) || fee < 1) return toast('Enter the fee in whole shillings');
    return act(a, () => api('/api/admin/post-rules', { label: $('#pr_l').value.trim(), words: $('#pr_w').value, fee }), 'Rule added');
  }
  const card = e.target.closest('[data-prid]'); if (!card) return;
  const id = card.dataset.prid, v = (k) => card.querySelector('[data-f="' + k + '"]').value;
  const s = e.target.closest('[data-prsave]');
  if (s) { const fee = Number(v('fee').trim()); if (!Number.isInteger(fee) || fee < 1) return toast('Enter the fee in whole shillings'); return act(s, () => api('/api/admin/post-rules/' + id, { label: v('label'), words: v('words'), fee }), 'Rule saved'); }
  const t = e.target.closest('[data-prtoggle]');
  if (t) return act(t, () => api('/api/admin/post-rules/' + id, { active: t.dataset.on !== '1' }), t.dataset.on === '1' ? 'Rule turned off' : 'Rule turned on');
  const d = e.target.closest('[data-prdel]');
  if (d) { if (!confirm('Delete this rule? Posts will stop being charged for it.')) return; act(d, () => api('/api/admin/post-rules/' + id, { action: 'delete' }), 'Rule deleted'); }
});
})();
