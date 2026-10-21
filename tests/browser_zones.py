"""Custom zones, light/dark mode and "no X next to Cancel": real page, FAKE Worker.
Run: python3 tests/browser_zones.py   (set SHOTS=/some/dir to also save screenshots)"""
import json, os, re, sys
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
API = 'https://cc-test.workers.dev'
SHOTS = os.environ.get('SHOTS')
fails = []
def check(n, c, x=''):
    print(('PASS ' if c else 'FAIL ') + n + (' ' + str(x) if (x and not c) else ''))
    if not c: fails.append(n)
def lum(rgb):
    r, g, b = [int(v) for v in re.findall(r'\d+', rgb)[:3]]
    f = lambda c: (c / 255 / 12.92) if c / 255 <= .03928 else (((c / 255 + .055) / 1.055) ** 2.4)
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b)
def ratio(a, b):
    x, y = sorted([lum(a), lum(b)], reverse=True); return (x + .05) / (y + .05)
def main():
    S = {'zones': ['Kerugoya', 'Kutus', 'Kagio', 'On campus'], 'posts': [], 'calls': [], 'gets': []}
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
            u = urlparse(req.url); path = u.path; qs = parse_qs(u.query); cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}
            def ok(d, s=200): route.fulfill(status=s, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(d))
            if req.method == 'OPTIONS': return route.fulfill(status=204, headers=cors)
            if path == '/api/config': return ok({'zones': S['zones']})
            if path == '/api/posts' and req.method == 'GET':
                S['gets'].append(qs); z = qs.get('zone', ['All'])[0]
                return ok({'posts': [x for x in S['posts'] if z == 'All' or x['zone'] == z], 'hasMore': False})
            if path == '/api/posts' and req.method == 'POST':
                body = json.loads(req.post_data); S['calls'].append(body)
                row = {'_id': 'p1', 'content': body['content'], 'category': body['category'], 'zone': body['zone'], 'aid': 'a1', 'likes': 0, 'views': 0, 'comments': [], 'createdAt': 1}
                S['posts'].insert(0, row); return ok(row, 201)
            return ok({'ok': True})
        page.route('http://app.test/**', app); page.route(API + '/**', worker)
        page.route('http://app.test/config.js*', lambda r, q: r.fulfill(status=200, body="const CC_API='" + API + "';const CC_GOOGLE_ID='';", content_type='application/javascript'))
        page.route(lambda u: not (u.startswith('http://app.test') or u.startswith(API) or u.startswith('data:') or u.startswith('blob:')), lambda r, q: r.abort())
        js = page.evaluate
        def shot(name):
            if SHOTS: os.makedirs(SHOTS, exist_ok=True); page.screenshot(path=os.path.join(SHOTS, name + '.png'))
        def vis(sel): return js("(s)=>[...document.querySelectorAll(s)].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').length", sel)
        def chips(): return js("[...document.querySelectorAll('#zones .tab')].map(t=>t.innerText.trim())")
        def opts(sel): return js("(s)=>[...document.querySelector(s).options].map(o=>o.text)", sel)
        def clear_welcome():                                   # the first-visit sign-in sheet: not under test, skip it
            js("(()=>{const d=document.querySelector('#dm.on');if(d){const b=[...d.querySelectorAll('button')].find(x=>/skip for now/i.test(x.textContent));b&&b.click()}})()"); page.wait_for_timeout(300)
        def popup_add(name):
            page.fill('#cczi', name); page.click('.cczo [data-go]'); page.wait_for_timeout(350)

        page.goto('http://app.test/index.html'); page.wait_for_timeout(300)
        js("localStorage.clear(); localStorage.setItem('cs_cookie','\"essential\"'); localStorage.setItem('cs_seen','1'); localStorage.setItem('cc_setup_done','1'); localStorage.setItem('cc_auth',JSON.stringify({aid:'a1b2c3d4e5f6',token:'tok'}))")
        page.goto('http://app.test/index.html'); page.wait_for_timeout(1000)
        js("document.getElementById('loader')&&document.getElementById('loader').remove()")   # splash screen: not under test

        # ---------- Section 1: custom zones ----------
        check('feed zone chips end with "+ Zone"', chips()[-1] == '+ Zone', chips())
        page.click('#zones .cczadd'); page.wait_for_timeout(250)
        check('tapping + Zone opens the popup', vis('.cczo') == 1)
        shot('zone-popup-dark')
        check('popup has Cancel and no X', vis('.cczo [data-no]') == 1 and vis('.cczo [aria-label*=lose i],.cczo .ccx-plain,.cczo .ccpb') == 0)
        page.fill('#cczi', 'a'); page.click('.cczo [data-go]')
        check('too short is refused with a message', 'letters or numbers' in page.inner_text('#ccze') and vis('.cczo') == 1)
        page.fill('#cczi', 'Hostel 0712345678'); page.click('.cczo [data-go]')
        check('phone numbers are refused', 'phone' in page.inner_text('#ccze').lower())
        popup_add('Sunrise Hostel')
        check('popup closes after adding', vis('.cczo') == 0)
        check('new zone chip appears and is selected', '@Sunrise Hostel' in chips() and js("document.querySelector('#zones .tab.on').dataset.z") == 'Sunrise Hostel', chips())
        check('feed asked the server for that zone', any(g.get('zone') == ['Sunrise Hostel'] for g in S['gets']))
        check('saved on the phone', js("JSON.parse(localStorage.getItem('cc_zones'))") == ['Sunrise Hostel'])
        check('+ Zone chip is still last', chips()[-1] == '+ Zone')
        js("document.querySelector('#zones [data-z=All]').click()")

        # drop-down in the Drop your tea form
        clear_welcome(); page.click('#fab'); page.wait_for_timeout(400)
        o = opts('#sz'); check('zone list has my zone and the add option', 'Sunrise Hostel' in o and o[-1] == '+ Add my own zone', o)
        check('Drop your tea sheet keeps its X (it has no Cancel)', vis('#md [aria-label=Close],#md .ccpb-x button') == 1, vis('#md [aria-label=Close],#md .ccpb-x button'))
        page.select_option('#sz', '__ccaddzone'); page.wait_for_timeout(300)
        check('choosing + Add my own zone opens the popup', vis('.cczo') == 1)
        popup_add('Njeri Plots')
        check('new zone is selected in the form', js("document.querySelector('#sz').value") == 'Njeri Plots')
        page.select_option('#sz', '__ccaddzone'); page.wait_for_timeout(300)
        popup_add('njeri plots')
        check('same name in other case is not added twice', js("document.querySelector('#sz').value") == 'Njeri Plots' and opts('#sz').count('Njeri Plots') == 1 and js("JSON.parse(localStorage.getItem('cc_zones'))") == ['Sunrise Hostel', 'Njeri Plots'])
        page.fill('#st', 'Water is back at Njeri Plots'); page.wait_for_timeout(100)
        page.click('#sb'); page.wait_for_timeout(700)
        check('story is posted with the custom zone', S['calls'] and S['calls'][-1]['zone'] == 'Njeri Plots', S['calls'])
        check('custom category form has no Cancel next to the sheet X', vis('#md [id=ccc]') == 0)

        # other pickers get the zone too
        js("document.querySelector('#md').classList.remove('on')")
        for sel in ['#mzo', '#rmz', '#htz', '#rz']:
            has = js("(s)=>{const e=document.querySelector(s);return !!e&&[...e.options].some(o=>o.text==='Njeri Plots')&&[...e.options].some(o=>o.text==='+ Add my own zone')}", sel)
            check('picker ' + sel + ' has my zones and the add option', has, opts(sel) if js("!!document.querySelector('%s')" % sel) else 'missing')
        check('delivery zone list is left alone', '+ Add my own zone' not in opts('#cdz') if js("!!document.querySelector('#cdz')") else True)

        # survive a reload (server list replaces ZONES after load)
        page.reload(); page.wait_for_timeout(1100); js("document.getElementById('loader')&&document.getElementById('loader').remove()")
        check('after reload my zones are still in the chips', '@Njeri Plots' in chips() and '@Sunrise Hostel' in chips() and '@Ngomongo' not in chips(), chips())
        check('and still in the pickers', 'Njeri Plots' in opts('#mzo'))

        # remove
        page.click('#zones .cczadd'); page.wait_for_timeout(250)
        page.click('.cczo [data-rm="Sunrise Hostel"]'); page.wait_for_timeout(250)
        check('Remove deletes the zone everywhere', '@Sunrise Hostel' not in chips() and 'Sunrise Hostel' not in opts('#mzo') and js("JSON.parse(localStorage.getItem('cc_zones'))") == ['Njeri Plots'])
        page.keyboard.press('Escape'); page.wait_for_timeout(200)
        check('Escape closes the popup', vis('.cczo') == 0)

        # ---------- Section 2: no X next to Cancel ----------
        js("""window.__mk=(cls,inner,id)=>{const m=document.createElement('div');if(cls)m.className=cls;m.id=id;m.innerHTML='<div class="box g" style="max-width:360px;width:100%">'+inner+'</div>';m.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:20px';document.body.appendChild(m);return m};0""")
        def xs(i): return js("(i)=>[...document.querySelectorAll('#'+i+' [aria-label=Close],#'+i+' .ccx-plain,#'+i+' .ccpb-x button,#'+i+' .ccx-b')].filter(e=>e.getClientRects().length).length", i)
        js("window.__mk('ccp-sheet','<h3>Sign out?</h3><div class=\"two\"><button class=\"btn g\">Cancel</button><button class=\"btn p\">Sign out</button></div>','t1')"); page.wait_for_timeout(500)
        check('profile-style sheet with Cancel: no X', xs('t1') == 0, xs('t1'))
        js("window.__mk('ccp-sheet','<h3>Recovery code</h3><button class=\"btn p\">Copy both</button>','t2')"); page.wait_for_timeout(500)
        check('profile-style sheet without Cancel: one X', xs('t2') == 1, xs('t2'))
        js("window.__mk('','<h3>Pay</h3><p>Plain popup</p><button class=\"btn g\">Cancel</button><button class=\"btn p\">Pay</button>','t3')"); page.wait_for_timeout(700)
        check('plain popup with Cancel: no X', xs('t3') == 0, xs('t3'))
        js("window.__mk('','<h3>Waiting for M-Pesa</h3><p>Check your phone</p><div style=\"height:140px\"></div>','t4')"); page.wait_for_timeout(700)
        check('plain popup without Cancel: one X', xs('t4') == 1, xs('t4'))
        js("document.querySelector('#t4 .box').insertAdjacentHTML('beforeend','<button class=\"btn g\">Cancel</button>')"); page.wait_for_timeout(700)
        check('Cancel appearing later removes the X', xs('t4') == 0, xs('t4'))
        js("[...document.querySelectorAll('#t1,#t2,#t3,#t4')].forEach(e=>e.remove())"); page.wait_for_timeout(300)

        # ---------- light and dark mode ----------
        def theme_state():
            return js("""()=>{const cs=getComputedStyle(document.body);return {t:document.documentElement.dataset.theme,bg:cs.backgroundColor,fg:cs.color,meta:document.querySelector('meta[name=theme-color]').content,scheme:getComputedStyle(document.documentElement).colorScheme}}""")
        d = theme_state(); check('starts dark', d['t'] == 'dark' and lum(d['bg']) < .05 and d['meta'] == '#000000' and d['scheme'] == 'dark', d)
        shot('feed-dark')
        page.click('#theme'); page.wait_for_timeout(300)
        l = theme_state(); check('toggle switches to light', l['t'] == 'light' and lum(l['bg']) > .9 and l['meta'] == '#ffffff' and l['scheme'] == 'light', l)
        check('light text is readable on light background', ratio(l['bg'], l['fg']) >= 7, ratio(l['bg'], l['fg']))
        check('choice is remembered', js("localStorage.getItem('cs_theme')") == 'light')
        shot('feed-light')
        page.click('#zones .cczadd'); page.wait_for_timeout(300); shot('zone-popup-light')
        pc = js("""()=>{const b=document.querySelector('.cczb'),i=document.querySelector('.cczb input'),h=document.querySelector('.cczb h3'),g=document.querySelector('.cczr .go');const c=e=>getComputedStyle(e);return {bg:c(b).backgroundColor,fg:c(h).color,ibg:c(i).backgroundColor,ifg:c(i).color,gbg:c(g).backgroundColor,gfg:c(g).color}}""")
        check('popup is light with dark text in light mode', lum(pc['bg']) > .9 and ratio(pc['bg'], pc['fg']) >= 7 and ratio(pc['ibg'], pc['ifg']) >= 7 and ratio(pc['gbg'], pc['gfg']) >= 7, pc)
        page.keyboard.press('Escape'); page.wait_for_timeout(200); clear_welcome()
        page.click('#fab'); page.wait_for_timeout(450); shot('tea-light')
        mc = js("""()=>{const b=document.querySelector('#md .bx'),t=document.querySelector('#md h2'),s=document.querySelector('#sz');const c=e=>getComputedStyle(e);return {bg:c(b).backgroundColor,fg:c(t).color,sbg:c(s).backgroundColor,sfg:c(s).color}}""")
        check('Drop your tea sheet is readable in light mode', lum(mc['bg']) > .8 and ratio(mc['bg'], mc['fg']) >= 7 and ratio(mc['bg'] if mc['sbg'].endswith(', 0)') else mc['sbg'], mc['sfg']) >= 4.5, mc)
        js("document.querySelector('#md').classList.remove('on')")
        page.click('#theme'); page.wait_for_timeout(300)
        d2 = theme_state(); check('toggle back to dark', d2['t'] == 'dark' and lum(d2['bg']) < .05 and d2['meta'] == '#000000', d2)
        page.click('#zones .cczadd'); page.wait_for_timeout(300)
        pd = js("""()=>{const b=document.querySelector('.cczb'),h=document.querySelector('.cczb h3'),i=document.querySelector('.cczb input');const c=e=>getComputedStyle(e);return {bg:c(b).backgroundColor,fg:c(h).color,ibg:c(i).backgroundColor,ifg:c(i).color}}""")
        check('popup is dark with light text in dark mode', lum(pd['bg']) < .05 and ratio(pd['bg'], pd['fg']) >= 7, pd)
        page.keyboard.press('Escape')
        check('no JavaScript errors on the page', not errors, errors)
        b.close()
    print('\n%d failed' % len(fails) if fails else '\nAll zone / theme / cancel checks passed'); sys.exit(1 if fails else 0)
main()
