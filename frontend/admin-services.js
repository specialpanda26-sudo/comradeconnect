/* Admin: Services. Add detailed services (contact, location, hours, price list). They appear for everyone in Explore, Services.
   Loaded before admin-dash.js. Uses api, load, render, SECTIONS, LABEL, esc, act, toast, confirm from admin.html. */
(function () {
'use strict';
const CATS = ['Printing', 'Cyber', 'Gas refill', 'Laundry', 'Food', 'Boda', 'General'];
let list = null, zones = [], edit = null;
const _load = load;
load = async function () {
  await _load();
  try { list = (await api('/api/admin/services')).services; } catch (e) { list = null; }
  try { zones = (await api('/api/admin/zones')).zones || []; } catch (e) { zones = []; }
  render();
};
LABEL.services = 'Services';
const opt = (a, sel, first) => (first ? '<option value="">' + first + '</option>' : '') + a.map((x) => '<option' + (x === sel ? ' selected' : '') + '>' + esc(x) + '</option>').join('');
const sw = (id, label, note, on) => '<label class="sw"><span>' + label + '<small>' + note + '</small></span><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><i></i></label>';
const fld = (id, label, ph, v, max, note) => '<label class="fl" for="' + id + '">' + label + (note ? '<small>' + note + '</small>' : '') + '</label><input id="' + id + '" placeholder="' + esc(ph) + '" maxlength="' + max + '" value="' + esc(v || '') + '" autocomplete="off">';

SECTIONS.services = () => {
  const e = edit || {}, cats = CATS.includes(e.category) || !e.category ? CATS : CATS.concat(e.category);
  const form = '<div class="card"><h3>' + (edit ? 'Edit service' : 'Add a service') + '</h3><p class="sub">Official services show a verified badge, a Call and WhatsApp button, directions, hours and the price list. Everyone sees them straight away.</p>'
    + fld('sv_t', 'Business name', 'e.g. Quick Print Point', e.title, 80)
    + '<label class="fl" for="sv_c">Category</label><select id="sv_c">' + opt(cats, e.category || 'Printing') + '</select>'
    + '<label class="fl" for="sv_z">Zone<small>Leave on "Whole campus" if they serve every zone.</small></label><select id="sv_z">' + opt(zones, e.zone, 'Whole campus') + '</select>'
    + fld('sv_p', 'Phone', '0712345678', e.phone, 16, 'Shown to everyone as a Call button.') + fld('sv_w', 'WhatsApp', '0712345678', e.whatsapp, 16, 'Optional. Shows a WhatsApp button.')
    + fld('sv_l', 'Location', 'e.g. Opposite Ngomongo gate, next to the chemist', e.location, 120, 'Used for the Directions button.') + fld('sv_h', 'Opening hours', 'e.g. Mon to Sat, 7am to 9pm', e.hours, 80)
    + fld('sv_n', 'Price summary', 'e.g. From KSh 5 a page', e.price_note, 40)
    + '<label class="fl" for="sv_o">Price list<small>One per line, like: Black and white print | KSh 5</small></label><textarea id="sv_o" rows="5" maxlength="1200" placeholder="Black and white print | KSh 5&#10;Colour print | KSh 20&#10;Binding | KSh 100">' + esc(e.offerings || '') + '</textarea>'
    + '<label class="fl" for="sv_d">About<small>What they do, what makes them good, anything comrades should know.</small></label><textarea id="sv_d" rows="4" maxlength="600">' + esc(e.details || '') + '</textarea>'
    + sw('sv_dl', 'Delivers to hostels', 'Adds a Delivery badge', e.delivery) + sw('sv_f', 'Pin to the top', 'Featured services are listed first', e.featured)
    + '<p class="err" id="sv_e"></p><div class="row"><button class="p" id="svsave">' + (edit ? 'Save changes' : 'Add service') + '</button>' + (edit ? '<button id="svcancel">Cancel</button>' : '') + '</div></div>';
  if (!list) return [form, '<div class="card"><p class="sub">The service list could not load. Run the newest SQL in Supabase (end of schema.sql), then tap Refresh.</p></div>'];
  const rows = list.map((x) => '<div class="card" data-id="' + esc(x.id) + '"><h3>' + esc(x.title) + '</h3>'
    + '<span class="bd">' + esc(x.category) + '</span><span class="bd">' + esc(x.zone || 'Whole campus') + '</span>' + (x.official ? '<span class="bd">official</span>' : '<span class="bd">community</span>') + (x.featured ? '<span class="bd">pinned</span>' : '') + (x.hidden ? '<span class="bd r">hidden</span>' : '') + (x.delivery ? '<span class="bd">delivers</span>' : '')
    + '<div style="margin-top:10px">' + [['Phone', x.phone], ['WhatsApp', x.whatsapp], ['Location', x.location], ['Hours', x.hours], ['Price', x.price_note]].filter((r) => r[1]).map((r) => '<div class="kv"><span class="sub">' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>').join('') + '</div>'
    + (x.details ? '<p class="sub" style="margin-top:8px">' + esc(x.details) + '</p>' : '')
    + '<div class="row">' + (x.official ? '<button data-sv="edit">Edit</button>' : '') + '<button data-sv="' + (x.featured ? 'unfeature' : 'feature') + '">' + (x.featured ? 'Unpin' : 'Pin to top') + '</button><button data-sv="' + (x.hidden ? 'show' : 'hide') + '">' + (x.hidden ? 'Show' : 'Hide') + '</button><button class="bad" data-sv="delete">Delete</button></div></div>');
  return [form, '<div class="card"><h3>All services (' + list.length + ')</h3><p class="sub">Official ones you added, plus anything comrades posted. Hide or delete anything that should not be there.</p></div>'].concat(rows);
};

const val = (id) => ($('#' + id).value || '').trim();
document.addEventListener('click', (e) => {
  if (e.target.closest('#svcancel')) { edit = null; return render(); }
  const sv = e.target.closest('#svsave');
  if (sv) {
    const body = { title: val('sv_t'), category: val('sv_c'), zone: val('sv_z'), phone: val('sv_p'), whatsapp: val('sv_w'), location: val('sv_l'), hours: val('sv_h'), price_note: val('sv_n'), offerings: $('#sv_o').value.trim(), details: val('sv_d'), delivery: $('#sv_dl').checked, featured: $('#sv_f').checked };
    if (body.title.length < 3) { $('#sv_e').textContent = 'Add the business name'; return; }
    if (!body.phone && !body.whatsapp) { if (!confirm('No phone or WhatsApp added. Comrades will only be able to message them in the app. Save anyway?')) return; }
    const was = edit;
    return act(sv, async () => { await api(was ? '/api/admin/services/' + was.id : '/api/admin/services', was ? Object.assign({ action: 'edit' }, body) : body); edit = null; }, was ? 'Saved' : 'Service added');
  }
  const b = e.target.closest('[data-sv]'); if (!b) return;
  const card = b.closest('.card'), id = card && card.dataset.id, a = b.dataset.sv;
  if (a === 'edit') { edit = (list || []).find((x) => x.id === id) || null; render(); return scrollTo({ top: 0, behavior: 'smooth' }); }
  if (a === 'delete' && !confirm('Delete this service for good? It disappears for everyone.')) return;
  act(b, () => api('/api/admin/services/' + id, { action: a }), 'Done');
});
})();
