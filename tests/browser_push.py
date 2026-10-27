"""Phone alerts in the new app: real page (frontend/app), FAKE Android (Capacitor) and FAKE Worker.
Run: python3 tests/browser_push.py"""
import json, os, sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
API = 'https://cc-test.example'
TOKEN = 'fcmtoken_' + 'x' * 30
fails = []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' ' + str(extra) if (extra and not cond) else ''))
    if not cond: fails.append(name)

def fake_android(perm='prompt', grant=True, reg_error=None, fcm_event=True):
    return """(function(){
  var L={};window.__push={reg:0,perm:%r,asked:0,channels:0,cleared:0};
  var P={addListener:function(n,f){L[n]=f;return Promise.resolve({remove:function(){}})},
    checkPermissions:function(){return Promise.resolve({receive:window.__push.perm})},
    requestPermissions:function(){window.__push.asked++;window.__push.perm=%s?'granted':'denied';return Promise.resolve({receive:window.__push.perm})},
    createChannel:function(){window.__push.channels++;return Promise.resolve()},
    register:function(){window.__push.reg++;%s;setTimeout(function(){L.registration&&L.registration({value:%r})},40);return Promise.resolve()}};
  var NL={};var N={addListener:function(n,f){NL[n]=f;return Promise.resolve()},takeTap:function(){return Promise.resolve({})},clear:function(){window.__push.cleared++;return Promise.resolve()}};
  window.__fire=function(n,d){if(L[n])L[n](d)};window.__tap=function(d){if(NL.ccTap)NL.ccTap(d)};
  window.Capacitor={isNativePlatform:function(){return true},isPluginAvailable:function(n){return n==='CCNotif'||n==='PushNotifications'},Plugins:{},
    registerPlugin:function(n){return n==='PushNotifications'?P:n==='CCNotif'?N:{}}};
})();""" % (perm, 'true' if grant else 'false', ("return Promise.reject(new Error(%r))" % reg_error) if reg_error else '', TOKEN if fcm_event else '')

def run(case, android, server, steps):
    seen = {'calls': []}
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 800}); page = ctx.new_page()
        errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        if android: page.add_init_script(android)
        def app(route, req):
            f = urlparse(req.url).path.lstrip('/') or 'app/index.html'
            if f.endswith('/'): f += 'index.html'
            fp = os.path.join(ROOT, f)
            if f == 'app/config.js': return route.fulfill(status=200, body="const CC_API='" + API + "';const CC_GOOGLE_ID='';", content_type='application/javascript')
            if not os.path.isfile(fp): return route.fulfill(status=404, body='')
            route.fulfill(status=200, body=open(fp, 'rb').read(), content_type='text/html' if f.endswith('.html') else 'text/css' if f.endswith('.css') else 'application/javascript')
        def worker(route, req):
            path = urlparse(req.url).path; q = urlparse(req.url).query
            cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}
            if req.method == 'OPTIONS': return route.fulfill(status=204, headers=cors)
            body = json.loads(req.post_data) if req.post_data else None
            seen['calls'].append((req.method, path, body, req.headers.get('x-aid'), req.headers.get('x-token')))
            code, data = server(req.method, path, q, body)
            route.fulfill(status=code, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(data))
        page.route('http://app.test/**', app); page.route(API + '/**', worker)
        page.route(lambda u: not (u.startswith('http://app.test') or u.startswith(API) or u.startswith('data:') or u.startswith('blob:')), lambda r, q: r.abort())
        page.goto('http://app.test/app/index.html#app'); page.wait_for_timeout(500)
        page.evaluate("localStorage.setItem('cc_auth', JSON.stringify({aid:'u_me',token:'tok_me'}))")
        steps(page, seen); page.close(); b.close()
    check(case + ': no script errors', not errors, errors[:2])

def calls(seen, method, path): return [c for c in seen['calls'] if c[0] == method and c[1] == path]
def sheet_text(page): return page.evaluate("document.getElementById('sheet').innerText")

