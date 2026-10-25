#!/usr/bin/env python3
"""Section 2 patch for Comrade Connect (frontend/app/index.html). Idempotent: every edit is anchor-checked and skipped if already applied."""
import re, sys, os
F = 'frontend/app/index.html'
if not os.path.isfile(F):
    sys.exit('Run this from the repo root (frontend/app/index.html not found).')
t = open(F, encoding='utf-8').read()
bad = []; done = []; skipped = []

def rep(name, old, new, marker):
    """replace the exact text `old` (must occur once) with `new`; skip if `marker` is already in the file"""
    global t
    if marker in t: skipped.append(name); return
    n = t.count(old)
    if n != 1: bad.append('%s: anchor found %d times (need 1)' % (name, n)); return
    t = t.replace(old, new); done.append(name)

def rep_re(name, pattern, new, marker, flags=re.M | re.S):
    """replace the single regex match with `new`"""
    global t
    if marker in t: skipped.append(name); return
    m = list(re.finditer(pattern, t, flags))
    if len(m) != 1: bad.append('%s: pattern found %d times (need 1)' % (name, len(m))); return
    t = t[:m[0].start()] + new + t[m[0].end():]; done.append(name)

# ---------------------------------------------------------------- 1. reset flicker hardening
rep('boot: remember the token the boot check used',
    "(function(){var a=window.ccAuth();if(!(a&&a.token&&connected()))return;\n loadMe().then(",
    "(function(){var a=window.ccAuth();if(!(a&&a.token&&connected()))return;var bootTk=a.token;\n loadMe().then(",
    "var bootTk=a.token")
rep('boot: a late 401 must not delete a newer login',
    "function(e){if(e&&e.status===401){try{localStorage.removeItem('cc_auth')}catch(x){}}})})();",
    "function(e){if(e&&e.status===401){/* only drop the token this check used: a slow answer must never erase a login made meanwhile (reset, restore) */var cur=window.ccAuth();if(!cur||cur.token===bootTk){try{localStorage.removeItem('cc_auth')}catch(x){}}}})})();",
    "cur.token===bootTk")
rep('gate close toast: Password updated after a reset',
    "window.ccAfterGate=()=>{S.signed=true;refresh();toast('Welcome, comrade')};",
    "window.ccAfterGate=()=>{S.signed=true;refresh();if(S.pwDone){S.pwDone=false;toast('Password updated')}else toast('Welcome, comrade')};",
    "if(S.pwDone){S.pwDone=false")
rep('backGate: never re-show the gate when signed in',
    "function backGate(){S.fromGate=false;hideLock();const g=gEl();if(g)g.style.display=''}",
    "function backGate(){S.fromGate=false;hideLock();const g=gEl();if(!g)return;if(S.signed){try{window.ccGate&&ccGate.close()}catch(e){}return}g.style.display=''}",
    "if(!g)return;if(S.signed)")
rep('new password saved: clean hand-over',
    "   hideLock();try{if(window.ccGate&&ccGate.close)ccGate.close()}catch(e){}\n   S.signed=true;refresh();try{A.zone(S.zone)}catch(e){}toast('Password updated')",
    "   S.fromGate=false;S.signed=true;S.pwDone=true;setTimeout(function(){S.pwDone=false},2000);\n   try{if(window.ccGate&&ccGate.close)ccGate.close()}catch(e){}\n   try{refresh()}catch(e){}hideLock();try{A.zone(S.zone)}catch(e){}toast('Password updated')",
    "S.fromGate=false;S.signed=true;S.pwDone=true")

# ---------------------------------------------------------------- 2. show/hide password eye
rep('icon: eyeoff',
    "\nmail:'<rect x=\"3\" y=\"5\"",
    "\neyeoff:'<path d=\"M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 004.2 4.2\"/>',\nmail:'<rect x=\"3\" y=\"5\"",
    "\neyeoff:'")
