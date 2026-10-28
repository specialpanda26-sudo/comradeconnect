#!/bin/bash
set -e
[ -f wrangler.toml ] && [ -d frontend ] && [ -d backend/src ] || { echo "Run this inside the comradeconnect folder."; exit 1; }

cat > frontend/cc-fix10.css <<'CC_EOF_CSS'
/* cc-fix10.css: Alerts sheet no longer overlaps, payment steps show ticks. Load last. */
html body div.ccn.ccn-pf .bx{overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;display:block!important}
html body div.ccn.ccn-pf .bx>.hd,html body div.ccn.ccn-pf .bx>.pf-sub,html body div.ccn.ccn-pf .bx>.pf-st,html body div.ccn.ccn-pf .bx>.pc-wrap{flex:none}
html body div.ccn.ccn-pf .ls{flex:none!important;height:auto!important;max-height:none!important;min-height:0;overflow:visible!important;display:flex;flex-direction:column;gap:10px}
html body div.ccn.ccn-pf .ls>.pf-row{flex:none}
html body div.ccn.ccn-pf .pc-wrap{position:relative;clear:both;margin:18px 2px 24px!important;padding-top:14px}
html body div.ccn.ccn-pf .pc-wrap .btn{display:block;width:100%;position:relative}
html body div.ccn.ccn-pf .pc-out{padding-bottom:12px}
html body .cs-l .cs-s .cs-i::after{
  content:""!important;display:block!important;box-sizing:content-box!important;width:5px!important;height:10px!important;
  border:solid var(--gb,rgba(120,110,100,.5))!important;border-width:0 2.5px 2.5px 0!important;border-radius:0!important;
  background:none!important;transform:rotate(45deg) translate(-1px,-1px)!important;animation:none!important;opacity:1;color:inherit;font-size:0}
