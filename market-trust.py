import re
from pathlib import Path

SHIELD = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>'

def need(s, old, where):
    if old not in s:
        raise SystemExit(f"STOP: anchor not found in {where}:\n  {old[:100]}\nNothing was changed.")

hp, cp, mp = Path("frontend/index.html"), Path("frontend/cc-core.js"), Path("frontend/cc-market-plus.js")
h, c, m = hp.read_text(), cp.read_text(), mp.read_text()
if "mtrust" in h:
    print("Already applied, nothing to do."); raise SystemExit(0)

old_intro = '<p class="sub">Buy and sell on campus. Your money is held in escrow and the seller is paid only after you confirm you received the item.</p>'
old_tip = '\n    <div class="box g"><p class="sub" style="margin:0">Meet on campus in daytime. Check the item before you confirm. Never confirm early and never pay outside Comrade Connect.</p></div>'
css_anchor = ".mb{padding:12px 14px}"
for o in (old_intro, old_tip, css_anchor):
    need(h, o, "index.html")

panel = ('<p class="sub">Buy and sell with other comrades. Real items, protected payments.</p>'
         '<div class="box g mtrust"><div class="mt-h">' + SHIELD + '<div><b>Protected by escrow</b><small>Every listing is checked by an admin before it goes live</small></div></div>'
         '<div class="mtb"><span class="badge">Money held in escrow</span><span class="badge">Seller paid after you confirm</span><span class="badge">Refunds reviewed by an admin</span></div></div>')
h = h.replace(old_intro, panel, 1)
h = h.replace(old_tip, '', 1)

css = (".mb{padding:12px 14px}\n"
 "/* market trust look */\n"
 ".mtrust{padding:18px 20px;border-radius:24px;margin:14px 0}.mt-h{display:flex;gap:12px;align-items:center}.mt-h svg{width:28px;height:28px;flex-shrink:0}"
 ".mt-h b{display:block;font-size:16px;font-weight:600}.mt-h small{display:block;color:var(--mut);font-size:12px;margin-top:2px;line-height:1.5}"
 ".mtr{display:flex!important;align-items:center;gap:5px;margin-top:6px;font-size:11px;color:var(--mut)}.mtr svg{width:13px;height:13px;flex-shrink:0}"
 ".mtb{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.mtb .badge{display:inline-flex;align-items:center;gap:5px}.mtb .badge svg{width:12px;height:12px}")
h = h.replace(css_anchor, css, 1)
h = re.sub(r"cc-core\.js\?v=\w+", "cc-core.js?v=mt1", h, count=1)
h = re.sub(r"cc-market-plus\.js\?v=\w+", "cc-market-plus.js?v=2", h, count=1)
hp.write_text(h)

if not re.search(r"'[^']*How escrow protects you'", m):
    raise SystemExit("STOP: escrow box title not found in cc-market-plus.js. Nothing was changed.")
m = re.sub(r"'[^']*How escrow protects you'", "'How escrow works, step by step'", m, count=1)
mp.write_text(m)

old_card = "<small>Verified by admin</small></div></button>').join('');"
old_badge = '<span class="badge">Verified by admin</span></div>'
old_note = "by @' + esc(l.seller ? l.seller.handle : 'Seller') + '</p>"
old_draw = "function draw() {"
for o in (old_card, old_badge, old_note, old_draw):
    need(c, o, "cc-core.js")

helper = '''const SHLD = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>';
function sellerBits(l) {
  const s = l.seller || {}, a = [];
  if (s.rating && s.rating.count) a.push('\\u2605 ' + Number(s.rating.avg) + ' (' + Number(s.rating.count) + ')');
  if (s.verified) a.push('Verified seller'); else if (s.student) a.push('Student');
  return a;
}
function draw() {'''
c = c.replace(old_draw, helper, 1)
c = c.replace(old_card, "<small class=\"mtr\">' + SHLD + 'Admin checked</small><small class=\"mtr\">' + esc(sellerBits(l).join(' \\u00B7 ') || 'New seller') + '</small></div></button>').join('');", 1)
c = c.replace(old_badge, '<span class="badge">Escrow protected</span></div>', 1)
c = c.replace(old_note, "by @' + esc(l.seller ? l.seller.handle : 'Seller') + '</p><div class=\"mtb\"><span class=\"badge\">' + SHLD + 'Admin checked</span></div>", 1)
cp.write_text(c)
print("Done: Market now has the escrow trust strip and trust details on cards and item view.")
