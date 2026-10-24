from pathlib import Path

js = Path("frontend/cc-help.js")
s = js.read_text()

if "cc-bell-topbar" in s:
    print("Already applied, nothing to do.")
    raise SystemExit(0)

css_old = "document.head.appendChild(st);"
css_new = (
    "st.textContent +=\n"
    "'/* cc-bell-topbar */' +\n"
    "'.ib.ccb{position:relative;flex-shrink:0}' +\n"
    "'.ib.ccb svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +\n"
    "'.ib.ccb.on{background:var(--ink,#fff);color:var(--inkfg,#000)}' +\n"
    "'.ib.ccb i{position:absolute;top:7px;right:8px;width:9px;height:9px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 2px var(--bg,#000)}';\n"
    "document.head.appendChild(st);"
)
if css_old not in s:
    raise SystemExit("STOP: style anchor not found in cc-help.js. Nothing changed.")
s = s.replace(css_old, css_new, 1)

boot_old = "document.body.appendChild(box); dot(); load();"
boot_new = (
    "var lay = document.getElementById('lay'), bar = lay && lay.parentNode;\n"
    "  if (bar) { bell.className = 'ib ccb'; bar.insertBefore(bell, lay); }\n"
    "  else document.body.appendChild(box);\n"
    "  dot(); load();"
)
if boot_old not in s:
    raise SystemExit("STOP: boot anchor not found in cc-help.js. Nothing changed.")
s = s.replace(boot_old, boot_new, 1)
js.write_text(s)

html = Path("frontend/index.html")
h = html.read_text()
h = h.replace("cc-help.js?v=2", "cc-help.js?v=3", 1)
html.write_text(h)
print("Done: bell moved into the top bar.")
