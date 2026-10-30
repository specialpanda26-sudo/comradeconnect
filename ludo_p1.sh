#!/data/data/com.termux/files/usr/bin/bash
# Comrade Connect Ludo - PHASE 1: brand header + site theme (offline page)
set -e
if [ -d "comradeconnect-main" ]; then cd comradeconnect-main; elif [ -d "comradeconnect" ]; then cd comradeconnect; fi
[ -d frontend ] || { echo "Run this inside your comradeconnect folder"; exit 1; }

cat > frontend/ludo-skin.css <<'EOF'
/* ludo-skin.css: the Comrade Connect look for the Ludo pages.
   Loaded AFTER each page's own <style>, so these values win. Colours match the site (cc-redesign.css):
   dark #17130f / light #fbf1ed, orange accent. The board box has its own palette (--lb-*), used from Phase 2. */
:root{
--bg:#17130f;--fg:#f6efe9;--mut:#b6aca2;--g:rgba(44,37,32,.86);--gb:rgba(255,255,255,.12);--line:rgba(255,255,255,.1);
--ink:#f6efe9;--inkfg:#17130f;--sh:0 10px 28px rgba(0,0,0,.4);
--cco:#ff8a3d;--cco2:#e8744f;--onacc:#1a0f08;
--die:#f6efe9;--pip:#16130f;
/* board palette (from the reference game) */
--lb-frame:#7b3306;--lb-blue:#97b0d6;--lb-blue-in:#8ca1bf;--lb-green:#00c950;--lb-green-in:#00a140;
--lb-red:#fb2c36;--lb-red-in:#c9232b;--lb-cream:#ecdca1;--lb-cream-in:#d1c595;--lb-cell:#fff;--lb-line:#676767;--lb-safe:#d4d4d4;
}
:root[data-theme="light"]{
--bg:#fbf1ed;--fg:#16130f;--mut:#6a625a;--g:rgba(255,255,255,.86);--gb:rgba(22,19,15,.12);--line:rgba(22,19,15,.09);
--ink:#16130f;--inkfg:#fff;--sh:0 10px 28px rgba(140,80,50,.14);--die:#fff;--pip:#16130f;
}
html{background:radial-gradient(130% 55% at 50% -8%,color-mix(in srgb,var(--cco) 17%,transparent),transparent 62%) fixed,var(--bg)}
body{background:none}

/* ---- brand header: logo + "Comrade Connect Ludo" ---- */
.lx-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 2px 12px;margin-bottom:6px;border-bottom:1px solid var(--line)}
.lx-brand{display:flex;align-items:center;gap:10px;min-width:0}
.lx-logo{flex:none;display:block;width:46px;aspect-ratio:440/324;background:linear-gradient(135deg,var(--cco),var(--cco2));
-webkit-mask:url(/cc-mark.png) center/contain no-repeat;mask:url(/cc-mark.png) center/contain no-repeat;
filter:drop-shadow(0 2px 8px color-mix(in srgb,var(--cco) 45%,transparent))}
.lx-name{font:800 14px/1.2 Unbounded,Poppins,system-ui,sans-serif;letter-spacing:-.2px;min-width:0}
.lx-name em{font-style:normal;color:var(--cco)}
.lx-chip{flex:none;display:flex;align-items:center;gap:6px;border:1px solid var(--gb);background:var(--g);border-radius:999px;padding:7px 12px;font:600 12px Poppins,sans-serif;color:var(--fg)}
.lx-chip i{width:8px;height:8px;border-radius:50%;background:var(--cco);box-shadow:0 0 8px var(--cco)}
.lx-chip small{color:var(--mut);font-size:11px;font-weight:600}

/* ---- site-style controls ---- */
h1{font-size:24px}
.card{box-shadow:var(--sh)}
.btn{background:linear-gradient(135deg,var(--cco),var(--cco2));color:var(--onacc);box-shadow:0 8px 22px color-mix(in srgb,var(--cco) 30%,transparent)}
.btn.sec{background:transparent;color:var(--fg);box-shadow:none}
.btn:disabled{box-shadow:none}
.tg button.on,.chips button.on{background:linear-gradient(135deg,var(--cco),var(--cco2));color:var(--onacc)}
.stk input:focus{border-color:var(--cco);box-shadow:0 0 0 3px color-mix(in srgb,var(--cco) 22%,transparent)}
.stk button.pm:active,.chips button:active{background:color-mix(in srgb,var(--cco) 20%,transparent)}
.sum div:last-child{border-color:color-mix(in srgb,var(--cco) 55%,transparent)}
.sum div:last-child b{color:var(--cco)}
.pl.turn{border-color:var(--cco);box-shadow:0 0 0 1px var(--cco),0 6px 18px color-mix(in srgb,var(--cco) 22%,transparent)}
.die.go::after{border-color:var(--cco)}
.pot b{color:var(--cco)}
#win .bx{box-shadow:0 20px 60px rgba(0,0,0,.45)}

@media (max-width:360px){.lx-logo{width:38px}.lx-name{font-size:12.5px}.lx-chip{padding:6px 10px}.lx-chip small{display:none}.seat{gap:9px}.seat .dot{width:18px;height:18px}.tg button{padding:7px 9px}}
EOF

python3 - <<'PYEOF'
import sys
p = 'frontend/ludo.html'
s = open(p, encoding='utf-8').read()
if 'ludo-skin.css' in s:
    print('Phase 1 already applied to ludo.html, skipping'); sys.exit(0)
def rep(old, new):
    global s
    if s.count(old) != 1:
        print('STOP: could not find a unique match for:\n' + old[:80]); sys.exit(1)
    s = s.replace(old, new)
rep('<title>Ludo | Comrade Connect</title>', '<title>Comrade Connect Ludo</title>')
rep('</style></head><body>', '</style><link rel="stylesheet" href="/ludo-skin.css"></head><body>\n'
    '<header class="lx-head"><div class="lx-brand"><i class="lx-logo" aria-hidden="true"></i>'
    '<div class="lx-name">Comrade Connect <em>Ludo</em></div></div>'
    '<div class="lx-chip" title="Practice points"><i></i><b id="balchip">0</b><small>pts</small></div></header>')
rep('<h1>Ludo</h1>', '<h1>Offline match</h1>')
rep("function drawSetup(){\n $('seats')", "function drawSetup(){\n $('balchip').textContent=bal.toLocaleString();\n $('seats')")
rep(" bal-=stake; ls.set('ludo_pts',bal);", " bal-=stake; ls.set('ludo_pts',bal);$('balchip').textContent=bal.toLocaleString();")
rep("if(humanWon){bal+=prize;ls.set('ludo_pts',bal)}", "if(humanWon){bal+=prize;ls.set('ludo_pts',bal);$('balchip').textContent=bal.toLocaleString()}")
open(p, 'w', encoding='utf-8').write(s)
print('ludo.html patched')
PYEOF

git add frontend/ludo-skin.css frontend/ludo.html
git commit -m "Ludo phase 1: Comrade Connect Ludo header, logo and site theme (offline page)"
git push origin main
echo "Phase 1 pushed."
