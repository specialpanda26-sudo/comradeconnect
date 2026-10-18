/* Admin: "Live items" tab. Every item currently on the Market, with a Remove button. */
(function () {
'use strict';
const L = { items: [] };
const _load = load;
load = async function () {
  await _load();
  try { const r = await api('/api/admin/listings-live'); L.items = (r && r.listings) || []; } catch (e) { L.items = []; }
  render();
};
const old = Object.assign({}, LABEL); Object.keys(LABEL).forEach((k) => delete LABEL[k]);
Object.keys(old).forEach((k) => { LABEL[k] = old[k]; if (k === 'listings') LABEL.live = 'Live items'; });
SECTIONS.live = () => L.items.map((l) => '<div class="card" data-id="' + esc(l.id) + '"><h3>' + esc(l.title) + '</h3><b>' + kes(l.price) + '</b> <span class="sub">' + esc(l.category || '') + '</span>'
  + (l.photos && l.photos.length ? '<div class="photos">' + l.photos.map((u) => '<img src="' + esc(u) + '" alt="" loading="lazy">').join('') + '</div>' : '<p class="sub">No photos</p>')
  + '<p style="overflow-wrap:anywhere">' + esc(l.description) + '</p><p class="sub">Seller ' + esc(l.seller) + ', ' + when(l.createdAt) + '</p>'
  + '<div class="row"><button class="bad" data-x="lvrm">Remove from Market</button></div></div>');
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-x="lvrm"]'); if (!b) return;
  const card = b.closest('.card'), id = card && card.dataset.id; if (!id) return;
  if (!confirm('Remove this item from the Market? Buyers will no longer see it.')) return;
  act(b, () => api('/api/admin/listings/' + id, { action: 'remove' }), 'Removed');
});
})();
