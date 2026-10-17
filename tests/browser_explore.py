"""Explore (roommates, groups, polls, Hearts, Wi-Fi, hostels, services, tips, zones) browser test: real page, FAKE Worker.
Run: python3 tests/browser_explore.py"""
import json, os, re, sys
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
    S = {'calls': [], 'adult': False, 'next': 100, 'match': False,
         'rooms': [{'id': U(1), 'kind': 'offering', 'title': 'Room in Kutus', 'details': 'Self-contained, water included', 'rent': 4500, 'zone': 'Kutus', 'createdAt': 1, 'mine': False}],
         'groups': [{'id': U(2), 'name': 'MAT 110', 'unit': 'MAT 110', 'details': 'Sat 3pm at Library', 'max_members': 5, 'members': 2, 'joined': False, 'createdAt': 1, 'mine': False}],
         'polls': [{'id': U(3), 'question': 'Best study spot on campus?', 'options': ['Library', 'Hostel', 'Under a tree'], 'counts': [3, 1, 0], 'voted': None, 'closed': False, 'createdAt': 1, 'mine': False}],
         'hearts': [{'id': U(4), 'content': '[Friendship] Final year, love hiking and chess', 'zone': 'Kagio', 'createdAt': 1, 'mine': False, 'interested': False}],
         'wifi': [{'id': U(5), 'place': 'Library 2F', 'zone': 'On campus', 'speed_note': 'Fast', 'score': 2, 'votes': 2, 'my_vote': 0, 'createdAt': 1, 'mine': False}],
         'hostels': [{'id': U(6), 'name': 'Sunrise Hostel', 'zone': 'Kerugoya', 'rent': 5000, 'rating': 4, 'review': 'Clean, water most days', 'createdAt': 1, 'mine': False}],
         'services': [{'id': U(7), 'title': 'Quick Print Point', 'category': 'Printing', 'price_note': 'KSh 5 a page', 'zone': 'Kutus', 'details': 'Open 8 to 8', 'createdAt': 1, 'mine': False}],
         'tips': [{'id': U(8), 'unit': 'STAT 201', 'tip': 'Do past papers from year 2 first', 'likes': 3, 'createdAt': 1, 'mine': False}],
         'zones': [{'zone': 'Kutus', 'ratings': 2, 'safety': 4.0, 'noise': 2.0, 'value': 3.0}], 'sent': [], 'refuse': None}
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
            u = urlparse(req.url); path = u.path; qs = parse_qs(u.query); cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}
            def ok(d, s=200): route.fulfill(status=s, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(d))
            if req.method == 'OPTIONS': return route.fulfill(status=204, headers=cors)
            body = json.loads(req.post_data) if req.post_data else {}
            if req.method == 'POST': S['calls'].append((path, body))
            if S['refuse'] and req.method == 'POST' and path.startswith('/api/c/'): return ok({'error': S['refuse']}, 400)
            if path == '/api/me/adult': S['adult'] = True; return ok({'adult_confirmed': True})
            if path == '/api/report': return ok({'ok': True})
            if path == '/api/notices': return ok({'notices': [{'id': U(30), 'title': 'Exam timetable out', 'body': 'Check the board', 'pinned': True, 'createdAt': 1}]})
            if path == '/api/messages/inbox': return ok({'threads': []})
            if path == '/api/messages/send': S['sent'].append(body); return ok({'thread_id': U(900), 'message': {'id': 'm1', 'body': body['body'], 'mine': True, 'createdAt': 1}}, 201)
            if path == '/api/messages/thread/' + U(900): return ok({'messages': []})
            if path == '/api/messages/thread/' + U(901): return ok({'messages': [{'id': 'sys', 'body': 'You matched on Hearts.', 'mine': False, 'system': True, 'createdAt': 1}]})
            if path == '/api/market/listings': return ok({'listings': [], 'hasMore': False})
            if path == '/api/c/zones' and req.method == 'GET': return ok({'zones': S['zones']})
            if path == '/api/c/zones/rate': S['zones'] = [{'zone': body['zone'], 'ratings': 1, 'safety': body['safety'], 'noise': body['noise'], 'value': body['value']}]; return ok({'ok': True})
            m = re.match(r'^/api/c/(rooms|groups|polls|hearts|wifi|hostels|services|tips)(?:/([^/]+)/(join|leave|vote|interest|like))?$', path)
            if m:
                kind, iid, act = m.groups(); L = S[kind]
                if not iid and req.method == 'GET':
                    if kind == 'hearts' and not S['adult']: return ok({'error': 'Confirm you are 18 or older to use Hearts'}, 403)
                    S.setdefault('gets', []).append((kind, qs)); items = L
                    if 'zone' in qs: items = [x for x in L if x.get('zone') == qs['zone'][0]]
                    return ok({'items': items, 'hasMore': False})
                if not iid:
                    S['next'] += 1; row = {**body, 'id': U(S['next']), 'createdAt': 2, 'mine': True}
                    if kind == 'groups': row.update(members=0, joined=False, max_members=body.get('max_members', 10))
                    if kind == 'tips': row['likes'] = 0
                    if kind == 'wifi': row.update(score=0, votes=0, my_vote=0)
                    L.insert(0, row); return ok(row, 201)
                it = next(x for x in L if x['id'] == iid)
                if act == 'join': it['members'] += 1; it['joined'] = True; return ok({'joined': True, 'members': it['members']})
                if act == 'leave': it['members'] -= 1; it['joined'] = False; return ok({'joined': False})
                if act == 'vote' and kind == 'polls': it['counts'][body['option']] += 1; it['voted'] = body['option']; return ok({'counts': it['counts'], 'voted': body['option']})
                if act == 'vote': it['my_vote'] = body['value']; it['votes'] += 1; it['score'] += body['value']; return ok({'score': it['score'], 'votes': it['votes'], 'my_vote': body['value']})
                if act == 'like': it['likes'] += 1; return ok({'likes': it['likes']})
                if act == 'interest': it['interested'] = True; return ok({'interested': True, 'matched': S['match'], 'thread_id': U(901) if S['match'] else None})
            return ok({'error': 'unexpected ' + path}, 404)
        page.route('http://app.test/**', app); page.route(API + '/**', worker)
        page.route('http://app.test/config.js*', lambda r, q: r.fulfill(status=200, body="const CC_API='" + API + "';const CC_GOOGLE_ID='';", content_type='application/javascript'))
        page.route(lambda u: not (u.startswith('http://app.test') or u.startswith(API) or u.startswith('data:') or u.startswith('blob:')), lambda r, q: r.abort())
        js = page.evaluate
        def fill(sel, v): js("([s,v])=>{const e=document.querySelector(s);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))}", [sel, v])
        def click(sel): js("(s)=>document.querySelector(s).click()", sel); page.wait_for_timeout(350)
        def tab(x): click('#xt [data-x=%s]' % x); page.wait_for_timeout(300)
        def body(): return page.inner_text('#xbody')
        def last(path): return next((c[1] for c in reversed(S['calls']) if c[0] == path), None)
        page.goto('http://app.test/index.html'); page.wait_for_timeout(300)
        js("localStorage.clear(); localStorage.setItem('cs_cookie','\"essential\"'); localStorage.setItem('cc_auth', JSON.stringify({aid:'u_a1',token:'tok'}))")
        page.goto('http://app.test/index.html'); page.wait_for_timeout(700)
        click('#tb [data-v=explore]'); page.wait_for_timeout(500)
        # tabs the Worker does not serve keep working while connected
        tab('nt'); page.wait_for_timeout(500)
        check('Notices tab shows admin notices from the Worker', 'Exam timetable out' in body() and 'Pinned' in body() and 'Check the board' in body(), body()[:300])
        tab('ev'); check('Events tab still renders', 'Upcoming campus events' in body(), body()[:100])
        tab('rm'); page.wait_for_timeout(300)
        # roommates
        check('roommates come from the server', 'Self-contained, water included' in body() and 'KSh 4,500' in body(), body()[:200])
        check('old local sample text is gone', 'Example' not in body())
        click('#xbody [data-xz=Kagio]'); check('zone chip asks the server for that zone', ('rooms', {'page': ['1'], 'zone': ['Kagio']}) in S['gets'], S['gets'][-2:])
        check('no rooms in that zone shows the empty message', 'No roommate posts here yet' in body())
        click('#xbody [data-xz=All]')
        click('#xbody [data-xa=dm]'); page.wait_for_timeout(500)
        fill('#dmi', 'Is it still free?'); js("document.querySelector('#dmf').requestSubmit()"); page.wait_for_timeout(500)
        check('message about a room goes by room id, never by person', S['sent'] == [{'ref_type': 'room', 'ref_id': U(1), 'body': 'Is it still free?'}], S['sent'])
        js("shut()")
        click('#xbody [data-xa=rp]'); fill('#ccwhy', 'Looks like a scam'); click('#ccwhy-go'); page.wait_for_timeout(400)
        check('report sends type, id and reason', last('/api/report') == {'type': 'room', 'id': U(1), 'reason': 'Looks like a scam'}, last('/api/report'))
        check('reported room is hidden for me', 'Self-contained' not in body())
        # post a room
        click('#xbody [data-xa=new]'); fill('#rmb', '4000'); fill('#rmn', 'Call me on 0712345678'); click('#rmS')
        check('phone number in a room note is stopped on the phone', last('/api/c/rooms') is None)
        fill('#rmn', 'Shared room, 2 minutes from the gate'); click('#rmS'); page.wait_for_timeout(300)
        r = last('/api/c/rooms')
        check('room is saved on the server', r and r['details'] == 'Shared room, 2 minutes from the gate' and r['rent'] == 4000 and r['kind'] in ('offering', 'looking'), r)
        check('new room shows at the top', 'Shared room, 2 minutes from the gate' in body() and 'Your post' in body())
        # study groups
        tab('sg'); check('groups come from the server', 'MAT 110' in body() and '2 of 5 comrades joined' in body(), body()[:200])
        click('#xbody [data-xa=join]'); check('join is sent and counted', '3 of 5' in body() and 'Joined. Tap to leave' in body(), body()[:200])
        click('#xbody [data-xa=join]'); check('leave is sent', '2 of 5' in body())
        click('#xbody [data-xa=new]'); fill('#sgu', 'PHY 120'); fill('#sgw', 'Sun 4pm'); fill('#sgp', 'Room 12'); click('#sgS'); page.wait_for_timeout(300)
        g = last('/api/c/groups')
        check('group is created with unit, time and place', g and g['name'] == 'PHY 120' and g['details'] == 'Sun 4pm at Room 12', g)
        check('creator is joined automatically', any(c[0] == '/api/c/groups/%s/join' % U(S['next']) for c in S['calls']) and '1 of 10' in body(), body()[:300])
        # polls
        tab('pl'); check('poll shows without results before voting', 'Best study spot on campus?' in body() and '75%' not in body())
        click('#xbody [data-xa=vote][data-i="0"]'); check('vote shows results from the server counts', '80%' in body() and '(your vote)' in body(), body()[:300])
        check('cannot vote twice from the screen', js("document.querySelector('#xbody [data-xa=vote]').disabled") is True)
        click('#xbody [data-xa=new]'); fill('#plq', 'Best snack at the cafeteria?'); fill('#plo1', 'Mandazi'); fill('#plo2', 'Chapati'); click('#plS'); page.wait_for_timeout(300)
        check('poll is created with its options', last('/api/c/polls') == {'question': 'Best snack at the cafeteria?', 'options': ['Mandazi', 'Chapati']}, last('/api/c/polls'))
        # Hearts
        tab('ht'); check('Hearts asks for the 18+ confirmation first', 'I am 18 or older' in body() and 'Final year' not in body())
        click('#xbody [data-xa=h18]'); page.wait_for_timeout(500)
        check('confirming calls the server and then shows posts', S['adult'] and 'Final year, love hiking and chess' in body() and 'Friendship' in body(), body()[:300])
        check('no number-sharing step any more', 'Share my number' not in body())
        click('#xbody [data-xa=hi]'); check('interest is sent', 'Interest sent' in body())
        S['match'] = True; S['hearts'].append({'id': U(10), 'content': 'Love music', 'zone': 'Kutus', 'createdAt': 1, 'mine': False, 'interested': False}); click('#xbody [data-xz=Kutus]'); page.wait_for_timeout(300)
        click('#xbody [data-xa=hi]'); page.wait_for_timeout(600)
        check('a match opens the private chat', 'You matched on Hearts' in page.inner_text('#dmlog'), page.inner_text('#dmlog'))
        js("shut()")
        click('#xbody [data-xa=new]'); fill('#htn', 'Text me on 0712345678 please'); click('#htS')
        check('number in a Hearts post is stopped on the phone', last('/api/c/hearts') is None)
        fill('#htn', 'Third year, into football and cooking'); click('#htS'); page.wait_for_timeout(300)
        h = last('/api/c/hearts'); check('Hearts post is saved with its style tag', h and h['content'].endswith('Third year, into football and cooking') and h['content'].startswith('['), h)
        # Wi-Fi
        tab('wf'); check('Wi-Fi spots come from the server', 'Library 2F' in body() and 'Works 2' in body(), body()[:300])
        check('no passwords on the screen', 'Show' not in body() and 'Password' not in body().replace('Do not post passwords', ''))
        click('#xbody [data-xa=wdn]'); check('vote not working is sent', last('/api/c/wifi/%s/vote' % U(5)) == {'value': -1} and 'Not working 1' in body(), body()[:300])
        click('#xbody [data-xa=new]'); fill('#x_wp', 'Hostel B corridor'); js("document.querySelector('#x_ws').value='Fast'")
        click('#xbody [data-xa=save]'); page.wait_for_timeout(300)
        check('Wi-Fi spot is saved', last('/api/c/wifi') == {'place': 'Hostel B corridor', 'zone': 'Kerugoya', 'speed_note': 'Fast'}, last('/api/c/wifi'))
        # typed text survives a background reload (the old bug)
        click('#xbody [data-xa=new]'); fill('#x_wp', 'half typed place'); js("exs_probe=1")
        click('#xbody [data-xz=All]'); page.wait_for_timeout(300)
        check('typed text is not wiped when the list refreshes', js("(document.querySelector('#x_wp')||{}).value") == 'half typed place')
        click('#xbody [data-xa=cancel]')
        # hostels
        tab('hs'); check('hostel reviews come from the server', 'Sunrise Hostel' in body() and '4/5' in body() and 'KSh 5,000' in body(), body()[:300])
        click('#xbody [data-xa=new]'); fill('#x_hn', 'Baraka Plots'); fill('#x_hr', '3500'); fill('#x_hv', 'Quiet and safe, water is slow'); click('#xbody [data-xa=save]'); page.wait_for_timeout(300)
        hs = last('/api/c/hostels'); check('hostel review is saved with rent and rating', hs and hs['name'] == 'Baraka Plots' and hs['rent'] == 3500 and hs['rating'] == 4, hs)
        # services
        tab('sv'); check('services come from the server', 'Quick Print Point' in body() and 'KSh 5 a page' in body())
        check('services have no Call or WhatsApp buttons', 'Call' not in body().split('Add a service')[-1] and 'WhatsApp' not in body())
        click('#xbody [data-xa=new]'); fill('#x_st', 'Gas Express'); js("document.querySelector('#x_sc').value='Gas refill'"); fill('#x_sd', 'Call 0712345678 for gas'); click('#xbody [data-xa=save]')
        check('phone number in a service is stopped on the phone', last('/api/c/services') is None)
        fill('#x_sd', 'Refills and delivery to hostels, 7am to 9pm'); click('#xbody [data-xa=save]'); page.wait_for_timeout(300)
        sv = last('/api/c/services'); check('service is saved', sv and sv['title'] == 'Gas Express' and 'delivery' in sv['details'], sv)
        click('#xbody [data-xc=Printing]'); check('category chip filters the list', 'Quick Print Point' in body() and 'Gas Express' not in body())
        S['sent'].clear(); click('#xbody [data-xa=dm]'); page.wait_for_timeout(400); fill('#dmi', 'Open now?'); js("document.querySelector('#dmf').requestSubmit()"); page.wait_for_timeout(500)
        check('message a service by its id', S['sent'] == [{'ref_type': 'service', 'ref_id': U(7), 'body': 'Open now?'}], S['sent'])
        js("shut()")
        # study tips
        tab('sn'); check('tips come from the server', 'Do past papers from year 2 first' in body() and 'Helpful 3' in body())
        click('#xbody [data-xa=like]'); check('like is counted once from the server', 'Helpful 4' in body())
        js("document.querySelector('#x_q').focus()"); fill('#x_q', 'zzz'); page.wait_for_timeout(300)
        check('search filters the loaded tips', 'Do past papers' not in body(), body()[:200])
        check('search box keeps focus while typing', js("document.activeElement.id") == 'x_q')
        fill('#x_q', '')
        click('#xbody [data-xa=new]'); fill('#x_nu', 'stat 201'); fill('#x_nt', 'Learn the formulas by doing examples'); click('#xbody [data-xa=save]'); page.wait_for_timeout(300)
        check('tip is saved with the unit in capitals', last('/api/c/tips') == {'unit': 'STAT 201', 'tip': 'Learn the formulas by doing examples'}, last('/api/c/tips'))
        S['refuse'] = 'You are posting too fast'; click('#xbody [data-xa=new]'); fill('#x_nu', 'MAT 1'); fill('#x_nt', 'Another useful tip here'); click('#xbody [data-xa=save]'); page.wait_for_timeout(300)
        check('server refusal keeps the typed tip', js("(document.querySelector('#x_nt')||{}).value") == 'Another useful tip here'); S['refuse'] = None
        # zone ratings
        click('#tb [data-v=feed]'); page.wait_for_timeout(400)
        check('leaderboard comes from the server', 'No ratings yet' in js("document.querySelector('#lbd').innerText") and 'Safety 4.0' in js("document.querySelector('#lbd').innerText"), js("document.querySelector('#lbd').innerText"))
        click('#rate'); js("document.querySelector('#rz').value='Kutus'")
        click('#rsub'); check('rating needs every score', last('/api/c/zones/rate') is None)
        for k, n in (('safety', 5), ('quiet', 4), ('value', 3)): js("([k,n])=>document.querySelector('#rrows [data-k=%s] [data-n=\"'+n+'\"]'.replace('%s',k)).click()" % ('x', 'x'), [k, n]) if False else js("([k,n])=>document.querySelector('#rrows [data-k=\"'+k+'\"] [data-n=\"'+n+'\"]').click()", [k, n])
        click('#rsub'); page.wait_for_timeout(500)
        check('rating is sent with quiet turned into noise', last('/api/c/zones/rate') == {'zone': 'Kutus', 'safety': 5, 'noise': 2, 'value': 3}, last('/api/c/zones/rate'))
        check('leaderboard refreshes', 'Safety 5.0' in js("document.querySelector('#lbd').innerText") and 'Quiet 4.0' in js("document.querySelector('#lbd').innerText"), js("document.querySelector('#lbd').innerText"))
        # Feed story: message the poster
        S['sent'].clear()
        js("tgt2={kind:'post',id:'%s',aid:'old'};dmSnip='Hostel water is back'" % U(55)); js("openDm('more')"); click('#morebox [data-a=dm]'); page.wait_for_timeout(500)
        fill('#dmi', 'Which hostel?'); js("document.querySelector('#dmf').requestSubmit()"); page.wait_for_timeout(500)
        check('message a Feed poster by story id', S['sent'] == [{'ref_type': 'post', 'ref_id': U(55), 'body': 'Which hostel?'}], S['sent'])
        check('no JavaScript errors on the page', not errors, errors)
        b.close()
    print('\n%d failed' % len(fails) if fails else '\nAll explore checks passed'); sys.exit(1 if fails else 0)
main()
