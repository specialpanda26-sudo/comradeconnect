"""Admin panel: Events, door check and Club tabs. Real admin.html, FAKE Worker. Run: python3 tests/browser_admin_club.py"""
import json, os, sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
API = 'https://cc-test.workers.dev'
U = lambda n: '%08d-0000-4000-8000-000000000000' % n
fails = []
def check(n, c, x=''):
    print(('PASS ' if c else 'FAIL ') + n + (' ' + str(x) if (x and not c) else ''))
    if not c: fails.append(n)
def main():
    st = {'calls': [], 'events': [{'id': U(20), 'title': 'Fresher bash', 'date': '2030-05-01', 'venue': 'Main hall', 'ticket_price': 300}], 'products': [{'id': U(10), 'name': 'Sugar 1kg', 'price': 180, 'stock': 4}],
          'orders': [{'id': U(300), 'product_id': U(10), 'qty': 2, 'amount': 360, 'created_at': '2026-10-16T08:00:00Z'}], 'door': {'ok': True}, 'notices': [{'id': U(30), 'title': 'Exam timetable out', 'body': 'Check the notice board', 'pinned': True, 'createdAt': 1760000000000}], 'sponsors': [{'id': U(40), 'name': 'Naivas', 'blurb': 'Student discounts', 'link': 'https://naivas.example'}]}
    with sync_playwright() as p:
        b = p.chromium.launch(); page = b.new_context(viewport={'width': 390, 'height': 800}).new_page(); page.set_default_timeout(4000)
        errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('dialog', lambda d: d.accept('25' if d.type == 'prompt' else None))
        def app(route, req):
            f = urlparse(req.url).path.lstrip('/'); data = open(os.path.join(ROOT, f), 'rb').read().decode().replace('https://comrade-connect-api.YOUR-SUBDOMAIN.workers.dev', API).encode()
            route.fulfill(status=200, body=data, content_type='text/html')
        def worker(route, req):
            path = urlparse(req.url).path; cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}
            def ok(d, s=200): route.fulfill(status=s, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(d))
            if req.method == 'OPTIONS': return route.fulfill(status=204, headers=cors)
            body = json.loads(req.post_data) if req.post_data else None
            if req.method == 'POST': st['calls'].append((path, body))
            if path == '/api/events': return ok({'events': st['events']})
            if path == '/api/notices': return ok({'notices': st['notices']})
            if path == '/api/sponsors': return ok({'sponsors': st['sponsors']})
            if path == '/api/club/products': return ok({'products': st['products']})
            if path == '/api/admin/club/orders': return ok({'orders': st['orders']})
            if path == '/api/admin/queue': return ok({'counts': {'listings': 0, 'verifications': 0, 'disputes': 0, 'withdrawals': 0, 'reports': 0, 'underpaid': 0}, 'listings': [], 'verifications': [], 'withdrawals': [], 'underpaid': [], 'content_reports': [], 'message_reports': [], 'disputes': []})
            if path == '/api/admin/tickets/validate': return ok(st['door'], 200 if st['door']['ok'] else 409)
            if path.endswith('/collect'): st['orders'] = []; return ok({'ok': True})
            return ok({'ok': True})
        page.route('http://app.test/**', app); page.route(API + '/**', worker)
        page.route('http://app.test/config.js*', lambda r, q: r.fulfill(status=200, body="const CC_API='" + API + "';const CC_GOOGLE_ID='';", content_type='application/javascript'))
        js = page.evaluate
        def click(sel, w=300): js("(s)=>document.querySelector(s).click()", sel); page.wait_for_timeout(w)
        def fill(sel, v): js("([s,v])=>{document.querySelector(s).value=v}", [sel, v])
        def last(path): return next((c[1] for c in reversed(st['calls']) if c[0] == path), None)
        page.goto('http://app.test/admin.html'); page.wait_for_timeout(300)
        page.fill('#k', 'secret-key'); click('#go', 600)
        check('Club tab shows the number of orders to collect', 'Club1' in page.inner_text('nav').replace(' ', '').replace('\n', ''), page.inner_text('nav'))
        click('[data-tab=events]')
        check('events tab lists events with ticket price', 'Fresher bash' in page.inner_text('#app') and 'KSh 300' in page.inner_text('#app'))
        fill('#ev_t', 'Career day'); fill('#ev_d', 'soon'); click('#evadd'); check('bad date is refused on the phone', last('/api/admin/events') is None)
        fill('#ev_d', '2030-06-10'); fill('#ev_v', 'Library'); fill('#ev_p', '200'); click('#evadd', 500)
        check('event is created with its ticket price', last('/api/admin/events') == {'title': 'Career day', 'date': '2030-06-10', 'venue': 'Library', 'details': '', 'ticket_price': 200}, last('/api/admin/events'))
        click('[data-tab=events]'); fill('#dr_c', '123'); click('#drgo'); check('short code is not sent', last('/api/admin/tickets/validate') is None)
        fill('#dr_c', '1234 5678'); click('#drgo', 500)
        check('door check sends event and code only', last('/api/admin/tickets/validate') == {'event_id': U(20), 'code': '1234 5678'}, last('/api/admin/tickets/validate'))
        check('valid ticket is shown clearly', 'VALID. Let them in.' in page.inner_text('#dr_m'), page.inner_text('#dr_m'))
        st['door'] = {'ok': False, 'reason': 'Already used', 'error': 'Already used'}; fill('#dr_c', '12345678'); click('#drgo', 500)
        check('used ticket is refused with the reason', 'NOT VALID: Already used' in page.inner_text('#dr_m'), page.inner_text('#dr_m'))
        click('[data-do=evdel]', 500); check('event delete asks and sends delete', last('/api/admin/events/' + U(20)) == {'action': 'delete'}, last('/api/admin/events/' + U(20)))
        click('[data-tab=club]')
        check('club tab shows products and orders to collect', 'Sugar 1kg' in page.inner_text('#app') and 'Collect: Sugar 1kg x2' in page.inner_text('#app') and '00000300' in page.inner_text('#app'), page.inner_text('#app')[:300])
        fill('#cp_n', 'Rice 2kg'); fill('#cp_p', '320'); fill('#cp_q', '12'); click('#cpadd', 500)
        check('product is created with price and stock', last('/api/admin/club/products') == {'name': 'Rice 2kg', 'price': 320, 'qty': 12}, last('/api/admin/club/products'))
        click('[data-tab=club]'); click('[data-do=cpstock]', 500)
        check('stock is set from a prompt', last('/api/admin/club/stock') == {'product_id': U(10), 'qty': 25}, last('/api/admin/club/stock'))
        click('[data-tab=club]'); click('[data-do=cocollect]', 500)
        check('collect marks the order', last('/api/admin/club/orders/%s/collect' % U(300)) == {}, st['calls'][-3:])
        click('[data-tab=notices]')
        check('notices tab lists notices', 'Exam timetable out' in page.inner_text('#app') and '(pinned)' in page.inner_text('#app'), page.inner_text('#app')[:200])
        fill('#nt_t', 'Fees deadline'); fill('#nt_b', 'Pay before Friday'); fill('#nt_x', '7'); js("document.querySelector('#nt_p').checked=true"); click('#ntadd', 500)
        check('notice is published with expiry and pin', last('/api/admin/notices') == {'title': 'Fees deadline', 'body': 'Pay before Friday', 'pinned': True, 'expires_days': 7}, last('/api/admin/notices'))
        click('[data-tab=notices]'); fill('#nt_t', 'x'); click('#ntadd'); fill('#nt_t', 'Another one'); fill('#nt_x', 'abc'); click('#ntadd')
        check('bad notice input is refused on the phone', last('/api/admin/notices')['title'] == 'Fees deadline')
        click('[data-tab=notices]'); click('[data-do=ntdel]', 500); check('notice delete asks and sends delete', last('/api/admin/notices/' + U(30)) == {'action': 'delete'}, last('/api/admin/notices/' + U(30)))
        click('[data-tab=sponsors]')
        check('sponsors tab lists sponsors', 'Naivas' in page.inner_text('#app') and 'https://naivas.example' in page.inner_text('#app'))
        fill('#sp_n', 'Equity'); fill('#sp_l', 'http://insecure.example'); click('#spadd2'); check('http link is refused on the phone', last('/api/admin/sponsors') is None)
        fill('#sp_l', 'https://equity.example'); fill('#sp_b', 'Student accounts'); click('#spadd2', 500)
        check('sponsor is created', last('/api/admin/sponsors') == {'name': 'Equity', 'blurb': 'Student accounts', 'link': 'https://equity.example', 'amount': 0, 'ends_on': ''}, last('/api/admin/sponsors'))
        click('[data-tab=sponsors]'); click('[data-do=spdel]', 500); check('sponsor delete sends delete', last('/api/admin/sponsors/' + U(40)) == {'action': 'delete'})
        check('no JavaScript errors on the page', not errors, errors)
        b.close()
    print('\n%d failed' % len(fails) if fails else '\nAll admin club checks passed'); sys.exit(1 if fails else 0)
main()
