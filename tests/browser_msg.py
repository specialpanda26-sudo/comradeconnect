"""Anonymous messaging browser test: real page, FAKE Worker. Run: python3 tests/browser_msg.py"""
import json, os, sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
API = 'https://cc-test.workers.dev'
LID = 'aaaaaaaa-0000-4000-8000-000000000001'; TID = 'bbbbbbbb-0000-4000-8000-000000000002'
LISTING = {'id': LID, 'title': 'Casio fx-991', 'description': 'Works well', 'category': 'Electronics', 'price': 1000, 'zone': 'Kutus', 'condition': 'Used, good', 'status': 'approved', 'photos': [], 'mine': False}
fails = []
def check(n, c, x=''):
    print(('PASS ' if c else 'FAIL ') + n + (' ' + str(x) if (x and not c) else ''))
    if not c: fails.append(n)
def main():
    S = {'threads': [], 'msgs': [], 'sent': [], 'reports': [], 'blocks': 0, 'send_err': None}
    with sync_playwright() as p:
        b = p.chromium.launch(); page = b.new_context(viewport={'width': 390, 'height': 800}).new_page(); page.set_default_timeout(4000)
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
            if path == '/api/market/listings': return ok({'listings': [LISTING], 'hasMore': False})
            if path == '/api/messages/inbox': return ok({'threads': S['threads']})
            if path == '/api/messages/thread/' + TID: return ok({'messages': S['msgs']})
            if path == '/api/messages/send':
                body = json.loads(req.post_data); S['sent'].append(body)
                if S['send_err']: return ok({'error': S['send_err']}, 400)
                S['msgs'].append({'id': 'm%d' % len(S['sent']), 'body': body['body'], 'mine': True, 'system': False, 'createdAt': 1})
                if not S['threads']: S['threads'] = [{'id': TID, 'with': 'Comrade', 'listing': {'id': LID, 'title': 'Casio fx-991'}, 'last': {'body': body['body'], 'mine': True, 'at': 1}, 'unread': 0, 'muted': False, 'blocked': False}]
                return ok({'thread_id': TID, 'message': S['msgs'][-1]}, 201)
            if path == '/api/messages/report': S['reports'].append(json.loads(req.post_data)); return ok({'ok': True})
            if path == '/api/messages/block': S['blocks'] += 1; return ok({'blocked': True})
            if path == '/api/messages/mute': return ok({'muted_until': 'x'})
            return ok({'error': 'unexpected ' + path}, 404)
        page.route('http://app.test/**', app); page.route(API + '/**', worker)
        page.route('http://app.test/config.js*', lambda r, q: r.fulfill(status=200, body="const CC_API='" + API + "';const CC_GOOGLE_ID='';", content_type='application/javascript'))
        page.route(lambda u: not (u.startswith('http://app.test') or u.startswith(API) or u.startswith('data:') or u.startswith('blob:')), lambda r, q: r.abort())
        js = page.evaluate
        def fill(sel, v): js("([s,v])=>{const e=document.querySelector(s);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))}", [sel, v])
        page.goto('http://app.test/index.html'); page.wait_for_timeout(300)
        js("localStorage.clear(); localStorage.setItem('cs_cookie','\"essential\"'); localStorage.setItem('cc_auth', JSON.stringify({aid:'u_a1',token:'tok'}))")
        page.goto('http://app.test/index.html'); page.wait_for_timeout(700)
        js("document.querySelector('#tb [data-v=market]').click()"); page.wait_for_timeout(600)
        js("document.querySelector('#mgrid .mc').click()"); page.wait_for_timeout(300)
        js("document.querySelector('#mvdm').click()"); page.wait_for_timeout(500)
        check('server chat note shown, not the "not delivered" text', 'not delivered' not in page.inner_text('#dmnote'), page.inner_text('#dmnote'))
        check('shows what the chat is about', 'Casio fx-991' in page.inner_text('#dmq'))
        fill('#dmi', 'Is it still available? Call me on 0712345678'); js("document.querySelector('#dmf').requestSubmit()"); page.wait_for_timeout(300)
        check('contact details never leave the phone', S['sent'] == [])
        fill('#dmi', 'Is it still available?'); js("document.querySelector('#dmf').requestSubmit()"); page.wait_for_timeout(600)
        check('first message is sent about the listing', S['sent'] == [{'listing_id': LID, 'body': 'Is it still available?'}], S['sent'])
        check('my message appears in the chat', 'Is it still available?' in page.inner_text('#dmlog'))
        S['msgs'].append({'id': 'mx', 'body': 'Yes, in Kutus', 'mine': False, 'system': False, 'createdAt': 2})
        fill('#dmi', 'Great, how much last?'); js("document.querySelector('#dmf').requestSubmit()"); page.wait_for_timeout(600)
        check('next message goes to the thread', S['sent'][-1] == {'thread_id': TID, 'body': 'Great, how much last?'}, S['sent'][-1])
        check("the seller's reply shows up", 'Yes, in Kutus' in page.inner_text('#dmlog'))
        S['send_err'] = 'Phone numbers are not allowed'
        fill('#dmi', 'hello again'); js("document.querySelector('#dmf').requestSubmit()"); page.wait_for_timeout(500)
        check('server refusal is shown and the text stays', js("document.querySelector('#dmi').value") == 'hello again')
        S['send_err'] = None; fill('#dmi', '')
        # report + block
        js("document.querySelector('#dmlog .bub[data-mine=\"0\"]').click()"); page.wait_for_timeout(300)
        fill('#ccwhy', 'Asked me to pay outside'); js("document.querySelector('#ccwhy-go').click()"); page.wait_for_timeout(500)
        check('report sends the message id and reason', S['reports'] == [{'message_id': 'mx', 'reason': 'Asked me to pay outside'}], S['reports'])
        js("document.querySelector('#dmact [data-m=block]').click()"); page.wait_for_timeout(200)
        check('block needs a second tap', S['blocks'] == 0)
        js("document.querySelector('#dmact [data-m=block]').click()"); page.wait_for_timeout(500)
        check('second tap blocks', S['blocks'] == 1 and 'Unblock' in page.inner_text('#dmact'), page.inner_text('#dmact'))
        # inbox + reopening
        js("document.querySelector('#dm .xb') && document.querySelector('#dm .xb').click()")
        S['threads'][0]['unread'] = 2; S['threads'][0]['blocked'] = False
        js("document.querySelector('#tb [data-v=me]').click()"); page.wait_for_timeout(800)
        check('inbox lists the chat with unread count', 'Casio fx-991' in page.inner_text('#dml') and 'Open (2)' in page.inner_text('#dml'), page.inner_text('#dml'))
        js("document.querySelector('#dml button[data-t]').click()"); page.wait_for_timeout(600)
        check('opening from the inbox shows the conversation', 'Yes, in Kutus' in page.inner_text('#dmlog'))
        # existing thread is found when messaging the same listing again
        S['sent'].clear(); js("shut()")
        js("document.querySelector('#tb [data-v=market]').click()"); page.wait_for_timeout(500)
        js("document.querySelector('#mgrid .mc').click()"); page.wait_for_timeout(300); js("document.querySelector('#mvdm').click()"); page.wait_for_timeout(700)
        check('same listing reopens the same conversation', 'Yes, in Kutus' in page.inner_text('#dmlog'))
        fill('#dmi', 'ok thanks'); js("document.querySelector('#dmf').requestSubmit()"); page.wait_for_timeout(500)
        check('and continues in the existing thread', S['sent'] == [{'thread_id': TID, 'body': 'ok thanks'}], S['sent'])
        check('no JavaScript errors on the page', not errors, errors)
        b.close()
    print('\n%d failed' % len(fails) if fails else '\nAll messaging checks passed'); sys.exit(1 if fails else 0)
main()
