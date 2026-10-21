"""Runs after `npx cap add android`. Safe to run twice.
 - adds the permissions the app needs (camera, microphone, location, notifications)
 - turns off Android cloud backup of app data
 - sets the version (VERSION_CODE and VERSION_NAME from the environment)
 - makes the launcher icons and the start-up screen from the website's logo (mark only: the words under it are too small to read)"""
import os, re, sys
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
APP = HERE / 'android' / 'app'
MAIN = APP / 'src' / 'main'
RES = MAIN / 'res'
LOGO = HERE.parent / 'frontend' / 'icon-512.png'
BG = (0, 0, 0)

PERMS = ['INTERNET', 'ACCESS_NETWORK_STATE', 'CAMERA', 'RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS',
         'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS', 'VIBRATE', 'USE_BIOMETRIC', 'USE_FINGERPRINT']
FEATURES = ['android.hardware.camera', 'android.hardware.camera.autofocus', 'android.hardware.location.gps', 'android.hardware.microphone']


def patch_manifest():
    p = MAIN / 'AndroidManifest.xml'
    s = p.read_text(encoding='utf-8')
    add = ''
    for n in PERMS:
        if 'android.permission.' + n + '"' not in s:
            add += '    <uses-permission android:name="android.permission.' + n + '" />\n'
    for f in FEATURES:
        if '"' + f + '"' not in s:
            add += '    <uses-feature android:name="' + f + '" android:required="false" />\n'
    if add:
        if '</manifest>' not in s:
            sys.exit('STOP: AndroidManifest.xml has no </manifest>')
        s = s.replace('</manifest>', add + '</manifest>', 1)
    s = s.replace('android:allowBackup="true"', 'android:allowBackup="false"')
    p.write_text(s, encoding='utf-8')
    print('manifest ready')


def patch_version():
    code, name = os.environ.get('VERSION_CODE'), os.environ.get('VERSION_NAME')
    if not code and not name:
        return
    p = APP / 'build.gradle'
    s = p.read_text(encoding='utf-8')
    if code:
        s, n = re.subn(r'versionCode\s+\d+', 'versionCode ' + str(int(code)), s, count=1)
        if not n: sys.exit('STOP: no versionCode line in app/build.gradle')
    if name:
        s, n = re.subn(r'versionName\s+"[^"]*"', 'versionName "' + name + '"', s, count=1)
        if not n: sys.exit('STOP: no versionName line in app/build.gradle')
    p.write_text(s, encoding='utf-8')
    print('version', code, name)


def mark():
    """The logo without the words under it, cropped tight, on a transparent canvas."""
    im = Image.open(LOGO).convert('RGB')
    top = im.crop((0, 0, im.width, int(im.height * 0.66)))          # the words sit in the lower third
    mask = top.convert('L').point(lambda v: 255 if v > 40 else 0)
    box = mask.getbbox()
    if not box: sys.exit('STOP: could not find the logo in ' + str(LOGO))
    m = top.crop(box).convert('L')
    out = Image.new('RGBA', m.size, (255, 255, 255, 0))
    out.putalpha(m)                                                  # white mark, soft edges
    white = Image.new('RGBA', m.size, (255, 255, 255, 255)); white.putalpha(m)
    return white


def put(canvas_size, scale, circle=False, transparent=False):
    c = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0) if transparent else BG + (255,))
    m = mark(); w = int(canvas_size * scale); h = int(m.height * w / m.width)
    if h > canvas_size * scale:
        h = int(canvas_size * scale); w = int(m.width * h / m.height)
    m = m.resize((max(1, w), max(1, h)), Image.LANCZOS)
    c.alpha_composite(m, ((canvas_size - m.width) // 2, (canvas_size - m.height) // 2))
    if circle:
        mk = Image.new('L', (canvas_size, canvas_size), 0)
        ImageDraw.Draw(mk).ellipse((0, 0, canvas_size - 1, canvas_size - 1), fill=255)
        c.putalpha(mk)
    return c


def icons():
    legacy = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    for d, px in legacy.items():
        folder = RES / ('mipmap-' + d); folder.mkdir(parents=True, exist_ok=True)
        put(px, 0.62).save(folder / 'ic_launcher.png')
        put(px, 0.62, circle=True).save(folder / 'ic_launcher_round.png')
        put(int(px * 108 / 48), 0.46, transparent=True).save(folder / 'ic_launcher_foreground.png')   # inside the adaptive-icon safe zone
    any26 = RES / 'mipmap-anydpi-v26'; any26.mkdir(parents=True, exist_ok=True)
    xml = ('<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
           '    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n')
    (any26 / 'ic_launcher.xml').write_text(xml, encoding='utf-8')
    (any26 / 'ic_launcher_round.xml').write_text(xml, encoding='utf-8')
    vals = RES / 'values'; vals.mkdir(parents=True, exist_ok=True)
    (vals / 'ic_launcher_background.xml').write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#000000</color>\n</resources>\n', encoding='utf-8')
    n = 0
    for p in RES.rglob('splash.png'):                                # the start-up screen: black with the logo
        w, h = Image.open(p).size
        c = Image.new('RGBA', (w, h), BG + (255,)); m = mark(); mw = int(min(w, h) * 0.34); mh = int(m.height * mw / m.width)
        c.alpha_composite(m.resize((mw, mh), Image.LANCZOS), ((w - mw) // 2, (h - mh) // 2)); c.convert('RGB').save(p); n += 1
    print('icons ready,', n, 'start-up screens')


def patch_deeplink():
    p = MAIN / 'AndroidManifest.xml'
    s = p.read_text(encoding='utf-8')
    # Android 12+ refuses to install/launch an activity with an intent-filter unless android:exported is set
    if 'android:exported' not in s.split('<activity', 1)[-1].split('>', 1)[0]:
        s = s.replace('<activity', '<activity android:exported="true"', 1)
        p.write_text(s, encoding='utf-8')
    if 'android:host="auth"' in s:
        return
    f = ('        <intent-filter>\n            <action android:name="android.intent.action.VIEW" />\n'
         '            <category android:name="android.intent.category.DEFAULT" />\n'
         '            <category android:name="android.intent.category.BROWSABLE" />\n'
         '            <data android:scheme="ke.co.comradeconnect.app" android:host="auth" />\n        </intent-filter>\n')
    if '</activity>' not in s: sys.exit('STOP: AndroidManifest.xml has no </activity>')
    p.write_text(s.replace('</activity>', f + '    </activity>', 1), encoding='utf-8')
    print('sign-in return link ready')


if not (MAIN / 'AndroidManifest.xml').exists():
    sys.exit('STOP: run `npx cap add android` first (no android/ folder found)')
patch_manifest(); patch_deeplink(); patch_version(); icons()