rep('eye toggle (shared click handler)',
    "function hideLock(){$('#lock').classList.remove('on')}",
    "function hideLock(){$('#lock').classList.remove('on')}\n"
    "/* show/hide password: any button with data-eye flips the input beside it */\n"
    "document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-eye]');if(!b)return;e.preventDefault();const i=b.parentElement&&b.parentElement.querySelector('input');if(!i)return;const show=i.type==='password';i.type=show?'text':'password';b.innerHTML=ic(show?'eyeoff':'eye',b.classList.contains('eyeb')?'s':'');b.setAttribute('aria-label',show?'Hide password':'Show password')});",
    "/* show/hide password: any button with data-eye")
rep('restore sheet: eye on the password field',
    "${field('Password or recovery code','<input class=\"in\" type=\"password\" autocomplete=\"off\">')}",
    "${field('Password or recovery code','<div class=\"pwr\"><input class=\"in\" type=\"password\" autocomplete=\"off\"><button type=\"button\" class=\"eyeb\" data-eye aria-label=\"Show password\">'+ic('eye','s')+'</button></div>')}",
    'class="pwr"')
rep('restore sheet: the Restore button really restores',
    "A.rest=()=>{closeSheet();toast('Account restored')};",
    "A.rest=()=>{const sh=$('#sheet'),ins=sh?[...sh.querySelectorAll('input')]:[],u=(ins[0]||{}).value||'',p=(ins[1]||{}).value||'',b=sh&&sh.querySelector('[data-act=\"rest\"]');if(!(window.CC&&CC.restoreAccount)){closeSheet();toast('Account restored');return}if(b)b.disabled=true;CC.restoreAccount(u,p).then(()=>{try{window.ccRemember&&ccRemember(u,p)}catch(e){}closeSheet();S.signed=true;refresh();toast('Account restored')},e=>{if(b)b.disabled=false;toast(e&&e.status===401?'Wrong account ID or recovery code':((e&&e.message)||'Could not restore the account'))})};",
    "CC.restoreAccount(u,p).then(()=>{try{window.ccRemember")

