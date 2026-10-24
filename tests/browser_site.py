"""Site editor browser test: admin.html > Site editor saves, and index.html shows what was saved. FAKE Worker. Run: python3 tests/browser_site.py"""
import json, os
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
API = 'https://cc-test.workers.dev'
fails = []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' ' + str(extra) if (extra and not cond) else ''))
    if not cond: fails.append(name)

FIELDS = [
 {'key': 'banner_on', 'kind': 'flag', 'group': 'Announcement banner', 'label': 'Show the banner', 'help': '', 'max': 0, 'multi': False, 'value': ''},
 {'key': 'banner_text', 'kind': 'text', 'group': 'Announcement banner', 'label': 'Banner message', 'help': '', 'max': 160, 'multi': False, 'value': ''},
 {'key': 'hero_title', 'kind': 'text', 'group': 'Home page words', 'label': 'Main title', 'help': '', 'max': 120, 'multi': False, 'value': ''},
 {'key': 'hide_live', 'kind': 'flag', 'group': 'Switch parts off', 'label': 'Hide Live', 'help': '', 'max': 0, 'multi': False, 'value': ''},
 {'key': 'custom_css', 'kind': 'css', 'group': 'Advanced styling', 'label': 'Extra CSS', 'help': '', 'max': 4000, 'multi': True, 'value': ''},
]
st = {'saved': {}, 'posts': []}

def serve(page):
    def app(route, req):
        f = urlparse(req.url).path.lstrip('/') or 'index.html'
        data = open(os.path.join(ROOT, f), 'rb').read()
        route.fulfill(status=200, body=data, content_type='text/html' if f.endswith('.html') else 'application/javascript')
    def worker(route, req):
        path = urlparse(req.url).path; cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}
        def ok(d, s=200): route.fulfill(status=s, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(d))
        if req.method == 'OPTIONS': return route.fulfill(status=204, headers=cors)
        if path == '/api/site-content': return ok({'content': st['saved']})
        if path.startswith('/api/admin/'):
            if req.headers.get('x-admin-key') != 'secret-key': return ok({'error': 'Not allowed'}, 403)
            if path == '/api/admin/login': return ok({'ok': True})
            if path == '/api/admin/queue': return ok({'counts': {'listings': 0, 'verifications': 0, 'disputes': 0, 'withdrawals': 0, 'reports': 0, 'underpaid': 0, 'confirm': 0}, 'listings': [], 'verifications': [], 'withdrawals': [], 'underpaid': [], 'confirm': [], 'disputes': [], 'content_reports': [], 'message_reports': []})
            if path == '/api/admin/site-content':
                if req.method == 'POST':
                    vals = json.loads(req.post_data)['values']; st['posts'].append(vals)
                    for k, v in vals.items(): st['saved'][k] = '1' if v is True else ('' if v is False else v)
                    return ok({'ok': True, 'changed': len(vals)})
                return ok({'fields': [dict(f, value=st['saved'].get(f['key'], '')) for f in FIELDS]})
            return ok({})
        return ok({}, 404)
    page.route('http://app.test/**', app); page.route(API + '/**', worker)
    page.route('http://app.test/config.js*', lambda r, q: r.fulfill(status=200, body="const CC_API='" + API + "';const CC_GOOGLE_ID='';", content_type='application/javascript'))

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 800}); page = ctx.new_page()
        errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        serve(page)
        page.goto('http://app.test/admin.html'); page.wait_for_timeout(300)
        page.fill('#k', 'secret-key'); page.click('#go'); page.wait_for_timeout(700)
        check('stat tiles show on the dashboard', page.locator('.stat').count() == 6)
        page.click('nav.tabs [data-tab=site]'); page.wait_for_timeout(300)
        check('Site editor tab lists the groups', page.locator('.grp').count() == 4, page.locator('.grp').count())
        check('save button starts disabled', page.locator('#scsave').is_disabled())
        page.locator('[data-sc=banner_on]').evaluate('e => e.click()')
        page.fill('[data-sc=banner_text]', 'Fresher bash on Friday')
        page.fill('[data-sc=hero_title]', 'Karibu <b>comrade</b>')
        page.locator('[data-sc=hide_live]').evaluate('e => e.click()')
        page.fill('[data-sc=custom_css]', 'h1{letter-spacing:.2em}')
        check('save button wakes up and counts changes', not page.locator('#scsave').is_disabled() and '5 change' in page.inner_text('#scmsg'), page.inner_text('#scmsg'))
        page.click('#scsave'); page.wait_for_timeout(600)
        sent = st['posts'][-1] if st['posts'] else {}
        check('save sends only the changed fields', set(sent) == {'banner_on', 'banner_text', 'hero_title', 'hide_live', 'custom_css'} and sent['banner_on'] is True, sent)
        check('form shows the saved values after reload', page.input_value('[data-sc=banner_text]') == 'Fresher bash on Friday')
        page.click('#thm'); check('theme switch works', page.evaluate('document.documentElement.dataset.theme') == 'light')
        check('admin has no JavaScript errors', not errors, errors)

        # the public site
        site = ctx.new_page(); errs2 = []; site.on('pageerror', lambda e: errs2.append(str(e))); serve(site)
        site.goto('http://app.test/index.html'); site.wait_for_timeout(1500)
        check('home title shows the edited words as plain text', site.inner_text('h1[data-cc=hero_title]') == 'Karibu <b>comrade</b>' and site.locator('h1[data-cc=hero_title] b').count() == 0, site.inner_text('h1[data-cc=hero_title]'))
        check('banner appears', site.locator('#cc-banner').count() == 1 and 'Fresher bash' in site.inner_text('#cc-banner'))
        check('Live tab is hidden', not site.locator('#tb button[data-v=live]').is_visible())
        check('extra CSS is applied', site.evaluate("getComputedStyle(document.querySelector('.hero h1')).letterSpacing") != 'normal')
        check('unedited words stay built in', 'Niaje comrade' in site.inner_text('[data-cc=hero_greeting]'))
        # clearing goes back to built-in
        st['saved'] = {}; site.evaluate("localStorage.removeItem('cc_site_v1')"); site.reload(); site.wait_for_timeout(1500)
        check('cleared fields return to the built-in text', 'Spill it' in site.inner_text('h1[data-cc=hero_title]') and site.locator('#cc-banner').count() == 0 and site.locator('#tb button[data-v=live]').is_visible())
        check('public site has no JavaScript errors from the editor', not [e for e in errs2 if 'site' in e.lower()], errs2)
        b.close()
    print('\n' + ('All site editor checks passed' if not fails else 'FAILED: ' + ', '.join(fails)))
    raise SystemExit(1 if fails else 0)
main()
