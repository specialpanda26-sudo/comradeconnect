"""Admin panel browser test: real admin.html, FAKE Worker. Run: python3 tests/browser_admin.py"""
import json, os, sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
API = 'https://cc-test.workers.dev'
fails = []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' ' + str(extra) if (extra and not cond) else ''))
    if not cond: fails.append(name)

def main():
    st = {'calls': [], 'listings': [{'id': 'aaaaaaaa-0000-4000-8000-000000000001', 'title': 'Study <b>desk</b>', 'description': 'Solid wood', 'price': 2500, 'category': 'Furniture', 'seller': 'u_s1', 'createdAt': 1, 'photos': []}],
          'wds': [{'id': 'bbbbbbbb-0000-4000-8000-000000000002', 'aid': 'u_s1', 'amount': 970, 'phone': '254712345678', 'created_at': '2026-10-16T08:00:00Z'}],
          'disputes': [{'id': 'cccccccc-0000-4000-8000-000000000003', 'title': 'Casio', 'amount': 1000, 'status': 'disputed', 'reason': 'Not as described', 'opened_by': 'buyer', 'buyer': 'u_b', 'seller': 'u_s1'}],
          'msgrep': [{'id': 'dddddddd-0000-4000-8000-000000000004', 'reason': 'harassment', 'snapshot': 'bad message text', 'reported_aid': 'u_x', 'created_at': '2026-10-16T08:00:00Z'}]}
    with sync_playwright() as p:
        b = p.chromium.launch(); page = b.new_context(viewport={'width': 390, 'height': 800}).new_page()
        errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        dialogs = []
        def on_dialog(d): dialogs.append((d.type, d.message)); d.accept('MPX123' if d.type == 'prompt' else None)
        page.on('dialog', on_dialog)
        def app(route, req):
            f = urlparse(req.url).path.lstrip('/'); fp = os.path.join(ROOT, f)
            data = open(fp, 'rb').read().decode().replace('https://comrade-connect-api.YOUR-SUBDOMAIN.workers.dev', API).encode()
            route.fulfill(status=200, body=data, content_type='text/html')
        def worker(route, req):
            path = urlparse(req.url).path; cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}
            def ok(d, s=200): route.fulfill(status=s, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(d))
            if req.method == 'OPTIONS': return route.fulfill(status=204, headers=cors)
            key = req.headers.get('x-admin-key')
            if key != 'secret-key': return ok({'error': 'Wrong admin key' if path.endswith('login') else 'Not allowed'}, 403)
            body = json.loads(req.post_data) if req.post_data else None
            st['calls'].append((req.method, path, body))
            if path == '/api/admin/login': return ok({'ok': True})
            if path == '/api/admin/queue':
                return ok({'counts': {'listings': len(st['listings']), 'verifications': 0, 'disputes': len(st['disputes']), 'withdrawals': len(st['wds']), 'reports': 1, 'underpaid': 0, 'confirm': len(st.get('conf', [{}]))},
                           'listings': st['listings'], 'verifications': [], 'withdrawals': st['wds'], 'underpaid': [], 'confirm': st.get('conf', [{'id': 'ffffffff-0000-4000-8000-000000000009', 'purpose': 'order', 'amount': 1000, 'phone': '254722111333', 'receipt': 'SJK7ABC123', 'created_at': '2026-10-16T10:00:00Z'}]), 'content_reports': [], 'message_reports': st['msgrep'], 'disputes': st['disputes']})
            if '/api/admin/listings/' in path: st['listings'] = []; return ok({'ok': True})
            if '/api/admin/withdrawals/' in path: st['wds'] = []; return ok({'ok': True})
            if '/api/admin/orders/' in path: st['disputes'] = []; return ok({'ok': True})
            return ok({'ok': True})
        page.route('http://app.test/**', app); page.route(API + '/**', worker)
        page.route('http://app.test/config.js*', lambda r, q: r.fulfill(status=200, body="const CC_API='" + API + "';const CC_GOOGLE_ID='';", content_type='application/javascript'))
        page.goto('http://app.test/admin.html'); page.wait_for_timeout(300)
        check('login screen first, asks for the Worker URL when not set', page.locator('#k').count() == 1 and page.locator('#u').count() == 0)
        page.fill('#k', 'wrong'); page.click('#go'); page.wait_for_timeout(400)
        check('wrong key shows an error and stays signed out', 'Wrong admin key' in page.inner_text('#app'), page.inner_text('#app'))
        page.fill('#k', 'secret-key'); page.click('#go'); page.wait_for_timeout(500)
        txt = page.inner_text('#app')
        check('queue loads with counts on the tabs', 'Listings' in txt and 'Withdrawals' in txt and 'Disputes' in txt)
        check('listing text is escaped, not run as HTML', page.locator('.card h3 b').count() == 0 and 'Study <b>desk</b>' in txt, txt[:200])
        page.click('[data-do=approve]'); page.wait_for_timeout(500)
        check('approve sends the right call', any(c[1].endswith('/listings/aaaaaaaa-0000-4000-8000-000000000001') and c[2] == {'action': 'approve'} for c in st['calls']), st['calls'])
        check('approved listing leaves the queue', 'Nothing waiting here' in page.inner_text('#app'))
        page.click('[data-tab=withdrawals]'); page.wait_for_timeout(200)
        check('withdrawal shows amount and number', 'KSh 970' in page.inner_text('#app') and '254712345678' in page.inner_text('#app'))
        page.click('[data-do=paid]'); page.wait_for_timeout(500)
        check('marking paid sends the M-Pesa code', any(c[2] == {'action': 'paid', 'payout_ref': 'MPX123'} for c in st['calls']), st['calls'][-3:])
        page.click('[data-tab=disputes]'); page.wait_for_timeout(200)
        page.click('[data-do=orefund]'); page.wait_for_timeout(500)
        check('refund asks for confirmation then sends it', any(d[0] == 'confirm' for d in dialogs) and any(c[1].startswith('/api/admin/orders/') and c[2] == {'action': 'refund'} for c in st['calls']))
        page.click('[data-tab=confirm]'); page.wait_for_timeout(200)
        check('payment to confirm shows the code, amount and buyer phone', 'SJK7ABC123' in page.inner_text('#app') and 'KSh 1,000' in page.inner_text('#app') and '254722111333' in page.inner_text('#app'), page.inner_text('#app')[:300])
        page.click('[data-do=payok]'); page.wait_for_timeout(500)
        check('money received sends approve for that payment', any(c[1] == '/api/admin/payments/ffffffff-0000-4000-8000-000000000009' and c[2] == {'action': 'approve'} for c in st['calls']), st['calls'][-2:])
        page.click('[data-tab=reports]'); page.wait_for_timeout(200)
        check('message report shows the saved message text', 'bad message text' in page.inner_text('#app'))
        check('message reports have no hide button', page.locator('[data-do=ractionhide]').count() == 0)
        page.click('[data-tab=users]'); page.fill('#ua', 'u_bad123'); page.select_option('#uact', 'mute'); page.fill('#uv', '24'); page.click('#ugo'); page.wait_for_timeout(500)
        check('mute sends hours', any(c[1] == '/api/admin/users/u_bad123' and c[2] == {'action': 'mute', 'hours': 24} for c in st['calls']), st['calls'][-2:])
        check('key is not kept in localStorage', page.evaluate("localStorage.getItem('k')") is None and 'secret-key' not in page.evaluate("JSON.stringify(localStorage)"))
        page.click('#out'); page.wait_for_timeout(200)
        check('sign out returns to the login screen', page.locator('#k').count() == 1)
        check('no JavaScript errors on the page', not errors, errors)
        b.close()
    print('\n%d failed' % len(fails) if fails else '\nAll admin checks passed')
    sys.exit(1 if fails else 0)
main()
