#!/bin/bash
set -e
[ -f wrangler.toml ] && [ -f frontend/app/index.html ] && [ -f frontend/app/cc-proto-fix.css ] || { echo "Run this inside the comradeconnect folder."; exit 1; }

python3 - <<'CC_PY_2'
def sub(path, old, new, mark):
    s = open(path, encoding='utf-8').read()
    if mark in s:
        print('skip   ', path, '(already done)'); return
    assert old in s, 'anchor missing in ' + path + ': ' + old[:70]
    open(path, 'w', encoding='utf-8').write(s.replace(old, new, 1)); print('patched', path)

A = 'frontend/app/index.html'

sub(A, "'Dedan Kimathi University'];",
    "'Dedan Kimathi University'];\n"
    "const UDOM={'Kirinyaga University':['kyu.ac.ke','KyU'],'University of Nairobi':['uonbi.ac.ke','UoN'],'Kenyatta University':['ku.ac.ke','KU'],'Moi University':['mu.ac.ke','MU'],'Egerton University':['egerton.ac.ke','EU'],'Embu University':['embuni.ac.ke','EmU'],'Mount Kenya University':['mku.ac.ke','MKU'],'Jomo Kenyatta University (JKUAT)':['jkuat.ac.ke','JKU'],'Maseno University':['maseno.ac.ke','MSU'],'Strathmore University':['strathmore.edu','SU'],'Technical University of Kenya':['tukenya.ac.ke','TUK'],'Dedan Kimathi University':['dkut.ac.ke','DeK']};\n"
    "const ulogo=u=>{const d=UDOM[u]||['',(u.match(/[A-Z]/g)||['U']).slice(0,3).join('')];return '<span class=\"ulg\"><i>'+esc(d[1])+'</i>'+(d[0]?'<img alt=\"\" loading=\"lazy\" referrerpolicy=\"no-referrer\" src=\"https://www.google.com/s2/favicons?domain='+d[0]+'&sz=128\" onload=\"if(this.naturalWidth<32)this.remove()\" onerror=\"this.remove()\">':'')+'</span>'};",
    'const UDOM=')

sub(A, "data-u=\"${esc(u)}\"><span class=\"ri\">${ic('building')}</span>",
       "data-u=\"${esc(u)}\">${ulogo(u)}", 'data-u="${esc(u)}">${ulogo(u)}')

sub(A, 'cc-proto-fix.css?v=1"', 'cc-proto-fix.css?v=2"', 'cc-proto-fix.css?v=2')

css = 'frontend/app/cc-proto-fix.css'
s = open(css, encoding='utf-8').read()
if 'cc-campus-logos' in s:
    print('skip   ', css, '(already done)')
else:
    s += ("\n/* cc-campus-logos: each university shows its own logo in the campus picker; the short name sits behind it in case the logo cannot load */\n"
          ".ulg{position:relative;width:42px;height:42px;border-radius:14px;background:#fff;display:grid;place-items:center;flex:none;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(22,19,15,.08)}\n"
          ".ulg i{font:800 12px/1 Manrope,system-ui,sans-serif;font-style:normal;color:#16130f;letter-spacing:-.02em}\n"
          ".ulg img{position:absolute;inset:0;width:100%;height:100%;padding:6px;box-sizing:border-box;object-fit:contain;background:#fff}\n")
    open(css, 'w', encoding='utf-8').write(s); print('patched', css)
CC_PY_2

cat > tests/campus-logos.test.mjs <<'CC_EOF_2'
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync('frontend/app/index.html', 'utf8');

test('every university in the picker has a logo entry, and the row uses it', () => {
  const unis = vm.runInNewContext(app.match(/const UNIS=(\[.*?\]);/)[1]);
  const dom = vm.runInNewContext('(' + app.match(/const UDOM=(\{.*?\});\n/)[1] + ')');
  for (const u of unis) assert.ok(dom[u] && dom[u][0] && dom[u][1], 'no logo entry for ' + u);
  assert.ok(app.includes('data-u="${esc(u)}">${ulogo(u)}'), 'the row still draws the plain building icon');
  assert.ok(!/data-u="\$\{esc\(u\)\}"><span class="ri">\$\{ic\('building'\)\}/.test(app));
});

test('a logo that cannot load, or is only the tiny default icon, is removed so the short name shows', () => {
  assert.ok(app.includes('onload="if(this.naturalWidth<32)this.remove()"'));
  assert.ok(app.includes('onerror="this.remove()"'));
});
CC_EOF_2
echo "Part 2 done."
