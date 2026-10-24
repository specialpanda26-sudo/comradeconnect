from pathlib import Path

# Remove the full-screen black startup loader.
p = Path("frontend/index.html")
s = p.read_text()

if "#loader{display:none!important}" not in s:
    s = s.replace(
        "</style>",
        "\n/* Fix: do not cover the page with the startup loader. */\n"
        "#loader{display:none!important;visibility:hidden!important;pointer-events:none!important}\n"
        "</style>",
        1
    )
    p.write_text(s)
    print("Disabled the full-screen startup overlay.")
else:
    print("Startup overlay fix already exists.")

# Move the notification bell into the existing top toolbar.
p = Path("frontend/cc-help.js")
s = p.read_text()

old = "document.body.appendChild(box); dot(); load();"
new = """var toolbar = document.querySelector('nav.g .flex.items-center');
  if (toolbar) {
    bell.id = 'cc-notifications';
    bell.className = 'ib';
    bell.style.cssText = 'position:relative;right:auto;bottom:auto;width:36px;height:36px;box-shadow:none;border:0;border-radius:12px;background:transparent;display:grid;place-items:center;flex-shrink:0';
    bell.querySelector('svg').style.cssText = 'width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round';
    var layoutButton = toolbar.querySelector('#lay');
    toolbar.insertBefore(bell, layoutButton || null);
  } else {
    document.body.appendChild(box);
  }
  dot(); load();"""

if old not in s:
    raise SystemExit(
        "STOP: Could not find the expected notification initialization. "
        "No notification changes were made."
    )

s = s.replace(old, new, 1)
p.write_text(s)
print("Moved the notification bell into the top toolbar.")
