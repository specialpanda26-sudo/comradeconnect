"""Runs after `npx cap add android`. Safe to run twice.
 - adds the permissions the app needs (camera, microphone, location, notifications)
 - turns off Android cloud backup of app data
 - sets the version (VERSION_CODE and VERSION_NAME from the environment)
 - makes the launcher icons and the start-up screen from the website's logo (mark only: the words under it are too small to read)"""
import os, re, shutil, sys
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
APP = HERE / 'android' / 'app'
MAIN = APP / 'src' / 'main'
RES = MAIN / 'res'
LOGO = HERE.parent / 'frontend' / 'cc-mark.png'
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
    im = Image.open(LOGO).convert('RGBA')
    al = im.getchannel('A')
    box = al.point(lambda v: 255 if v > 8 else 0).getbbox()
    if not box: sys.exit('STOP: no logo found')
    m = al.crop(box)
    w = Image.new('RGBA', m.size, (255, 255, 255, 255)); w.putalpha(m)
    return w


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
        put(px, 0.70).save(folder / 'ic_launcher.png')
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


PKG = 'ke.co.comradeconnect.app'
KOTLIN_VERSION = '1.9.25'          # works with the Android Gradle Plugin that Capacitor 6 generates (8.2.x)
CREDENTIALS_VERSION = '1.3.0'      # androidx.credentials + credentials-play-services-auth (needs compileSdk 34, which Capacitor 6 uses)
GOOGLEID_VERSION = '1.1.1'         # com.google.android.libraries.identity.googleid


def patch_google_signin():
    """Native "Choose an account" bottom sheet (Android Credential Manager).
    Adds Kotlin + the credentials libraries, copies the plugin from android-wrapper/native/ and registers it in MainActivity."""
    # 1) Kotlin plugin for the whole project (android/build.gradle)
    root = HERE / 'android' / 'build.gradle'
    s = root.read_text(encoding='utf-8')
    if 'kotlin-gradle-plugin' not in s:
        s, n = re.subn(r"(classpath\s+['\"]com\.android\.tools\.build:gradle:[^'\"]+['\"])",
                       r"\1\n        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:" + KOTLIN_VERSION + "'", s, count=1)
        if not n: sys.exit('STOP: could not find the Android Gradle Plugin line in android/build.gradle')
        root.write_text(s, encoding='utf-8')

    # 2) The app module: apply Kotlin, set its JVM target, add the libraries
    g = APP / 'build.gradle'
    s = g.read_text(encoding='utf-8')
    if 'androidx.credentials:credentials:' not in s:
        if "apply plugin: 'kotlin-android'" not in s:
            s, n = re.subn(r"(apply plugin: 'com\.android\.application')", r"\1\napply plugin: 'kotlin-android'", s, count=1)
            if not n: sys.exit("STOP: no \"apply plugin: 'com.android.application'\" line in app/build.gradle")
        s += ("\n// Native Google account picker (Credential Manager)\n"
              "android { kotlinOptions { jvmTarget = '17' } }\n"
              "dependencies {\n"
              "    implementation \"androidx.credentials:credentials:" + CREDENTIALS_VERSION + "\"\n"
              "    implementation \"androidx.credentials:credentials-play-services-auth:" + CREDENTIALS_VERSION + "\"\n"
              "    implementation \"com.google.android.libraries.identity.googleid:googleid:" + GOOGLEID_VERSION + "\"\n"
              "    implementation \"org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1\"\n"
              "}\n")
        g.write_text(s, encoding='utf-8')

    # 3) Copy the plugin and MainActivity into the generated project (the generated MainActivity.java is replaced)
    src = HERE / 'native'
    pkgdir = MAIN / 'java' / Path(*PKG.split('.'))
    pkgdir.mkdir(parents=True, exist_ok=True)
    for old in pkgdir.glob('MainActivity.*'):
        old.unlink()
    shutil.copy(src / 'MainActivity.java', pkgdir / 'MainActivity.java')
    shutil.copy(src / 'GoogleSignInPlugin.kt', pkgdir / 'GoogleSignInPlugin.kt')
    print('native Google sign-in ready')


