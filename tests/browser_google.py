"""Google sign-in browser test: real page, FAKE Worker, FAKE Google script (the real Google button is not loaded).
Run: python3 tests/browser_google.py"""
import json, os, sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
API = 'https://cc-test.workers.dev'
fails = []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' ' + str(extra) if (extra and not cond) else ''))
    if not cond: fails.append(name)

GSI = """window.google={accounts:{id:{initialize:function(o){window.__gcb=o.callback;window.__gid=o.client_id},
renderButton:function(el){var b=document.createElement('button');b.id='fakeg';b.textContent='Continue with Google';b.onclick=function(){window.__gcb({credential:'good:sub1'})};el.appendChild(b)}}}};"""
LISTING = {'id': 'aaaaaaaa-0000-4000-8000-000000000001', 'title': 'Casio fx-991', 'description': 'Works well', 'category': 'Electronics', 'price': 1000, 'zone': 'Kutus', 'condition': 'Used, good', 'status': 'approved', 'photos': [], 'seller': {'handle': 'S', 'verified': False}, 'mine': False, 'createdAt': 1}

def main():
    seen = {'register': 0, 'google': 0, 'cred': None, 'buy_hdr': None}
    with sync_playwright() as p:
        b = p.chromium.launch(); page = b.new_context(viewport={'width': 390, 'height': 800}).new_page()
        errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        def app(route, req):
            f = urlparse(req.url).path.lstrip('/') or 'index.html'; fp = os.path.join(ROOT, f)
            if not os.path.isfile(fp): return route.fulfill(status=404, body='')
            data = open(fp, 'rb').read()
            if f == 'index.html': data = data.decode().replace('https://comrade-connect-api.YOUR-SUBDOMAIN.workers.dev', API).replace("const CC_GOOGLE_ID='';", "const CC_GOOGLE_ID='1234567890-test.apps.googleusercontent.com';").encode()
            route.fulfill(status=200, body=data, content_type='text/html' if f.endswith('.html') else 'application/javascript')
        def worker(route, req):
            path = urlparse(req.url).path; cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}
            def ok(d, s=200): route.fulfill(status=s, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(d))
            if req.method == 'OPTIONS': return route.fulfill(status=204, headers=cors)
            if path == '/api/auth/register': seen['register'] += 1; return ok({'aid': 'u_x', 'token': 't', 'recovery_code': 'R', 'referral_code': 'C'}, 201)
            if path == '/api/auth/google': seen['google'] += 1; seen['cred'] = json.loads(req.post_data)['credential']; return ok({'aid': 'u_google1', 'token': 'gtok', 'created': True}, 201)
            if path == '/api/market/listings': return ok({'listings': [LISTING], 'hasMore': False})
            if path == '/api/market/buy': seen['buy_hdr'] = (req.headers.get('x-aid'), req.headers.get('x-token')); return ok({'error': 'stop here'}, 400)
            return ok({'error': 'unexpected ' + path}, 404)
        page.route('http://app.test/**', app); page.route(API + '/**', worker)
        page.route('http://app.test/config.js*', lambda r, q: r.fulfill(status=200, body="const CC_API='" + API + "';const CC_GOOGLE_ID='1234567890-test.apps.googleusercontent.com';", content_type='application/javascript'))
        page.route('https://accounts.google.com/gsi/client', lambda r, q: r.fulfill(status=200, body=GSI, content_type='application/javascript'))
        page.route(lambda u: not (u.startswith('http://app.test') or u.startswith(API) or u.startswith('https://accounts.google.com') or u.startswith('data:') or u.startswith('blob:')), lambda r, q: r.abort())
        page.goto('http://app.test/index.html'); page.wait_for_timeout(700)
        page.evaluate("localStorage.setItem('cs_cookie','\"essential\"')")
        page.evaluate("document.querySelector('#tb [data-v=market]').click()"); page.wait_for_timeout(600)
        page.evaluate("document.querySelector('#mgrid .mc').click()"); page.wait_for_timeout(300)
        page.evaluate("localStorage.setItem('cc_phone','\"0799999999\"')")
        page.evaluate("document.querySelector('#mvbuy').click()"); page.wait_for_timeout(200)
        page.evaluate("document.querySelector('#bgo').click()")
        check('saved M-Pesa number is prefilled', page.input_value('#bph') == '0799999999', page.input_value('#bph'))
        page.fill('#bph', '0712345678')
        page.evaluate("document.querySelector('#bpay').click()"); page.wait_for_timeout(500)
        check('sign-in sheet appears with the Google button', page.locator('text=Sign in to continue').count() == 1 and page.locator('#fakeg:visible').count() == 1)
        check('Google client id passed to Google', page.evaluate('window.__gid') == '1234567890-test.apps.googleusercontent.com')
        check('no recovery-code screen when using Google', page.locator('text=Save your recovery code').count() == 0)
        page.locator('#fakeg:visible').click(); page.wait_for_timeout(1200)
        check('Google credential sent to the Worker once', seen['google'] == 1 and seen['cred'] == 'good:sub1', seen)
        check('no guest account was created', seen['register'] == 0)
        a = json.loads(page.evaluate("localStorage.getItem('cc_auth')"))
        check('account saved on the phone', a == {'aid': 'u_google1', 'token': 'gtok'}, a)
        check('the purchase continues with the Google account token', seen['buy_hdr'] == ('u_google1', 'gtok'), seen['buy_hdr'])
        check('a number the server rejected is not remembered', json.loads(page.evaluate("localStorage.getItem('cc_phone')")) == '0799999999')
        check('no JavaScript errors on the page', not errors, errors)
        b.close()
    print('\n%d failed' % len(fails) if fails else '\nAll Google browser checks passed')
    sys.exit(1 if fails else 0)
main()
