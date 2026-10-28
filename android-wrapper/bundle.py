"""Builds android-wrapper/www from ../frontend so the app carries the whole website inside it (works with no internet).
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
    shutil.copytree(SRC, OUT, ignore=shutil.ignore_patterns('bg-4k.mp4'))
    VENDOR.mkdir(parents=True, exist_ok=True)
    fontn = [0]
    cssn = [0]

    def vendor(page, up):
        """Keeps one html page working offline. up = '' for the root page, '../' for app/index.html."""
        html = page.read_text(encoding='utf-8')
        for url in sorted(set(re.findall(r'<script[^>]+src="(https://[^"]+)"', html))):
            name = re.sub(r'[^A-Za-z0-9._-]', '_', urlparse(url).path.strip('/').replace('/', '_')) or 'lib'
            if not name.endswith('.js'):
                name += '.js'
            if not (VENDOR / name).exists():
                (VENDOR / name).write_bytes(get(url, binary=True))
            html = html.replace(url, up + 'vendor/' + name)
            print('library ', url, '->', up + 'vendor/' + name)
        fonts = VENDOR / 'fonts'
        fonts.mkdir(parents=True, exist_ok=True)
        for m in re.finditer(r'<link[^>]+href="(https://fonts\.googleapis\.com/css2[^"]+)"[^>]*>', html):
            link = m.group(1)
            css_url = link.replace('&amp;', '&')
            css = get(css_url)
            for f in sorted(set(re.findall(r'url\((https://fonts\.gstatic\.com/[^)]+)\)', css))):
                fontn[0] += 1
                fn = 'f%02d.woff2' % fontn[0]
                (fonts / fn).write_bytes(get(f, binary=True))
                css = css.replace(f, 'fonts/' + fn)
            cssn[0] += 1
            cssname = 'fonts%d.css' % cssn[0]
            (VENDOR / cssname).write_text(css, encoding='utf-8')
            html = html.replace(link, up + 'vendor/' + cssname)
            print('fonts   ', css_url[:60], '->', up + 'vendor/' + cssname)
        html = re.sub(r'<link[^>]+rel="preconnect"[^>]*>', '', html)
        page.write_text(html, encoding='utf-8')
        return html

    # the Wi-Fi map library (Leaflet): keep it inside the app too
    lf = VENDOR / 'leaflet'
    lf.mkdir(exist_ok=True)
    LB = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/'
    for fn in ('leaflet.min.js', 'leaflet.min.css'):
        (lf / fn).write_bytes(get(LB + fn, binary=True))
    ww = OUT / 'cc-wifi.js'
    if ww.exists():
        t = ww.read_text(encoding='utf-8')
        ww.write_text(t.replace("var LEAF = '" + LB + "'", "var LEAF = 'vendor/leaflet/'"), encoding='utf-8')
        print('leaflet  -> vendor/leaflet/')

    html = vendor(OUT / 'index.html', '')
    if (OUT / 'app' / 'index.html').exists():
        vendor(OUT / 'app' / 'index.html', '../')

    # APP_ENTRY: which app opens when the Android app starts. empty or new = the new app, classic = the old one.
    entry = (os.environ.get('APP_ENTRY') or 'classic').strip().lower()
    if entry == 'new' and (OUT / 'app' / 'index.html').exists():
        (OUT / 'index.html').rename(OUT / 'classic.html')
        (OUT / 'index.html').write_text(
            '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<meta name="theme-color" content="#000000"><title>Comrade Connect</title>'
            '<style>html,body{margin:0;height:100%;background:#000}</style>'
            '<script>location.replace("app/index.html"+location.search+location.hash)</script></head>'
            '<body><noscript><a href="app/index.html" style="color:#fff">Open Comrade Connect</a></noscript></body></html>', encoding='utf-8')
        print('entry    -> new app (app/index.html); the old page is kept as classic.html')
    else:
        print('entry    -> full app (index.html)')

    # the scrolling background video: 1080p only
    sb = OUT / 'cc-scrollbg.js'
    if sb.exists():
        s = sb.read_text(encoding='utf-8')
        sb.write_text(s.replace("'media/bg-4k.mp4?v=1'", "'media/bg-1080.mp4?v=1'"), encoding='utf-8')

    # service worker: new build = old saved screens are replaced
    sw = OUT / 'sw.js'
    if sw.exists():
        build = os.environ.get('VERSION_NAME') or str(int(time.time()))
        s = sw.read_text(encoding='utf-8').replace("const BUILD = 'dev';", "const BUILD = '" + build + "';")
        s = re.sub(r"const CDN = \[[^\]]*\];", "const CDN = [];", s)
        sw.write_text(s, encoding='utf-8')

    left = sorted(set(re.findall(r'(?:src|href)="(https://[^"]+)"', html)))
    print('www ready. Links still pointing online (fine, they are normal links):', len(left))


if __name__ == '__main__':
    main()
