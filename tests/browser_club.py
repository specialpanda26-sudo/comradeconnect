"""Club shop and event tickets browser test: real page, FAKE Worker. Run: python3 tests/browser_club.py"""
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
def main():
    S = {'member': False, 'calls': [], 'pay': {}, 'orders': [], 'tickets': [], 'stock': 8, 'refuse': None, 'paystate': 'paid',
         'events': [{'id': U(20), 'title': 'Fresher bash', 'date': '2030-05-01', 'venue': 'Main hall', 'details': 'Doors 6pm', 'ticket_price': 300},
                    {'id': U(21), 'title': 'Open talk', 'date': '2030-05-02', 'venue': None, 'details': None, 'ticket_price': None}]}
    with sync_playwright() as p:
        b = p.chromium.launch(); page = b.new_context(viewport={'width': 390, 'height': 800}).new_page(); page.set_default_timeout(8000)
        errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        def app(route, req):
            f = urlparse(req.url).path.lstrip('/') or 'index.html'; fp = os.path.join(ROOT, f)
            if not os.path.isfile(fp): return route.fulfill(status=404, body='')
            d = open(fp, 'rb').read()
            if f == 'index.html': d = d.decode().replace('https://comrade-connect-api.YOUR-SUBDOMAIN.workers.dev', API)
            route.fulfill(status=200, body=d, content_type='text/html' if f.endswith('.html') else 'application/javascript')
        def worker(route, req):
            path = urlparse(req.url).path; cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}
            def ok(d, s=200): route.fulfill(status=s, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(d))
            if req.method == 'OPTIONS': return route.fulfill(status=204, headers=cors)
            body = json.loads(req.post_data) if req.post_data else {}
            if req.method == 'POST': S['calls'].append((path, body))
            if path == '/api/club/products': return ok({'products': [{'id': U(10), 'name': 'Exercise book (pack of 5)', 'price': 250, 'stock': S['stock']}, {'id': U(11), 'name': 'Sugar 1kg', 'price': 180, 'stock': 0}]})
            if path == '/api/events': return ok({'events': S['events']})
            if path == '/api/club/me': return ok({'member': S['member']})
            if path == '/api/club/join': S['member'] = True; return ok({'member': True})
            if path == '/api/club/orders/mine': return ok({'orders': S['orders']})
            if path == '/api/tickets/mine': return ok({'tickets': S['tickets']})
            if path == '/api/club/order':
                if S['refuse']: return ok({'error': S['refuse']}, 409)
                S['stock'] -= body['qty']; S['orders'].insert(0, {'id': U(300), 'product': 'Exercise book (pack of 5)', 'qty': body['qty'], 'amount': 250 * body['qty'], 'status': 'paid', 'createdAt': 1})
                return ok({'id': U(400), 'order_id': U(300), 'amount': 250 * body['qty']}, 201)
            if path == '/api/tickets/buy':
                S['tickets'].insert(0, {'id': U(500), 'event': 'Fresher bash', 'date': '2030-05-01', 'venue': 'Main hall', 'status': 'valid', 'code': '12345678'})
                return ok({'id': U(401), 'amount': 300}, 201)
            if path == '/api/pay/status': return ok({'status': S['paystate']})
            return ok({'error': 'unexpected ' + path}, 404)
        page.route('http://app.test/**', app); page.route(API + '/**', worker)
        page.route('http://app.test/config.js*', lambda r, q: r.fulfill(status=200, body="const CC_API='" + API + "';const CC_GOOGLE_ID='';", content_type='application/javascript'))
        page.route(lambda u: not (u.startswith('http://app.test') or u.startswith(API) or u.startswith('data:') or u.startswith('blob:')), lambda r, q: r.abort())
        js = page.evaluate
        def click(sel, w=350): js("(s)=>document.querySelector(s).click()", sel); page.wait_for_timeout(w)
        def txt(sel): return page.inner_text(sel)
        def last(path): return next((c[1] for c in reversed(S['calls']) if c[0] == path), None)
        page.goto('http://app.test/index.html'); page.wait_for_timeout(300)
        js("localStorage.clear(); localStorage.setItem('cs_cookie','\"essential\"'); localStorage.setItem('cc_auth', JSON.stringify({aid:'u_a1',token:'tok'}))")
        page.goto('http://app.test/index.html'); page.wait_for_timeout(700)
        js("goTo('club','rewards');drawClub()"); page.wait_for_timeout(700)
        check('shop shows server products with prices and stock', 'Exercise book (pack of 5)' in txt('#cgrid') and 'KSh 250' in txt('#cgrid') and 'Low stock (8 left)' in txt('#cgrid') and 'Sold out' in txt('#cgrid'), txt('#cgrid'))
        check('tab says Tickets, not Cart', 'Tickets' in txt('#cseg') and 'Cart' not in txt('#cseg'))
        check('joining is free, no fee shown', 'Join the Club' in txt('#cmem') and 'KSh 100' not in txt('#cmem'))
        click('#cgrid [data-buy]'); check('non-member cannot buy', page.query_selector('#ccpg') is None)
        click('#cjoin'); check('join calls the server and shows member', 'Active member' in txt('#cmem') and last('/api/club/join') == {})
        click('#cgrid [data-buy]')
        js("(()=>{const q=document.querySelector('#ccqty');q.value='2';q.dispatchEvent(new Event('change'))})()")
        check('quantity updates the total', 'KSh 500' in txt('#cctot'), txt('#cctot'))
        js("document.querySelector('#ccpp').value='0712'"); click('#ccpg'); check('bad phone number is refused on the phone', last('/api/club/order') is None and 'Safaricom' in txt('#ccpe'))
        S['refuse'] = 'Sorry, not enough stock'; js("document.querySelector('#ccpp').value='0712345678'"); click('#ccpg', 600)
        check('server refusal is shown and nothing is charged', 'not enough stock' in txt('#ccpe') and not page.query_selector('#ccpf').get_attribute('hidden'), txt('#ccpe')); S['refuse'] = None
        click('#ccpg', 4500)
        check('order is sent by product and quantity only, no price', last('/api/club/order') == {'product_id': U(10), 'qty': 2, 'phone': '0712345678'}, last('/api/club/order'))
        check('paid message shown', 'Paid KSh 500' in txt('#ccpm'), txt('#ccpm'))
        check('phone is remembered for next time', js("JSON.parse(localStorage.getItem('cc_phone')||'null')") == '0712345678' or '0712345678' in js("localStorage.getItem('cc_phone')||''"))
        click('#ccpo', 600)
        check('lands on Orders with the new order', 'Paid. Collect on campus' in txt('#cord') and 'KSh 500' in txt('#cord') and 'Ref 00000300' in txt('#cord'), txt('#cord'))
        click('#cseg [data-s=shop]'); check('stock refreshed from the server', 'Low stock (6 left)' in txt('#cgrid'), txt('#cgrid'))
        # tickets
        click('#cseg [data-s=cart]', 600)
        check('events listed from the server', 'Fresher bash' in txt('#ccart') and 'Doors 6pm' in txt('#ccart') and 'Buy a ticket, KSh 300' in txt('#ccart') and 'No tickets needed' in txt('#ccart'), txt('#ccart')[:300])
        check('no tickets yet', 'No tickets yet' in txt('#ccart'))
        click('#ccart [data-tb]'); js("document.querySelector('#ccpp').value='0712345678'"); S['paystate'] = 'failed'; click('#ccpg', 4500)
        check('failed payment shows a clear message and no ticket', 'cancelled or failed' in txt('#ccpe') and S['tickets'] == [] or 'cancelled or failed' in txt('#ccpe'), txt('#ccpe'))
        S['paystate'] = 'paid'; click('#ccpg', 4500)
        check('ticket purchase sends the event only', last('/api/tickets/buy') == {'event_id': U(20), 'phone': '0712345678'}, last('/api/tickets/buy'))
        click('#ccpo', 800)
        check('ticket code appears under My tickets', '1234 5678' in txt('#ccart') and 'Show this code at the door' in txt('#ccart'), txt('#ccart')[-300:])
        S['tickets'][0]['status'] = 'used'; S['tickets'][0].pop('code'); click('#cseg [data-s=shop]')
        check('no JavaScript errors on the page', not errors, errors)
        b.close()
    print('\n%d failed' % len(fails) if fails else '\nAll club checks passed'); sys.exit(1 if fails else 0)
main()
