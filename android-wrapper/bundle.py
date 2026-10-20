"""Builds android-wrapper/www from ../frontend so the app carries the whole website inside it (works with no internet).
 - copies the site (leaves out the 17 MB 4K video; the app uses the 1080p one)
 - downloads the libraries and fonts the site normally loads from the internet and points the pages at the local copies
 - stamps the service worker with this build
Runs in GitHub Actions (needs internet there). Safe to run again."""
import os, re, shutil, sys, time, urllib.request
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / 'frontend'
OUT = HERE / 'www'
VENDOR = OUT / 'vendor'
UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'


def get(url, binary=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for i in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                d = r.read()
                return d if binary else d.decode('utf-8')
        except Exception as e:
            if i == 2:
                sys.exit('STOP: could not download ' + url + ' (' + str(e) + ')')
            time.sleep(2)


def main():
    if not (SRC / 'index.html').exists():
        sys.exit('STOP: no frontend/index.html')
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(SRC, OUT, ignore=shutil.ignore_patterns('bg-4k.mp4', 'admin*.html', 'admin-*.js'))
    VENDOR.mkdir(parents=True, exist_ok=True)

    idx = OUT / 'index.html'
    html = idx.read_text(encoding='utf-8')

    # 1) script libraries (Tailwind, jsPDF)
    for url in sorted(set(re.findall(r'<script[^>]+src="(https://[^"]+)"', html))):
        name = re.sub(r'[^A-Za-z0-9._-]', '_', urlparse(url).path.strip('/').replace('/', '_')) or 'lib'
        if not name.endswith('.js'):
            name += '.js'
        (VENDOR / name).write_bytes(get(url, binary=True))
        html = html.replace(url, 'vendor/' + name)
        print('library ', url, '->', 'vendor/' + name)

    # 2) Google Fonts: the stylesheet and the font files
    fonts = VENDOR / 'fonts'
    fonts.mkdir(exist_ok=True)
    m = re.search(r'<link[^>]+href="(https://fonts\.googleapis\.com/css2[^"]+)"[^>]*>', html)
    if m:
        css_url = m.group(1).replace('&amp;', '&')
        css = get(css_url)
        n = 0
        for f in sorted(set(re.findall(r'url\((https://fonts\.gstatic\.com/[^)]+)\)', css))):
            n += 1
            fn = 'f%02d.woff2' % n
            (fonts / fn).write_bytes(get(f, binary=True))
            css = css.replace(f, 'fonts/' + fn)
        (VENDOR / 'fonts.css').write_text(css, encoding='utf-8')
        html = html.replace(m.group(1), 'vendor/fonts.css')
        print('fonts   ', n, 'files')
    html = re.sub(r'<link[^>]+rel="preconnect"[^>]*>', '', html)
    idx.write_text(html, encoding='utf-8')

    # 3) the scrolling background video: 1080p only
    sb = OUT / 'cc-scrollbg.js'
    if sb.exists():
        s = sb.read_text(encoding='utf-8')
        sb.write_text(s.replace("'media/bg-4k.mp4?v=1'", "'media/bg-1080.mp4?v=1'"), encoding='utf-8')

    # 4) service worker: new build = old saved screens are replaced
    sw = OUT / 'sw.js'
    if sw.exists():
        build = os.environ.get('VERSION_NAME') or str(int(time.time()))
        s = sw.read_text(encoding='utf-8').replace("const BUILD = 'dev';", "const BUILD = '" + build + "';")
        s = re.sub(r"const CDN = \[[^\]]*\];", "const CDN = [];", s)       # libraries are already inside the app
        sw.write_text(s, encoding='utf-8')

    left = sorted(set(re.findall(r'(?:src|href)="(https://[^"]+)"', html)))
    print('www ready. Links still pointing online (fine, they are normal links):', len(left))


main()