def patch_firebase():
    """Phone notifications (Firebase Cloud Messaging). Only switched on when google-services.json was added to the build."""
    gs = APP / 'google-services.json'
    if not gs.exists():
        print('no google-services.json: building without phone notifications'); return
    root = HERE / 'android' / 'build.gradle'; s = root.read_text(encoding='utf-8')
    if 'com.google.gms:google-services' not in s:
        s, n = re.subn(r"(classpath\s+['\"]com\.android\.tools\.build:gradle:[^'\"]+['\"])", r"\1\n        classpath 'com.google.gms:google-services:4.4.2'", s, count=1)
        if not n: sys.exit('STOP: could not add the Google services plugin to android/build.gradle')
        root.write_text(s, encoding='utf-8')
    g = APP / 'build.gradle'; s = g.read_text(encoding='utf-8')
    if 'com.google.gms.google-services' not in s:
        g.write_text(s + "\napply plugin: 'com.google.gms.google-services'\n", encoding='utf-8')
    print('Firebase ready')
def patch_notif_icon():
    """Small white logo for the phone's notification bar, and the default channel id for Firebase messages."""
    for d, px in {'mdpi': 24, 'hdpi': 36, 'xhdpi': 48, 'xxhdpi': 72, 'xxxhdpi': 96}.items():
        folder = RES / ('drawable-' + d); folder.mkdir(parents=True, exist_ok=True)
        put(px, 0.8, transparent=True).save(folder / 'ic_stat_cc.png')
    p = MAIN / 'AndroidManifest.xml'
    s = p.read_text(encoding='utf-8')
    if 'default_notification_icon' not in s:
        meta = ('        <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_cc" />\n'
                '        <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="cc_alerts" />\n')
        if '</application>' not in s: sys.exit('STOP: AndroidManifest.xml has no </application>')
        p.write_text(s.replace('</application>', meta + '    </application>', 1), encoding='utf-8')
    print('notification icon ready')



# cc-fix7
def patch_notif_native():
    """WhatsApp-style phone notifications. Copies the native Java files, and (only when Firebase is on) registers
    our messaging service in the manifest, ahead of the Capacitor one, and adds the Firebase messaging library."""
    src = HERE / 'native'
    pkgdir = MAIN / 'java' / Path(*PKG.split('.'))
    pkgdir.mkdir(parents=True, exist_ok=True)
    for f in ('CCNotifier.java', 'CCNotifPlugin.java'):
        shutil.copy(src / f, pkgdir / f)
    gs = APP / 'google-services.json'
    if not gs.exists():
        print('no google-services.json: notification service not added'); return
    shutil.copy(src / 'CCMessagingService.java', pkgdir / 'CCMessagingService.java')
    g = APP / 'build.gradle'; s = g.read_text(encoding='utf-8')
    if 'cc-fix7-firebase' not in s:
        g.write_text(s + "\n// cc-fix7-firebase: the notification service needs the Firebase messaging classes directly\n"
                         "dependencies {\n    implementation platform('com.google.firebase:firebase-bom:33.1.2')\n    implementation 'com.google.firebase:firebase-messaging'\n}\n", encoding='utf-8')
    p = MAIN / 'AndroidManifest.xml'; s = p.read_text(encoding='utf-8')
    if 'CCMessagingService' not in s:
        if 'xmlns:tools=' not in s:
            if '<manifest' not in s: sys.exit('STOP: AndroidManifest.xml has no <manifest')
            s = s.replace('<manifest', '<manifest xmlns:tools="http://schemas.android.com/tools"', 1)
        svc = ('        <service android:name=".CCMessagingService" android:exported="false">\n'
               '            <intent-filter android:priority="100">\n                <action android:name="com.google.firebase.MESSAGING_EVENT" />\n            </intent-filter>\n        </service>\n'
               '        <service android:name="com.capacitorjs.plugins.pushnotifications.MessagingService" tools:node="remove" />\n')
        if '</application>' not in s: sys.exit('STOP: AndroidManifest.xml has no </application>')
        s = s.replace('</application>', svc + '    </application>', 1)
        p.write_text(s, encoding='utf-8')
    print('notification service ready')


if not (MAIN / 'AndroidManifest.xml').exists():
    sys.exit('STOP: run `npx cap add android` first (no android/ folder found)')
patch_manifest(); patch_deeplink(); patch_version(); patch_google_signin(); patch_firebase(); patch_notif_icon(); patch_notif_native(); icons()
