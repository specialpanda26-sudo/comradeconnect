from pathlib import Path

js = Path("frontend/cc-help.js"); s = js.read_text()
if "cc-glass-panel" in s:
    print("Already applied, nothing to do."); raise SystemExit(0)

a = s.find("'#cchp{position:fixed;left:50%")
endmark = "#cchp a.r{display:block;padding:12px 0;color:inherit;border-bottom:1px solid var(--line,rgba(255,255,255,.15))}';"
b = s.find(endmark)
c = s.find("function sheet(")
d = s.find("\nfunction showBell")
if min(a, b, c, d) < 0 or not (a < b < c < d):
    raise SystemExit("STOP: cc-help.js is not the version I expected. Nothing was changed.")

NEW_CSS = r"""'/* cc-glass-panel */' +
'#cchp{position:fixed;inset:0;z-index:960;display:grid;place-items:end center;background:rgba(0,0,0,.6);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);padding:16px;color:var(--fg,#fff)}' +
'#cchp .bx{width:min(520px,100%);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;border-radius:26px;padding:26px;background:#0b0b0b;animation:ccpop .4s cubic-bezier(.2,.9,.3,1.2)}' +
':root[data-theme="light"] #cchp .bx{background:#fff}' +
'@keyframes ccpop{from{opacity:0;transform:translateY(40px) scale(.96)}}' +
'#cchp .h{display:flex;justify-content:space-between;align-items:center;flex-shrink:0}#cchp .h h2{font-size:22px;font-weight:600;letter-spacing:-.02em;margin:0}' +
'#cchp .ht{display:flex;gap:6px;padding:14px 0 4px;flex-shrink:0}#cchp .ht button{all:unset;cursor:pointer;flex:1;text-align:center;padding:9px 8px;border-radius:14px;font-size:13px;color:var(--mut,#bdbdbd);background:var(--g,rgba(255,255,255,.07));border:1px solid var(--gb,rgba(255,255,255,.22))}#cchp .ht .on{background:var(--ink,#fff);color:var(--inkfg,#000);border-color:var(--ink,#fff);font-weight:600}' +
'#cchp .b{overflow:auto;flex:1;min-height:0;padding:6px 0 2px;font-size:14px;line-height:1.7;color:var(--mut,#bdbdbd)}' +
'#cchp .n{border:1px solid var(--gb,rgba(255,255,255,.22));background:var(--g,rgba(255,255,255,.07));border-radius:18px;padding:14px 16px;margin:10px 0;font-size:13px}#cchp .n b{display:block;color:var(--fg,#fff);font-weight:600;font-size:14px}#cchp .n a{color:var(--fg,#fff)}' +
'#cchp .m{margin:8px 0;padding:10px 14px;border-radius:18px;max-width:88%;white-space:pre-wrap;word-wrap:break-word;color:var(--fg,#fff);background:var(--g,rgba(255,255,255,.07));border:1px solid var(--gb,rgba(255,255,255,.22))}#cchp .m.u{margin-left:auto;background:var(--ink,#fff);color:var(--inkfg,#000);border-color:var(--ink,#fff)}' +
'#cchp .f{display:flex;gap:8px;padding-top:14px;flex-shrink:0}#cchp .f input{flex:1;min-width:0;font:inherit;font-size:16px;padding:11px 16px;border-radius:999px;border:1px solid var(--gb,rgba(255,255,255,.22));background:var(--g,rgba(255,255,255,.07));color:var(--fg,#fff)}' +
'#cchp .f button{all:unset;cursor:pointer;padding:0 20px;border-radius:999px;font-weight:600;background:var(--ink,#fff);color:var(--inkfg,#000);display:grid;place-items:center}' +
'#cchp details{border-bottom:1px solid var(--line,rgba(255,255,255,.14));padding:12px 0}#cchp summary{cursor:pointer;font-weight:600;color:var(--fg,#fff)}#cchp details p{margin:6px 0 0}' +
'#cchp a.r{display:block;padding:14px 0;color:var(--fg,#fff);text-decoration:none;border-bottom:1px solid var(--line,rgba(255,255,255,.14))}';"""

NEW_SHEET = r"""function sheet(title, tabs, on) {
  close();
  var o = el('div'); o.id = 'cchp'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', title);
  o.onclick = function (e) { if (e.target === o) close(); };
  var p = el('div', 'bx g');
  var h = el('div', 'h'); h.appendChild(el('h2', '', title));
  var x = el('button', 'ib'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
  x.innerHTML = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  x.onclick = close; h.appendChild(x); p.appendChild(h);
  var body = el('div', 'b');
  if (tabs) {
    var t = el('div', 'ht');
    tabs.forEach(function (n, i) { var b = el('button', i === on ? 'on' : '', n); b.type = 'button'; b.onclick = function () { bots(i); }; t.appendChild(b); });
    p.appendChild(t);
  }
  p.appendChild(body); o.appendChild(p); document.body.appendChild(o); open = o; return { p: p, body: body };
}
"""

s = s[:a] + NEW_CSS + s[b + len(endmark):c] + NEW_SHEET + s[d:]
js.write_text(s)

h = Path("frontend/index.html"); t = h.read_text()
t = t.replace("cc-help.js?v=3", "cc-help.js?v=4", 1); h.write_text(t)
print("Done: Notifications and Support now open like the Safety panel.")
