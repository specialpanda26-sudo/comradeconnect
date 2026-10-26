"""Mbogi Talk + Live camera flip + floating comments: real page, FAKE Worker, FAKE AgoraRTC.
Run: python3 tests/browser_mbogi.py   (needs: pip install playwright; playwright install chromium)"""
import json, os, re, sys
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
API = 'https://cc-test.workers.dev'
U = lambda n: '%08d-0000-4000-8000-000000000000' % n
CODE = 'abc-defg-hij'
fails = []
def check(n, c, x=''):
    print(('PASS ' if c else 'FAIL ') + n + (' ' + str(x) if (x and not c) else ''))
    if not c: fails.append(n)
iso = lambda dt: dt.strftime('%Y-%m-%dT%H:%M:%S.') + '%03dZ' % (dt.microsecond // 1000)
now = lambda s=0: iso(datetime.now(timezone.utc) + timedelta(seconds=s))

# A fake AgoraRTC. The app loads it from a URL containing "agora"; every such URL is answered with this.
AGORA_STUB = r"""
(function () {
  var W = window, ag = W.__ag = { calls: [], plays: [], tracks: [], joined: [], pubs: [], roles: [], setDevice: [], left: 0, client: null };
  var cams = [{ deviceId: 'cam-front', label: 'Front camera' }, { deviceId: 'cam-back', label: 'Back camera' }];
  function mk(kind, face) {
    var t = { kind: kind, face: face === 'environment' ? 'environment' : 'user', enabled: true, closed: false, stopped: false };
    t.dev = t.face === 'environment' ? 'cam-back' : 'cam-front';
    t.play = function (el, o) {
      ag.plays.push({ kind: kind, mirror: o && o.mirror, face: t.face });
      if (el) { var old = el.querySelector('.fakevid'); if (old) old.remove(); var d = document.createElement('div'); d.className = 'fakevid'; el.appendChild(d); }
    };
    t.stop = function () { t.stopped = true; }; t.close = function () { t.closed = true; };
    t.setEnabled = function (v) { t.enabled = !!v; return Promise.resolve(); };
    t.setDevice = function (id) { ag.setDevice.push(id); t.dev = id; t.face = id === 'cam-back' ? 'environment' : 'user'; return Promise.resolve(); };
    t.getMediaStreamTrack = function () { return { getSettings: function () { return { facingMode: t.face, deviceId: t.dev }; }, label: t.dev === 'cam-back' ? 'Back camera' : 'Front camera', readyState: 'live' }; };
    t.setVolume = function () {};
    ag.tracks.push(t); return t;
  }
  function client() {
    var c = { remoteUsers: [], connectionState: 'CONNECTED', h: {} };
    c.on = function (ev, f) { (c.h[ev] = c.h[ev] || []).push(f); };
    c.setClientRole = function (r) { ag.roles.push(r); return Promise.resolve(); };
    c.join = function (app, ch, tk) { ag.joined.push({ app: app, ch: ch, tk: tk }); return Promise.resolve(5001); };
    c.publish = function (t) { ag.pubs.push(t.map(function (x) { return x.kind; })); return Promise.resolve(); };
    c.subscribe = function () { return Promise.resolve(); };
    c.leave = function () { ag.left++; return Promise.resolve(); };
    c.enableAudioVolumeIndicator = function () {};
    ag.client = c; return c;
  }
  W.AgoraRTC = {
    createClient: client,
    createMicrophoneAndCameraTracks: function (a, v) { ag.calls.push({ fn: 'micAndCam', v: v }); return Promise.resolve([mk('audio'), mk('video', v && v.facingMode)]); },
    createCameraVideoTrack: function (v) { ag.calls.push({ fn: 'cam', v: v }); return Promise.resolve(mk('video', v && v.facingMode)); },
    createMicrophoneAudioTrack: function () { ag.calls.push({ fn: 'mic' }); return Promise.resolve(mk('audio')); },
    getCameras: function () { return Promise.resolve(cams); }, onAudioAutoplayFailed: null
  };
  ag.addRemote = function (uid, video, audio) {
    var u = { uid: uid, hasVideo: !!video, hasAudio: !!audio };
    if (video) u.videoTrack = { play: function (el) { if (el) { var d = document.createElement('div'); d.className = 'fakevid'; el.appendChild(d); } } };
    if (audio) u.audioTrack = { play: function () {}, setVolume: function () {} };
    ag.client.remoteUsers.push(u); (ag.client.h['user-published'] || []).forEach(function (f) { f(u, video ? 'video' : 'audio'); });
  };
})();
"""

def main():
    S = {'calls': [], 'host_is_me': True, 'mb_events': [], 'mb_status': 'open', 'eid': 0,
         'live_comments': [{'id': U(50 + i), 'name': 'Old' + str(i), 'text': 'old comment ' + str(i), 'at': now(-3600 + i)} for i in range(3)],
         'streams': [{'id': U(2), 'title': 'Hostel tour', 'native': True, 'channel': 'lv2', 'viewers': 1, 'hearts': 0, 'startedAt': 2}]}
    def ev(kind, name, text):
        S['eid'] += 1; e = {'id': U(500 + S['eid']), 'kind': kind, 'name': name, 'text': text, 'at': now()}; S['mb_events'].append(e); return e
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 800}); page = ctx.new_page(); page.set_default_timeout(6000)
        errors = []; warns = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: warns.append(m.text) if 'could not hook' in m.text else None)
        def app(route, req):
            f = urlparse(req.url).path.lstrip('/') or 'index.html'; fp = os.path.join(ROOT, f)
            if not os.path.isfile(fp): return route.fulfill(status=404, body='')
            ct = 'text/html' if f.endswith('.html') else 'text/css' if f.endswith('.css') else 'image/svg+xml' if f.endswith('.svg') else 'application/json' if f.endswith('.json') else 'application/javascript'
            route.fulfill(status=200, body=open(fp, 'rb').read(), content_type=ct)
        def worker(route, req):
            path = urlparse(req.url).path; cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}
            def ok(d, s=200): route.fulfill(status=s, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(d))
            if req.method == 'OPTIONS': return route.fulfill(status=204, headers=cors)
            body = json.loads(req.post_data) if req.post_data else {}
            if req.method == 'POST': S['calls'].append((path, body))
            # ----- Mbogi Talk -----
            if path == '/api/mbogi/create': return ok({'code': CODE, 'title': body.get('title') or "Kamau's Mbogi", 'channel': 'mbabcdefghij'}, 201)
            m = re.match(r'^/api/mbogi/([a-z]{3}-[a-z]{4}-[a-z]{3})(?:/(\w+))?$', path)
            if m:
                act = m.group(2)
                if not act and req.method == 'GET': return ok({'code': CODE, 'title': 'Study group', 'status': S['mb_status'], 'host': 'Kamau', 'count': 2, 'max': 12})
                if act == 'join': return ok({'token': None, 'channel': 'mbabcdefghij', 'title': 'Study group', 'host': S['host_is_me'], 'name': 'Kamau', 'max': 12})
                if act == 'ping':
                    since = body.get('since'); evs = [e for e in S['mb_events'] if not since or e['at'] > since] if since else S['mb_events'][-30:]
                    ppl = [{'viewer': 'v_me', 'name': 'Kamau', 'uid': body.get('uid'), 'hand': bool(body.get('hand')), 'host': S['host_is_me'], 'me': True},
                           {'viewer': 'v_ach', 'name': 'Achieng', 'uid': '7777', 'hand': False, 'host': not S['host_is_me'], 'me': False}]
                    return ok({'status': S['mb_status'], 'people': ppl, 'events': evs})
                if act == 'send':
                    if body.get('kind') == 'chat' and '0712' in body.get('text', ''): return ok({'error': 'Remove phone numbers, handles and links'}, 400)
                    e = ev(body['kind'], 'Kamau', body['text']); return ok({'id': e['id'], 'kind': e['kind'], 'name': 'Kamau', 'text': e['text'], 'at': e['at']}, 201)
                if act == 'end': S['mb_status'] = 'ended'; return ok({'ok': True})
                if act == 'leave': return ok({'ok': True})
            # ----- Live -----
            if path == '/api/live' and req.method == 'GET': return ok({'streams': S['streams']})
            if path == '/api/live/start': return ok({'id': U(3), 'channel': 'lv3'}, 201)
            if path == '/api/live/token': return ok({'token': None})
            if path.endswith('/host-ping'): return ok({'status': 'live'})
            if path.endswith('/ping'):
                since = body.get('since'); cs = [c for c in S['live_comments'] if not since or c['at'] > since]
                return ok({'status': 'live', 'viewers': 4, 'hearts': 0, 'comment_count': len(S['live_comments']), 'comments': cs})
            if path.endswith('/heart'): return ok({'hearts': 1})
            if path.endswith('/comment'):
                if '0712' in body['text']: return ok({'error': 'Remove phone numbers, handles and links'}, 400)
                c = {'id': U(200 + len(S['live_comments'])), 'name': 'Comrade', 'text': body['text'], 'at': now()}; S['live_comments'].append(c); return ok(c, 201)
            if path.endswith('/end'): return ok({'ok': True})
            return ok({'error': 'unexpected ' + path}, 404)
        # routes: the LAST one registered wins, so the catch-all goes first and the Agora stub after it
        page.route(lambda u: not (u.startswith('http://app.test') or u.startswith(API) or u.startswith('data:') or u.startswith('blob:')), lambda r, q: r.abort())
        page.route('http://app.test/**', app); page.route(API + '/**', worker)
        page.route('http://app.test/config.js*', lambda r, q: r.fulfill(status=200, body="const CC_API='" + API + "';const CC_GOOGLE_ID='';const CC_AGORA_ID='testappid';", content_type='application/javascript'))
        page.route(lambda u: 'agora' in u.lower(), lambda r, q: r.fulfill(status=200, body=AGORA_STUB, content_type='application/javascript'))
        page.add_init_script("if(!navigator.mediaDevices){Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:()=>Promise.resolve({getTracks:()=>[]})},configurable:true})}")
        js = page.evaluate
        def click(sel, w=350): js("(s)=>document.querySelector(s).click()", sel); page.wait_for_timeout(w)
        def until(cond, t=5000):
            try: page.wait_for_function(cond, timeout=t); return True
            except Exception: return False
        def calls(suffix): return [c for c in S['calls'] if c[0].endswith(suffix)]
        def toast(): return page.inner_text('#toast')
        def prime():
            js("""localStorage.clear(); localStorage.setItem('cs_cookie','"essential"'); localStorage.setItem('cc_auth', JSON.stringify({aid:'u_a1',token:'tok'}));
                  localStorage.setItem('cc_campus','kirinyaga'); localStorage.setItem('cc_campus_home','kirinyaga'); localStorage.setItem('cc_campus_name','Kirinyaga University'); localStorage.setItem('cc_campus_short','KyU')""")
        page.goto('http://app.test/index.html'); page.wait_for_timeout(300); prime()
        page.goto('http://app.test/index.html'); page.wait_for_timeout(1500)
        check('university picker does not appear', js("!document.querySelector('#ccuni, .cc-uni, [data-uni-picker]')") )

        # ================= Mbogi Talk: the switch in Watch =================
        js("document.querySelector('#tb button[data-v=\"videos\"]').click()"); page.wait_for_timeout(700)
        seg = page.locator('#v-videos .crd-seg button')
        check('Watch switch has Videos, Live and Mbogi Talk', [t.strip() for t in seg.all_inner_texts()] == ['Videos', 'Live', 'Mbogi Talk'], seg.all_inner_texts())
        check('the hidden Mbogi tab exists in the bottom bar but is not shown', js("(()=>{const b=document.querySelector('#tb button[data-v=\"mbogi\"]');return !!b&&getComputedStyle(b).display==='none'})()"), js("(()=>{const b=document.querySelector('#tb button[data-v=\"mbogi\"]');return b?[getComputedStyle(b).display,b.className,b.parentNode.id]:'missing'})()"))
        click('#v-videos .crd-seg [data-sg="mbogi"]', 600)
        check('tapping Mbogi Talk opens the Mbogi page', js("document.body.dataset.view") == 'mbogi' and page.locator('#v-mbogi').is_visible())
        check('the Mbogi page heading is Watch and the switch is marked', page.inner_text('#v-mbogi .ph').strip() == 'Watch' and js("document.querySelector('#v-mbogi .crd-seg [data-sg=mbogi]').classList.contains('on')"))
        check('Watch tab stays highlighted while on Mbogi Talk', js("document.querySelector('#tb button[data-v=\"videos\"]').classList.contains('on2')"))
        # code typed loosely
        page.fill('#mbg-code', 'ABCDEFGHIJ'); page.dispatch_event('#mbg-code', 'input')
        check('a code typed without dashes is formatted', page.input_value('#mbg-code') == CODE, page.input_value('#mbg-code'))
        page.fill('#mbg-code', '')
        # ================= create a meeting =================
        page.fill('#mbg-title', 'Study group'); click('#mbg-new', 700)
        check('create sends the title and shows the code and link', calls('/api/mbogi/create') and calls('/api/mbogi/create')[0][1] == {'title': 'Study group'} and page.inner_text('#mbg-mc') == CODE and ('?mbogi=' + CODE) in page.inner_text('#mbg-ml'), page.inner_text('#mbg-made'))
        check('the new meeting is saved under Recent meetings', CODE in js("localStorage.getItem('cc_mbogi_recent')"))
        # ================= pre-join sheet =================
        click('#mbg-made [data-k="go"]', 700)
        sheet = '.ccm-sh'
        check('pre-join sheet shows title, host and head count', page.locator(sheet).count() == 1 and page.inner_text(sheet + ' h3') == 'Study group' and 'Host: Kamau' in page.inner_text('#mbg-pj-s'), page.inner_text(sheet))
        check('front camera and microphone are on by default', js("document.querySelector('.mbg-seg [data-f=user]').classList.contains('on')") and page.get_attribute('#mbg-pj-m', 'aria-checked') == 'true')
        check('three camera choices (front, back, off)', [t.strip() for t in page.locator('.mbg-seg button').all_inner_texts()] == ['Front camera', 'Back camera', 'Camera off'])
        click('.mbg-seg [data-f="environment"]', 100); click('#mbg-pj-m', 100)   # camera: back, microphone: off
        check('picking back camera marks it', js("document.querySelector('.mbg-seg [data-f=environment]').classList.contains('on')") and page.get_attribute('.mbg-seg [data-f=environment]', 'aria-checked') == 'true')
        click('#mbg-pj-go', 300)
        check('room opens full screen and the sheet is gone', until("!!document.querySelector('#mbg-room') && !document.querySelector('.mbg-load')") and page.locator(sheet).count() == 0 and js("document.body.classList.contains('mbg-on')"))
        check('join sends a tab id, no camera data', calls('/join') and calls('/join')[0][1].get('v'))
        check('the video room joined Agora with the chosen back camera and published audio+video', js("__ag.joined.length")==1 and js("__ag.joined[0].ch")=='mbabcdefghij' and any(c['fn']=='cam' and c['v']['facingMode']=='environment' for c in js("__ag.calls")) and js("__ag.pubs")==[['audio','video']], js("JSON.stringify([__ag.joined,__ag.calls,__ag.pubs])"))
        until("document.querySelectorAll('#mbg-room .mbg-t').length===2", 5000)
        page.wait_for_timeout(300)
        check('two tiles: you (host) first, then Achieng', page.locator('#mbg-room .mbg-t .mbg-nm').all_inner_texts() == ['You (host)', 'Achieng'], page.locator('#mbg-room .mbg-t .mbg-nm').all_inner_texts())
        check('your tile shows your video, mirrored off for the back camera', js("document.querySelectorAll('#mbg-room .mbg-t')[0].classList.contains('hasv')") and js("__ag.plays.filter(p=>p.kind==='video').slice(-1)[0].mirror")==False, js("JSON.stringify(__ag.plays)"))
        check('Achieng shows a letter avatar until her video arrives', page.locator('#mbg-room .mbg-t').nth(1).locator('.mbg-av').inner_text() == 'A' and not js("document.querySelectorAll('#mbg-room .mbg-t')[1].classList.contains('hasv')"))
        js("__ag.addRemote(7777, true, true)"); page.wait_for_timeout(500)
        check('her video appears in her tile once she publishes', js("document.querySelectorAll('#mbg-room .mbg-t')[1].classList.contains('hasv')") and page.locator('#mbg-room .mbg-t').nth(1).locator('.fakevid').count() == 1)
        check('head count shows 2', page.inner_text('#mbg-room .mbg-cnt b') == '2')
        bar = lambda: [x for x in page.locator('#mbg-room .mbg-bar button').evaluate_all("els=>els.map(e=>e.dataset.k)")]
        check('bottom bar: mic, camera, flip, react, hand, chat, leave', bar() == ['mic', 'cam', 'flip', 'react', 'hand', 'chat', 'leave'], bar())
        # mic
        lab = lambda k: page.get_attribute('#mbg-room .mbg-bar [data-k="%s"]' % k, 'aria-label')
        check('mic started OFF because it was switched off in the sheet', lab('mic') == 'Turn microphone on', lab('mic'))
        click('#mbg-room .mbg-bar [data-k="mic"]', 300)
        check('mic button turns the microphone on', lab('mic') == 'Turn microphone off' and js("__ag.tracks.filter(t=>t.kind==='audio')[0].enabled") is True)
        click('#mbg-room .mbg-bar [data-k="mic"]', 300)
        check('mic button turns it off again and shows the muted badge on your tile', js("__ag.tracks.filter(t=>t.kind==='audio')[0].enabled") is False and not js("document.querySelector('#mbg-room .mbg-t .mbg-bd.mic').hidden"))
        # camera
        click('#mbg-room .mbg-bar [data-k="cam"]', 300)
        check('camera off: no flip button, avatar instead of video', 'flip' not in bar() and js("__ag.tracks.filter(t=>t.kind==='video')[0].enabled") is False and not js("document.querySelectorAll('#mbg-room .mbg-t')[0].classList.contains('hasv')"), bar())
        click('#mbg-room .mbg-bar [data-k="cam"]', 400)
        check('camera on again: flip button back and video plays again', 'flip' in bar() and js("document.querySelectorAll('#mbg-room .mbg-t')[0].classList.contains('hasv')"), bar())
        # flip
        click('#mbg-room .mbg-bar [data-k="flip"]', 600)
        check('flip switches the back camera to the front camera', js("__ag.setDevice")==['cam-front'] and 'Front camera' in toast(), js("JSON.stringify(__ag.setDevice)") + toast())
        check('front camera is mirrored in your tile', js("__ag.plays.filter(p=>p.kind==='video').slice(-1)[0].mirror") is True)
        click('#mbg-room .mbg-bar [data-k="flip"]', 600)
        check('flip again goes back to the back camera', js("__ag.setDevice")==['cam-front','cam-back'] and 'Back camera' in toast())
        # reactions
        click('#mbg-room .mbg-bar [data-k="react"]', 300)
        check('reaction tray has 9 reactions', page.locator('#mbg-room .mbg-tray button').count() == 9)
        click('#mbg-room .mbg-tray button', 500)
        r = calls('/send')
        check('a reaction is sent and floats up at once', r and r[-1][1]['kind'] == 'react' and r[-1][1]['text'] == 'heart' and page.locator('#mbg-room .mbg-fl').count() >= 1)
        click('#mbg-room .mbg-bar [data-k="react"]', 200)
        check('tray closes when the button is tapped again', page.locator('#mbg-room .mbg-tray').count() == 0)
        # hand
        click('#mbg-room .mbg-bar [data-k="hand"]', 700)
        check('raise hand shows the hand badge and is sent with the next ping', not js("document.querySelectorAll('#mbg-room .mbg-t')[0].querySelector('.hand').hidden") and 'Hand raised' in toast() and any(c[1].get('hand') is True for c in calls('/ping')))
        # chat
        click('#mbg-room .mbg-bar [data-k="chat"]', 300)
        check('chat panel opens with the Chat tab', page.locator('#mbg-room .mbg-panel').count() == 1 and 'No messages yet' in page.inner_text('#mbg-body'))
        page.fill('#mbg-room .mbg-cf input', 'Call me 0712345678'); click('#mbg-room .mbg-cf button', 600)
        check('a refused message shows the reason and keeps the text', 'Remove phone numbers' in toast() and page.input_value('#mbg-room .mbg-cf input') == 'Call me 0712345678')
        page.fill('#mbg-room .mbg-cf input', '<img src=x onerror=window.__x=1> Niaje'); click('#mbg-room .mbg-cf button', 700)
        check('a sent message appears as plain text and the box clears', 'Niaje' in page.inner_text('#mbg-body') and page.locator('#mbg-body img').count() == 0 and js('window.__x') is None and page.input_value('#mbg-room .mbg-cf input') == '')
        check('your own message is not shown twice after the next ping', until("true") and (page.wait_for_timeout(3500) or True) and page.locator('#mbg-body .mbg-m').count() == 1, page.locator('#mbg-body .mbg-m').count())
        # people tab
        click('#mbg-room .mbg-panel [data-t="people"]', 300)
        t = page.inner_text('#mbg-body')
        check('People tab lists you and Achieng, and marks the host and raised hand', 'Kamau (You)' in t and 'Achieng' in t and 'Host' in t and page.locator('#mbg-body .hd').count() == 1, t)
        check('the chat box is hidden on the People tab', page.locator('#mbg-room .mbg-cf').is_hidden())
        click('#mbg-room .mbg-panel [data-t="x"]', 300)
        check('closing the panel removes it', page.locator('#mbg-room .mbg-panel').count() == 0)
        # messages from other people while the panel is closed
        ev('chat', 'Achieng', 'Karibu wasee'); ev('react', 'Achieng', 'clap')
        until("!!document.querySelector('#mbg-room .mbg-bar .dot')", 6000)
        check("someone else's message while the chat is closed shows the unread dot", page.locator('#mbg-room .mbg-bar .dot').count() == 1)
        check("someone else's reaction floats with their name", page.locator('#mbg-room .mbg-fl').filter(has_text='Achieng').count() >= 1)
        click('#mbg-room .mbg-bar [data-k="chat"]', 300)
        check('opening the chat shows her message and clears the dot', 'Karibu wasee' in page.inner_text('#mbg-body') and page.locator('#mbg-room .mbg-bar .dot').count() == 0)
        # phone back button closes the panel first
        check('phone back button closes the panel (and stays in the meeting)', js("window.ccMbogiBack()") is True and page.locator('#mbg-room .mbg-panel').count() == 0 and page.locator('#mbg-room').count() == 1)
        # ================= host leaves: end for everyone =================
        click('#mbg-room .mbg-bar [data-k="leave"]', 400)
        sh = page.locator('.ccm-sh')
        check('the host is asked: end for everyone, just leave, or stay', sh.count() == 1 and [t.strip() for t in sh.locator('button').all_inner_texts()] == ['End for everyone', 'Just leave', 'Stay'], sh.all_inner_texts())
        click('.ccm-sh [data-k="x"]', 300)
        check('Stay keeps you in the meeting', page.locator('#mbg-room').count() == 1 and page.locator('.ccm-sh').count() == 0)
        click('#mbg-room .mbg-bar [data-k="leave"]', 300); click('.ccm-sh [data-k="end"]', 800)
        check('End for everyone ends the meeting and leaves', len([c for c in calls('/end') if c[0].startswith('/api/mbogi')]) == 1 and len(calls('/leave')) >= 1 and page.locator('#mbg-room').count() == 0 and not js("document.body.classList.contains('mbg-on')"))
        check('camera and microphone are released and Agora is left', js("__ag.tracks.every(t=>t.closed)") and js("__ag.left")>=1, js("JSON.stringify(__ag.tracks.map(t=>[t.kind,t.closed]))"))
        check('back in the lobby with the bottom bar visible again', page.locator('#v-mbogi').is_visible() and page.locator('#mbogi-made, #mbg-made').first.is_hidden())
        # joining an ended meeting
        js("window.ccMbogi.join('%s')" % CODE); page.wait_for_timeout(600)
        check('an ended meeting cannot be joined', 'ended' in toast().lower() and page.locator('.ccm-sh').count() == 0, toast())

        # ================= Live: camera prompt, flip, floating comments =================
        S['mb_status'] = 'open'
        js("go('live')"); page.wait_for_timeout(900)
        check('Live page also has the three-way switch', len(page.locator('#v-live .crd-seg button').all()) == 3 and 'ccl-go' in js("document.body.innerHTML.indexOf('id=\"ccl-go\"')>0 ? 'ccl-go' : ''"))
        page.fill('#ltitle', 'Campus tour'); click('#ccl-go', 400)
        check('going live asks front or back camera first', page.locator('.ccm-sh').count() == 1 and 'Go live with which camera?' in page.inner_text('.ccm-sh h3') and page.locator('.ccm-sh [data-k="user"]').count() == 1 and page.locator('.ccm-sh [data-k="environment"]').count() == 1, page.inner_text('.ccm-sh'))
        click('.ccm-sh [data-k="x"]', 300)
        check('Cancel does not go live', not calls('/api/live/start') and page.locator('.ccm-sh').count() == 0 and page.locator('#room').is_hidden() and page.input_value('#ltitle') == 'Campus tour')
        click('#ccl-go', 400); click('.ccm-sh [data-k="environment"]', 1200)
        check('choosing back camera starts the live with {native:true}', calls('/api/live/start') and calls('/api/live/start')[-1][1] == {'title': 'Campus tour', 'native': True} and page.locator('#room').is_visible(), [calls('/api/live/start'), toast(), page.locator('#room').is_visible()])
        until("window.__ag && __ag.calls.some(c=>c.fn==='micAndCam')", 4000)
        check('the camera was opened with the back camera as chosen', js("__ag.calls.filter(c=>c.fn==='micAndCam')[0].v.facingMode") == 'environment' and js("__ag.roles") == ['host'], js("JSON.stringify(__ag.calls)"))
        until("!!document.querySelector('#rframe .fakevid')", 4000)
        check('the host sees a flip button next to the microphone button', page.locator('#ccl-ctl [data-k="flip"]').count() == 1 and page.locator('#ccl-ctl button').evaluate_all("els=>els.map(e=>e.dataset.k)")[:2] == ['snd', 'flip'], page.locator('#ccl-ctl button').evaluate_all("els=>els.map(e=>e.dataset.k)"))
        js("__ag.setDevice.length=0")
        click('#ccl-ctl [data-k="flip"]', 700)
        check('flip switches to the front camera and mirrors the preview', js("__ag.setDevice").count('cam-front') == 1 and 'Front camera' in toast() and js("__ag.plays.slice(-1)[0].mirror") is True and js("window.__ccFacing") == 'user', js("JSON.stringify(__ag.setDevice)") + toast())
        click('#ccl-ctl [data-k="flip"]', 700)
        check('and back again', js("__ag.setDevice") == ['cam-front', 'cam-back'] and js("window.__ccFacing") == 'environment', js("JSON.stringify(__ag.setDevice)"))

        # --- floating comments ---
        page.wait_for_timeout(800)
        check('chat history loaded into the list below the video', page.locator('#lchat p').count() == 3, page.locator('#lchat p').count())
        check('history is NOT replayed as floating bubbles', page.locator('#ccl-float').count() == 1 and page.locator('#ccl-float .cclf-b').count() == 0 and page.locator('#ccl-float').get_attribute('aria-hidden') == 'true', page.locator('#ccl-float .cclf-b').count())
        page.wait_for_timeout(2000)   # past the 2.5 second warm-up
        page.fill('#li', 'Hongera comrades'); click('#lf button[aria-label="Send"]', 700)
        fb = page.locator('#ccl-float .cclf-b')
        check('a new comment rises over the video with name and avatar letter', fb.count() == 1 and 'Hongera comrades' in fb.first.inner_text() and 'Comrade' in fb.first.inner_text() and page.locator('#ccl-float .cclf-a').first.inner_text() == 'C', [fb.all_inner_texts(), toast(), calls('/comment')])
        check('the floating layer sits over the video and lets taps through', js("getComputedStyle(document.querySelector('#ccl-float')).pointerEvents") == 'none' and js("document.querySelector('#rmedia').contains(document.querySelector('#ccl-float'))"))
        S['live_comments'].append({'id': U(300), 'name': 'Achieng', 'text': 'Naona vizuri', 'at': now()})
        until("document.querySelectorAll('#ccl-float .cclf-b').length>=2", 7000)
        check("someone else's comment (from the server) floats too", page.locator('#ccl-float .cclf-b').filter(has_text='Naona vizuri').count() == 1)
        js("for(let i=0;i<10;i++)addComment({id:'t'+i,name:'N'+i,text:'msg '+i,at:new Date().toISOString()})"); page.wait_for_timeout(300)
        check('at most 7 bubbles are on screen, oldest are dropped', page.locator('#ccl-float .cclf-b').count() == 7 and page.locator('#ccl-float .cclf-b').last.inner_text().endswith('msg 9') and page.locator('#ccl-float .cclf-b').filter(has_text='Hongera').count() == 0, page.locator('#ccl-float .cclf-b').count())
        js("addComment({id:'xss1',name:'<i>Hack</i>',text:'<img src=x onerror=window.__y=1><b>bold</b>',at:new Date().toISOString()})"); page.wait_for_timeout(200)
        last = page.locator('#ccl-float .cclf-b').last
        check('comments are plain text only (no HTML from name or text)', last.locator('img').count() == 0 and last.locator('b').count() == 0 and last.locator('i').count() == 0 and '<img' in last.inner_text() and '<i>Hack</i>' in last.inner_text() and js('window.__y') is None, last.inner_text())
        check('a comment that was already shown is not floated twice', (js("addComment({id:'xss1',name:'x',text:'dup',at:new Date().toISOString()})") or True) and page.locator('#ccl-float .cclf-b').filter(has_text='dup').count() == 0)
        check('bubbles fade out and are removed by themselves', until("document.querySelectorAll('#ccl-float .cclf-b').length===0", 14000))
        # --- full screen ---
        click('#ccl-ctl [data-k="fs"]', 500)
        check('full screen: the video sits under <body> and the comment box shows on the video', js("document.querySelector('#rmedia').classList.contains('ccl-fs')") and js("document.querySelector('#rmedia').parentNode===document.body") and page.locator('#ccl-fin').is_visible())
        page.fill('#ccl-fin input', 'Hello from full screen'); click('#ccl-fin button', 700)
        check('a comment typed in full screen is sent and floats', calls('/comment')[-1][1] == {'text': 'Hello from full screen'} and page.locator('#ccl-float .cclf-b').filter(has_text='Hello from full screen').count() == 1 and page.input_value('#ccl-fin input') == '')
        bf, bi = page.locator('#ccl-float').bounding_box(), page.locator('#ccl-fin').bounding_box()
        check('floating comments do not cover the full-screen comment box', bf['y'] + bf['height'] <= bi['y'] + 1 and bi['y'] + bi['height'] <= 800 and bi['x'] >= 0 and bi['x'] + bi['width'] <= 390, (bf, bi))
        page.fill('#ccl-fin input', 'Call 0712345678'); js("document.querySelector('#ccl-fin').requestSubmit()"); page.wait_for_timeout(600)
        check('a refused full-screen comment shows the reason and keeps the text', 'Remove phone numbers' in toast() and page.input_value('#ccl-fin input') == 'Call 0712345678' and page.locator('#ccl-float .cclf-b').filter(has_text='0712').count() == 0, toast())
        click('#ccl-ctl [data-k="fs"]', 500)
        check('leaving full screen hides the comment box again', page.locator('#ccl-fin').is_hidden() and not js("document.querySelector('#rmedia').classList.contains('ccl-fs')"))
        click('#lend', 800)
        check('ending the live clears the floating layer and leaves cleanly', len(calls('/end')) >= 1 and page.locator('#room').is_hidden() and js("(document.querySelector('#ccl-float')||{children:[]}).children.length")==0)

        # --- a viewer of a phone live: no flip button, floating comments work ---
        js("go('live')"); page.wait_for_timeout(700)
        click('#lvl [data-i="0"]', 1200)
        check('a viewer of a phone live has no flip button', page.locator('#room').is_visible() and page.locator('#ccl-ctl [data-k="flip"]').count() == 0 and js("__ag.roles.slice(-1)[0]") == 'audience', js("JSON.stringify(__ag.roles)"))
        click('#rend', 500)
        check('no "could not hook the Live room" warnings', not warns, warns)

        # ================= 360px phone layout =================
        page.set_viewport_size({'width': 360, 'height': 740}); page.wait_for_timeout(300)
        for name, view in (('Videos', 'videos'), ('Live', 'live'), ('Mbogi Talk', 'mbogi')):
            js("go('%s')" % view); page.wait_for_timeout(500)
            r = js("""(()=>{const s=document.querySelector('#v-%s .crd-seg');const q=s.getBoundingClientRect();const bs=[...s.querySelectorAll('button')].map(b=>b.getBoundingClientRect());
                return {w:q.width,l:q.left,r:q.right,sw:s.scrollWidth,cw:s.clientWidth,inside:bs.every(b=>b.left>=q.left-0.5&&b.right<=q.right+0.5),same:Math.max(...bs.map(b=>b.top))-Math.min(...bs.map(b=>b.top)),page:document.documentElement.scrollWidth}})()""" % view)
            check('360px: the Watch switch fits on %s (3 buttons, one row, no overflow)' % name, r['sw'] <= r['cw'] + 1 and r['inside'] and r['same'] < 2 and r['l'] >= 0 and r['r'] <= 360.5 and r['page'] <= 360, r)
        js("go('mbogi')"); page.wait_for_timeout(300)
        check('360px: the Mbogi lobby does not scroll sideways', js("document.documentElement.scrollWidth") <= 360 and js("document.body.scrollWidth") <= 360)
        S['mb_status'] = 'open'; js("window.ccMbogi.join('%s')" % CODE); page.wait_for_timeout(700)
        sheet_ok = js("""(()=>{const b=document.querySelector('.ccm-sh .box').getBoundingClientRect();const bs=[...document.querySelectorAll('.ccm-sh button')].map(x=>x.getBoundingClientRect());return b.left>=0&&b.right<=360.5&&bs.every(x=>x.left>=0&&x.right<=360.5)})()""")
        check('360px: the pre-join sheet fits', sheet_ok)
        click('.ccm-sh [data-k="user"], .ccm-sh .mbg-seg [data-f="user"]', 100); click('#mbg-pj-go', 300)
        until("!!document.querySelector('#mbg-room') && !document.querySelector('.mbg-load')", 5000); page.wait_for_timeout(600)
        r = js("""(()=>{const bs=[...document.querySelectorAll('#mbg-room .mbg-bar button')].map(b=>b.getBoundingClientRect());const bar=document.querySelector('#mbg-room .mbg-bar').getBoundingClientRect();
            return {n:bs.length,left:Math.min(...bs.map(b=>b.left)),right:Math.max(...bs.map(b=>b.right)),rowSpread:Math.max(...bs.map(b=>b.top))-Math.min(...bs.map(b=>b.top)),bar:[bar.left,bar.right],page:document.documentElement.scrollWidth,
            sw:document.querySelector('#mbg-room .mbg-bar').scrollWidth,cw:document.querySelector('#mbg-room .mbg-bar').clientWidth}})()""")
        print('   bar numbers at 360px:', r)
        check('360px: all 7 meeting buttons fit on one row inside the screen', r['n'] == 7 and r['rowSpread'] < 2 and r['left'] >= 0 and r['right'] <= 360.5 and r['sw'] <= r['cw'], r)
        page.set_viewport_size({'width': 320, 'height': 640}); page.wait_for_timeout(300)
        r320 = js("""(()=>{const bs=[...document.querySelectorAll('#mbg-room .mbg-bar button')].map(b=>b.getBoundingClientRect());return {left:Math.min(...bs.map(b=>b.left)),right:Math.max(...bs.map(b=>b.right)),spread:Math.max(...bs.map(b=>b.top))-Math.min(...bs.map(b=>b.top))}})()""")
        check('320px (small phones): the 7 meeting buttons still fit on one row', r320['left'] >= 0 and r320['right'] <= 320.5 and r320['spread'] < 2, r320)
        page.set_viewport_size({'width': 360, 'height': 740}); page.wait_for_timeout(300)
        click('#mbg-room .mbg-bar [data-k="react"]', 300)
        tr = js("(()=>{const t=document.querySelector('#mbg-room .mbg-tray').getBoundingClientRect();return [t.left,t.right]})()")
        check('360px: reaction tray stays inside the screen', tr[0] >= 0 and tr[1] <= 360.5, tr)
        click('#mbg-room .mbg-bar [data-k="react"]', 200); click('#mbg-room .mbg-bar [data-k="chat"]', 300)
        pn = js("(()=>{const t=document.querySelector('#mbg-room .mbg-panel').getBoundingClientRect();return [t.left,t.right,t.bottom]})()")
        check('360px: chat panel fits the screen', pn[0] >= 0 and pn[1] <= 360.5 and pn[2] <= 740.5, pn)
        js("window.ccMbogiBack()"); click('#mbg-room .mbg-bar [data-k="leave"]', 300); click('.ccm-sh [data-k="leave"]', 500)
        mb_end = [c for c in calls('/end') if c[0].startswith('/api/mbogi')]
        check('"Just leave" closes the room without ending the meeting for others', page.locator('#mbg-room').count() == 0 and len(mb_end) == 1 and len([c for c in calls('/leave') if c[0].startswith('/api/mbogi')]) >= 2, [len(mb_end)])
        check('no JavaScript errors', not errors, errors)
        b.close()
main()
print('\n%d failed' % len(fails) if fails else '\nAll Mbogi checks passed'); sys.exit(1 if fails else 0)
