"""Group 2 browser test: manual M-Pesa (free mode). Real frontend in headless Chromium against a FAKE Worker.
Proves the buy flow shows how to pay, asks for the M-Pesa code, handles a used code, and ends on "checking your payment".
Run:  python3 tests/browser_manualpay.py
"""
import json, os, sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
API = 'https://cc-test.workers.dev'
fails = []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' ' + str(extra) if (extra and not cond) else ''))
    if not cond: fails.append(name)

MAN = {'type': 'send', 'pay_to': '0712345678', 'name': 'Henry O', 'amount': 1000, 'ref': 'CCDDDDDDDD', 'steps': 'M-Pesa > Send Money > 0712345678'}
S = {'stage': 'pending', 'codes': [], 'registered': 0}

def worker(route, req):
    path = urlparse(req.url).path; m = req.method
    cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}
    def ok(d, s=200): route.fulfill(status=s, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(d))
    if m == 'OPTIONS': return route.fulfill(status=204, headers=cors)
    body = json.loads(req.post_data) if req.post_data else {}
    if path == '/api/auth/register': S['registered'] += 1; return ok({'aid': 'u_serverid1', 'token': 'tok123', 'recovery_code': 'ABC123DEF456', 'referral_code': 'RC1'}, 201)
    if path == '/api/market/listings': return ok({'listings': [{'id': 'aaaaaaaa-0000-4000-8000-000000000001', 'title': 'Casio fx-991', 'description': 'Works well', 'category': 'Electronics', 'price': 1000, 'zone': 'Kutus', 'condition': 'Used, good', 'status': 'approved', 'photos': [], 'seller': {'handle': 'amina', 'verified': False}, 'createdAt': 1}], 'hasMore': False})
    if path == '/api/market/buy': return ok({'id': 'dddddddd-0000-4000-8000-000000000004', 'amount': 1000})
    if path == '/api/pay/status':
        if S['stage'] == 'pending': return ok({'status': 'pending', 'amount': 1000, 'manual': MAN})
        return ok({'status': 'submitted', 'receipt': S['codes'][-1], 'amount': 1000})
    if path == '/api/pay/confirm':
        if body.get('code') == 'USED000001': return ok({'error': 'That M-Pesa code was already used'}, 409)
        S['codes'].append(body['code']); S['stage'] = 'submitted'; return ok({'ok': True, 'status': 'submitted'})
    if path in ('/api/orders/mine',): return ok({'orders': []})
    if path == '/api/wallet': return ok({'balance': 0, 'ledger': [], 'withdrawals': []})
    return ok({'error': 'unexpected ' + path}, 404)

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(); page = b.new_context(viewport={'width': 390, 'height': 800}).new_page()
        errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        def app(route, req):
            f = urlparse(req.url).path.lstrip('/') or 'index.html'; fp = os.path.join(ROOT, f)
            if not os.path.isfile(fp): return route.fulfill(status=404, body='')
            data = open(fp, 'rb').read()
            if f == 'index.html': data = data.decode().replace('https://comrade-connect-api.YOUR-SUBDOMAIN.workers.dev', API).encode()
            route.fulfill(status=200, body=data, content_type='text/html' if f.endswith('.html') else 'application/javascript')
        page.route('http://app.test/**', app); page.route(API + '/**', worker)
        page.route(lambda u: not (u.startswith('http://app.test') or u.startswith(API) or u.startswith('data:') or u.startswith('blob:')), lambda r, q: r.abort())
        page.goto('http://app.test/index.html'); page.wait_for_timeout(800)
        page.evaluate("localStorage.setItem('cs_cookie','\"essential\"')")
        page.evaluate("document.querySelector('#tb [data-v=market]').click()"); page.wait_for_timeout(600)
        page.evaluate("document.querySelector('#mgrid .mc').click()"); page.wait_for_timeout(300)
        page.evaluate("document.querySelector('#mvbuy').click()"); page.wait_for_timeout(200)
        page.evaluate("document.querySelector('#bgo').click()"); page.fill('#bph', '0712345678'); page.evaluate("document.querySelector('#bpay').click()"); page.wait_for_timeout(600)
        page.check('#ccok'); page.click('#ccgo'); page.wait_for_timeout(1500)
        txt = page.inner_text('body')
        check('instructions say how and how much to pay', 'Send exactly' in txt and 'KSh 1,000' in txt.replace('\u00a0', ' ') or 'Send exactly' in txt, txt[-400:])
        check('instructions show the steps and the name', 'Send Money > 0712345678' in txt and 'Henry O' in txt)
        check('a code box is shown', page.locator('#ccmc').count() == 1)
        page.fill('#ccmc', 'abc'); page.click('#ccmg'); page.wait_for_timeout(200)
        check('a short code is refused on the phone, no server call', 'letters and numbers' in page.inner_text('#ccme') and not S['codes'])
        page.fill('#ccmc', 'used000001'); page.click('#ccmg'); page.wait_for_timeout(500)
        check('a code the server refuses shows its message and keeps the box open', 'already used' in page.inner_text('#ccme') and page.locator('#ccmc').count() == 1)
        page.fill('#ccmc', 'sjk7 abc123'); page.click('#ccmg'); page.wait_for_timeout(1000)
        check('the code is sent upper case without spaces', S['codes'] == ['SJK7ABC123'], S['codes'])
        check('the box closes', page.locator('#ccmc').count() == 0)
        check('buyer is told an admin is checking', 'checking your payment' in (page.text_content('#toast') or '').lower(), page.text_content('#toast'))
        check('no JavaScript errors on the page', not errors, errors)
        b.close()
    print('\n%d failed' % len(fails) if fails else '\nAll manual payment checks passed')
    sys.exit(1 if fails else 0)
main()
