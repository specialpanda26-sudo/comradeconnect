"""Feed auto-refresh and new-stories button: real page, FAKE Worker. Run: python3 tests/browser_feed.py"""
import json, os, sys
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
API = 'https://cc-test.workers.dev'
U = lambda n: '%08d-0000-4000-8000-000000000000' % n
fails = []
def check(n, c, x=''):
    print(('PASS ' if c else 'FAIL ') + n + (' ' + str(x) if (x and not c) else ''))
    if not c: fails.append(n)
def post(n, t, text, cat='HostelTea'):
    return {'_id': U(n), 'content': text, 'category': cat, 'zone': 'Kutus', 'aid': 'a%d' % n, 'likes': 0, 'views': 0, 'comments': [], 'createdAt': t, 'campus': 'Kirinyaga University', 'verified': False}
def main():
    S = {'posts': [post(2, 2000, 'Second story'), post(1, 1000, 'First story')], 'gets': 0, 'fail': False}
    with sync_playwright() as p:
        b = p.chromium.launch(); page = b.new_context(viewport={'width': 390, 'height': 800}).new_page(); page.set_default_timeout(5000)
        errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        def app(route, req):
            f = urlparse(req.url).path.lstrip('/') or 'index.html'; fp = os.path.join(ROOT, f)
            if not os.path.isfile(fp): return route.fulfill(status=404, body='')
            d = open(fp, 'rb').read()
            if f == 'index.html': d = d.decode().replace('https://comrade-connect-api.YOUR-SUBDOMAIN.workers.dev', API)
            route.fulfill(status=200, body=d, content_type='text/html' if f.endswith('.html') else 'application/javascript')
        def worker(route, req):
            u = urlparse(req.url); path = u.path; qs = parse_qs(u.query); cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}
            def ok(d, s=200): route.fulfill(status=s, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(d))
            if req.method == 'OPTIONS': return route.fulfill(status=204, headers=cors)
            if path == '/api/posts' and req.method == 'GET':
                S['gets'] += 1
                if S['fail']: return ok({'error': 'down'}, 500)
                cat = qs.get('category', ['All'])[0]; L = [x for x in sorted(S['posts'], key=lambda x: -x['createdAt']) if cat == 'All' or x['category'] == cat]
                return ok({'posts': L[:5], 'hasMore': len(L) > 5})
            return ok({'ok': True})
        page.route('http://app.test/**', app); page.route(API + '/**', worker)
        page.route('http://app.test/config.js*', lambda r, q: r.fulfill(status=200, body="const CC_API='" + API + "';const CC_GOOGLE_ID='';", content_type='application/javascript'))
        page.route(lambda u: not (u.startswith('http://app.test') or u.startswith(API) or u.startswith('data:') or u.startswith('blob:')), lambda r, q: r.abort())
        js = page.evaluate
        def pill():
            return js("(()=>{const b=document.querySelector('#fnew');return b&&!b.hidden?b.innerText:null})()")
        def fcheck(w=500): js("fcheck()"); page.wait_for_timeout(w)
        page.goto('http://app.test/index.html'); page.wait_for_timeout(300)
        js("localStorage.clear(); localStorage.setItem('cs_cookie','\"essential\"')")
        page.goto('http://app.test/index.html'); page.wait_for_timeout(900)
        check('feed shows server stories', 'Second story' in page.inner_text('#feed') and 'First story' in page.inner_text('#feed'))
        fcheck(); check('nothing new, no button', pill() is None)
        S['posts'].insert(0, post(3, 3000, 'Fresh story')); fcheck()
        check('one newer story shows the button', pill() == '1 new story. Tap to see', pill())
        check('the page is not changed behind your back', 'Fresh story' not in page.inner_text('#feed'))
        S['posts'].insert(0, post(4, 4000, 'Fresher')); S['posts'].insert(0, post(5, 5000, 'Freshest')); fcheck()
        check('count updates', pill() == '3 new stories. Tap to see', pill())
        js("window.scrollTo(0, 300)"); js("document.querySelector('#fnew').click()"); page.wait_for_timeout(700)
        txt = page.inner_text('#feed')
        check('tapping loads the new stories first and hides the button', pill() is None and txt.index('Freshest') < txt.index('Second story') and 'Fresh story' in txt, txt[:200])
        check('scrolled back to the top', js("window.scrollY") < 5)
        n = S['gets']; js("Object.defineProperty(document,'hidden',{get:()=>true,configurable:true})"); S['posts'].insert(0, post(6, 6000, 'While away')); fcheck(300)
        check('hidden tab makes no request', S['gets'] == n and pill() is None)
        js("Object.defineProperty(document,'hidden',{get:()=>false,configurable:true})")
        js("document.body.dataset.view='market'"); fcheck(300); check('other screens make no request', S['gets'] == n)
        js("document.body.dataset.view='feed'")
        S['fail'] = True; fcheck(); check('a failed check is silent', pill() is None and not page.query_selector('.toast.on'))
        S['fail'] = False; fcheck(); check('then recovers', pill() == '1 new story. Tap to see', pill())
        # filter change resets the baseline
        js("document.querySelector('#tabs .tab[data-c=Crush]').click()"); page.wait_for_timeout(600)
        check('changing category hides the button', pill() is None)
        S['posts'].insert(0, post(7, 7000, 'A crush story', 'Crush')); fcheck()
        check('new story in the chosen category is found', pill() == '1 new story. Tap to see', pill())
        check('no JavaScript errors on the page', not errors, errors)
        b.close()
    print('\n%d failed' % len(fails) if fails else '\nAll feed checks passed'); sys.exit(1 if fails else 0)
main()
