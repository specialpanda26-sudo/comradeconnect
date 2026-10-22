/* cc-profile.js v1
   Fixes: sign-in / sign-out flow, a tidy Me (profile) page, and Record that opens the camera.
   Loaded after cc-core.js. No emojis: every icon is an outline SVG like the bottom tabs. */
(function () {
  'use strict';
  if (window.__ccProfile) return; window.__ccProfile = 1;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var API = typeof CC_API === 'string' ? CC_API : '';
  var live = function () { return !!API && API.indexOf('YOUR-SUBDOMAIN') < 0; };
  var auth = function () { try { return window.ccAuth ? window.ccAuth() : null; } catch (e) { return null; } };
  var signedIn = function () { var a = auth(); return !!(a && a.token && a.aid); };
  var say = function (m) { try { toast(m); } catch (e) {} };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var copy = function (t) { try { navigator.clipboard.writeText(t).then(function () { say('Copied'); }, function () { say('Select the text and copy it'); }); } catch (e) { say('Select the text and copy it'); } };
  var SV = function (p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };

  /* ---------- styles ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '.ccp-sheet{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto}',
    '.ccp-card{max-width:360px;width:100%}',
    'body.cc-out #ccso,body.cc-out .acl.so{display:none!important}',
    'body.cc-out .mgrp:has(#ccso){display:none!important}',
    'body:not(.cc-out) #ccsi{display:none}',
    'body.cc-out #ccpr,body.cc-out #ccmy,body.cc-out #ccw{display:none}',
    '.ccp-hide{display:none!important}',
    '#ccsi{display:grid;gap:10px}',
    '#ccsi b.t{font-size:17px}',
    '.ccp-bio{margin:2px 0 0;overflow-wrap:anywhere}',
    '.ccp-act{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '.ccp-gr{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-top:12px}',
    '.ccp-gr button{position:relative;aspect-ratio:9/14;border:0;border-radius:8px;color:#fff;font-size:11px;background:linear-gradient(160deg,#3a1c71,#d76d77);display:flex;align-items:flex-end;padding:6px;text-align:left;line-height:1.3;overflow:hidden}',
    '.ccp-gr button:nth-child(4n+2){background:linear-gradient(160deg,#134e5e,#71b280)}',
    '.ccp-gr button:nth-child(4n+3){background:linear-gradient(160deg,#41295a,#2f0743)}',
    '.ccp-gr button:nth-child(4n+4){background:linear-gradient(160deg,#614385,#516395)}',
    '.ccp-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--line)}',
    '.ccp-row:first-of-type{border-top:0}',
    '.ccp-row span{color:var(--mut);font-size:13px}',
    '.ccp-row b{font-size:14px;overflow-wrap:anywhere;text-align:right}',
    /* camera recorder */
    '.ccr{position:fixed;inset:0;z-index:10001;background:#000;color:#fff;display:flex;flex-direction:column}',
    '.ccr video{flex:1;min-height:0;width:100%;object-fit:cover;background:#000}',
    '.ccr video.mir{transform:scaleX(-1)}',
    '.ccr-top{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;justify-content:space-between;padding:calc(env(safe-area-inset-top,0px) + 12px) 14px 12px;background:linear-gradient(rgba(0,0,0,.55),transparent)}',
    '.ccr-top button,.ccr-bot button.ccr-ic{width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.16);color:#fff;display:grid;place-items:center;padding:0}',
    '.ccr-top svg,.ccr-bot svg{width:22px;height:22px}',
    '#ccrt{font-weight:600;font-variant-numeric:tabular-nums;padding:6px 12px;border-radius:999px;background:rgba(0,0,0,.45)}',
    '#ccrt.on{background:#e11d48}',
    '.ccr-bot{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:16px 14px calc(env(safe-area-inset-bottom,0px) + 22px);background:linear-gradient(transparent,rgba(0,0,0,.6))}',
    '.ccr-rec{width:74px;height:74px;border-radius:50%;border:4px solid #fff;background:transparent;padding:0;display:grid;place-items:center}',
    '.ccr-rec i{display:block;width:54px;height:54px;border-radius:50%;background:#e11d48;transition:all .15s}',
    '.ccr-rec.on i{width:28px;height:28px;border-radius:8px}',
    '.ccr-rev{position:absolute;left:0;right:0;bottom:0;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:16px 14px calc(env(safe-area-inset-bottom,0px) + 18px);background:linear-gradient(transparent,rgba(0,0,0,.7))}',
    '.ccr-note{position:absolute;left:0;right:0;bottom:120px;text-align:center;font-size:13px;opacity:.85;padding:0 20px}'
  ].join('');
  document.head.appendChild(css);

  function sheet(html) {
    var m = document.createElement('div'); m.className = 'ccp-sheet';
    m.innerHTML = '<div class="box g ccp-card">' + html + '</div>';
    document.body.appendChild(m); m.close = function () { m.remove(); };
    return m;
  }

  /* ---------- account actions ---------- */
  function showRecovery(d) {
    return new Promise(function (done) {
      var m = sheet('<h3>Save your recovery code</h3><p class="sub" style="margin-top:6px">This is the only way to get this account back on a new phone. We cannot show it again. Screenshot it or write it down.</p>'
        + '<div class="rw" style="margin-top:12px"><span>Account ID</span><b>' + esc(d.aid) + '</b></div>'
        + '<div class="rw"><span>Recovery code</span><b style="letter-spacing:1px">' + esc(d.recovery_code) + '</b></div>'
        + '<button class="btn g" id="ccp-cp" style="width:100%;margin-top:12px">Copy both</button>'
        + '<label class="sub" style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="ccp-ok"> I saved my account ID and recovery code</label>'
        + '<button class="btn p" id="ccp-go" style="width:100%;margin-top:12px" disabled>Continue</button>');
      m.dataset.noclose = '1';
      if (window.ccAddX) ccAddX(m, function () { if (confirm('Close without saving your recovery code? We cannot show it again, and without it you cannot get this account back on a new phone.')) { m.close(); done(); } });
      $('#ccp-cp', m).onclick = function () { copy('Comrade Connect account ID: ' + d.aid + '\nRecovery code: ' + d.recovery_code); };
      $('#ccp-ok', m).onchange = function (e) { $('#ccp-go', m).disabled = !e.target.checked; };
      $('#ccp-go', m).onclick = function () { m.close(); done(); };
    });
  }

  /* a REAL account (the old Me page and welcome sheet showed a made-up local code that could not restore anything) */
  async function createGuest() {
    if (!live()) throw new Error('We cannot reach the service right now. Please try again in a moment.');
    var r, d;
    try { r = await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); }
    catch (e) { throw new Error('Could not reach the server. Check your internet and try again.'); }
    d = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(window.ccErr ? ccErr(r.status, d.error) : 'Could not create the account');
    localStorage.setItem('cc_auth', JSON.stringify({ aid: d.aid, token: d.token }));
    if (ME.aid && ME.aid !== d.aid) ME.oldAid = ME.aid;
    ME.aid = d.aid; saveMe();
    await showRecovery(d);
    await afterSignIn();
    say('Account created');
  }

  async function afterSignIn() {
    await fetchInfo();
    try { saveMe(); } catch (e) {}
    try { drawMe(); drawMe2(); } catch (e) {}
    try { window.ccSyncVer && ccSyncVer(); } catch (e) {}
    try { window.ccRefresh && ccRefresh(true); } catch (e) {}
    try { window.ccWholesaleLoad && ccWholesaleLoad(); } catch (e) {}
    render();
  }

  /* ---------- username and password ---------- */
  var info = null;                                       // what the server says about this account (has_password, handle)
  async function fetchInfo() {
    info = null; if (!signedIn() || !live()) return;
    try { var r = await fetch(API + '/api/me'); if (r.ok) { info = await r.json(); if (info && info.handle) ME.handle = info.handle; } } catch (e) {}
  }
  var pwField = function (id, ph, label, ac) { return '<div class="fld"><input id="' + id + '" type="password" placeholder="' + ph + '" autocomplete="' + (ac || 'new-password') + '" autocapitalize="off" aria-label="' + label + '"></div>'; };
  var SHOWPW = '<label class="sub" style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="ccp-sh"> Show password</label>';
  function showToggle(m, ids) { var c = $('#ccp-sh', m); if (c) c.onchange = function () { ids.forEach(function (i) { var n = $('#' + i, m); if (n) n.type = c.checked ? 'text' : 'password'; }); }; }
  function problem(h, p) {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(h)) return 'Username: 3 to 20 letters, numbers or _';
    if (p.length < 8) return 'Password: at least 8 characters';
    if (p.toLowerCase() === h.toLowerCase()) return 'The password cannot be your username';
    return '';
  }
  async function post(path, body) {
    var r, d;
    try { r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    catch (e) { throw new Error('Could not reach the server. Check your internet and try again.'); }
    d = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(window.ccErr ? ccErr(r.status, d.error) : (d.error || 'Something went wrong'));
    return d;
  }
  function openCreate() {
    if (!live()) return say('We cannot reach the service right now. Please try again in a moment.');
    var m = sheet('<h3>Create your account</h3><p class="sub" style="margin-top:6px">Pick a username and a password. You will use them to sign in on any phone. Other people only see your username.</p>'
      + '<div class="fld" style="margin-top:10px"><input id="ccp-u" placeholder="Username" maxlength="20" autocomplete="username" autocapitalize="off" aria-label="Username"></div>'
      + pwField('ccp-p1', 'Password (8 or more characters)', 'Password') + pwField('ccp-p2', 'Repeat the password', 'Repeat the password') + SHOWPW
      + '<p class="sub" id="ccp-e" style="color:#f87171;min-height:18px"></p>'
      + '<div class="two"><button class="btn g" id="ccp-x">Cancel</button><button class="btn p" id="ccp-go">Create account</button></div>');
    showToggle(m, ['ccp-p1', 'ccp-p2']);
    $('#ccp-x', m).onclick = function () { m.close(); };
    $('#ccp-go', m).onclick = async function () {
      var b = $('#ccp-go', m), h = $('#ccp-u', m).value.trim(), p1 = $('#ccp-p1', m).value, p2 = $('#ccp-p2', m).value, e = $('#ccp-e', m);
      var bad = problem(h, p1) || (p1 !== p2 ? 'The two passwords are not the same' : '');
      if (bad) { e.textContent = bad; return; }
      b.disabled = true; e.textContent = '';
      try {
        var d = await post('/api/auth/register', { handle: h, password: p1 });
        localStorage.setItem('cc_auth', JSON.stringify({ aid: d.aid, token: d.token }));
        if (ME.aid && ME.aid !== d.aid) ME.oldAid = ME.aid;
        ME.aid = d.aid; ME.handle = d.handle || h; saveMe(); m.close();
        await afterSignIn(); say('Welcome, @' + (d.handle || h));
      } catch (er) { e.textContent = er.message; b.disabled = false; }
    };
  }
  function openCredentials() {
    var has = !!(info && info.has_password);
    var m = sheet('<h3>' + (has ? 'Change username or password' : 'Set a username and password') + '</h3><p class="sub" style="margin-top:6px">'
      + (has ? 'Enter your current password to make changes.' : 'Right now this account only has an account ID and a recovery code. Choose a username and password so you can sign in on any phone. Your old recovery code stops working once you save.') + '</p>'
      + (has ? '<div style="margin-top:10px">' + pwField('ccp-cur', 'Current password', 'Current password', 'current-password') + '</div>' : '')
      + '<div class="fld" style="margin-top:10px"><input id="ccp-u" placeholder="Username" maxlength="20" autocomplete="username" autocapitalize="off" aria-label="Username" value="' + esc((info && info.handle) || '') + '"></div>'
      + pwField('ccp-p1', has ? 'New password' : 'Password (8 or more characters)', 'Password') + pwField('ccp-p2', 'Repeat the password', 'Repeat the password') + SHOWPW
      + '<p class="sub" id="ccp-e" style="color:#f87171;min-height:18px"></p>'
      + '<div class="two"><button class="btn g" id="ccp-x">Cancel</button><button class="btn p" id="ccp-go">Save</button></div>');
    showToggle(m, ['ccp-p1', 'ccp-p2', 'ccp-cur']);
    $('#ccp-x', m).onclick = function () { m.close(); };
    $('#ccp-go', m).onclick = async function () {
      var b = $('#ccp-go', m), h = $('#ccp-u', m).value.trim(), p1 = $('#ccp-p1', m).value, p2 = $('#ccp-p2', m).value, e = $('#ccp-e', m);
      var bad = problem(h, p1) || (p1 !== p2 ? 'The two passwords are not the same' : '') || (has && !$('#ccp-cur', m).value ? 'Enter your current password' : '');
      if (bad) { e.textContent = bad; return; }
      b.disabled = true; e.textContent = '';
      try {
        var d = await post('/api/me/credentials', { handle: h, password: p1, current: has ? $('#ccp-cur', m).value : undefined });
        info = Object.assign(info || {}, { has_password: true, handle: d.handle || h }); ME.handle = d.handle || h; saveMe();
        m.close(); say('Saved. Sign in with @' + (d.handle || h) + ' and your password.');
        try { drawMe(); drawMe2(); } catch (x) {} render();
      } catch (er) { e.textContent = er.message; b.disabled = false; }
    };
  }

  function openRestore() {
    var m = sheet('<h3>Sign in</h3><p class="sub" style="margin-top:6px">Enter your username and password. If you made your account before usernames, use your account ID and the recovery code you saved.</p>'
      + '<div class="fld" style="margin-top:10px"><input id="ccp-a" placeholder="Username or account ID" autocomplete="username" autocapitalize="off" aria-label="Username or account ID"></div>'
      + pwField('ccp-c', 'Password or recovery code', 'Password or recovery code', 'current-password') + SHOWPW
      + '<p class="sub" id="ccp-e" style="color:#f87171;min-height:18px"></p>'
      + '<div class="two"><button class="btn g" id="ccp-x">Cancel</button><button class="btn p" id="ccp-r">Sign in</button></div>');
    showToggle(m, ['ccp-c']);
    $('#ccp-x', m).onclick = function () { m.close(); };
    $('#ccp-r', m).onclick = async function () {
      var b = $('#ccp-r', m); b.disabled = true; $('#ccp-e', m).textContent = '';
      try { await window.CC.restoreAccount($('#ccp-a', m).value, $('#ccp-c', m).value); m.close(); say('Signed in'); await afterSignIn(); }
      catch (e) { $('#ccp-e', m).textContent = e.message || 'Could not restore'; b.disabled = false; }
    };
  }

  /* ---------- sign out ---------- */
  var WIPE = ['cc_auth', 'cc_pending', 'cs_me', 'cc_bio', 'cc_follow', 'cs_club', 'cs_dm', 'cs_ht', 'cs_blocked', 'cs_hidden', 'cc_phone', 'cc_sellphone', 'cc_wf', 'cc_wfv', 'cc_wd_seen', 'cc_rel_seen'];
  function wipe(aid) {
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (WIPE.indexOf(k) >= 0 || k.indexOf('cc_c_') === 0 || (aid && k.slice(-(aid.length + 1)) === ':' + aid)) localStorage.removeItem(k);
      });
    } catch (e) {}
  }
  async function doSignOut(a) {
    try { if (live() && a && a.token) await Promise.race([fetch(API + '/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), new Promise(function (r) { setTimeout(r, 3000); })]); } catch (e) {}
    try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) {}
    wipe(a && a.aid);
    try { sessionStorage.setItem('cc_go', 'me'); sessionStorage.setItem('cc_toast', 'You are signed out'); } catch (e) {}
    location.reload();
  }
  function openSignOut() {
    var a = auth();
    if (!signedIn()) { say('You are not signed in'); try { go('me'); } catch (e) {} return; }
    var linked = !!ME.google, canG = !!(window.ccGoogle && ccGoogle.on());
    var body = linked
      ? '<p class="sub" style="margin-top:6px">You are signed in with Google. You can sign back in any time with the same Google account.</p>'
      : (info && info.has_password) ? '<p class="sub" style="margin-top:6px">You can sign back in any time with your username <b>@' + esc(info.handle || '') + '</b> and your password.</p>'
      : '<p class="sub" style="margin-top:6px">This is an anonymous account. After you sign out, the only way back in is your account ID and the recovery code you were shown when you created it. We cannot show that code again.</p>'
        + '<div class="rw" style="margin-top:12px"><span>Account ID</span><b>' + esc(a.aid) + '</b></div>'
        + '<button class="btn g" id="ccp-sc" style="width:100%;margin-top:10px">Copy account ID</button>'
        + (canG ? '<p class="sub" style="margin-top:14px">Safer: link Google first, then you can always get back in.</p><div id="ccp-sg" style="display:flex;justify-content:center;margin-top:8px;min-height:44px"></div>' : '')
        + '<label class="sub" style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="ccp-so"> I saved my account ID and recovery code</label>';
    var m = sheet('<h3>Sign out?</h3>' + body + '<div class="two" style="margin-top:14px"><button class="btn g" id="ccp-sx">Cancel</button><button class="btn p" id="ccp-sgo">Sign out</button></div>');
    var go2 = $('#ccp-sgo', m), ok = $('#ccp-so', m);
    if (ok) { go2.disabled = true; ok.onchange = function () { go2.disabled = !ok.checked; }; }
    var cp = $('#ccp-sc', m); if (cp) cp.onclick = function () { copy(a.aid); };
    $('#ccp-sx', m).onclick = function () { m.close(); };
    go2.onclick = function () { go2.disabled = true; doSignOut(a); };
    var gb = $('#ccp-sg', m);
    if (gb) window.ccGoogle.mount(gb, function () { m.close(); say('Google linked. You can sign out safely now.'); render(); }, function (e) { say(e); }, { theme: 'outline', width: 260 });
  }
  window.ccSignOut = openSignOut;

  /* ---------- the Me page ---------- */
  var gMounted = false;
  function ensureCard() {
    var host = $('#mecard'); if (!host || $('#ccsi')) return;
    host.insertAdjacentHTML('afterend',
      '<div class="box g" id="ccsi"><b class="t">Sign in</b>'
      + '<p class="sub" style="margin:0">You are not signed in on this phone. Create an account or sign in to keep your points, orders and wallet on any phone.</p>'
      + '<div id="ccsig" style="display:flex;justify-content:center;min-height:44px"></div>'
      + '<p class="sub" id="ccsie" style="color:#f87171;min-height:18px;margin:0"></p>'
      + '<button class="btn p" id="ccsiC" style="width:100%">Create account</button>'
      + '<button class="btn g" id="ccsiR" style="width:100%">I already have an account</button>'
      + '<button class="btn g" id="ccsiG" style="width:100%">Continue without a username</button></div>');
    $('#ccsiC').onclick = openCreate;
    $('#ccsiG').onclick = async function (e) { var b = e.currentTarget; b.disabled = true; try { await createGuest(); } catch (er) { say(er.message); } b.disabled = false; };
    $('#ccsiR').onclick = openRestore;
  }
  function ensureUp() {
    var card = $('#ccup');
    if (!signedIn() || !info || !$('#mecard')) { if (card) card.remove(); return; }
    var has = !!info.has_password;
    if (!card) { $('#mecard').insertAdjacentHTML('afterend', '<div class="box g" id="ccup"></div>'); card = $('#ccup'); }
    var key = has ? 'y:' + (info.handle || '') : 'n'; if (card.dataset.k === key) return; card.dataset.k = key;
    card.innerHTML = has
      ? '<b class="t">Sign in details</b><p class="sub" style="margin:0">You sign in with the username <b>@' + esc(info.handle || '') + '</b> and your password.</p><button class="btn g" id="ccup-b" style="width:100%">Change username or password</button>'
      : '<b class="t">Choose a username and password</b><p class="sub" style="margin:0">Right now this account only has an account ID and a recovery code. Set your own username and password so you can always sign in, on any phone.</p><button class="btn p" id="ccup-b" style="width:100%">Set username and password</button>';
    $('#ccup-b').onclick = openCredentials;
  }
  function mountG() {
    var box = $('#ccsig'); if (!box || gMounted) return;
    if (!(window.ccGoogle && ccGoogle.on())) { box.style.display = 'none'; return; }
    gMounted = true;
    var w = Math.max(200, Math.min(320, ((box.parentElement && box.parentElement.clientWidth) || 300) - 4));
    ccGoogle.mount(box, function () { gMounted = false; box.innerHTML = ''; say('Signed in with Google'); afterSignIn(); },
      function (m) { $('#ccsie').textContent = m || 'Google sign-in failed. Try again.'; }, { theme: 'outline', width: w })
      .then(function (ok) { if (!ok) gMounted = false; }, function () { gMounted = false; });
  }

  var bio = function () { try { return ST.get('cc_bio', ''); } catch (e) { return ''; } };
  function ensureProfile() {
    var card = $('#mecard'); if (!card) return;
    if (!$('#ccpr')) {
      var top = $('.mtop', card);
      if (top) top.insertAdjacentHTML('afterend',
        '<div id="ccpr"><p class="sub ccp-bio" id="ccp-bio"></p>'
        + '<div class="ccp-act" style="margin-top:10px"><button class="btn g" id="ccp-edit">Edit profile</button><button class="btn g" id="ccp-share">Share profile</button></div></div>');
      var e1 = $('#ccp-edit'), s1 = $('#ccp-share');
      if (e1) e1.onclick = openEdit;
      if (s1) s1.onclick = function () {
        var x = 'Join me on Comrade Connect, the campus app for Kirinyaga comrades.', u = (window.ccOrigin?window.ccOrigin():location.origin) + '/';
        if (navigator.share) navigator.share({ text: x, url: u }).catch(function () {});
        else window.open('https://wa.me/?text=' + encodeURIComponent(x + ' ' + u), '_blank', 'noopener');
      };
    }
    if (!$('#ccmy')) {
      card.insertAdjacentHTML('afterend', '<div class="box g" id="ccmy"><b style="font-size:16px">My clips</b><div class="ccp-gr" id="ccp-gr"></div></div>');
      $('#ccp-gr').onclick = function (e) { if (e.target.closest('button')) go('videos'); };
    }
  }
  function openEdit() {
    var m = sheet('<h3>Edit profile</h3>'
      + '<div class="fld" style="margin-top:10px"><textarea id="ccp-b" maxlength="100" style="height:84px;resize:none" placeholder="Write a short bio (no numbers or links)" aria-label="Bio"></textarea></div>'
      + '<div class="two" style="margin-top:12px"><button class="btn g" id="ccp-bx">Cancel</button><button class="btn p" id="ccp-bs">Save</button></div>');
    $('#ccp-b', m).value = bio();
    $('#ccp-bx', m).onclick = function () { m.close(); };
    $('#ccp-bs', m).onclick = function () {
      var v = $('#ccp-b', m).value.trim().slice(0, 100);
      try { if (v && typeof contactHit === 'function' && contactHit(v)) return say('No phone numbers, handles or links in your bio'); } catch (e) {}
      ST.set('cc_bio', v); m.close(); paint(); say('Profile saved');
    };
  }
  function paintHeader() {
    var out = !signedIn(), h = $('#mh'), av = $('#mav'), j = $('#mj'), k = $('#mkind');
    if (out) {
      if (h) h.textContent = 'Guest'; if (j) j.textContent = 'Not signed in'; if (k) k.textContent = 'Not signed in';
      if (av && !av.querySelector('img')) av.textContent = 'G';
    }
    var b = $('#ccp-bio'); if (b) b.textContent = bio() || 'No bio yet. Tap Edit profile to add one.';
  }
  function paintClips() {
    var g = $('#ccp-gr'); if (!g) return;
    var mine = []; try { mine = VIDS.filter(function (v) { return !v.ex && v.mine !== false; }); } catch (e) {}
    g.innerHTML = mine.length
      ? mine.map(function (v) { return '<button type="button" aria-label="Open clip">' + esc(String(v.cap || '').slice(0, 28)) + '</button>'; }).join('')
      : '<p class="sub" style="grid-column:1/4;text-align:center;margin:6px 0">No clips yet. Open Videos and tap Record.</p>';
  }
  function paintRecovery() {
    var me = $('#v-me'); if (!me) return;
    var box = Array.prototype.filter.call(me.querySelectorAll('.box'), function (b) { var h = b.querySelector('h3'); return h && h.textContent.trim() === 'Recovery code'; })[0];
    if (!box) return;
    if (!$('#ccp-rc', box)) {
      Array.prototype.forEach.call(box.children, function (c) { if (c.tagName !== 'H3') c.classList.add('ccp-hide'); });
      box.insertAdjacentHTML('beforeend', '<div id="ccp-rc"></div>');
    }
    var a = auth(), h;
    if (!signedIn()) h = '<p class="sub" style="margin:6px 0 0">Sign in first. Your account ID and recovery options show here.</p>';
    else {
      h = '<p class="sub" style="margin:6px 0 10px">' + (ME.google
        ? 'You sign in with Google, so you do not need a recovery code.'
        : (info && info.has_password) ? 'You sign in with your username and password, so you do not need a recovery code. Keep your account ID as a backup.'
        : 'Your recovery code was shown once when you created this account and cannot be shown again. Keep it together with your account ID. To never lose this account, link Google.') + '</p>'
        + '<div class="ccp-row"><span>Account ID</span><b>' + esc(a.aid) + '</b></div>'
        + '<div class="two" style="margin-top:8px"><button class="btn g" id="ccp-cid">Copy account ID</button>' + (ME.google ? '' : '<button class="btn g" id="ccp-lg">Link Google</button>') + '</div>'
        + '<div class="ccp-row" style="margin-top:14px"><span>Phone unlock code<br><small>Only unlocks the fingerprint lock on this phone. It cannot restore your account.</small></span><b id="ccp-pu">XXXX-XXXX-XXXX</b></div>'
        + '<div class="two" style="margin-top:8px"><button class="btn g" id="ccp-pus">Show</button><button class="btn g" id="ccp-puc">Copy</button></div>';
    }
    $('#ccp-rc', box).innerHTML = h;
    var q;
    if ((q = $('#ccp-cid', box))) q.onclick = function () { copy(a.aid); };
    if ((q = $('#ccp-lg', box))) q.onclick = function () { var b = $('#acb'); if (b) b.click(); };
    if ((q = $('#ccp-pus', box))) q.onclick = function () { var p = $('#ccp-pu', box), on = p.textContent.indexOf('X') !== 0; p.textContent = on ? 'XXXX-XXXX-XXXX' : ME.code; q.textContent = on ? 'Show' : 'Hide'; };
    if ((q = $('#ccp-puc', box))) q.onclick = function () { copy(ME.code); };
  }
  function paintAccountText() {
    var s = $('#acs'); if (s && !signedIn()) s.textContent = 'You are not signed in. Use the Sign in card at the top of Me to create an account or sign in with Google.';
  }
  function paint() { try { paintHeader(); paintClips(); paintRecovery(); paintAccountText(); } catch (e) { console.error('cc-profile', e); } }
  function render() {
    document.body.classList.toggle('cc-out', !signedIn());
    ensureCard(); ensureProfile(); ensureUp();
    if (!signedIn()) mountG();
    paint();
  }

  if (signedIn()) fetchInfo().then(function () { try { drawMe(); drawMe2(); } catch (e) {} render(); });

  /* wrap the page's own functions (same pattern the page already uses) */
  try { var d1 = drawMe; drawMe = function () { var r = d1.apply(this, arguments); render(); return r; }; } catch (e) {}
  try { var d2 = drawMe2; drawMe2 = function () { var r = d2.apply(this, arguments); paintAccountText(); return r; }; } catch (e) {}
  try { var d3 = drawVids; drawVids = function () { var r = d3.apply(this, arguments); paintClips(); return r; }; } catch (e) {}
  try { var g1 = go; go = function (v) { var r = g1.apply(this, arguments); if (v === 'me') { setTimeout(render, 0); if (!info && signedIn()) fetchInfo().then(function () { render(); }); } return r; }; } catch (e) {}

  /* welcome sheet: "Create anonymous account" now makes a real account and shows the real recovery code */
  var siA = $('#siA');
  if (siA) siA.onclick = async function () {
    if (signedIn()) return say('You already have an account on this phone');
    siA.disabled = true;
    try { await createGuest(); var dn = $('#siD'); if (dn) dn.click(); } catch (e) { say(e.message); }
    siA.disabled = false;
  };
  try {
    var rs = resetSi;
    resetSi = function () {
      var r = rs.apply(this, arguments);
      try {
        if (signedIn()) {
          var a = $('#siA'); if (a) a.hidden = true;
          var n = document.querySelector('#dm section[data-v=si] .note');
          if (n) n.textContent = ME.google ? 'You are signed in with Google.' : 'You have an account on this phone. Link Google so you can always get back in on any phone.';
          if (ME.google) { var gb = $('#siGb'); if (gb) gb.style.display = 'none'; }
        }
      } catch (e) {}
      return r;
    };
  } catch (e) {}

  /* "Sign in to continue" sheet: add the missing way back in for people who already have an account */
  new MutationObserver(function () {
    var g = $('#ccg-guest');
    if (g && !$('#ccg-have')) {
      g.insertAdjacentHTML('afterend', '<button class="btn g" id="ccg-have" style="width:100%;margin-top:6px">I already have an account ID and recovery code</button>');
      $('#ccg-have').onclick = function () { var x = $('#ccg-x'); if (x) x.click(); openRestore(); };
    }
  }).observe(document.body, { childList: true });

  /* ---------- Record: open the camera, do not open the file picker ---------- */
  var REC = null;
  function pickMime() {
    var c = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'];
    for (var i = 0; i < c.length; i++) { try { if (MediaRecorder.isTypeSupported(c[i])) return c[i]; } catch (e) {} }
    return '';
  }
  function fallbackPicker() { var i = $('#vc'); if (i) i.click(); }
  function closeRecorder() {
    if (!REC) return;
    try { if (REC.mr && REC.mr.state !== 'inactive') { REC.mr.onstop = null; REC.mr.stop(); } } catch (e) {}
    try { REC.stream && REC.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    try { if (REC.url) URL.revokeObjectURL(REC.url); } catch (e) {}
    clearInterval(REC.tick); REC.el.remove(); REC = null;
  }
  async function startStream() {
    var R = REC; if (!R) return;
    try { R.stream && R.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    var vid = { facingMode: R.facing, width: { ideal: 720 }, height: { ideal: 1280 } };
    try { R.stream = await navigator.mediaDevices.getUserMedia({ video: vid, audio: true }); }
    catch (e1) {
      if (e1 && (e1.name === 'NotAllowedError' || e1.name === 'SecurityError')) throw e1;
      R.stream = await navigator.mediaDevices.getUserMedia({ video: vid, audio: false });   // no microphone found: record without sound
    }
    if (!REC) { R.stream.getTracks().forEach(function (t) { t.stop(); }); return; }
    var v = $('video', R.el); v.srcObject = R.stream; v.muted = true; v.controls = false; v.loop = false;
    v.classList.toggle('mir', R.facing === 'user'); try { await v.play(); } catch (e) {}
  }
  function fmt(s) { return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  async function openRecorder() {
    if (REC) return;
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)) return fallbackPicker();
    var el = document.createElement('div'); el.className = 'ccr'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Record a clip');
    el.innerHTML = '<video playsinline muted autoplay></video>'
      + '<div class="ccr-top"><button type="button" id="ccr-x" aria-label="Close">' + SV('<path d="M6 6l12 12M18 6L6 18"/>') + '</button><span id="ccrt">0:00</span>'
      + '<button type="button" id="ccr-f" aria-label="Switch camera">' + SV('<path d="M4 8V5h3M20 16v3h-3"/><path d="M5 8a8 8 0 0 1 14-1M19 16a8 8 0 0 1-14 1"/>') + '</button></div>'
      + '<p class="ccr-note" id="ccr-n">Tap the red button to start. Up to 60 seconds.</p>'
      + '<div class="ccr-bot" id="ccr-b"><button type="button" class="ccr-rec" id="ccr-g" aria-label="Start recording"><i></i></button></div>'
      + '<div class="ccr-rev" id="ccr-r" hidden><button type="button" class="btn g" id="ccr-re">Retake</button><button type="button" class="btn p" id="ccr-ok">Use clip</button></div>';
    document.body.appendChild(el);
    REC = { el: el, facing: 'environment', stream: null, mr: null, chunks: [], secs: 0, tick: null, mime: '', url: '' };
    $('#ccr-x', el).onclick = closeRecorder;
    try { await startStream(); }
    catch (e) {
      closeRecorder();
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) say('Camera is blocked. Allow the camera for this site in your browser settings, then tap Record again.');
      else if (e && e.name === 'NotFoundError') { say('No camera found on this device.'); fallbackPicker(); }
      else say('Could not open the camera. Try again.');
      return;
    }
    var R = REC; if (!R) return;
    $('#ccr-f', el).onclick = async function () {
      if (R.mr && R.mr.state === 'recording') return say('Stop recording first');
      R.facing = R.facing === 'user' ? 'environment' : 'user';
      try { await startStream(); } catch (e) { say('Could not switch the camera'); }
    };
    var gbtn = $('#ccr-g', el);
    function stop() { try { if (R.mr && R.mr.state === 'recording') R.mr.stop(); } catch (e) {} }
    gbtn.onclick = function () {
      if (R.mr && R.mr.state === 'recording') return stop();
      R.mime = pickMime(); R.chunks = []; R.secs = 0;
      try { R.mr = new MediaRecorder(R.stream, R.mime ? { mimeType: R.mime, videoBitsPerSecond: 1500000, audioBitsPerSecond: 96000 } : { videoBitsPerSecond: 1500000 }); }
      catch (e) { return say('This browser cannot record here. Use Upload clip instead.'); }
      R.mr.ondataavailable = function (ev) { if (ev.data && ev.data.size) R.chunks.push(ev.data); };
      R.mr.onstop = function () {
        clearInterval(R.tick); gbtn.classList.remove('on'); $('#ccrt', el).classList.remove('on');
        var base = ((R.mr.mimeType || R.mime || 'video/webm').split(';')[0]) === 'video/mp4' ? 'video/mp4' : 'video/webm';
        var blob = new Blob(R.chunks, { type: base });
        if (!blob.size) return say('Nothing was recorded. Try again.');
        R.blob = blob; R.base = base; R.url = URL.createObjectURL(blob);
        R.stream.getTracks().forEach(function (t) { t.stop(); });
        var v = $('video', el); v.srcObject = null; v.src = R.url; v.muted = false; v.controls = true; v.loop = true; v.classList.remove('mir'); v.play().catch(function () {});
        $('#ccr-b', el).hidden = true; $('#ccr-n', el).hidden = true; $('#ccr-f', el).hidden = true; $('#ccr-r', el).hidden = false;
      };
      R.mr.start(500);
      gbtn.classList.add('on'); gbtn.setAttribute('aria-label', 'Stop recording'); $('#ccr-n', el).hidden = true;
      var t = $('#ccrt', el); t.classList.add('on'); t.textContent = '0:00';
      R.tick = setInterval(function () { R.secs++; t.textContent = fmt(R.secs); if (R.secs >= 60) stop(); }, 1000);
    };
    $('#ccr-re', el).onclick = async function () {
      try { URL.revokeObjectURL(R.url); } catch (e) {} R.url = ''; R.blob = null;
      var v = $('video', el); v.removeAttribute('src'); v.load();
      $('#ccr-r', el).hidden = true; $('#ccr-b', el).hidden = false; $('#ccr-n', el).hidden = false; $('#ccr-f', el).hidden = false; $('#ccrt', el).textContent = '0:00';
      gbtn.setAttribute('aria-label', 'Start recording');
      try { await startStream(); } catch (e) { closeRecorder(); say('Could not reopen the camera'); }
    };
    $('#ccr-ok', el).onclick = function () {
      var blob = R.blob, base = R.base; if (!blob) return;
      if (blob.size > 25 * 1048576) return say('That clip is over 25 MB. Record a shorter one.');
      var file = new File([blob], 'clip-' + Date.now() + (base === 'video/mp4' ? '.mp4' : '.webm'), { type: base });
      closeRecorder();
      try { addClip(file); } catch (e) { say('Could not post the clip'); }
    };
  }
  var vrec = $('#vrec'); if (vrec) vrec.onclick = openRecorder;
  window.ccRecorder = { open: openRecorder };

  /* ---------- start ---------- */
  window.addEventListener('load', function () {
    setTimeout(function () {
      render();
      var goMe = null, msg = null;
      try { goMe = sessionStorage.getItem('cc_go'); msg = sessionStorage.getItem('cc_toast'); sessionStorage.removeItem('cc_go'); sessionStorage.removeItem('cc_toast'); } catch (e) {}
      if (goMe === 'me') { try { go('me'); } catch (e) {} }
      if (msg) { var n = 0, t = setInterval(function () { var L = $('#loader'); if (!L || n++ > 40) { clearInterval(t); say(msg); } }, 300); }
    }, 50);
  });
  render();
})();
