"""Search suggestions test: real page in headless Chromium, no network. Run: python3 tests/browser_suggest.py"""
import os, sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
fails = []
def check(n, c, x=''):
    print(('PASS ' if c else 'FAIL ') + n + (' ' + str(x) if (x and not c) else ''))
    if not c: fails.append(n)
with sync_playwright() as p:
    b = p.chromium.launch(); page = b.new_context(viewport={'width': 390, 'height': 800}).new_page(); errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    def app(route, req):
        f = urlparse(req.url).path.lstrip('/') or 'index.html'; fp = os.path.join(ROOT, f)
        if not os.path.isfile(fp): return route.fulfill(status=404, body='')
        route.fulfill(status=200, body=open(fp, 'rb').read(), content_type='text/html' if f.endswith('.html') else 'application/javascript' if f.endswith('.js') else 'application/octet-stream')
    page.route('http://app.test/**', app)
    page.route(lambda u: not (u.startswith('http://app.test') or u.startswith('data:') or u.startswith('blob:')), lambda r, q: r.abort())
    page.goto('http://app.test/index.html'); page.wait_for_timeout(800)
    page.evaluate("localStorage.setItem('cs_cookie','\"essential\"')"); page.add_style_tag(content='#loader,#ck{display:none!important}')
    # Market box: inject listing titles through the same hook the page uses
    page.evaluate("window.ccMarketTerms=()=>['Study desk wooden','Casio fx-991 calculator','Mini fridge']")
    page.evaluate("document.querySelector('#tb [data-v=market]').click()"); page.wait_for_timeout(500)
    page.evaluate("document.getElementById('mkq').focus()"); page.keyboard.type('cas'); page.wait_for_timeout(200)
    sg = page.evaluate("[...document.querySelectorAll('#mkq')[0].closest('.fld').querySelectorAll('.ccsg button')].map(b=>b.textContent)")
    check('market suggests the matching title', 'Casio fx-991 calculator' in sg, sg)
    check('market does not suggest unrelated items', 'Mini fridge' not in sg, sg)
    page.evaluate("document.querySelector('#mkq').closest('.fld').querySelector('.ccsg button').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}))"); page.wait_for_timeout(200)
    check('tapping a suggestion fills the box', page.input_value('#mkq') == 'Casio fx-991 calculator', page.input_value('#mkq'))
    check('suggestions close after choosing', page.evaluate("document.querySelector('#mkq').closest('.fld').querySelector('.ccsg').hidden"))
    page.fill('#mkq', ''); page.keyboard.type('zzz'); page.wait_for_timeout(200)
    check('no suggestions for a word that matches nothing', page.evaluate("document.querySelector('#mkq').closest('.fld').querySelector('.ccsg').hidden"))
    page.keyboard.type('\b\b\bfri'); page.wait_for_timeout(200); page.keyboard.press('Escape')
    check('Escape closes the list', page.evaluate("document.querySelector('#mkq').closest('.fld').querySelector('.ccsg').hidden"))
    # script safety: markup in a title must stay text
    page.evaluate("window.ccMarketTerms=()=>['<img src=x onerror=window.__x=1> desk']"); page.fill('#mkq', ''); page.keyboard.type('des'); page.wait_for_timeout(200)
    check('markup in a title is shown as text, never run', page.evaluate("window.__x") is None and page.evaluate("document.querySelectorAll('.ccsg img').length") == 0)
    # Explore search box uses the page's own terms
    page.evaluate("document.querySelector('#tb [data-v=explore]').click()"); page.wait_for_timeout(400)
    page.evaluate("document.querySelector('#xt [data-x=sr]').click()"); page.wait_for_timeout(300)
    page.evaluate("window.ccSearchTerms=()=>['Fresher orientation week','Exam timetable']"); page.evaluate("document.getElementById('sq').focus()"); page.keyboard.type('exa'); page.wait_for_timeout(200)
    sg = page.evaluate("[...document.querySelector('#sq').closest('.fld').querySelectorAll('.ccsg button')].map(b=>b.textContent)")
    check('explore search suggests', 'Exam timetable' in sg, sg)
    check('no JavaScript errors', not errs, errs)
    b.close()
print('\n%d failed' % len(fails) if fails else '\nAll suggestion checks passed'); sys.exit(1 if fails else 0)
