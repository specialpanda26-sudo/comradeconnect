"""Section 3B browser test: ID verification upload + referrals. Real page, FAKE Worker, nothing real is called.
Run: python3 tests/browser_3b.py"""
import json, os, sys, base64
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
API = 'https://cc-test.workers.dev'
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
fails = []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' ' + str(extra) if (extra and not cond) else ''))
    if not cond: fails.append(name)

def main():
    S = {'verify': {'verified': False, 'badge': None, 'request': None}, 'up': 0, 'put': None, 'submit': None, 'attr': [], 'attr_status': 201,
         'ref': {'code': 'MYCODE12', 'referred_by_someone': False, 'pending': 1, 'unlocked': 2, 'earned': 40, 'unlock_days': 7}, 'register': 0}
    with sync_playwright() as p:
        os.environ["PWDEBUG"]="0"
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 800}); page = ctx.new_page(); page.set_default_timeout(4000)
        errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        def app(route, req):
            f = urlparse(req.url).path.lstrip('/') or 'index.html'; fp = os.path.join(ROOT, f)
            if not os.path.isfile(fp): return route.fulfill(status=404, body='')
            data = open(fp, 'rb').read()
            if f == 'index.html': data = data.decode().replace('https://comrade-connect-api.YOUR-SUBDOMAIN.workers.dev', API)
            route.fulfill(status=200, body=data, content_type='text/html' if f.endswith('.html') else 'application/javascript')
        def worker(route, req):
            path = urlparse(req.url).path; cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}
            def ok(d, s=200): route.fulfill(status=s, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(d))
            if req.method == 'OPTIONS': return route.fulfill(status=204, headers=cors)
            if path == '/api/auth/register': S['register'] += 1; return ok({'aid': 'u_new1', 'token': 'tok1', 'recovery_code': 'RC1', 'referral_code': 'MYCODE12'}, 201)
            if path == '/api/verify/status': return ok(S['verify'])
            if path == '/api/verify/upload-url': S['up'] += 1; return ok({'r2_key': 'verif/' + 'a' * 32 + '.jpg', 'upload_url': 'https://r2.test/private/put', 'headers': {'Content-Type': 'image/jpeg'}, 'expires_in': 600})
            if path == '/api/verify/submit':
                S['submit'] = json.loads(req.post_data)
                S['verify'] = {'verified': False, 'badge': None, 'request': {'status': 'pending', 'claimed_role': S['submit'].get('role'), 'barcode_check': S['submit'].get('barcode'), 'decision_note': None}}
                return ok({'id': 'x', 'status': 'pending'}, 201)
            if path == '/api/referral/attribute':
                S['attr'].append((json.loads(req.post_data)['code'], req.headers.get('x-aid'), req.headers.get('x-token')))
                return ok({'ok': True} if S['attr_status'] == 201 else {'error': 'nope'}, S['attr_status'])
            if path == '/api/referral/me': return ok(S['ref'])
            if path in ('/api/market/listings',): return ok({'listings': [], 'hasMore': False})
            return ok({'error': 'unexpected ' + path}, 404)
        def r2(route, req):
            S['put'] = (req.method, req.headers.get('content-type'), len(req.post_data_buffer or b''))
            route.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}, body='')
        page.route('http://app.test/**', app); page.route(API + '/**', worker); page.route('https://r2.test/**', r2)
        page.route(lambda u: not (u.startswith('http://app.test') or u.startswith(API) or u.startswith('https://r2.test') or u.startswith('data:') or u.startswith('blob:')), lambda r, q: r.abort())
        def js(x): return page.evaluate(x)
        def fresh(url='http://app.test/index.html', auth=True):
            page.goto(url); page.wait_for_timeout(300)
            js("localStorage.clear()")
            js("localStorage.setItem('cs_cookie','\"essential\"')")
            js("localStorage.setItem('cc_auth', JSON.stringify({aid:'u_a1',token:'tok_a1'}))" if auth else "localStorage.removeItem('cc_auth')")
            if not auth: js("localStorage.removeItem('cc_ref')")
            page.goto(url); page.wait_for_timeout(700)

        # ---------- ID verification ----------
        fresh()
        js("document.querySelector('#tb [data-v=me]').click()"); page.wait_for_timeout(500)
        check('not verified yet message', 'Not verified yet' in page.inner_text('#vst'), page.inner_text('#vst'))
        js("openDm('bdg')"); page.wait_for_timeout(200)
        page.fill('#bdnm', 'Jane Wanjiru'); page.fill('#bdn', 'SC211/0123/2022')
        page.set_input_files('#bdf', {'name': 'front.png', 'mimeType': 'image/png', 'buffer': PNG})
        page.set_input_files('#bdf2', {'name': 'back.png', 'mimeType': 'image/png', 'buffer': PNG}); page.wait_for_timeout(500)
        js("(()=>{const e=document.querySelector('#bdr');e.value='Class rep';e.dispatchEvent(new Event('change',{bubbles:true}))})()")
        js("document.querySelector('#bds').click()"); page.wait_for_timeout(300)
        check('class rep without a group link is refused on the phone', S['up'] == 0)
        js("document.querySelector('#bdl').value='https://chat.example.com/abc'")
        js("document.querySelector('#bds').click()"); page.wait_for_timeout(300)
        if S['up'] == 0:   # barcode did not match the number: it asks for a second tap
            js("document.querySelector('#bds').click()")
        page.wait_for_timeout(1500)
        check('one upload-url request', S['up'] == 1, S['up'])
        check('photo PUT to the private bucket as one JPEG', S['put'] and S['put'][0] == 'PUT' and S['put'][1].startswith('multipart/form-data') and S['put'][2] > 100, S['put'])
        sb = S['submit'] or {}
        check('submit carries name, number, role, link and the key', sb.get('full_name') == 'Jane Wanjiru' and sb.get('id_number') == 'SC211/0123/2022' and sb.get('role') == 'Class rep' and sb.get('group_link') == 'https://chat.example.com/abc' and sb.get('r2_key', '').startswith('verif/'), sb)
        check('barcode result is sent as a plain word', sb.get('barcode') in ('match', 'mismatch', 'unread', 'unsupported', 'none'), sb)
        check('status now reads Sent', 'Sent' in page.inner_text('#vst') and 'Class rep' in page.inner_text('#vst'), page.inner_text('#vst'))
        check('the Get verified button is hidden while waiting', js('document.querySelector("#vgo").hidden'))
        check('form is cleared after sending', page.input_value('#bdf') == '' and page.inner_text('#bdfn') == '')

        S['verify'] = {'verified': False, 'badge': None, 'request': {'status': 'rejected', 'claimed_role': 'Student', 'decision_note': 'Photo is blurry', 'barcode_check': 'unread'}}
        js("document.querySelector('#tb [data-v=home]') && document.querySelector('#tb [data-v=home]').click()"); js("document.querySelector('#tb [data-v=me]').click()"); page.wait_for_timeout(700)
        check('rejection note is shown', 'Not approved: Photo is blurry' in page.inner_text('#vst'), page.inner_text('#vst'))
        check('can send a new request after rejection', not js('document.querySelector("#vgo").hidden') and 'new request' in page.inner_text('#vgo'), (page.is_visible('#vgo'), js("document.querySelector('#vgo').hidden"), page.inner_text('#vgo'), js("JSON.stringify(ME.ver)")))

        S['verify'] = {'verified': True, 'badge': 'Class rep', 'request': {'status': 'approved', 'claimed_role': 'Class rep', 'decision_note': None, 'barcode_check': 'match'}}
        js("document.querySelector('#tb [data-v=me]').click()"); page.wait_for_timeout(700)
        check('verified with badge', 'Verified as Class rep' in page.inner_text('#vst'), page.inner_text('#vst'))
        check('withdraw gate opens once verified', js("idOK()") is True)
        S['verify'] = {'verified': True, 'badge': None, 'request': {'status': 'approved', 'claimed_role': 'Student', 'decision_note': None, 'barcode_check': 'match'}}
        js("document.querySelector('#tb [data-v=me]').click()"); page.wait_for_timeout(700)
        check('verified student can ask for a role badge', 'Verified student' in page.inner_text('#vst') and 'badge' in page.inner_text('#vgo'), (page.inner_text('#vst'), page.inner_text('#vgo')))

        # ---------- referrals ----------
        fresh('http://app.test/index.html?ref=abcd1234', auth=False); S['attr'].clear()
        check('invite code from the link is remembered (upper case)', js("JSON.parse(localStorage.getItem('cc_ref')||'null')") == 'ABCD1234')
        js("goTo('rewards','rewards')"); page.wait_for_timeout(500)
        check('signed out: asks to sign in', 'Sign in to get your invite link' in page.inner_text('#rlk'), page.inner_text('#rlk'))
        js("void CC.ensureAccount()"); page.wait_for_timeout(600)
        check('recovery sheet shown on signup', page.locator('text=Save your recovery code').count() == 1)
        page.check('#ccok'); page.click('#ccgo'); page.wait_for_timeout(1200)
        check('signup did not hang and registered once', S['register'] == 1, S['register'])
        check('saved code sent once with the new account token', S['attr'] == [('ABCD1234', 'u_new1', 'tok1')], S['attr'])
        check('saved code cleared after success', js("JSON.parse(localStorage.getItem('cc_ref')||'null')") in ('', None))
        js("goTo('rewards','rewards')"); page.wait_for_timeout(800)
        check('invite link uses the server code', '?ref=MYCODE12' in page.inner_text('#rlk'), page.inner_text('#rlk'))
        led = page.inner_text('#rled')
        check('shows waiting count and paid rewards', 'Waiting' in led and 'Rewards paid' in led and 'KSh 40' in led, led)
        check('WhatsApp link carries the server code', 'MYCODE12' in (page.get_attribute('#rwa', 'href') or ''), page.get_attribute('#rwa', 'href'))
        S['ref'] = {**S['ref'], 'referred_by_someone': True}; js("void window.ccRefresh()"); page.wait_for_timeout(500)
        check('after using a code the entry box goes away', page.locator('#rfc').count() == 0)

        # code used by hand; rejected code is dropped, a server error keeps it
        S['ref']['referred_by_someone'] = False; S['attr'].clear(); S['attr_status'] = 409
        js("localStorage.setItem('cc_ref', JSON.stringify('LATE1234'))"); js("void window.ccRefresh(true)"); page.wait_for_timeout(800)
        check('a refused code (409) is dropped, not retried forever', js("JSON.parse(localStorage.getItem('cc_ref')||'null')") in ('', None) and len(S['attr']) == 1, S['attr'])
        S['attr_status'] = 500; S['attr'].clear()
        js("localStorage.setItem('cc_ref', JSON.stringify('RETRY123'))"); js("void window.ccRefresh(true)"); page.wait_for_timeout(800)
        check('a server error (500) keeps the code for next time', js("JSON.parse(localStorage.getItem('cc_ref')||'null')") == 'RETRY123')
        js("localStorage.setItem('cc_ref','\"\"')")
        page.fill('#rfc', 'zzzz9999'); S['attr_status'] = 201; S['attr'].clear()
        js("document.querySelector('[data-go=enter]').click()"); page.wait_for_timeout(800)
        check('typed friend code is sent upper case', any(a[0] == 'ZZZZ9999' for a in S['attr']), S['attr'])

        check('no JavaScript errors on the page', not errors, errors)
        b.close()
    print('\n%d failed' % len(fails) if fails else '\nAll 3B browser checks passed')
    sys.exit(1 if fails else 0)
main()