def good_server(extra=None):
    def f(m, path, q, body):
        if extra:
            r = extra(m, path, q, body)
            if r: return r
        if path == '/api/me': return 200, {'aid': 'u_me', 'handle': 'tester', 'points': 0}
        if path == '/api/push/fcm': return 200, {'ok': True}
        if path == '/api/push/fcm-remove': return 200, {'ok': True}
        if path == '/api/push/status': return 200, {'fcm': True, 'project': 'proj-1', 'key_ok': True, 'phones': [{'phone': '...' + TOKEN[-6:], 'app': 'new'}], 'prefs': {}, 'last_test': None}
        if path == '/api/push/test': return 200, {'ok': True, 'step': 'sent', 'message': 'Firebase accepted the test alert.', 'devices': [{'ok': True}]}
        if path == '/api/notifications/prefs': return 200, {'prefs': {'updates': True, 'events': True, 'comments': True, 'messages': True, 'live': True, 'orders': True, 'wallet': True}}
        if path == '/api/notifications': return 200, {'items': [], 'events': [], 'unread': 0, 'unread_total': 0}
        return 200, {}
    return f

def t_register(page, seen):
    page.wait_for_timeout(5500)
    c = calls(seen, 'POST', '/api/push/fcm')
    check('register: the phone address is sent once signed in, as a new-app phone', len(c) >= 1 and c[0][2] == {'token': TOKEN, 'v': 2}, c[:1])
    check('register: it carries the account headers', c and c[0][3] == 'u_me' and c[0][4] == 'tok_me', c[:1])
    check('register: permission asked and channel made', page.evaluate('__push.asked') == 1 and page.evaluate('__push.channels') >= 1)
    n = len(c); page.wait_for_timeout(5000)
    check('register: it does not keep re-sending', len(calls(seen, 'POST', '/api/push/fcm')) == n)

def t_checkok(page, seen):
    page.wait_for_timeout(5500)
    page.evaluate("A.mesheet('notif')"); page.wait_for_timeout(300)
    page.get_by_text('Send a test').click(); page.wait_for_timeout(600)
    page.evaluate("__fire('pushNotificationReceived',{title:'Test alert',data:{kind:'test'}})"); page.wait_for_timeout(1500)
    t = sheet_text(page)
    check('check: every step ends with a tick and the sheet says it reached the phone', t.count('✓') == 7 and 'reached this phone' in t, t)
    check('check: the test was sent to the server', len(calls(seen, 'POST', '/api/push/test')) == 1)

def t_nofile(page, seen):
    page.wait_for_timeout(2500)
    page.evaluate("A.mesheet('notif')"); page.wait_for_timeout(200)
    page.get_by_text('Send a test').click(); page.wait_for_timeout(1500)
    t = sheet_text(page)
    check('no Firebase file: it names GOOGLE_SERVICES_JSON_BASE64', 'GOOGLE_SERVICES_JSON_BASE64' in t, t)
    check('no Firebase file: nothing was sent to the server and no test attempted', not calls(seen, 'POST', '/api/push/fcm') and not calls(seen, 'POST', '/api/push/test'))

def t_denied(page, seen):
    page.wait_for_timeout(2000)
    page.evaluate("A.mesheet('notif')"); page.wait_for_timeout(200)
    page.get_by_text('Send a test').click(); page.wait_for_timeout(1500)
    check('permission denied: the sheet says how to turn alerts on', 'Settings > Apps > Comrade Connect > Notifications' in sheet_text(page), sheet_text(page))

def t_nokey(page, seen):
    page.wait_for_timeout(5500)
    page.evaluate("A.mesheet('notif')"); page.wait_for_timeout(200)
    page.get_by_text('Send a test').click(); page.wait_for_timeout(1800)
    t = sheet_text(page)
    check('Render has no key: the sheet shows the server hint and does not send a test', 'FCM_SERVICE_ACCOUNT is not set on Render' in t and not calls(seen, 'POST', '/api/push/test'), t)

