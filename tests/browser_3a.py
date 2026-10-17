"""Section 3A browser test. Runs the real frontend in headless Chromium against a FAKE Worker.
It proves the page sends the right calls and draws the right states. It does not prove the real Worker, M-Pesa or R2 work.
Run:  pip install playwright && playwright install chromium && python3 tests/browser_3a.py
"""
import json, os, struct, sys, zlib, base64
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
API = 'https://cc-test.workers.dev'
fails = []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' ' + str(extra) if (extra and not cond) else ''))
    if not cond: fails.append(name)

def png(w=64, h=48):                                      # a real PNG with some pixels in it
    rows = b''.join(b'\x00' + b''.join(bytes([(x * 4) % 256, (y * 5) % 256, 120]) for x in range(w)) for y in range(h))
    def chunk(t, d): c = struct.pack('>I', len(d)) + t + d; return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')

class Fake:
    def __init__(self):
        self.listings = [{'id': 'aaaaaaaa-0000-4000-8000-000000000001', 'title': 'Casio fx-991', 'description': 'Works well', 'category': 'Electronics', 'price': 1000, 'zone': 'Kutus', 'condition': 'Used, good', 'status': 'approved', 'photos': [], 'seller': {'handle': 'Seller_One', 'verified': False}, 'mine': False, 'createdAt': 1}]
        self.orders = []; self.mine = []; self.calls = []; self.auth_seen = []; self.registered = 0; self.uploaded = 0; self.completed = 0
        self.offline = False; self.pay_polls = 0; self.wallet = 0
    def handle(self, route, req):
        from urllib.parse import urlparse
        u = urlparse(req.url); path = u.path; m = req.method; h = req.headers
        body = {}
        try: body = json.loads(req.post_data) if req.post_data else {}
        except Exception: pass
        self.calls.append((m, path)); self.auth_seen.append((path, h.get('x-aid'), h.get('x-token')))
        cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}
        def ok(d, s=200): route.fulfill(status=s, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(d))
        if m == 'OPTIONS': return route.fulfill(status=204, headers=cors)
        if self.offline and path.startswith('/api/market/listings') and m == 'GET': return route.abort()
        if path == '/api/auth/register': self.registered += 1; return ok({'aid': 'u_serverid1', 'token': 'tok123', 'recovery_code': 'ABC123DEF456', 'referral_code': 'RC1'}, 201)
        if path == '/api/market/listings' and m == 'GET': return ok({'listings': self.listings, 'hasMore': False})
        if path == '/api/market/listings' and m == 'POST':
            l = {'id': 'bbbbbbbb-0000-4000-8000-000000000002', 'title': body['title'], 'description': body['description'], 'price': body['price'], 'zone': body['zone'], 'condition': body['condition'], 'category': body.get('category'), 'status': 'pending', 'photos': [], 'seller': {'handle': 'Me'}, 'mine': True, 'createdAt': 2}
            self.mine.append(l); self.last_listing = body; return ok(l, 201)
        if path == '/api/market/mine': return ok({'listings': self.mine})
        if path.endswith('/remove') and m == 'POST': return ok({'ok': True})
        if path == '/api/media/upload-url': self.last_upload = body; return ok({'id': 'cccccccc-0000-4000-8000-000000000003', 'upload_url': 'https://r2.test/put/abc.jpg', 'headers': {'Content-Type': 'image/jpeg'}, 'expires_in': 600}, 201)
        if path.endswith('/complete'): self.completed += 1; return ok({'status': 'ready'})
        if path == '/api/market/buy':
            if h.get('x-token') != 'tok123': return ok({'error': 'Please sign in again'}, 401)
            self.buy_body = body; return ok({'id': 'dddddddd-0000-4000-8000-000000000004', 'amount': 1000})
        if path == '/api/pay/status':
            self.pay_polls += 1
            if not self.orders: self.orders.append({'id': 'eeeeeeee-0000-4000-8000-000000000005', 'role': 'buyer', 'title': 'Casio fx-991', 'amount': 1000, 'status': 'held', 'dispute_status': 'none', 'code': '123456', 'createdAt': 3})
            return ok({'status': 'paid', 'receipt': 'RCP1', 'amount': 1000, 'order_id': self.orders[0]['id']})
        if path == '/api/orders/mine': return ok({'orders': self.orders})
        if path == '/api/wallet': return ok({'balance': self.wallet, 'ledger': [], 'withdrawals': []})
        if path.endswith('/received'):
            self.orders[0]['status'] = 'released'; return ok({'status': 'released'})
        return ok({'error': 'unexpected ' + path}, 404)

