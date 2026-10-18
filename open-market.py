"""Open Market: no posting limit, items live at once (admin setting), admin Live items tab, DB price limit raised."""
import re
from pathlib import Path

def rd(p): return Path(p).read_text()
def need(s, old, where):
    if old not in s:
        raise SystemExit(f"STOP: anchor not found in {where}:\n  {old[:100]}\nNothing was changed.")

files = {k: rd(k) for k in [
    "backend/src/market.js", "backend/src/settings.js", "backend/src/admin.js", "supabase/schema.sql",
    "frontend/index.html", "frontend/cc-core.js", "frontend/admin.html"]}
if "listing_auto_publish" in files["backend/src/settings.js"]:
    print("Already applied, nothing to do."); raise SystemExit(0)
if "mtrust" not in files["frontend/index.html"]:
    raise SystemExit("STOP: run market-trust.py first (the Market trust strip is missing). Nothing was changed.")

# ---------- backend: market.js ----------
m = files["backend/src/market.js"]
thr = "    if (!(await throttle(env, ip, 'listing', u.aid, 5, 15))) return tooMany(env);\n"
old_post = "const l = await one(await post(env, 'listings', { seller_aid: u.aid, title, description, category, price, zone, condition: condition || null, contact_phone, ip }));"
need(m, thr, "market.js"); need(m, old_post, "market.js")
m = m.replace(thr, "", 1)
m = m.replace(old_post,
  "const live = (await getSettings(env)).listing_auto_publish === 1;\n"
  "    const l = await one(await post(env, 'listings', { seller_aid: u.aid, title, description, category, price, zone, condition: condition || null, contact_phone, ip,\n"
  "      ...(live ? { status: 'approved', approved_by: 'auto', approved_at: new Date().toISOString() } : {}) }));", 1)
files["backend/src/market.js"] = m

# ---------- backend: settings.js ----------
s = files["backend/src/settings.js"]
need(s, "  escrow_auto_release_days:", "settings.js")
s = s.replace("  escrow_auto_release_days:",
  "  listing_auto_publish: { env: 'LISTING_AUTO_PUBLISH', def: 1, min: 0, max: 1, unit: '', label: 'New items go live instantly (1 = yes, 0 = admin approves first)', help: '1: items appear on the Market as soon as they are posted and you remove anything unsafe in Live items. 0: every item waits for your approval.' },\n"
  "  escrow_auto_release_days:", 1)
files["backend/src/settings.js"] = s

# ---------- backend: admin.js ----------
a = files["backend/src/admin.js"]
anchor = "  mm = path.match(/^\\/api\\/admin\\/listings\\/([0-9a-f-]{36})$/);"
need(a, anchor, "admin.js")
a = a.replace(anchor,
  "  if (path === '/api/admin/listings-live' && m === 'GET') {\n"
  "    const ls = await rows(await sb(env, 'listings?status=eq.approved&order=created_at.desc&limit=100'));\n"
  "    const ph = ls.length ? await rows(await sb(env, `media?select=listing_id,r2_key&kind=eq.listing_photo&status=eq.ready&listing_id=${inList(ls.map((l) => l.id))}`)) : [];\n"
  "    return json(env, { listings: ls.map((l) => ({ id: l.id, title: l.title, description: l.description, price: l.price, category: l.category, seller: l.seller_aid, createdAt: Date.parse(l.created_at), photos: ph.filter((p) => p.listing_id === l.id).map((p) => mediaUrl(env, p.r2_key)) })) });\n"
  "  }\n\n" + anchor, 1)
files["backend/src/admin.js"] = a

# ---------- database ----------
files["supabase/schema.sql"] += """

-- v16: item price limit follows the admin setting (up to KSh 250,000, the M-Pesa per-payment limit). Safe to run again.
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'listings'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%price%' loop
    execute format('alter table listings drop constraint %I', c);
  end loop;
end $$;
alter table listings add constraint listings_price_check check (price >= 1 and price <= 250000);
"""

