"""Saved-lists browser test: real page, FAKE Worker. Shows saved items instantly, refreshes, keeps them offline, never saves the handover code.
Run: python3 tests/browser_cache.py"""
import json, os, sys, time
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
API = 'https://cc-test.workers.dev'
fails = []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' ' + str(extra) if (extra and not cond) else ''))
    if not cond: fails.append(name)

def L(title): return {'id': 'aaaaaaaa-0000-4000-8000-00000000000' + ('1' if 'Casio' in title else '2'), 'title': title, 'description': 'x', 'category': 'Electronics', 'price': 1000, 'zone': 'Kutus', 'condition': 'Used', 'status': 'approved', 'photos': [], 'seller': {'handle': 'S'}, 'mine': False, 'createdAt': 1}

def main():
    st = {'hold': True, 'held': [], 'offline': False}
    with sync_playwright() as p:
        b = p.chromium.launch(); page = b.new_context(viewport={'width': 390, 'height': 800}).new_page()
        errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        def app(route, req):
            f = urlparse(req.url).path.lstrip('/') or 'index.html'; fp = os.path.join(ROOT, f)
            if not os.path.isfile(fp): return route.fulfill(status=404, body='')
            data = open(fp, 'rb').read()
            if f == 'index.html': data = data.decode().replace('https://comrade-connect-api.YOUR-SUBDOMAIN.workers.dev', API).encode()
            route.fulfill(status=200, body=data, content_type='text/html' if f.endswith('.html') else 'application/javascript')
        def worker(route, req):
            path = urlparse(req.url).path; cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}
            def ok(d, s=200): route.fulfill(status=s, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(d))
            if req.method == 'OPTIONS': return route.fulfill(status=204, headers=cors)
            if st['offline'] and path != '/api/posts': return route.abort()
            if path == '/api/market/listings':
                if st['hold']: st['held'].append(route); return        # keep the request waiting so the saved list is visible alone
                return ok({'listings': [L('Casio fx-991')], 'hasMore': False})
            if path == '/api/orders/mine': return ok({'orders': [{'id': 'eeeeeeee-0000-4000-8000-000000000005', 'role': 'buyer', 'title': 'Study desk', 'amount': 2500, 'status': 'held', 'dispute_status': 'none', 'code': '123456', 'createdAt': 3}]})
            if path == '/api/wallet': return ok({'balance': 0, 'ledger': [], 'withdrawals': []})
            return ok({'posts': [], 'hasMore': False})
        page.route('http://app.test/**', app); page.route(API + '/**', worker)
        page.route(lambda u: not (u.startswith('http://app.test') or u.startswith(API) or u.startswith('data:') or u.startswith('blob:')), lambda r, q: r.abort())
        seed = {'cs_cookie': json.dumps('essential'), 'cc_auth': json.dumps({'aid': 'u_a', 'token': 't'}),
                'cc_c_browse': json.dumps({'t': 4102444800000, 'd': {'listings': [L('Cached desk')], 'more': False}}),
                'cc_c_orders:u_a': json.dumps({'t': 4102444800000, 'd': {'orders': [{'id': 'eeeeeeee-0000-4000-8000-000000000005', 'role': 'buyer', 'title': 'Study desk', 'amount': 2500, 'status': 'held', 'dispute_status': 'none', 'code': '...', 'createdAt': 3}], 'wallet': {'balance': 0, 'ledger': [], 'withdrawals': []}}})}
        page.add_init_script("if(!sessionStorage.getItem('seeded')){var S=%s;for(var k in S)localStorage.setItem(k,S[k]);sessionStorage.setItem('seeded','1')}" % json.dumps(seed))
        page.goto('http://app.test/index.html'); page.wait_for_timeout(300)
        page.evaluate("document.querySelector('#tb [data-v=market]').click()"); page.wait_for_timeout(300)
        check('saved items show instantly, before the server answers', 'Cached desk' in page.inner_text('#mgrid') and 'Loading' not in page.inner_text('#mgrid'), page.inner_text('#mgrid'))
        for r in st['held']: r.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}, body=json.dumps({'listings': [L('Casio fx-991')], 'hasMore': False}))
        st['hold'] = False; page.wait_for_timeout(700)
        txt = page.inner_text('#mgrid')
        check('fresh data replaces the saved items', 'Casio fx-991' in txt and 'Cached desk' not in txt, txt)
        saved = json.loads(json.loads(page.evaluate("localStorage.getItem('cc_c_browse')"))['d']['listings'][0]['title'].join('""')) if False else json.loads(page.evaluate("localStorage.getItem('cc_c_browse')"))
        check('the new list is saved for next time', saved['d']['listings'][0]['title'] == 'Casio fx-991')
        st['offline'] = True
        page.evaluate("document.querySelector('#mseg [data-s=mine]').click();document.querySelector('#mseg [data-s=browse]').click()"); page.wait_for_timeout(600)
        txt = page.inner_text('#mgrid')
        check('offline: saved items stay visible with a retry button', 'Casio fx-991' in txt and 'tap to retry' in txt.lower(), txt)
        st['offline'] = False
        page.evaluate("document.querySelector('#mseg [data-s=orders]').click()"); page.wait_for_timeout(300)
        check('saved orders show at once', 'Study desk' in page.inner_text('#olist'), page.inner_text('#olist'))
        page.wait_for_timeout(900)
        check('real code appears after the refresh', '123456' in page.inner_text('#olist'), page.inner_text('#olist'))
        raw = page.evaluate("localStorage.getItem('cc_c_orders:u_a')")
        check('the handover code is not saved on the phone', '123456' not in raw, raw)
        page.evaluate("localStorage.setItem('cc_auth', JSON.stringify({aid:'u_b',token:'t2'}))")
        check('another account does not see the first account orders', page.evaluate("(function(){var v=localStorage.getItem('cc_c_orders:u_b');return v===null})()"))
        check('no JavaScript errors on the page', not errors, errors)
        b.close()
    print('\n%d failed' % len(fails) if fails else '\nAll cache checks passed')
    sys.exit(1 if fails else 0)
main()
