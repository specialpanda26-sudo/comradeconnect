"""Production checks: friendly errors, no demo leftovers. Run: python3 tests/browser_production.py"""
import os, re
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
API = 'https://cc-test.workers.dev'
fails = []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' ' + str(extra) if (extra and not cond) else ''))
    if not cond: fails.append(name)

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(); page = b.new_context(viewport={'width': 390, 'height': 800}).new_page()
        def app(route, req):
            f = urlparse(req.url).path.lstrip('/') or 'index.html'; fp = os.path.join(ROOT, f)
            if not os.path.isfile(fp): return route.fulfill(status=404, body='')
            route.fulfill(status=200, body=open(fp, 'rb').read(), content_type='text/html' if f.endswith('.html') else 'application/javascript')
        page.route('http://app.test/**', app)
        page.route('http://app.test/config.js*', lambda r, q: r.fulfill(status=200, body="const CC_API='" + API + "';const CC_GOOGLE_ID='';", content_type='application/javascript'))
        page.route(API + '/**', lambda r, q: r.fulfill(status=500, headers={'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}, body='{"error":"Server error"}'))
        page.route(lambda u: not (u.startswith('http://app.test') or u.startswith(API) or u.startswith('data:') or u.startswith('blob:')), lambda r, q: r.abort())
        page.goto('http://app.test/index.html'); page.wait_for_timeout(800)
        m = page.evaluate("[ccErr(500,'Server error'), ccErr(429,'Too many requests. Try again later.'), ccErr(429,''), ccErr(400,'Remove phone numbers, handles and links'), ccErr(401,''), ccErr(403,''), ccErr(404,''), ccErr(400,'')]")
        check('500 never shows the raw server text', 'Server error' not in m[0] and 'our side' in m[0], m[0])
        check('429 gets a patient message', 'wait' in m[2].lower() and 'Too many' in m[1])
        check('a clear server message (400) is kept', m[3] == 'Remove phone numbers, handles and links')
        check('401, 403, 404 and unknown have plain words', all(len(x) > 10 for x in m[4:]), m)
        page.evaluate("setTimeout(()=>{Promise.reject(new Error('Boom for test'))},0)"); page.wait_for_timeout(200)
        check('an unexpected failure shows a message', page.evaluate("document.querySelector('#toast').classList.contains('on')"))
        page.evaluate("document.querySelector('#tb [data-v=market]').click()"); page.wait_for_timeout(800)
        txt = page.inner_text('body').lower()
        check('a failing server shows a retry, not a crash', 'retry' in txt or 'try again' in txt, txt[:200])
        page.evaluate("document.querySelector('#tb [data-v=me]').click()"); page.wait_for_timeout(300)
        check('no Admin preview button on the public page', not page.evaluate("(()=>{const e=document.querySelector('#madm');return !!e && e.offsetParent!==null})()"))
        html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read().lower()
        check('no demo or coming-soon wording left', not re.search(r'\bdemo\b|coming soon|admin preview|not delivered yet', html))
        check('no workers.dev address left in the site', 'workers.dev' not in html and 'workers.dev' not in open(os.path.join(ROOT, 'config.js')).read())
        b.close()
    print('\n%d failed' % len(fails)); raise SystemExit(1 if fails else 0)
main()