html body .cs-l .cs-s.a .cs-i{border-color:#ee7a4f!important;border-top-color:#ee7a4f!important;background:transparent!important;animation:cs-pulse 1.6s ease-out infinite}
html body .cs-l .cs-s.a .cs-i::after{border-color:#ee7a4f!important;animation:cc10-tick 1.2s ease-in-out infinite!important}
html body .cs-l .cs-s.d .cs-i{background:var(--ink,#16130f)!important;border-color:var(--ink,#16130f)!important}
html body .cs-l .cs-s.d .cs-i::after{border-color:var(--inkfg,#fff)!important;animation:cc10-pop .35s ease-out both!important}
html body .cs-l .cs-s.f .cs-i::after{content:"\00d7"!important;width:auto!important;height:auto!important;border:0!important;transform:none!important;color:var(--bad,#d8493e)!important;font-size:20px!important;line-height:1;font-weight:700}
@keyframes cc10-tick{0%,100%{opacity:.25;transform:rotate(45deg) translate(-1px,-1px) scale(.7)}50%{opacity:1;transform:rotate(45deg) translate(-1px,-1px) scale(1.05)}}
@keyframes cc10-pop{from{opacity:0;transform:rotate(45deg) translate(-1px,-1px) scale(0)}to{opacity:1;transform:rotate(45deg) translate(-1px,-1px) scale(1)}}
@media (prefers-reduced-motion:reduce){html body .cs-l .cs-s.a .cs-i::after{animation:none!important;opacity:1}}
CC_EOF_CSS

python3 - <<'CC_EOF_PY'
def sub(path, old, new, mark):
    s = open(path, encoding='utf-8').read()
    if mark in s: print('skip   ', path, '(already done)'); return
    assert old in s, 'anchor missing in ' + path + ': ' + old[:70]
    open(path, 'w', encoding='utf-8').write(s.replace(old, new, 1)); print('patched', path)

sub('android-wrapper/native/CCMessagingService.java',
'if (d != null && "2".equals(d.get("cc")) && !CCNotifier.foreground) {\n            try { CCNotifier.show(this, d); } catch (Throwable e) { /* never crash the push service */ }\n            return;\n        }',
'if (d != null && "2".equals(d.get("cc"))) {\n            // cc-fix10: every alert goes to the notification bar, also while the app is open\n            try { CCNotifier.show(this, d); } catch (Throwable e) { /* never crash the push service */ }\n            if (CCNotifier.foreground) forward("sendRemoteMessage", RemoteMessage.class, message);\n            return;\n        }', 'cc-fix10')

sub('backend/src/push.js',
"  for (let i = 0; i < to.length; i += 25) await Promise.all(to.slice(i, i + 25).map((s) => sendFcm(env, s, payload).catch(() => null)));\n  return to.length;",
"  let ok = 0;   // cc-fix10\n  for (let i = 0; i < to.length; i += 25) await Promise.all(to.slice(i, i + 25).map((s) => sendFcm(env, s, payload).then((r) => { if (r && r.ok) ok++; }).catch((e) => { console.error('broadcast send failed', e && e.message); })));\n  console.log('broadcast ' + cat + ': phones=' + subs.length + ' switched_off=' + (subs.length - to.length) + ' accepted=' + ok);\n  return to.length;", 'cc-fix10')

sub('backend/src/push.js', "export const announceNotice =",
"const LIVE_C = new Map();   // cc-fix10\nexport const announceLiveComment = (env, hostAid, streamId, text) => {\n  try {\n    if (!hostAid || hostAid === 'admin' || Date.now() - (LIVE_C.get(streamId) || 0) < 15000) return Promise.resolve();\n    LIVE_C.set(streamId, Date.now()); if (LIVE_C.size > 500) LIVE_C.clear();\n    return sendPush(env, hostAid, { title: 'New comment on your live', body: String(text || 'Someone commented').slice(0, 100), view: 'live', tag: 'live-comment', cat: 'comments', kind: 'live_comment', ref_type: 'live', ref_id: streamId, rep: 'livec-' + String(streamId).slice(0, 8), ttl: '300s' });\n  } catch (e) { return Promise.resolve(); }\n};\nexport const announceNotice =", 'announceLiveComment')
sub('backend/src/push.js', "like_milestone: 'comments',", "like_milestone: 'comments', live_comment: 'comments',", 'live_comment:')
sub('backend/src/live.js', "import { voiceOf,", "import { announceLiveComment } from './push.js';\nimport { voiceOf,", 'announceLiveComment')
sub('backend/src/live.js', "live_streams?select=id,status&id=eq.${mm[1]}`)); if (!s || s.status !== 'live') return err(env, 'This stream has ended', 404);\n    const c = ",
    "live_streams?select=id,status,host_aid&id=eq.${mm[1]}`)); if (!s || s.status !== 'live') return err(env, 'This stream has ended', 404); /* cc-fix10 select */\n    const c = ", 'cc-fix10 select')
sub('backend/src/live.js', "    return c ? json(env, { id: c.id, name: c.name, text: voiceOf(env, c.text).text,",
    "    if (c && s.host_aid !== u.aid) announceLiveComment(env, s.host_aid, s.id, text).catch(() => {});   // cc-fix10\n    return c ? json(env, { id: c.id, name: c.name, text: voiceOf(env, c.text).text,", 'announceLiveComment(env, s.host_aid')

sub('frontend/index.html', '<link rel="stylesheet" href="cc-dots.css?v=2"></head>',
    '<link rel="stylesheet" href="cc-dots.css?v=2"><link rel="stylesheet" href="cc-fix10.css?v=1"></head>', 'cc-fix10.css')

sub('tests/notifnative.test.mjs',
    "j.includes('!CCNotifier.foreground')",
    "!j.includes('\"2\".equals(d.get(\"cc\")) && !CCNotifier.foreground')", "&& !j.includes('")
CC_EOF_PY

git add -A
git commit -m "Alerts: show every alert in the notification bar, alert host on live comments, log live broadcasts; fix Alerts sheet overlap; payment steps use ticks"
git push origin main
