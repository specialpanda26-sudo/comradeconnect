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
