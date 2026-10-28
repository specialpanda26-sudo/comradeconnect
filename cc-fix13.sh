#!/bin/bash
set -e
[ -f wrangler.toml ] && [ -d frontend ] && [ -d backend/src ] || { echo "Run this inside the comradeconnect folder."; exit 1; }

cat > frontend/cc-touchfix.js <<'CC_EOF_JS'
/* cc-touchfix.js: on phones, a tapped button must go back to normal when you let go.
   1) A phone keeps ":hover" on the last thing you touched until you touch somewhere else, so every hover style stays stuck.
      On touch-only screens the hover parts of the style rules are removed.
   2) A tapped button can keep focus, so its focus ring stays. The button is let go (blurred) shortly after the tap.
   Mouse and keyboard users on computers are not affected. */
(function () {
  'use strict';
  if (window.__ccTouchFix) return; window.__ccTouchFix = 1;
  var touchOnly = false;
  try { touchOnly = matchMedia('(hover: none)').matches; } catch (e) { /* old browser: do nothing */ }
  if (!touchOnly) return;

  function topSplit(sel) {
    var out = [], depth = 0, cur = '';
    for (var i = 0; i < sel.length; i++) {
      var ch = sel[i];
      if (ch === '(' || ch === '[') depth++; else if (ch === ')' || ch === ']') depth--;
      if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out;
  }
  function clean(rules) {
    for (var i = rules.length - 1; i >= 0; i--) {
      var r = rules[i];
      try {
        if (r.type === 1 && r.selectorText && r.selectorText.indexOf(':hover') > -1) {
          var keep = topSplit(r.selectorText).filter(function (s) { return s.indexOf(':hover') < 0; });
          if (keep.length) r.selectorText = keep.join(','); else r.parentRule ? r.parentRule.deleteRule(i) : r.parentStyleSheet.deleteRule(i);
        } else if (r.cssRules && r.cssRules.length) clean(r.cssRules);
      } catch (e) { /* a rule that cannot be changed is left alone */ }
    }
  }
  var done = new WeakSet();
  function sweep() {
    for (var i = 0; i < document.styleSheets.length; i++) {
      var sh = document.styleSheets[i];
      if (done.has(sh)) continue;
      try { var rules = sh.cssRules; if (!rules) continue; done.add(sh); clean(rules); } catch (e) { /* another site's sheet: skip */ }
    }
  }
  sweep();
  document.addEventListener('DOMContentLoaded', sweep);
  window.addEventListener('load', function () { sweep(); setTimeout(sweep, 1500); });
  new MutationObserver(function () { sweep(); setTimeout(sweep, 300); }).observe(document.head || document.documentElement, { childList: true, subtree: true });

  var BTN = 'button,.btn,.ib,.act,.tab,.chip,.pill,.crd-tile,[role="button"],a';
  document.addEventListener('pointerup', function (e) {
    if (e.pointerType === 'mouse') return;
    var t = e.target && e.target.closest && e.target.closest(BTN);
    if (!t) return;
    setTimeout(function () { if (document.activeElement === t && !/^(input|textarea|select)$/i.test(t.tagName)) t.blur(); }, 350);
  }, true);

  var st = document.createElement('style');
  st.textContent = '@media (hover:none){html body :is(button,.btn,.ib,.act,.tab,.chip,.pill,.crd-tile,#tb button,[role="button"],a):is(:focus,:focus-visible){outline:0!important}}';
  (document.head || document.documentElement).appendChild(st);
})();
CC_EOF_JS

python3 - <<'CC_EOF_PY'
def sub(path, old, new, mark):
    s = open(path, encoding='utf-8').read()
    if mark in s: print('skip   ', path, '(already done)'); return
    assert old in s, 'anchor missing in ' + path + ': ' + old[:70]
    open(path, 'w', encoding='utf-8').write(s.replace(old, new, 1)); print('patched', path)

sub('frontend/index.html', '<script src="cc-core.js?v=16"></script>', '<script src="cc-core.js?v=16"></script><script src="cc-touchfix.js?v=1"></script>', 'cc-touchfix.js')

sub('frontend/index.html',
    "const BOT=ST.get('cs_bot',null)||{on:true,role:'moderator',hu:true},svb=()=>ST.set('cs_bot',BOT);",
    "const BOT=ST.get('cs_bot',null)||{on:true,role:'moderator',hu:true},svb=()=>{BOT.on=true;ST.set('cs_bot',BOT)};BOT.on=true;/* cc-fix13: Spill Bot is always on */", 'cc-fix13: Spill Bot')
sub('frontend/index.html', "$('#bon').checked=BOT.on;", "BOT.on=true;$('#bon').checked=true;$('#bon').disabled=true;", "$('#bon').disabled=true;")
sub('frontend/index.html', "$('#bon').onchange=e=>{BOT.on=e.target.checked;svb();drawBot()};", "$('#bon').onchange=e=>{BOT.on=true;e.target.checked=true;svb();drawBot()};", "BOT.on=true;e.target.checked=true")

s = open('backend/src/moderation.js', encoding='utf-8').read()
if 'spillBotBlock' not in s:
    s += """
// cc-fix13: the Spill Bot rules on the server too, so nobody can switch the bot off by editing the page. Same rules as the app.
export function spillBotBlock(text = '') {
  const s = String(text).toLowerCase();
  if (/\\b(gun|pistol|bhang|weed|bangi|cocaine|vodka|whisky|whiskey|beer|chang'?aa|exam ?papers?|leaked|stolen|fake id)\\b/.test(s)) return 'Spill Bot: this item type is not allowed on Comrade Connect.';
  if (/(pay|send|tuma).{0,20}(first|deposit|fare|before)|pay (me )?(direct|outside|cash only)|outside (the )?(app|site)/.test(s)) return 'Spill Bot: payments go through Comrade Connect escrow only. Remove any ask to pay first or pay outside.';
  return null;
}
"""
    open('backend/src/moderation.js', 'w', encoding='utf-8').write(s); print('patched backend/src/moderation.js')
else: print('skip    backend/src/moderation.js (already done)')
sub('backend/src/market.js',
    "    const blk = contactBlock(env, title, description, zone, condition); if (blk) return blk;\n    if (!isWholesaler(u)",
    "    const blk = contactBlock(env, title, description, zone, condition); if (blk) return blk;\n    const botNo = spillBotBlock(title + ' ' + description); if (botNo) return err(env, botNo, 422);   // cc-fix13\n    if (!isWholesaler(u)", 'spillBotBlock(title')
sub('backend/src/market.js', "import { badgeKind } from './lib.js';", "import { badgeKind } from './lib.js';\nimport { spillBotBlock } from './moderation.js';", 'spillBotBlock }')
CC_EOF_PY

git add -A
git commit -m "Buttons go back to normal after a tap on phones; Spill Bot always on (app and server)"
git push origin main