def t_taps(page, seen):
    page.wait_for_timeout(5500)
    page.evaluate("__tap({view:'orders',ref_type:'order'})"); page.wait_for_timeout(700)
    check('tap: an order alert opens Market > Orders', page.evaluate("S.tab==='market' && S.mkTab==='orders'"))
    page.evaluate("__tap({view:'live',ref_type:'live'})"); page.wait_for_timeout(700)
    check('tap: a live alert opens Watch > Live', page.evaluate("S.tab==='watch' && S.wTab==='live'"))
    page.evaluate("__fire('pushNotificationActionPerformed',{notification:{data:{view:'bell',ref_type:'test'}}})"); page.wait_for_timeout(800)
    check('tap: a test alert opens the bell', 'Notifications' in sheet_text(page))
    check('tap: opening the bell clears the phone notifications', page.evaluate('__push.cleared') >= 1)

def t_prefs(page, seen):
    page.wait_for_timeout(1500)
    page.evaluate("A.mesheet('notif')"); page.wait_for_timeout(500)
    page.evaluate("var e=document.querySelector('#sheet #n2');e.checked=false;e.dispatchEvent(new Event('change'))"); page.wait_for_timeout(500)
    c = calls(seen, 'POST', '/api/notifications/prefs')
    p = c[-1][2]['prefs'] if c else {}
    check('switches: turning off replies and messages saves comments and messages off, the rest stay on', p.get('comments') is False and p.get('messages') is False and p.get('orders') is True and p.get('wallet') is True and p.get('updates') is True, p)

def t_signout(page, seen):
    page.wait_for_timeout(5500)
    page.evaluate("A.signout()"); page.wait_for_timeout(500)
    c = calls(seen, 'POST', '/api/push/fcm-remove')
    check('sign out: this phone is taken off the account first', len(c) == 1 and c[0][2] == {'token': TOKEN} and c[0][3] == 'u_me', c)

def t_web(page, seen):
    page.wait_for_timeout(1500)
    page.evaluate("A.mesheet('notif')"); page.wait_for_timeout(200)
    page.get_by_text('Send a test').click(); page.wait_for_timeout(500)
    check('website: it says alerts come from the Android app and calls nothing', 'Android app' in sheet_text(page) and not [c for c in seen['calls'] if '/api/push/' in c[1]], sheet_text(page))
    page.evaluate("document.querySelector('#sheet .sh-h button').click()"); page.wait_for_timeout(200)
    page.evaluate("A.mesheet('notif')"); page.wait_for_timeout(200)
    page.evaluate("A.allow()"); page.wait_for_timeout(300)
    check('website: Allow alerts explains instead of pretending', 'Android app' in page.evaluate("document.getElementById('toast').innerText"))

run('register', fake_android(), good_server(), t_register)
run('check ok', fake_android(), good_server(), t_checkok)
run('no Firebase file', fake_android(reg_error='Default FirebaseApp is not initialized in this process'), good_server(), t_nofile)
run('permission denied', fake_android(perm='denied', grant=False), good_server(), t_denied)
run('no key on Render', fake_android(), good_server(lambda m, p, q, b: (200, {'fcm': False, 'project': None, 'key_ok': None, 'hint': 'FCM_SERVICE_ACCOUNT is not set on Render. Do the thing.', 'phones': [{'phone': '...' + TOKEN[-6:], 'app': 'new'}]}) if p == '/api/push/status' else None), t_nokey)
run('taps', fake_android(), good_server(), t_taps)
run('prefs', fake_android(), good_server(), t_prefs)
run('sign out', fake_android(), good_server(), t_signout)
run('website', None, good_server(), t_web)
print('\n%d failed' % len(fails)); sys.exit(1 if fails else 0)