# ---------- frontend wording ----------
h = files["frontend/index.html"]
old1 = "<small>Every listing is checked by an admin before it goes live</small>"
old2 = "An admin checks every listing before it goes live."
need(h, old1, "index.html"); need(h, old2, "index.html")
h = h.replace(old1, "<small>Admins watch the Market and remove anything unsafe</small>", 1)
h = h.replace(old2, "Items go live straight away, and admins remove anything unsafe.", 1)
h = h.replace("Submit for verification", "Post item")
h = re.sub(r"cc-core\.js\?v=\w+", "cc-core.js?v=op1", h, count=1)
files["frontend/index.html"] = h

c = files["frontend/cc-core.js"]
old_card = "<small class=\"mtr\">' + SHLD + 'Admin checked</small>"
old_row = "</p><div class=\"mtb\"><span class=\"badge\">' + SHLD + 'Admin checked</span></div>"
old_toast = "toast('Sent for admin verification');"
old_ph = "Add at least one photo so the admin can verify it"
for o in (old_card, old_row, old_toast, old_ph): need(c, o, "cc-core.js")
c = c.replace(old_card, "<small class=\"mtr\">' + SHLD + 'Escrow protected</small>", 1)
c = c.replace(old_row, "</p>", 1)
c = c.replace(old_toast, "toast(l.status === 'approved' ? 'Your item is live' : 'Sent for admin verification');", 1)
c = c.replace(old_ph, "Add at least one photo so buyers can see the item", 1)
c = c.replace("Submit for verification", "Post item")
files["frontend/cc-core.js"] = c

# ---------- admin screen ----------
ah = files["frontend/admin.html"]
tag = '<script src="admin-site.js?v=1"></script>'
need(ah, tag, "admin.html")
ah = ah.replace(tag, tag + '\n<script src="admin-live.js?v=1"></script>', 1)
files["frontend/admin.html"] = ah

Path("frontend/admin-live.js").write_text('''/* Admin: "Live items" tab. Every item currently on the Market, with a Remove button. */
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
''')

for k, v in files.items():
    Path(k).write_text(v)

# ---------- tests ----------
th = Path("tests/helpers.mjs"); t1 = th.read_text()
if "REFERRAL_REWARD: '20', ...opts.env" in t1:
    th.write_text(t1.replace("REFERRAL_REWARD: '20', ...opts.env", "REFERRAL_REWARD: '20', LISTING_AUTO_PUBLISH: '0', ...opts.env", 1))
ts = Path("tests/settings.test.mjs")
ts.write_text(ts.read_text() + """
test('open market: no posting limit, items live at once, admin can remove, switch back to approval', async (t) => {
  const w = await fresh(t, { env: { LISTING_AUTO_PUBLISH: '1' } });
  const s = await w.user('s');
  const post = (n) => w.call('POST', '/api/market/listings', { as: s, body: { title: 'Item ' + n, description: 'fine', price: 100 + n, contact_phone: '0722000111' } });
  for (let i = 0; i < 12; i++) { const r = await post(i); assert.equal(r.status, 201, 'post ' + i); assert.equal(r.data.status, 'approved'); }
  assert.equal((await w.call('GET', '/api/market/listings?limit=30')).data.listings.length, 12, 'all live without approval');
  const live = (await w.call('GET', '/api/admin/listings-live', { admin: true })).data.listings;
  assert.equal(live.length, 12);
  assert.equal((await w.call('GET', '/api/admin/listings-live')).status, 403, 'admin only');
  assert.equal((await w.call('POST', '/api/admin/listings/' + live[0].id, { admin: true, body: { action: 'remove' } })).status, 200);
  assert.equal((await w.call('GET', '/api/market/listings?limit=30')).data.listings.length, 11, 'removed item is gone');
  assert.equal((await save(w, { listing_auto_publish: 0 })).status, 200);
  const p = await post(99); assert.equal(p.data.status, 'pending');
  assert.equal((await w.call('GET', '/api/market/listings?limit=30')).data.listings.length, 11, 'pending stays hidden');
});
""")
print("Done: no posting limit, items go live at once, admin Live items tab added.")
print("NEXT: run the v16 SQL in the Supabase SQL editor.")
