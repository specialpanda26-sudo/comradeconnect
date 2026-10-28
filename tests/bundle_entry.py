import importlib.util, os, re, sys, tempfile, shutil
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('bundle', ROOT / 'android-wrapper' / 'bundle.py')
b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
fails = []
def check(n, c, x=''):
    print(('PASS ' if c else 'FAIL ') + n + ((' ' + str(x)) if (x and not c) else ''))
    if not c: fails.append(n)
def fake_get(url, binary=False):
    if 'fonts.googleapis.com' in url:
        return "@font-face{src:url(https://fonts.gstatic.com/s/x/%s.woff2)}" % (abs(hash(url)) % 9999)
    return b'FAKE' if binary else 'FAKE'
b.get = fake_get
tmp = Path(tempfile.mkdtemp()); b.OUT = tmp / 'www'; b.VENDOR = b.OUT / 'vendor'
os.environ.pop('APP_ENTRY', None); b.main()
idx = (b.OUT / 'index.html').read_text(encoding='utf-8'); app = (b.OUT / 'app' / 'index.html').read_text(encoding='utf-8')
check('APK starts on the new app', 'app/index.html' in idx and len(idx) < 1500)
check('old page kept as classic.html', (b.OUT / 'classic.html').exists())
check('new app loads nothing from the internet', not re.search(r'<link[^>]+href="https://fonts\.googleapis', app) and not re.search(r'<script[^>]+src="https://', app))
check('new app has cc-native.js and cc-push.js', '../cc-native.js' in app and 'cc-push.js' in app)
os.environ['APP_ENTRY'] = 'classic'; b.main()
check('APP_ENTRY=classic opens the old app', 'cc-native.js' in (b.OUT / 'index.html').read_text(encoding='utf-8'))
shutil.rmtree(tmp, ignore_errors=True)
print('%d failed' % len(fails)); sys.exit(1 if fails else 0)