# ---------------------------------------------------------------- 3. reset screens in the sign-in look
CSS = r'''/* reset screens: same look as the Login sheet (white or dark navy, Poppins, light-blue inputs, navy pill buttons) */
.lock.rs{--rs-sheet:#fff;--rs-ink:#101422;--rs-mut:rgba(16,20,34,.62);--rs-in:#eef8fa;--rs-ph:rgba(16,20,34,.45);--rs-btn:#101422;--rs-btnt:#fff;--rs-bowl:#101422;--rs-foc:#101422;--rs-tile:#dcf0f5;--rs-line:rgba(16,20,34,.16);padding:0;background:var(--rs-sheet);color:var(--rs-ink);font-family:Poppins,system-ui,sans-serif;overflow:hidden}
:root[data-theme="dark"] .lock.rs{--rs-sheet:#0d1120;--rs-ink:#f4f7fb;--rs-mut:rgba(244,247,251,.62);--rs-in:rgba(168,220,231,.11);--rs-ph:rgba(244,247,251,.4);--rs-btn:#A8DCE7;--rs-btnt:#101422;--rs-bowl:#1a2138;--rs-foc:#A8DCE7;--rs-tile:rgba(168,220,231,.16);--rs-line:rgba(244,247,251,.2)}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]) .lock.rs{--rs-sheet:#0d1120;--rs-ink:#f4f7fb;--rs-mut:rgba(244,247,251,.62);--rs-in:rgba(168,220,231,.11);--rs-ph:rgba(244,247,251,.4);--rs-btn:#A8DCE7;--rs-btnt:#101422;--rs-bowl:#1a2138;--rs-foc:#A8DCE7;--rs-tile:rgba(168,220,231,.16);--rs-line:rgba(244,247,251,.2)}}
.lock.rs .rs-w{flex:1;min-height:0;display:flex;flex-direction:column;text-align:left}
.rs-hd{position:relative;flex:none;height:206px;padding:calc(env(safe-area-inset-top,0px) + 18px) 18px 0;color:#fff}
.rs-cv{position:absolute;left:0;top:0;width:100%;height:100%;display:block;z-index:0}.rs-cv path{fill:var(--rs-bowl)}
.rs-top,.rs-brand,.rs-sub{position:relative;z-index:1}.rs-top{display:flex;justify-content:space-between}
.rs-b{width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.28);display:grid;place-items:center;color:#fff;background:transparent}.rs-b .i{width:18px;height:18px}
.rs-brand{display:flex;align-items:center;gap:12px;margin-top:20px}.rs-brand img{width:40px;height:auto}.rs-brand b{font:300 15px Poppins,sans-serif;letter-spacing:.2em;white-space:nowrap}
.rs-sub{margin:6px 0 0;font-size:13.5px;color:rgba(255,255,255,.7)}
.rs-body{flex:1;min-height:0;overflow-y:auto;padding:14px 22px calc(18px + env(safe-area-inset-bottom,0px))}
.rs-ic{width:52px;height:52px;border-radius:16px;background:var(--rs-tile);color:var(--rs-ink);display:grid;place-items:center;margin-bottom:12px}.rs-ic .i{width:26px;height:26px}
.rs-h{font:600 24px/1.15 Poppins,system-ui,sans-serif;letter-spacing:-.02em;margin:0 0 4px;color:var(--rs-ink)}
.rs-p{font-size:13.5px;line-height:1.55;color:var(--rs-mut);margin:0 0 16px}
.rs-f{margin-bottom:14px}.rs-f label{display:block;font:500 13px Poppins,system-ui,sans-serif;margin:0 0 6px;color:var(--rs-ink)}
.rs-in{position:relative}.rs-in input{width:100%;height:50px;border-radius:12px;border:1.5px solid transparent;background:var(--rs-in);color:var(--rs-ink);font:400 14px Poppins,system-ui,sans-serif;padding:0 48px 0 14px;outline:0;transition:border-color .2s}
.rs-in input::placeholder{color:var(--rs-ph)}.rs-in input:focus{border-color:var(--rs-foc)}
.rs-eye{position:absolute;right:4px;top:3px;width:44px;height:44px;display:grid;place-items:center;color:var(--rs-mut);border-radius:12px}.rs-eye .i{width:20px;height:20px}
.rs-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:50px;border-radius:999px;background:var(--rs-btn);color:var(--rs-btnt);font:500 15px Poppins,system-ui,sans-serif;margin-top:8px;transition:transform .15s,opacity .2s}
.rs-btn:active{transform:scale(.97)}.rs-btn:disabled{opacity:.5}.rs-btn[hidden]{display:none}.rs-btn.o{background:transparent;color:var(--rs-ink);border:1.5px solid var(--rs-line)}
.lock.rs .note{color:var(--rs-mut);font-size:12.5px;text-align:center}
.lock.rs .otpb{margin:18px 0 6px}
.lock.rs .otpb input{width:46px;height:56px;border-radius:12px;background:var(--rs-in);box-shadow:none;border:1.5px solid transparent;color:var(--rs-ink);font:600 22px Poppins,system-ui,sans-serif}
.lock.rs .otpb input:focus{border-color:var(--rs-foc);transform:none}
.lock.rs .otpb.badb input{border-color:var(--bad)}.lock.rs .otpb.okb input{border-color:var(--ok);background:rgba(31,157,87,.12)}
.pwr{position:relative}.pwr .in{padding-right:52px}.eyeb{position:absolute;right:8px;top:8px;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;color:var(--mut)}
'''
rep('css: reset screens + eye button', ".otpb.badb{animation:shk .45s}", CSS + ".otpb.badb{animation:shk .45s}", ".lock.rs{--rs-sheet")

HELP = r'''const rsHead=(back,sub)=>`<div class="rs-hd"><svg class="rs-cv" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0H100V0C92 20 72 40 46 40C22 40 6 30 0 21Z"/></svg><div class="rs-top"><button class="rs-b" data-act="${back}" aria-label="Back">${ic('back','s')}</button><button class="rs-b" data-act="lpw" aria-label="Close">${ic('x','s')}</button></div><div class="rs-brand"><img src="${window.ccLogoUrl?ccLogoUrl():''}" alt=""><b>COMRADE CONNECT</b></div><p class="rs-sub">${sub}</p></div>`;
const rsF=(l,f,inner)=>`<div class="rs-f"><label for="${f}">${l}</label>${inner}</div>`;
const rsPw=(id,ph,ac)=>`<div class="rs-in"><input id="${id}" type="password" placeholder="${ph}" autocomplete="${ac}"><button type="button" class="rs-eye" data-eye aria-label="Show password">${ic('eye')}</button></div>`;
'''
rep('helpers for the reset screens', "function lockHtml(page){", HELP + "function lockHtml(page){", "const rsHead=(back,sub)")