def main():
    fake = Fake(); png_path = os.path.join('/tmp', 'photo.png'); open(png_path, 'wb').write(png())
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 800}); page = ctx.new_page()
        errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        def app(route, req):
            from urllib.parse import urlparse
            f = urlparse(req.url).path.lstrip('/') or 'index.html'
            fp = os.path.join(ROOT, f)
            if not os.path.isfile(fp): return route.fulfill(status=404, body='')
            data = open(fp, 'rb').read()
            if f == 'index.html': data = data.decode().replace('https://comrade-connect-api.YOUR-SUBDOMAIN.workers.dev', API).encode()
            route.fulfill(status=200, body=data, content_type='text/html' if f.endswith('.html') else 'application/javascript' if f.endswith('.js') else 'application/octet-stream')
        page.route('http://app.test/**', app)
        page.route('http://app.test/config.js*', lambda r, q: r.fulfill(status=200, body="const CC_API='" + API + "';const CC_GOOGLE_ID='';", content_type='application/javascript'))
        page.route(API + '/**', fake.handle)
        page.route('https://r2.test/**', lambda r, q: (setattr(fake, 'uploaded', fake.uploaded + 1), r.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*'}, body=''))[1])
        page.route(lambda u: not (u.startswith('http://app.test') or u.startswith(API) or u.startswith('https://r2.test') or u.startswith('data:') or u.startswith('blob:')), lambda r, q: r.abort())
        page.goto('http://app.test/index.html'); page.wait_for_timeout(800)
        page.evaluate("localStorage.setItem('cs_cookie','\"essential\"')")
        def tab(): page.evaluate("document.querySelector('#tb [data-v=market]').click()")
        def dismiss_overlays():
            page.evaluate("document.querySelectorAll('#ck').forEach(e=>e.classList.remove('on'))")

        # 1. browse works without an account, no registration yet
        tab(); page.wait_for_timeout(600)
        check('browse shows the server listing', 'Casio fx-991' in page.inner_text('#mgrid'), page.inner_text('#mgrid'))
        check('browsing does not create an account', fake.registered == 0)

        # 2. offline state with retry
        fake.offline = True; page.evaluate("document.querySelector('#mseg [data-s=mine]').click();document.querySelector('#mseg [data-s=browse]').click()"); page.wait_for_timeout(500)
        check('offline browse shows retry', 'tap to retry' in page.inner_text('#mgrid').lower(), page.inner_text('#mgrid'))
        fake.offline = False; page.evaluate("document.querySelector('[data-retry=browse]').click()"); page.wait_for_timeout(500)
        check('retry reloads the list', 'Casio fx-991' in page.inner_text('#mgrid'))

        # 3. buy: first purchase registers, shows the recovery sheet, then pays
        page.evaluate("document.querySelector('#mgrid .mc').click()"); page.wait_for_timeout(300)
        page.evaluate("document.querySelector('#mvbuy').click()"); page.wait_for_timeout(200)
        check('fee note says 3% and 970', '3%' in page.inner_text('#bn') and '970' in page.inner_text('#bn'), page.inner_text('#bn'))
        page.evaluate("document.querySelector('#bgo').click()"); page.fill('#bph', '0712345678'); page.evaluate("document.querySelector('#bpay').click()"); page.wait_for_timeout(600)
        sheet = page.locator('text=Save your recovery code')
        check('recovery code sheet appears on first purchase', sheet.count() == 1)
        check('continue is locked until the box is ticked', page.locator('#ccgo').is_disabled())
        page.check('#ccok'); page.click('#ccgo'); page.wait_for_timeout(4500)
        check('registered exactly once', fake.registered == 1, fake.registered)
        check('buy call carried the server token and a server-made aid', any(p == '/api/market/buy' and a == 'u_serverid1' and t == 'tok123' for p, a, t in fake.auth_seen), [x for x in fake.auth_seen if x[0] == '/api/market/buy'])
        check('buy call sent the listing id and phone', fake.buy_body.get('phone') == '0712345678' and fake.buy_body.get('listing_id', '').startswith('aaaaaaaa'))
        check('paid screen shown', 'held safely in escrow' in page.inner_text('#bok'), page.inner_text('#bok'))
        check('account stored on the phone', json.loads(page.evaluate("localStorage.getItem('cc_auth')"))['aid'] == 'u_serverid1')
        check('M-Pesa number remembered for next time', json.loads(page.evaluate("localStorage.getItem('cc_phone')")) == '0712345678')
        check('listing leaves the browse list after buying', 'Casio fx-991' not in page.inner_text('#mgrid'))

        # 4. orders: code shown, buyer confirms with a double tap
        page.evaluate("document.querySelector('#bdone').click()"); page.wait_for_timeout(700)
        txt = page.inner_text('#olist')
        check('buyer sees the 6-digit code', '123456' in txt, txt)
        check('buyer has "I received it" and report buttons', 'I received it' in txt and 'Report a problem' in txt)
        page.evaluate("document.querySelector('#olist [data-a=received]').click()"); page.wait_for_timeout(300)
        check('first tap only arms the button', fake.orders[0]['status'] == 'held' and 'Tap again' in page.inner_text('#olist'))
        page.evaluate("document.querySelector('#olist [data-a=received]').click()"); page.wait_for_timeout(700)
        check('second tap releases the money', fake.orders[0]['status'] == 'released' and 'Completed' in page.inner_text('#olist'), page.inner_text('#olist'))

        # 5. sell: photo is compressed to JPEG, listing created, photo uploaded and completed
        page.evaluate("document.querySelector('#mseg [data-s=mine]').click()"); page.wait_for_timeout(300)
        page.evaluate("document.querySelector('#msell').click()"); page.wait_for_timeout(300)
        page.set_input_files('#mgi', png_path); page.wait_for_timeout(500)
        check('photo preview appears', page.locator('#mprev img').count() == 1)
        page.fill('#mti', 'Study desk'); page.fill('#mpr', '2500'); page.fill('#mde', 'Solid wood desk'); page.select_option('#mcat', 'Furniture')
        page.evaluate("document.querySelector('#msub').click()"); page.wait_for_timeout(1200)
        check('listing created with category and price', getattr(fake, 'last_listing', {}).get('category') == 'Furniture' and fake.last_listing.get('price') == 2500, getattr(fake, 'last_listing', None))
        check('photo asked for as image/jpeg with real size', getattr(fake, 'last_upload', {}).get('content_type') == 'image/jpeg' and fake.last_upload.get('bytes', 0) > 100, getattr(fake, 'last_upload', None))
        check('photo PUT to R2 and marked complete', fake.uploaded == 1 and fake.completed == 1, (fake.uploaded, fake.completed))
        check('My listings shows it waiting for admin', 'Waiting for admin verification' in page.inner_text('#mlist'), page.inner_text('#mlist'))

        # 6. validation: phone numbers in the description are blocked before any call
        n = len(fake.calls)
        page.evaluate("document.querySelector('#msell').click()"); page.wait_for_timeout(200)
        page.set_input_files('#mgi', png_path); page.wait_for_timeout(400)
        page.fill('#mti', 'Phone'); page.fill('#mpr', '3000'); page.fill('#mde', 'call me on 0712345678')
        page.evaluate("document.querySelector('#msub').click()"); page.wait_for_timeout(400)
        check('contact info blocked in the browser, no server call', len(fake.calls) == n, fake.calls[n:])

        check('no JavaScript errors on the page', not errors, errors)
        page.screenshot(path='/tmp/market-3a.png'); b.close()
    print('\n%d failed' % len(fails) if fails else '\nAll browser checks passed')
    sys.exit(1 if fails else 0)

main()
