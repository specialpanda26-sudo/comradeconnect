/* Admin: Kura. Approve or reject contestants, hide or verify pages, and set the season (closing time, prizes, vote packs).
   Loaded before admin-dash.js. Uses api, load, render, SECTIONS, LABEL, esc, kes, when, act, toast, $ from admin.html. */
(function () {
'use strict';
let K = null;
const _load = load;
load = async function () {
  await _load();
  try { K = await api('/api/admin/kura'); } catch (e) { K = null; }
  render();
};
LABEL.kura = 'Kura';
async function kuSave(p) {
  const g = (i) => ($('#' + i).value || '').trim(), iso = (i) => (g(i) ? new Date(g(i)).toISOString() : '');
  p.starts_at = iso('ku_s'); p.reveal_at = iso('ku_rv'); p.prize_mystery = $('#ku_pm').checked;
  const f = $('#ku_pi').files[0];
  if (f) {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 5242880) throw new Error('Prize image: JPG, PNG or WebP under 5 MB');
    const u = await api('/api/admin/kura/prize-url', { content_type: f.type }), fd = new FormData();
    fd.append('cacheControl', '3600'); fd.append('', f);
    const r = await fetch(u.upload_url, { method: 'PUT', body: fd });
    if (!r.ok) throw new Error('The prize image did not upload. Try again.');
    p.prize_image_key = u.key;
  } else if ($('#ku_pr') && $('#ku_pr').checked) p.prize_image_key = '';
  return api('/api/admin/kura/season', p);
}
const sw = (id, label, note, on) => '<label class="sw"><span>' + label + '<small>' + note + '</small></span><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><i></i></label>';
const fld = (id, label, ph, v, max, note) => '<label class="fl" for="' + id + '">' + label + (note ? '<small>' + note + '</small>' : '') + '</label><input id="' + id + '" placeholder="' + esc(ph) + '" maxlength="' + max + '" value="' + esc(v == null ? '' : v) + '">';
const local = (iso) => { if (!iso) return ''; const d = new Date(iso), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); };
const person = (c, pending) => '<div class="card" data-id="' + esc(c.id) + '"><div style="display:flex;gap:12px;align-items:center">'
  + (c.photo ? '<img src="' + esc(c.photo) + '" alt="" style="width:64px;height:64px;border-radius:14px;object-fit:cover">' : '')
  + '<div><h3 style="margin:0">' + esc(c.name) + '</h3><span class="bd">' + esc(c.category) + '</span><span class="bd">' + esc(c.gender) + '</span><span class="bd">' + esc(c.campus) + '</span>'
  + (!pending ? '<span class="bd' + (c.status === 'approved' ? '' : ' r') + '">' + esc(c.status) + '</span>' + (c.verified ? '<span class="bd">verified</span>' : '') + '<span class="bd">' + c.votes + ' votes</span>' : '') + '</div></div>'
  + '<div style="margin-top:10px">' + [['Email', c.email], ['Payout phone', c.phone], ['Tagline', c.tagline], ['Bio', c.bio], ['Socials', Object.keys(c.socials || {}).map((k) => k + ': ' + c.socials[k]).join(', ')], ['Sent', when(c.created_at)], ['Note', c.note]].filter((r) => r[1]).map((r) => '<div class="kv"><span class="sub">' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>').join('') + '</div>'
  + '<div class="row">' + (pending ? '<button class="ok" data-ku="approve">Approve</button><button class="bad" data-ku="reject">Reject</button>'
    : (c.status === 'hidden' ? '<button data-ku="unhide">Show</button>' : c.status === 'approved' ? '<button data-ku="hide">Hide</button>' : '<button class="ok" data-ku="approve">Approve</button>')
      + (c.status === 'approved' ? '<button data-ku="' + (c.verified ? 'unverify' : 'verify') + '">' + (c.verified ? 'Remove tick' : 'Verify tick') + '</button>' : '') + '<button class="bad" data-ku="delete">Delete</button>') + '</div></div>';

SECTIONS.kura = () => {
  if (!K) return ['<div class="card"><p class="sub">Kura could not load. Run supabase/kura.sql in Supabase, redeploy the API, then tap Refresh.</p></div>'];
  const s = K.season || {}, m = K.money || {};
  const form = '<div class="card"><h3>Season settings</h3><p class="sub">Raised so far from votes: <b>' + kes(m.paid || 0) + '</b> (' + (m.votes || 0) + ' votes, ' + (m.payments || 0) + ' payments).</p>'
    + fld('ku_t', 'Title', 'Campus Star Awards', s.title, 60) + fld('ku_g', 'Tagline', 'One line under the title', s.tagline, 200)
    + '<label class="fl" for="ku_e">Voting closes<small>Leave empty for no closing time.</small></label><input type="datetime-local" id="ku_e" value="' + local(s.ends_at) + '">'
    + '<label class="fl" for="ku_s">Competition starts<small>Voters see a countdown to this time. Leave empty to start now.</small></label><input type="datetime-local" id="ku_s" value="' + local(s.starts_at) + '">'
    + sw('ku_pm', 'Mystery prize', 'On: voters see a mystery card instead of the real prize', s.prize_mystery)
    + '<label class="fl" for="ku_rv">Prize reveal time<small>The real image shows automatically then. Leave empty to reveal by turning Mystery off.</small></label><input type="datetime-local" id="ku_rv" value="' + local(s.reveal_at) + '">'
    + '<label class="fl" for="ku_pi">Prize image<small>JPG, PNG or WebP under 5 MB. Voters only see it after the mystery ends.</small></label>' + (s.prize_image_url ? '<img src="' + esc(s.prize_image_url) + '" alt="" style="width:100%;max-height:180px;object-fit:cover;border-radius:16px;margin:8px 0">' + sw('ku_pr', 'Remove current image', '', false) : '') + '<input type="file" id="ku_pi" accept="image/jpeg,image/png,image/webp">'
    + sw('ku_v', 'Voting open', 'Turn off to stop all vote sales', s.voting_open) + sw('ku_n', 'Entries open', 'Turn off to stop new applications', s.entries_open)
    + fld('ku_pt', 'Prize headline', 'e.g. Win a brand-new phone', s.prize_title, 80) + fld('ku_px', 'Prize details', 'One or two lines', s.prize_text, 240)
    + '<label class="fl" for="ku_pz">Prize boxes<small>One per line: Label | small text. Leave empty to hide the prize card.</small></label><textarea id="ku_pz" rows="3" maxlength="500">' + esc((s.prizes || []).map((x) => x.label + (x.sub ? ' | ' + x.sub : '')).join('\n')) + '</textarea>'
    + '<label class="fl" for="ku_pk">Vote packs<small>One per line: votes | price in KSh | bonus (optional) | popular (optional). Votes is the total the fan gets, bonus included.</small></label><textarea id="ku_pk" rows="6" maxlength="600">' + esc((s.packs || []).map((p) => [p.votes, p.price, p.bonus || 0, p.popular ? 'popular' : ''].join(' | ').replace(/ \| 0 \| $/, '').replace(/ \| $/, '')).join('\n')) + '</textarea>'
    + '<label class="fl" for="ku_cp">Campuses<small>One per line. Contestants pick from this list.</small></label><textarea id="ku_cp" rows="6" maxlength="4000">' + esc((s.campuses || []).join('\n')) + '</textarea>'
    + '<p class="err" id="ku_er"></p><div class="row"><button class="p" id="ku_save">Save settings</button></div></div>';
  return [form, '<div class="card"><h3>Waiting for review (' + K.pending.length + ')</h3><p class="sub">Check the photo and details, then approve. Approved pages go live straight away.</p></div>']
    .concat(K.pending.map((c) => person(c, true)), ['<div class="card"><h3>All contestants (' + K.contestants.length + ')</h3></div>'], K.contestants.map((c) => person(c, false)));
};

document.addEventListener('click', (e) => {
  const sv = e.target.closest('#ku_save');
  if (sv) {
    const v = (id) => ($('#' + id).value || '').trim(), lines = (id) => $('#' + id).value.split('\n').map((x) => x.trim()).filter(Boolean);
    const packs = lines('ku_pk').map((l) => { const a = l.split('|').map((x) => x.trim()); return { votes: +a[0], price: +a[1], bonus: +a[2] > 0 ? +a[2] : 0, popular: /popular/i.test(l) }; });
    if (packs.some((p) => !(p.votes >= 1 && p.price >= 1))) { $('#ku_er').textContent = 'Each vote pack line needs votes and a price, like: 10 | 100 | 0 | popular'; return; }
    const prizes = lines('ku_pz').map((l) => { const a = l.split('|'); return { label: (a[0] || '').trim(), sub: (a[1] || '').trim() }; });
    const ends = v('ku_e');
    return act(sv, () => kuSave({ title: v('ku_t'), tagline: v('ku_g'), ends_at: ends ? new Date(ends).toISOString() : '', voting_open: $('#ku_v').checked, entries_open: $('#ku_n').checked, prize_title: v('ku_pt'), prize_text: v('ku_px'), prizes, packs, campuses: lines('ku_cp') }), 'Saved');
  }
  const b = e.target.closest('[data-ku]'); if (!b) return;
  const card = b.closest('.card'), id = card && card.dataset.id, a = b.dataset.ku;
  let note = '';
  if (a === 'delete' && !confirm('Delete this contestant and all their votes for good?')) return;
  if (a === 'reject') { note = prompt('Reason shown to the applicant (optional)', '') || ''; }
  act(b, () => api('/api/admin/kura/c/' + id, { action: a, note }), 'Done');
});
})();
