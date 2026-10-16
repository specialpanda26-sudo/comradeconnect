"""Message alerts (banner, tab title, browser notification) browser test: real page, FAKE Worker. Run: python3 tests/browser_alerts.py"""
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
    S = {'threads': [{'id': U(1), 'with': 'Wanjiru', 'unread': 0, 'muted': False, 'blocked': False, 'listing': {'id': U(9), 'title': 'Calculator'}, 'last': None},
                     {'id': U(2), 'with': 'Brian', 'unread': 0, 'muted': True, 'blocked': False, 'listing': None, 'last': None}]}
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
            if path == '/api/messages/inbox': return ok({'threads': S['threads']})
            return ok({'ok': True})
        page.route('http://app.test/**', app); page.route(API + '/**', worker)
        page.route(lambda u: not (u.startswith('http://app.test') or u.startswith(API) or u.startswith('data:') or u.startswith('blob:')), lambda r, q: r.abort())
        js = page.evaluate
        def poll(w=400): js("CC.pollAlerts()"); page.wait_for_timeout(w)
        def banner(): return js("(()=>{const b=document.querySelector('#ccbn');return b&&!b.hidden?b.innerText:null})()")
        page.goto('http://app.test/index.html'); page.wait_for_timeout(300)
        js("localStorage.clear(); localStorage.setItem('cs_cookie','\"essential\"'); localStorage.setItem('cc_auth', JSON.stringify({aid:'u_a1',token:'tok'}))")
        page.add_init_script("window.__notes=[];window.Notification=class{constructor(t,o){window.__notes.push([t,o]);}close(){}};Notification.permission='granted';Notification.requestPermission=async()=>'granted';")
        page.goto('http://app.test/index.html'); page.wait_for_timeout(900)
        check('first look at the inbox only sets the baseline, no banner', banner() is None and js("document.title.startsWith('(')") is False)
        S['threads'][0]['unread'] = 1; poll()
        check('a new message shows a banner', banner() and 'You have a new message' in banner(), banner())
        check('banner has no message text or sender', 'Wanjiru' not in banner() and 'Calculator' not in banner())
        check('tab title shows the unread count', js("document.title.startsWith('(1) ')"), js("document.title"))
        check('Me tab shows an unread dot', js("!!document.querySelector('#tb [data-v=me] .ccdot')"))
        check('no browser notification while the tab is visible', js("window.__notes.length") == 0)
        poll(); js("document.querySelector('#ccbx').click()")
        check('same unread count does not alert again', banner() is None)
        js("document.querySelector('#ccbn') && (document.querySelector('#ccbn').hidden=true)")
        S['threads'][0]['unread'] = 3; poll(); check('two more messages are counted', banner() and 'You have 2 new messages' in banner(), banner())
        js("document.querySelector('#ccbv').click()"); page.wait_for_timeout(500)
        check('View opens Me and hides the banner', banner() is None and js("document.querySelector('#v-me').classList.contains('on')") is True)
        S['threads'][1]['unread'] = 5; js("document.querySelector('#ccbn').hidden=true"); poll()
        check('muted chats do not alert', banner() is None)
        check('muted chats are not in the unread count', js("document.title.startsWith('(3) ')"), js("document.title"))
        js("CC.DM.on=true;CC.DM.tid='%s'" % U(1)); S['threads'][0]['unread'] = 4; poll()
        check('the chat that is open does not alert', banner() is None)
        js("CC.DM.on=false;CC.DM.tid=null"); S['threads'][0]['unread'] = 5
        js("localStorage.setItem('cs_nt', JSON.stringify({n1:1,n2:0,n3:0}))"); poll()
        check('turning off Replies and messages silences alerts', banner() is None)
        js("localStorage.setItem('cs_nt', JSON.stringify({n1:1,n2:1,n3:0}))"); S['threads'][0]['unread'] = 6
        js("Object.defineProperty(document,'hidden',{get:()=>true,configurable:true})"); poll()
        notes = js("window.__notes")
        check('background tab gets a browser notification with generic text', len(notes) == 1 and notes[0][1]['body'] == 'You have a new message' and notes[0][1]['tag'] == 'cc-msg', notes)
        js("Object.defineProperty(document,'hidden',{get:()=>false,configurable:true})")
        S['threads'][0]['unread'] = 0; poll(); check('reading everything clears the title and dot', js("document.title.startsWith('(')") is False and js("!!document.querySelector('#tb [data-v=me] .ccdot')") is False, js("document.title"))
        check('no JavaScript errors on the page', not errors, errors)
        b.close()
    print('\n%d failed' % len(fails) if fails else '\nAll alert checks passed'); sys.exit(1 if fails else 0)
main()
