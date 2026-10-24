"""Live browser test: real page, FAKE Worker. Run: python3 tests/browser_live.py"""
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
    S = {'calls': [], 'host_ok': False, 'ended': False, 'hearts': 2, 'comments': [{'id': U(90), 'name': 'Wanjiru', 'text': 'Congrats graduands', 'at': '2026-10-17T10:00:00.000Z'}],
         'streams': [{'id': U(1), 'title': 'Graduation day', 'watch_url': 'https://www.youtube.com/watch?v=abcdefghijk', 'embed_url': 'https://www.youtube-nocookie.com/embed/abcdefghijk', 'viewers': 7, 'hearts': 2, 'startedAt': 1},
                     {'id': U(2), 'title': 'Derby watch party', 'watch_url': 'https://www.tiktok.com/@club/live', 'embed_url': None, 'viewers': 3, 'hearts': 0, 'startedAt': 2}]}
    with sync_playwright() as p:
        b = p.chromium.launch(); page = b.new_context(viewport={'width': 390, 'height': 800}).new_page(); page.set_default_timeout(5000)
        errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        def app(route, req):
            f = urlparse(req.url).path.lstrip('/') or 'index.html'; fp = os.path.join(ROOT, f)
            if not os.path.isfile(fp): return route.fulfill(status=404, body='')
            route.fulfill(status=200, body=open(fp, 'rb').read(), content_type='text/html' if f.endswith('.html') else 'application/javascript')
        def worker(route, req):
            path = urlparse(req.url).path; cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}
            def ok(d, s=200): route.fulfill(status=s, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(d))
            if req.method == 'OPTIONS': return route.fulfill(status=204, headers=cors)
            body = json.loads(req.post_data) if req.post_data else {}
            if req.method == 'POST': S['calls'].append((path, body))
            if path == '/api/live' and req.method == 'GET': return ok({'streams': S['streams']})
            if path == '/api/live/start':
                if not S['host_ok']: return ok({'error': 'Only club admins can go live'}, 403)
                S['streams'].insert(0, {'id': U(3), 'title': body['title'], 'watch_url': body['url'], 'embed_url': 'https://www.youtube-nocookie.com/embed/zzzzzzzzzzz', 'viewers': 0, 'hearts': 0, 'startedAt': 3}); return ok({'id': U(3), 'watch_url': body['url'], 'embed_url': 'https://www.youtube-nocookie.com/embed/zzzzzzzzzzz'}, 201)
            if path.endswith('/ping'):
                if S['ended']: return ok({'status': 'ended', 'viewers': 0, 'hearts': S['hearts'], 'comments': []})
                since = body.get('since'); cs = [c for c in S['comments'] if not since or c['at'] > since]
                return ok({'status': 'live', 'viewers': 12, 'hearts': S['hearts'], 'comments': cs})
            if path.endswith('/heart'): S['hearts'] += body['n']; return ok({'hearts': S['hearts']})
            if path.endswith('/comment'):
                if '0712' in body['text']: return ok({'error': 'Remove phone numbers, handles and links'}, 400)
                c = {'id': U(100 + len(S['comments'])), 'name': 'Comrade', 'text': body['text'], 'at': '2026-10-17T10:0%d:00.000Z' % (len(S['comments']) + 1)}; S['comments'].append(c); return ok(c, 201)
            if path.endswith('/remove'): return ok({'ok': True})
            if path.endswith('/end'): return ok({'ok': True})
            return ok({'error': 'unexpected ' + path}, 404)
        page.route('http://app.test/**', app); page.route(API + '/**', worker)
        page.route('http://app.test/config.js*', lambda r, q: r.fulfill(status=200, body="const CC_API='" + API + "';const CC_GOOGLE_ID='';", content_type='application/javascript'))
        page.route(lambda u: not (u.startswith('http://app.test') or u.startswith(API) or u.startswith('data:') or u.startswith('blob:')), lambda r, q: r.abort())
        js = page.evaluate
        def click(sel, w=350): js("(s)=>document.querySelector(s).click()", sel); page.wait_for_timeout(w)
        def calls(suffix): return [c for c in S['calls'] if c[0].endswith(suffix)]
        page.goto('http://app.test/index.html'); page.wait_for_timeout(300)
        js("localStorage.clear(); localStorage.setItem('cs_cookie','\"essential\"'); localStorage.setItem('cc_auth', JSON.stringify({aid:'u_a1',token:'tok'}))")
        page.goto('http://app.test/index.html'); page.wait_for_timeout(700)
        js("go('live')"); page.wait_for_timeout(800)
        t = page.inner_text('#lvl')
        check('live list comes from the server with viewer counts', 'Graduation day' in t and 'Derby watch party' in t and '7 watching' in t and 'Nobody is live' not in t, t[:200])
        # --- watch a YouTube live ---
        click('#lvl [data-i="0"]', 900)
        check('room opens with the YouTube player inside the app', page.locator('#rframe iframe[src^="https://www.youtube-nocookie.com/embed/abcdefghijk"]').count() == 1)
        check('viewer count shown from the server', '12 watching' in page.inner_text('#rv'), page.inner_text('#rv'))
        check('existing comments are loaded and the heart count shown', 'Wanjiru: Congrats graduands' in page.inner_text('#lchat') and '2 hearts' in page.inner_text('#lhc'), page.inner_text('#lchat'))
        check('ping carries a viewer id but no account', len(calls('/ping')) >= 1 and calls('/ping')[0][1].get('v'))
        check('the host-only End button is hidden for a viewer', page.locator('#lend').is_hidden())
        # --- hearts ---
        click('#lheart', 100); click('#lheart', 100); click('#lheart', 100)
        check('tapping the heart floats heart icons (SVG, no emoji)', page.locator('#lhf svg.fh').count() >= 1 and page.locator('#lhf').inner_text().strip() == '')
        check('local count goes up straight away', '5 hearts' in page.inner_text('#lhc'), page.inner_text('#lhc'))
        page.wait_for_timeout(1900)
        check('taps are sent together as one request', [c[1]['n'] for c in calls('/heart')] == [3], calls('/heart'))
        S['hearts'] += 4; page.wait_for_timeout(5500)
        check("other people's hearts show up and animate", '9 hearts' in page.inner_text('#lhc'), page.inner_text('#lhc'))
        # --- comments ---
        page.fill('#li', 'Call me 0712345678'); click('#lf button', 600)
        check('a refused comment shows the reason and keeps the text', 'Remove phone numbers' in page.inner_text('#toast') and page.input_value('#li') == 'Call me 0712345678')
        page.fill('#li', '<img src=x onerror=window.__x=1> Hongera'); click('#lf button', 700)
        check('a sent comment appears, and markup stays as plain text', 'Hongera' in page.inner_text('#lchat') and page.locator('#lchat img').count() == 0 and js('window.__x') is None and page.input_value('#li') == '')
        # --- leave, then a TikTok live (cannot be embedded) ---
        click('#rend', 600)
        check('leaving returns to the list', page.locator('#room').is_hidden() and page.locator('#lvl').is_visible())
        click('#lvl [data-i="1"]', 700)
        a = page.locator('#rframe a')
        check('TikTok live opens in its own app, safely', page.locator('#rframe iframe').count() == 0 and a.count() == 1 and a.get_attribute('href') == 'https://www.tiktok.com/@club/live' and a.get_attribute('target') == '_blank' and 'noopener' in a.get_attribute('rel'))
        check('chat still works for it', 'tiktok' in page.inner_text('#rframe').lower())
        click('#rend', 400)
        # --- host ---
        page.fill('#ltitle', 'Strike update'); click('#golive', 400)
        check('going live without a link is refused on the phone', 'Paste the live link' in page.inner_text('#toast') and not calls('/api/live/start'))
        page.fill('#lurl', 'https://www.youtube.com/watch?v=zzzzzzzzzzz'); click('#golive', 700)
        check('a non-admin gets the server reason', 'Only club admins' in page.inner_text('#toast') and page.locator('#room').is_hidden())
        S['host_ok'] = True; click('#golive', 900)
        check('host goes live and sees the End button', page.locator('#room').is_visible() and page.locator('#lend').is_visible() and calls('/api/live/start')[-1][1] == {'title': 'Strike update', 'url': 'https://www.youtube.com/watch?v=zzzzzzzzzzz'})
        check('host can remove a comment', page.locator('#lchat .lnk').count() >= 1)
        click('#lchat .lnk', 500)
        check('removal is sent to the server', len(calls('/remove')) == 1)
        click('#lend', 700)
        check('ending sends the end request and returns to the list', len(calls('/end')) == 1 and page.locator('#room').is_hidden())
        # --- stream ends while watching ---
        click('#lvl [data-i="0"]', 600); S['ended'] = True; page.wait_for_timeout(5600)
        check('a stream that ends while you watch sends you back to the list', page.locator('#room').is_hidden() and 'has ended' in page.inner_text('#toast'))
        check('no JavaScript errors', not errors, errors)
        b.close()
main()
print('\n%d failed' % len(fails) if fails else '\nAll live checks passed'); sys.exit(1 if fails else 0)