FORGOT = r''' if(page==='forgot')return `<div class="rs-w">${rsHead('lpw','Reset your password')}<div class="rs-body"><div class="rs-ic">${ic('key')}</div><h2 class="rs-h">Reset password</h2><p class="rs-p">Enter the email saved on your account. We will send you a 6-digit code.</p>${rsF('Email','fem','<div class="rs-in"><input id="fem" type="email" placeholder="you@example.com" autocomplete="email" autocapitalize="off" spellcheck="false"></div>')}<button class="rs-btn" data-act="lsendcode">Send code</button><button class="rs-btn o" data-act="lpw">Back to log in</button><p class="note" style="margin-top:16px">No email saved? Use Restore an account with your recovery code, or contact support.</p></div></div>`;'''
OTP = r''' if(page==='otp')return `<div class="rs-w">${rsHead('lforgot','Check your email')}<div class="rs-body" style="text-align:center"><div class="rs-ic" style="margin:0 auto 12px">${ic('mail')}</div><h2 class="rs-h">Enter the code</h2><p class="rs-p" style="margin-bottom:0">We sent a 6-digit code to your email.</p><div class="otpb" id="otpb">${[0,1,2,3,4,5].map(i=>`<input maxlength="1" inputmode="numeric" autocomplete="one-time-code" aria-label="Digit ${i+1}">`).join('')}</div><p class="note" id="otpm" style="min-height:20px"></p><button class="rs-btn" id="otpv" disabled>Verify</button><p class="note" id="otpt" style="margin-top:14px">Resend code in <b id="otps">30</b>s</p><button class="rs-btn o" id="otpr" hidden>Resend code</button></div></div>`;'''
rep_re('forgot screen', r"^ if\(page==='forgot'\)return `.*?`;$", FORGOT, 'rsHead(\'lpw\',\'Reset your password\')', re.M)
rep_re('code screen', r"^ if\(page==='otp'\)return `.*?`;$", OTP, "rsHead('lforgot','Check your email')", re.M)

NEWPW = r''' if(page!=='newpw')return _lh.apply(this,arguments);
 return '<div class="rs-w">'+rsHead('lforgot','Choose a new password')+'<div class="rs-body"><div class="rs-ic">'+ic('lock')+'</div><h2 class="rs-h">Choose a new password</h2><p class="rs-p">Other phones signed in to your account will be signed out.</p>'
  +rsF('New password','np1',rsPw('np1','Enter a new password','new-password'))
  +rsF('Repeat the password','np2',rsPw('np2','Repeat the password','new-password'))
  +'<p class="note" id="npm" style="min-height:20px"></p><button class="rs-btn" id="npgo">Save password</button></div></div>'};'''
rep_re('new-password screen',
       r" if\(page!=='newpw'\)return _lh\.apply\(this,arguments\);\n return '<div style=\"margin-top:50px\">.*?Save password</button></div>'\};",
       NEWPW, "rsHead('lforgot','Choose a new password')")

rep('showLock: mark the reset screens',
    "function showLock(page){const l=$('#lock');l.innerHTML=lockHtml(page);l.classList.add('on');",
    "function showLock(page){const l=$('#lock');l.innerHTML=lockHtml(page);l.classList.add('on');l.classList.toggle('rs',page==='forgot'||page==='otp'||page==='newpw');",
    "l.classList.toggle('rs'")

if bad:
    print('NOT PATCHED (nothing written):'); [print('  -', b) for b in bad]; sys.exit(1)
if done:
    open(F, 'w', encoding='utf-8').write(t)
print('applied :', len(done), done)
print('skipped (already there):', len(skipped), skipped)
