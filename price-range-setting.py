from pathlib import Path

def edit(path, pairs):
    p = Path(path); s = p.read_text()
    for old, new in pairs:
        if old not in s:
            raise SystemExit(f"STOP: anchor not found in {path}:\n  {old[:90]}\nNothing was written for this file.")
    for old, new in pairs:
        s = s.replace(old, new, 1)
    p.write_text(s)

if "listing_price_min" in Path("backend/src/settings.js").read_text():
    print("Already applied, nothing to do."); raise SystemExit(0)

edit("backend/src/settings.js", [
 ("  escrow_auto_release_days:",
  "  listing_price_min: { env: 'LISTING_PRICE_MIN', def: 1, min: 1, max: 250000, unit: 'KSh', label: 'Lowest item price', help: 'Cheapest price a seller can put on a Market item. 1 means any price.' },\n"
  "  listing_price_max: { env: 'LISTING_PRICE_MAX', def: 150000, min: 1, max: 250000, unit: 'KSh', label: 'Highest item price', help: 'Most a seller can ask for one Market item. M-Pesa allows at most 250,000 per payment.' },\n"
  "  escrow_auto_release_days:"),
 ("  withdraw_min: S.withdraw_min, withdraw_fee_percent",
  "  price_min: S.listing_price_min, price_max: S.listing_price_max,\n  withdraw_min: S.withdraw_min, withdraw_fee_percent"),
 ("  if (withdrawFee(next.withdraw_min, next) >= next.withdraw_min)",
  "  if (next.listing_price_min > next.listing_price_max) return { error: 'Lowest item price cannot be higher than the highest item price.' };\n"
  "  if (withdrawFee(next.withdraw_min, next) >= next.withdraw_min)"),
])

edit("backend/src/market.js", [
 ("const category = CATS.includes(b.category) ? b.category : 'General', price = int(b.price, 1, 150000);\n"
  "    if (title.length < 3 || !price) return err(env, 'Add a title and a price (KES 1 to 150,000)');",
  "const S = await getSettings(env), category = CATS.includes(b.category) ? b.category : 'General', price = int(b.price, S.listing_price_min, S.listing_price_max);\n"
  "    if (title.length < 3 || !price) return err(env, `Add a title and a price (KSh ${S.listing_price_min.toLocaleString('en-US')} to ${S.listing_price_max.toLocaleString('en-US')})`);"),
])

edit("backend/src/pay.js", [("amount > 150000", "amount > 250000")])

edit("frontend/cc-core.js", [
 ("const CFG = { min: 50, wfp: 0, wff: 0 };", "const CFG = { min: 50, wfp: 0, wff: 0, pmin: 1, pmax: 150000 };"),
 ("CFG.min = d.withdraw_min || 50;",
  "CFG.pmin = d.price_min || 1; CFG.pmax = d.price_max || 150000;\n"
  "    { const mp = document.getElementById('mpr'); if (mp) mp.placeholder = 'Price in KSh (' + CFG.pmin.toLocaleString('en-US') + ' to ' + CFG.pmax.toLocaleString('en-US') + ')'; }\n"
  "    CFG.min = d.withdraw_min || 50;"),
 ("if (!(p >= 100 && p <= 150000)) return toast('Enter a price between KSh 100 and KSh 150,000');",
  "if (!(p >= CFG.pmin && p <= CFG.pmax)) return toast('Enter a price between KSh ' + CFG.pmin.toLocaleString('en-US') + ' and KSh ' + CFG.pmax.toLocaleString('en-US'));"),
])
edit("frontend/cc-trust.js", [("n <= 150000", "n <= 250000")])
edit("frontend/index.html", [
 ('placeholder="Price in KSh (100 to 150,000)"', 'placeholder="Price in KSh"'),
 ("if(p&&p<300)r.push('Price looks unusually low');", ""),
 ("cc-core.js?v=7j", "cc-core.js?v=7k"),
])
print("Done: item price range is now an admin setting (default KSh 1 to 150,000).")
