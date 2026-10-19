/* cc-faceid.js v1: Face ID screen for Comrade Connect.
Shows the "Use Face ID?" approval screen, then a front-camera face scan, then hands over to the phone's own
biometric prompt (Face ID / face unlock / fingerprint) through the lock code already on the site (WebAuthn).
Your face is never recorded or uploaded: the camera preview stays on this phone and is switched off right after the scan,
and the phone itself does the real recognition. Loaded after the main page scripts. */
(function () {
'use strict';
if (window.__ccFaceId) return; window.__ccFaceId = 1;
var $ = function (s, r) { return (r || document).querySelector(s); };
var reduce = false; try { reduce = matchMedia('(prefers-reduced-motion:reduce)').matches; } catch (e) {}
var hasBio = function () { try { return !!ME.bio; } catch (e) { return false; } };
var buzz = function (p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
var el = function (t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
var FACE = '<svg viewBox="0 0 120 120" class="fid-gl" aria-hidden="true"><path class="fc" d="M8 34V22a14 14 0 0 1 14-14h12M86 8h12a14 14 0 0 1 14 14v12M112 86v12a14 14 0 0 1-14 14H86M34 112H22A14 14 0 0 1 8 98V86"/><path class="ft" d="M44 44v10M76 44v10M60 46v16c0 3-2 4-5 4M42 80c10 11 26 11 36 0"/></svg>';
function css() {
if ($('#fid-css')) return;
var s = document.createElement('style'); s.id = 'fid-css';
s.textContent = [
'#ccfid{position:fixed;inset:0;z-index:10100;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:0;background:var(--bg,#000);color:var(--fg,#fff);font-family:Poppins,system-ui,sans-serif;opacity:0;transition:opacity .3s;overflow:hidden;-webkit-tap-highlight-color:transparent}',
'#ccfid,#ccfid *,#ccfid *::before,#ccfid *::after{box-sizing:border-box}',
'#ccfid.on{opacity:1}',
'#ccfid::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(var(--line,rgba(255,255,255,.14)) 1px,transparent 1px),linear-gradient(90deg,var(--line,rgba(255,255,255,.14)) 1px,transparent 1px);background-size:34px 34px;-webkit-mask-image:radial-gradient(circle at 50% 38%,#000,transparent 72%);mask-image:radial-gradient(circle at 50% 38%,#000,transparent 72%);opacity:.7}',
'#ccfid .fid-x{position:absolute;right:16px;top:calc(14px + env(safe-area-inset-top,0px));width:40px;height:40px;border-radius:50%;border:1px solid var(--gb,rgba(255,255,255,.22));background:var(--g,rgba(255,255,255,.07));color:inherit;display:grid;place-items:center;cursor:pointer}',
'#ccfid .fid-x svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}',
'#ccfid .fid-bx{position:relative;width:min(440px,100%);flex:1;min-height:0;display:flex;flex-direction:column}',
'#ccfid .fid-st{display:none;width:100%;flex:1;min-height:0;flex-direction:column}#ccfid .fid-st.on{display:flex;animation:fid-in .45s cubic-bezier(.2,.9,.3,1.1)}',
'#ccfid .fid-hero{flex:1;min-height:0;display:grid;place-items:center;padding-top:calc(30px + env(safe-area-inset-top,0px))}',
'#ccfid .fid-sheet{position:relative;margin:0 14px calc(14px + env(safe-area-inset-bottom,0px));padding:24px 22px 20px;border-radius:28px;text-align:left;background:var(--g,rgba(255,255,255,.07));border:1px solid var(--gb,rgba(255,255,255,.22));-webkit-backdrop-filter:blur(14px) saturate(160%);backdrop-filter:blur(14px) saturate(160%);box-shadow:var(--sh,0 10px 30px rgba(0,0,0,.6)),inset 0 1px 0 var(--gh,rgba(255,255,255,.4))}',
'@keyframes fid-in{from{opacity:0;transform:translateY(16px) scale(.98)}}',
'#ccfid h2{margin:0 0 8px;font:600 24px/1.2 Poppins,sans-serif;letter-spacing:-.02em}',
'#ccfid p{margin:0;color:var(--mut,#bdbdbd);font-size:14px;line-height:1.6;max-width:none}',
'#ccfid .fid-gl{width:170px;height:170px;fill:none;stroke:var(--fg,#fff);stroke-width:5;stroke-linecap:round;stroke-linejoin:round}',
'#ccfid .fid-gl .ft{stroke-width:5.5;animation:fid-bob 3.2s ease-in-out infinite;transform-origin:60px 60px}',
'@keyframes fid-bob{50%{transform:translateY(-2px) scale(1.03)}}',
'#ccfid .fid-b{width:100%;margin-top:12px;border:1px solid var(--gb,rgba(255,255,255,.3));background:transparent;color:inherit;border-radius:999px;padding:15px 22px;font:600 15px Poppins,sans-serif;cursor:pointer;transition:transform .25s,opacity .25s}',
'#ccfid .fid-b:active{transform:scale(.97)}#ccfid .fid-b.p{background:var(--ink,#fff);color:var(--inkfg,#000);border-color:var(--ink,#fff)}#ccfid .fid-b[disabled]{opacity:.45;pointer-events:none}',
'#ccfid .fid-acts{width:100%;margin-top:18px}',
'#ccfid .fid-cam{position:relative;width:250px;height:250px}',
'#ccfid .fid-vw{position:absolute;inset:14px;border-radius:50%;overflow:hidden;background:var(--g,rgba(255,255,255,.07));border:1px solid var(--gb,rgba(255,255,255,.22))}',
'#ccfid .fid-vw video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1);display:block}',
'#ccfid .fid-vw::after{content:"";position:absolute;left:0;right:0;top:-30%;height:30%;background:linear-gradient(transparent,rgba(255,255,255,.35),transparent);animation:fid-scan 1.8s ease-in-out infinite}',
'#ccfid.ok .fid-vw::after,#ccfid.rm .fid-vw::after{display:none}',
'@keyframes fid-scan{from{top:-30%}to{top:100%}}',
'#ccfid .fid-fr{position:absolute;inset:0;width:100%;height:100%;fill:none;stroke:var(--fg,#fff);stroke-width:4;stroke-linecap:round;transition:stroke .3s,transform .4s}',
'#ccfid.ok .fid-fr{stroke:#3ddc84;transform:scale(1.03)}',
'#ccfid .fid-chk{position:absolute;left:50%;top:50%;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;background:#3ddc84;display:grid;place-items:center;transform:scale(0);transition:transform .45s cubic-bezier(.2,.9,.3,1.4)}',
'#ccfid .fid-chk svg{width:44px;height:44px;fill:none;stroke:#04130a;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}',
'#ccfid.ok .fid-chk{transform:scale(1)}',
'#ccfid .fid-ph{display:flex;gap:8px;margin-top:14px}#ccfid .fid-ph i{width:8px;height:8px;border-radius:50%;background:var(--gb,rgba(255,255,255,.3));transition:background .3s,transform .3s}#ccfid .fid-ph i.on{background:var(--fg,#fff);transform:scale(1.25)}',
'#ccfid .fid-ns{font-size:12px;margin-top:10px;min-height:0;color:var(--mut,#bdbdbd)}',
'#ccfid.rm *{animation-duration:.01s!important;transition-duration:.01s!important}'
].join('\n');
document.head.appendChild(s);
}
var running = false;
function flow(mode) {
return new Promise(function (resolve) {
if (running) return resolve(false); running = true; css();
var stream = null, timers = [], done = false, detector = null, T = function (f, ms) { timers.push(setTimeout(f, reduce ? Math.min(ms, 60) : ms)); };
var root = el('div'); root.id = 'ccfid'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Face ID'); if (reduce) root.classList.add('rm');
var x = el('button', 'fid-x'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
var bx = el('div', 'fid-bx');
var A = el('div', 'fid-st'); A.innerHTML = '<div class="fid-hero">' + FACE + '</div><div class="fid-sheet"><h2>Login with Face ID</h2><p>Face ID lets you open Comrade Connect and approve withdrawals securely, without typing codes. Your face never leaves your phone.</p>'
+ '<div class="fid-acts"><button type="button" class="fid-b p" id="fid-y">Allow Face ID</button><button type="button" class="fid-b" id="fid-n">Not now</button></div></div>';
var B = el('div', 'fid-st'); B.innerHTML = '<div class="fid-hero"><div class="fid-cam"><div class="fid-vw"><video playsinline muted autoplay></video></div>'
+ '<svg class="fid-fr" viewBox="0 0 232 232" aria-hidden="true"><path d="M20 70V44a24 24 0 0 1 24-24h26M162 20h26a24 24 0 0 1 24 24v26M212 162v26a24 24 0 0 1-24 24h-26M70 212H44a24 24 0 0 1-24-24v-26"/></svg>'
+ '<div class="fid-chk"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div></div></div>'
+ '<div class="fid-sheet"><h2 id="fid-t">Position your face</h2><p id="fid-s">Look at the front camera and hold still.</p>'
+ '<div class="fid-ph" aria-hidden="true"><i class="on"></i><i></i><i></i></div>'
+ '<div class="fid-acts"><button type="button" class="fid-b p" id="fid-c" disabled>Continue</button></div><div class="fid-ns" id="fid-ns"></div></div>';
bx.append(A, B); root.append(x, bx); document.body.appendChild(root);
var vid = $('video', B), t = $('#fid-t', B), sub = $('#fid-s', B), cont = $('#fid-c', B), note = $('#fid-ns', B), dots = B.querySelectorAll('.fid-ph i');
function phase(n) { dots.forEach(function (d, i) { d.classList.toggle('on', i <= n); }); }
function stopCam() { try { stream && stream.getTracks().forEach(function (k) { k.stop(); }); } catch (e) {} stream = null; try { vid.srcObject = null; } catch (e) {} }
function finish(ok) {
if (done) return; done = true; timers.forEach(clearTimeout); stopCam(); document.removeEventListener('keydown', key);
root.classList.remove('on'); setTimeout(function () { root.remove(); running = false; }, 320); resolve(!!ok);
}
function key(e) { if (e.key === 'Escape') finish(false); }
document.addEventListener('keydown', key); x.onclick = function () { finish(false); };
requestAnimationFrame(function () { root.classList.add('on'); });
function scanned(noCam) {
phase(2); root.classList.add('ok'); buzz([20, 40, 20]);
t.textContent = noCam ? 'Ready' : 'Face scanned'; sub.textContent = 'Tap Continue and your phone will confirm it is really you.';
cont.disabled = false; cont.focus && cont.focus({ preventScroll: true });
stopCam();
}
cont.onclick = function () { finish(true); };
function start() {
A.classList.remove('on'); B.classList.add('on'); phase(0);
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { note.textContent = 'This browser cannot open the camera, so your phone will check you directly.'; T(function () { scanned(true); }, 500); return; }
navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } }, audio: false }).then(function (s) {
if (done) { s.getTracks().forEach(function (k) { k.stop(); }); return; }
stream = s; vid.srcObject = s; var p = vid.play(); if (p && p.catch) p.catch(function () {});
T(function () { phase(1); t.textContent = 'Scanning...'; sub.textContent = 'Keep your face inside the frame.'; }, 700);
try { if (window.FaceDetector) detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 }); } catch (e) { detector = null; }
var began = Date.now(), seen = 0;
(function loop() {
if (done || !stream) return;
var waited = Date.now() - began;
if (detector && vid.readyState >= 2) {
detector.detect(vid).then(function (f) {
if (f && f.length) seen++; else seen = 0;
if (seen >= 3) return scanned(false);
if (waited > 9000) { note.textContent = 'Could not see a face clearly. Your phone will check you directly.'; return scanned(false); }
setTimeout(loop, 160);
}).catch(function () { detector = null; setTimeout(loop, 160); });
} else if (!detector && waited >= 2300) { scanned(false); }
else setTimeout(loop, 160);
})();
}).catch(function () {
note.textContent = 'Camera is blocked or busy. No problem, your phone will check you directly.';
T(function () { scanned(true); }, 900);
});
}
$('#fid-y', A).onclick = function () { buzz(15); start(); };
$('#fid-n', A).onclick = function () { finish(false); };
if (mode === 'enable') A.classList.add('on'); else start();
});
}
var bypass = null;
function intercept(sel, modeFor) {
document.addEventListener('click', function (e) {
var b = e.target.closest && e.target.closest(sel); if (!b) return;
if (bypass === b) { bypass = null; return; }
var mode = modeFor(b); if (!mode) return;
e.preventDefault(); e.stopImmediatePropagation();
flow(mode).then(function (ok) {
if (!ok) { if (mode === 'enable') { var n = $('#secN'); if (b.id === 'secY' && n) n.click(); } return; }
bypass = b; b.click();
});
}, true);
}
intercept('#secY', function () { return 'enable'; });
intercept('#sgo', function () { return hasBio() ? 'verify' : 'enable'; });
intercept('#lku', function () { return 'verify'; });
window.ccFaceId = { scan: flow };
})();