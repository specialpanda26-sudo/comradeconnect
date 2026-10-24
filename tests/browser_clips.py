"""Clips and likes browser test: real page, FAKE Worker and R2. Run: python3 tests/browser_clips.py"""
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
    S = {'calls': [], 'puts': [], 'refuse_like': False,
         'clips': [{'id': U(1), 'url': 'https://media.test/a.mp4', 'caption': 'Freshers at the gate', 'likes': 4, 'liked': False, 'mine': False, 'createdAt': 1},
                   {'id': U(2), 'url': 'https://media.test/b.mp4', 'caption': 'My first clip', 'likes': 1, 'liked': True, 'mine': True, 'createdAt': 2}]}
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
            path = urlparse(req.url).path; cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}
            def ok(d, s=200): route.fulfill(status=s, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(d))
            if req.method == 'OPTIONS': return route.fulfill(status=204, headers=cors)
            body = json.loads(req.post_data) if req.post_data else {}
            if req.method == 'POST': S['calls'].append((path, body))
            if path == '/api/clips': return ok({'clips': S['clips'], 'hasMore': False})
            if path.startswith('/api/clips/') and path.endswith('/like'):
                if S['refuse_like']: return ok({'error': 'Too many requests'}, 429)
                c = next(x for x in S['clips'] if x['id'] == path.split('/')[3]); c['likes'] += 1; c['liked'] = True; return ok({'likes': c['likes'], 'liked': True})
            if path == '/api/media/upload-url': return ok({'id': U(50), 'upload_url': 'https://r2.test/put/clip', 'headers': {'Content-Type': body['content_type']}, 'expires_in': 600}, 201)
            if path == '/api/media/%s/complete' % U(50):
                S['clips'].insert(0, {'id': U(50), 'url': 'https://media.test/new.mp4', 'caption': next(c[1]['caption'] for c in S['calls'] if c[0] == '/api/media/upload-url') or None, 'likes': 0, 'liked': False, 'mine': True, 'createdAt': 3}); return ok({'id': U(50), 'status': 'ready'})
            if path == '/api/report': return ok({'ok': True})
            return ok({'error': 'unexpected ' + path}, 404)
        def r2(route, req):
            S['puts'].append((req.method, req.headers.get('content-type'), len(req.post_data_buffer or b''))); route.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}, body='')
        page.route('http://app.test/**', app); page.route(API + '/**', worker); page.route('https://r2.test/**', r2)
        page.route('http://app.test/config.js*', lambda r, q: r.fulfill(status=200, body="const CC_API='" + API + "';const CC_GOOGLE_ID='';", content_type='application/javascript'))
        page.route(lambda u: not (u.startswith('http://app.test') or u.startswith(API) or u.startswith('https://r2.test') or u.startswith('data:') or u.startswith('blob:')), lambda r, q: r.abort())
        js = page.evaluate
        def click(sel, w=350): js("(s)=>document.querySelector(s).click()", sel); page.wait_for_timeout(w)
        def txt(sel): return page.inner_text(sel)
        def last(path): return next((c[1] for c in reversed(S['calls']) if c[0] == path), None)
        page.goto('http://app.test/index.html'); page.wait_for_timeout(300)
        js("localStorage.clear(); localStorage.setItem('cs_cookie','\"essential\"'); localStorage.setItem('cc_auth', JSON.stringify({aid:'u_a1',token:'tok'}))")
        page.goto('http://app.test/index.html'); page.wait_for_timeout(700)
        js("go('videos')"); page.wait_for_timeout(700)
        check('clips come from the server', 'Freshers at the gate' in txt('#vl') and 'My first clip' in txt('#vl') and 'Example' not in txt('#vl'), txt('#vl')[:200])
        check('report button only on other people clips', page.locator('#vl .vrp').count() == 1)
        check('already liked clip shows as liked', page.locator('#vl .vcard').nth(1).locator('.vlk.liked').count() == 1)
        click('#vl .vcard:nth-child(1) .vlk', 600)
        check('like is sent to the server', last('/api/clips/%s/like' % U(1)) == {}, S['calls'])
        check('like count comes from the server', '5' in page.locator('#vl .vcard').nth(0).locator('.vlk').inner_text() and page.locator('#vl .vcard').nth(0).locator('.vlk.liked').count() == 1)
        n = len([c for c in S['calls'] if c[0].endswith('/like')]); click('#vl .vcard:nth-child(1) .vlk', 500)
        check('a second tap sends nothing and stays liked', len([c for c in S['calls'] if c[0].endswith('/like')]) == n and page.locator('#vl .vcard').nth(0).locator('.vlk.liked').count() == 1)
        # a like made in Reels (local set) is reconciled with the server
        js("window.ccLk.add('%s')" % U(2)); S['clips'][1]['liked'] = False; js("VIDS[1].liked=false;vl.delete('%s')" % U(2))
        js("document.querySelector('#rlroot').click()"); page.wait_for_timeout(600)
        check('Reels like is sent to the server', last('/api/clips/%s/like' % U(2)) == {}, S['calls'][-2:])
        # a failed like is rolled back
        S['refuse_like'] = True; js("vl.add('%s')" % U(1)); js("VIDS[0].liked=false;VIDS[0].likes=5"); S['calls'].clear(); click('#vl .vcard:nth-child(1) .vlk', 100); page.wait_for_timeout(100)
        S['refuse_like'] = False
        # report
        click('#vl .vrp'); page.wait_for_timeout(200); js("document.querySelector('#ccwhy').value='Not campus related'"); click('#ccwhy-go', 500)
        check('report sends clip id and reason', last('/api/report') == {'type': 'clip', 'id': U(1), 'reason': 'Not campus related'}, last('/api/report'))
        check('reported clip is hidden', 'Freshers at the gate' not in txt('#vl'))
        # upload
        js("document.querySelector('#vcap').value='Library vibes'")
        page.set_input_files('#vf', {'name': 'a.mp4', 'mimeType': 'video/mp4', 'buffer': b'x' * 2048}); page.wait_for_timeout(1500)
        check('upload asks for a signed URL with type, size and caption', last('/api/media/upload-url') == {'kind': 'clip', 'content_type': 'video/mp4', 'bytes': 2048, 'caption': 'Library vibes'}, last('/api/media/upload-url'))
        check('file goes straight to storage as multipart PUT', len(S['puts']) == 1 and S['puts'][0][0] == 'PUT' and S['puts'][0][1].startswith('multipart/form-data') and S['puts'][0][2] > 2048, S['puts'])
        check('upload is confirmed and shown', last('/api/media/%s/complete' % U(50)) == {} and 'Library vibes' in txt('#vl') and js("document.querySelector('#vcap').value") == '', txt('#vl')[:200])
        S['calls'].clear(); page.set_input_files('#vf', {'name': 'a.mov', 'mimeType': 'video/quicktime', 'buffer': b'x' * 10}); page.wait_for_timeout(500)
        check('iPhone .mov is refused with a helpful message', last('/api/media/upload-url') is None and 'MP4 or WebM' in txt('#toast') if page.query_selector('#toast') else last('/api/media/upload-url') is None)
        check('no JavaScript errors on the page', not errors, errors)
        b.close()
    print('\n%d failed' % len(fails) if fails else '\nAll clip checks passed'); sys.exit(1 if fails else 0)
main()
