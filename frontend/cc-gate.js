/* cc-gate.js v1: the opening of the app and site, from the "Get started" design. Replaces the old loading screen, the old Get started pages and the old Log in / Sign up panel.
   Splash (logo glides across black) -> Get started cards -> white sheet with Login / Sign up -> dark sweep into the app.
   It is drawn inside its own shadow root so no site style can touch it. Accounts are unchanged: username + password and Google, through CC.restoreAccount / CC.createAccount / ccGoogle.
   window.ccGate.welcome() opens the cards, window.ccAuthPanel('login' | 'create') opens the sheet straight away, window.ccGate.close() closes it. */
(function () {
'use strict';
if (window.ccGate) return;
var CSS = `
:host{display:block;position:fixed;inset:0;z-index:9600;background:#101422;color:#fff;font:400 15px/1.5 Poppins,system-ui,sans-serif;-webkit-tap-highlight-color:transparent;--acc:#A8DCE7;--sheet:#FFFFFF;--ink:#101422;--mut:rgba(16,20,34,.62);--nt:#101422;--aqt:color-mix(in srgb,#A8DCE7 16%,#fff);box-sizing:border-box}
*{box-sizing:border-box}body{color:#fff;font:400 15px/1.5 Poppins,system-ui,sans-serif;overflow:hidden;-webkit-tap-highlight-color:transparent}
.app{position:absolute;inset:0;overflow:hidden;background:radial-gradient(120% 52% at 50% -8%,rgba(168,220,231,.2),transparent 62%),#101422;--b:.9s;--ch:270px}
@media(min-width:600px){:host{display:grid;place-items:center}.app{position:relative;inset:auto;width:390px;height:780px;max-height:96vh;border-radius:36px;border:1px solid #222}}
/* splash group */
.sp{position:absolute;left:0;right:0;top:46%;transform:translateY(-50%);text-align:center;pointer-events:none}
.sp img{width:64px;height:auto;display:block;margin:0 auto 18px;opacity:0;filter:brightness(0)}
.wm{font:300 15px/1 Poppins,sans-serif;letter-spacing:.34em;text-transform:uppercase;padding-left:.34em;opacity:0;white-space:nowrap}.wm,.wm b,.wm i{font-weight:300;font-style:normal;color:#000}
.tl{font-size:10.5px;line-height:1;color:#000;margin-top:18px;opacity:0}
.s .sp img{animation:cgwio 6s .1s cubic-bezier(.4,0,.2,1) both}
.s .wm{animation:cgwio 6s .1s cubic-bezier(.4,0,.2,1) both}
.s .tl{animation:cgwio 6s .1s cubic-bezier(.4,0,.2,1) both}
.w .sp,.a .sp{display:none}
@keyframes cgwio{0%{opacity:0;transform:translateX(-26px)}22%{opacity:1;transform:translateX(0)}65%{opacity:1;transform:translateX(14px)}100%{opacity:0;transform:translateX(190px)}}
@keyframes cgio{0%{opacity:0}22%{opacity:1}65%{opacity:1;transform:translateX(14px)}100%{opacity:0;transform:translateX(190px)}}
/* the white sheet with the bowl-shaped black top */
.sheet{position:absolute;inset:0;background:var(--sheet);color:var(--ink);transform:translateY(100%);display:flex;flex-direction:column;padding:calc(var(--ch) - 4px) 22px calc(16px + env(safe-area-inset-bottom,0px));transition:transform 1.3s cubic-bezier(.65,0,.2,1),padding-top 1.2s cubic-bezier(.65,0,.2,1)}
.w .sheet,.a .sheet{transform:none}
.s .sheet,.w .sheet{visibility:hidden;pointer-events:none}.a .sheet{visibility:visible}
.cv{position:absolute;left:0;top:-1px;width:100%;height:calc(var(--ch) + 150px);display:block;transition:height 1.5s cubic-bezier(.65,0,.2,1)}
.w .cv,.a .cv{height:var(--ch)}
.cv path{fill:#101422}
/* brand at top left (over the black) */
.brand{position:absolute;z-index:3;left:22px;top:calc(env(safe-area-inset-top,0px) + 30px);opacity:0;transition:opacity .7s 1.2s,top .5s cubic-bezier(.65,0,.2,1);pointer-events:none}
.a .brand{opacity:1;transition-delay:.3s}
.brand .row{display:flex;align-items:center;gap:11px}.brand img{width:40px;height:auto;display:block}
.brand b{font:500 13.5px Poppins,sans-serif;letter-spacing:.17em;text-transform:uppercase;white-space:nowrap}
.brand .bt{margin:20px 0 0;font:800 25px/1.1 Unbounded,Poppins,sans-serif;letter-spacing:-.02em;color:#fff}
.brand p{margin:8px 0 0;font-size:15px;line-height:1.35;color:rgba(255,255,255,.74)}
.s .pane.on>*{animation:none;opacity:0}
/* welcome: big logo and loud headline in the black area */
.bm,.hl,.bk{display:none!important}.bm{position:absolute;z-index:3;left:22px;top:calc(env(safe-area-inset-top,0px) + 30px);width:clamp(100px,17vh,140px);height:auto;opacity:0;filter:drop-shadow(0 12px 30px rgba(254,129,60,.35));transition:opacity .5s}
.hl{position:absolute;z-index:3;left:22px;right:22px;top:calc(env(safe-area-inset-top,0px) + 30px + clamp(100px,17vh,140px)*.74 + 16px);margin:0;font:800 clamp(36px,6.8vh,54px)/.98 'Bricolage Grotesque',Poppins,sans-serif;letter-spacing:-.04em;opacity:0;pointer-events:none}
.hl span{display:inline-block}.hl .v{color:var(--acc)}
.w .bm{opacity:1;transition:opacity .8s 1.1s;animation:cgfl 5s 2s ease-in-out infinite}
@keyframes cgfl{50%{transform:translateY(-8px)}}
.w .hl{opacity:1;transition:opacity .2s 1.2s}
.w .hl span{animation:cgwd .7s cubic-bezier(.2,.9,.3,1) both}
.w .hl .l1{animation-delay:1.3s}.w .hl .l2{animation-delay:1.45s}.w .hl .l3{animation-delay:1.6s}
@keyframes cgwd{from{opacity:0;transform:translateY(60%) rotate(4deg)}}
.bk{all:unset;position:absolute;z-index:4;right:18px;top:calc(env(safe-area-inset-top,0px) + 24px);width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.28);display:grid;place-items:center;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .4s}
.a .bk{opacity:1;pointer-events:auto;transition-delay:1.2s}.bk svg{width:20px;height:20px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.bk:focus-visible{outline:2px solid var(--acc);outline-offset:3px}
.sb{color:var(--mut);font-size:14px;margin:0}.fine{color:var(--mut);font-size:11.5px;text-align:center;margin:auto 0 0}.fine u{color:#101422}
.btn.o{background:#fff;color:#101422;border:1.5px solid rgba(16,20,34,.18)}
/* panes */
.pane{display:none;flex-direction:column;gap:14px;flex:1;position:relative;overflow:auto;padding:2px 2px 0}
.pane.on{display:flex}
.pane.on>*{animation:cgup .6s cubic-bezier(.2,.9,.3,1) both}
.pane.on>*:nth-child(1){animation-delay:calc(var(--b) + .0s)}.pane.on>*:nth-child(2){animation-delay:calc(var(--b) + .07s)}.pane.on>*:nth-child(3){animation-delay:calc(var(--b) + .14s)}.pane.on>*:nth-child(4){animation-delay:calc(var(--b) + .21s)}.pane.on>*:nth-child(5){animation-delay:calc(var(--b) + .28s)}.pane.on>*:nth-child(6){animation-delay:calc(var(--b) + .35s)}.pane.on>*:nth-child(7){animation-delay:calc(var(--b) + .42s)}.pane.on>*:nth-child(8){animation-delay:calc(var(--b) + .49s)}
@keyframes cgup{from{opacity:0;transform:translateY(14px)}}
h2{font:600 24px/1.1 Unbounded,Poppins,sans-serif;margin:0 0 2px;letter-spacing:-.02em}
.f label{display:block;font-size:12.5px;font-weight:500;margin:0 0 6px}
.in{position:relative}
.in input{width:100%;height:50px;border-radius:12px;border:1.5px solid transparent;background:var(--aqt);color:var(--ink);font:inherit;font-size:14px;padding:0 48px 0 14px;outline:none;transition:border-color .2s}
.in input::placeholder{color:rgba(16,20,34,.45)}.in input:focus{border-color:#101422}
.eye{all:unset;position:absolute;right:4px;top:3px;width:44px;height:44px;display:grid;place-items:center;cursor:pointer}
.eye svg{width:20px;height:20px;fill:none;stroke:#6b6862;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.eye .eo{display:none}.eye.on .eo{display:block}.eye.on .ey{display:none}
.err{color:#101422;font-weight:500;font-size:13px;min-height:0;margin:0}
.lnk{all:unset;cursor:pointer;color:#101422;font-size:12.5px;align-self:flex-end;font-weight:500}
.btn{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;justify-content:center;width:100%;height:50px;border-radius:999px;background:#101422;color:#fff;font-weight:500;font-size:15px;flex:none;align-self:center;overflow:hidden;transition:width .45s cubic-bezier(.65,0,.2,1),transform .15s}
.btn:active{transform:scale(.97)}.btn.ld{width:92px}.btn.ld .t{display:none}
.sn{display:none;gap:6px;align-items:center}.btn.ld .sn{display:flex}.sn b{width:8px;height:8px;border-radius:50%;background:#fff;animation:cgdt 1s infinite ease-in-out}.sn b:nth-child(2){animation-delay:.15s}.sn b:nth-child(3){animation-delay:.3s}@keyframes cgdt{0%,80%,100%{transform:scale(.5);opacity:.5}40%{transform:scale(1.15);opacity:1}}
@keyframes cgrot{to{transform:rotate(360deg)}}
.btn:focus-visible,.lnk:focus-visible,.eye:focus-visible,.soc:focus-visible,.sw button:focus-visible{outline:2px solid var(--acc);outline-offset:3px}
.or{display:flex;align-items:center;gap:12px;color:var(--mut);font-size:12px;margin:6px 0 2px}.or:before,.or:after{content:"";flex:1;height:1px;background:rgba(16,20,34,.12)}
.socs{display:flex;justify-content:center;gap:16px}
.soc{all:unset;cursor:pointer;width:52px;height:52px;border-radius:50%;background:var(--aqt);display:grid;place-items:center;box-shadow:none;transition:transform .15s}.soc:active{transform:scale(.94)}
.sw{text-align:center;color:var(--mut);font-size:13px;margin:auto 0 0;padding-top:12px}.sw button{all:unset;cursor:pointer;color:#101422;font-weight:600}
.cover{position:absolute;left:0;top:0;width:100%;height:135%;z-index:8;pointer-events:none;display:none;will-change:transform;transform:translate3d(0,-100%,0)}
.cover svg{width:100%;height:100%;display:block}.cover path{fill:#101422}
.home{position:absolute;inset:0;z-index:7;background:var(--sheet);color:var(--ink);opacity:0;visibility:hidden}
.home.on{opacity:1;visibility:visible}
.hm{position:absolute;inset:0;display:grid;place-items:center;color:var(--mut);font-size:13px}
.rp{all:unset;position:absolute;z-index:2;right:18px;top:calc(env(safe-area-inset-top,0px) + 20px);cursor:pointer;font-size:13px;padding:10px 14px;border-radius:999px;border:1px solid rgba(0,0,0,.25);color:#101422}
.rp:focus-visible{outline:2px solid var(--acc);outline-offset:3px}
.app.su{--ch:250px}.su .brand{top:calc(env(safe-area-inset-top,0px) + 50px)}.app.s{background:radial-gradient(120% 52% at 50% -8%,rgba(168,220,231,.75),transparent 62%),#fff}
.app.w .sheet{transform:translateY(100%)}
.gs{position:absolute;inset:0;z-index:5;background:linear-gradient(180deg,#A8DCE7 0,rgba(168,220,231,.35) 220px,rgba(255,255,255,0) 420px),#fff;color:#101422;display:flex;flex-direction:column;visibility:hidden;opacity:0;touch-action:pan-y;user-select:none;transition:opacity .5s,visibility .5s}.w .gs{visibility:visible;opacity:1}
.gt{display:flex;justify-content:center;align-items:center;gap:10px;padding-top:calc(env(safe-area-inset-top,0px) + 26px);flex:none}.gt img{width:30px;height:auto;filter:invert(1)}.gt b{font:300 15px Poppins,sans-serif;letter-spacing:.3em;text-transform:uppercase}
.gv{flex:1;min-height:0;overflow:hidden}.gk{display:flex;height:100%;transition:transform .55s cubic-bezier(.65,0,.2,1)}
.gsl{flex:0 0 100%;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 24px;text-align:center}
.art{position:relative;width:300px;height:250px;flex:none;margin-bottom:18px}
.cd{position:absolute;width:140px;height:186px;border-radius:18px;border:2.5px solid #101422;background:var(--aqt);overflow:hidden;display:grid;place-items:center;font-size:12px;color:var(--mut);box-shadow:0 12px 22px -12px rgba(0,0,0,.4)}.cd img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.c1{left:0;top:52px;transform:rotate(-9deg)}.c2{right:0;top:40px;transform:rotate(8deg)}.c3{left:80px;top:0;transform:rotate(-2deg);z-index:2}
.st{position:absolute;width:28px;height:28px;border-radius:50%;border:2.5px solid #101422;z-index:3;animation:cgfl 5s ease-in-out infinite}.st.a{left:6px;top:8px;background:#fff}.st.b{right:10px;top:4px;background:#101422;animation-delay:-1.6s}.st.c{right:36px;bottom:6px;background:var(--acc);animation-delay:-3s}
.w .gsl.on .cd{animation:cgci .8s cubic-bezier(.2,.9,.3,1) both}.w .gsl.on .c1{animation-delay:.1s}.w .gsl.on .c2{animation-delay:.2s}@keyframes cgci{from{opacity:0;transform:translateY(40px) scale(.9)}}
.gsl h2{font:700 clamp(19px,3.3vh,24px)/1.18 Unbounded,Poppins,sans-serif;letter-spacing:-.01em;margin:0 0 10px}.gsl p{margin:0;font-size:13.5px;color:var(--mut);max-width:290px;line-height:1.55}
.w .gsl.on h2{animation:cgup .6s .25s both}.w .gsl.on p{animation:cgup .6s .32s both}
.gd{display:flex;justify-content:center;gap:6px;margin:6px 0 16px;flex:none}.gd b{width:7px;height:7px;border-radius:9px;background:rgba(16,20,34,.18);transition:.3s;cursor:pointer}.gd b.on{width:26px;background:#101422}
.gb{padding:0 22px calc(16px + env(safe-area-inset-bottom,0px));flex:none}.gb .lg{text-align:center;color:var(--mut);font-size:13px;margin:12px 0 0}.gb .lg button{all:unset;cursor:pointer;color:#101422;font-weight:600}.gb .fine{margin:10px 0 0}.hl{font-size:clamp(32px,5.8vh,44px)}
.chips{display:flex;gap:8px;flex-wrap:wrap}.chips span{background:var(--aqt);border-radius:999px;padding:8px 14px;font-size:13px;font-weight:500}
@media(max-height:720px){.app{--ch:230px}.app.su{--ch:200px}.su .brand{top:calc(env(safe-area-inset-top,0px) + 30px)}.app.w{--ch:290px}}
.app.q .cv{transition:height .5s cubic-bezier(.65,0,.2,1)}.app.q .sheet{transition:transform 1.3s cubic-bezier(.65,0,.2,1),padding-top .5s cubic-bezier(.65,0,.2,1)}
.app.typ{--ch:130px}
@media(prefers-reduced-motion:reduce){*{animation-duration:.01s!important;animation-delay:0s!important;transition-duration:.01s!important}}

.skp{all:unset;cursor:pointer;display:block;margin:6px auto 0;padding:8px 12px;font-size:12.5px;color:rgba(16,20,34,.55)}.fine u{cursor:pointer;text-decoration:underline}.gs{background:#F3F6F7}.gt{height:32px;box-sizing:content-box}.gt img{height:28px;width:auto}.gt b{font:800 17px Unbounded,Poppins,sans-serif;letter-spacing:0;text-transform:none}.gsl{justify-content:flex-start;padding-top:clamp(18px,5vh,56px)}.art{margin-bottom:50px}.art::before,.art::after{content:"";position:absolute;width:26px;height:26px;z-index:3;background:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Cpath d=%27M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z%27 fill=%27none%27 stroke=%27%23101422%27 stroke-width=%271.6%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E") center/contain no-repeat;animation:cgfl 5s ease-in-out infinite}.art::before{left:-14px;bottom:44px}.art::after{right:-6px;top:78px;width:20px;height:20px;animation-delay:-2s}.gd{position:absolute;left:0;right:0;margin:0;top:calc(env(safe-area-inset-top,0px) + 58px + clamp(18px,5vh,56px) + 250px + 20px);z-index:2}.gd b{width:9px;height:9px;background:transparent;border:1.5px solid #101422}.gd b.on{width:30px;background:#101422}.gsl h2{font:800 clamp(27px,4.6vh,36px)/1.1 Unbounded,Poppins,sans-serif;letter-spacing:-.02em;margin:0 0 12px}.gsl p{font-size:14px;max-width:300px}.gb #gn{width:min(260px,80%);margin:0 auto;background:#fff;color:#101422;border:2px solid #101422;box-shadow:0 4px 0 #101422;font-weight:600;transition:transform .12s,box-shadow .12s}.gb #gn:active{transform:translateY(3px);box-shadow:0 1px 0 #101422}.cover.on{display:block}
/* Google banner: white pill, turns grey with a spinner while Google is working (like Claude's sign-in) */
.socs{display:block}
.gbx{position:relative;display:block;width:100%;max-width:400px;height:52px;margin:0 auto;border-radius:999px}
.gbx .gb-vis,.gbx .cc-gbtn{all:unset;box-sizing:border-box;position:absolute;left:0;top:0;display:flex;align-items:center;justify-content:center;gap:12px;width:100%;height:52px;border-radius:999px;background:#fff;border:1.5px solid rgba(16,20,34,.16);box-shadow:0 2px 10px rgba(16,20,34,.07);color:#101422;font:600 15px Poppins,system-ui,sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .2s,color .2s,border-color .2s,transform .12s}
.gbx .cc-gbtn:active{transform:scale(.985)}
.gbx .gb-vis svg,.gbx .cc-gbtn svg{width:20px;height:20px;display:block;flex:none;transition:opacity .2s}
.gbx .gb-vis span,.gbx .cc-gbtn .gb-t{white-space:nowrap}
.gb-sp{display:none;position:absolute;right:20px;top:50%;width:18px;height:18px;margin-top:-9px;border-radius:50%;border:2.2px solid rgba(16,20,34,.18);border-top-color:rgba(16,20,34,.7);animation:cgrot .8s linear infinite}
.gbx.ld .gb-vis,.gbx .cc-gbtn:disabled{background:#E3E5E9;border-color:transparent;color:rgba(16,20,34,.5);box-shadow:none;cursor:default}
.gbx.ld .gb-vis svg,.gbx .cc-gbtn:disabled svg{opacity:.5}
.gbx.ld .gb-sp,.gbx .cc-gbtn:disabled .gb-sp{display:block}
.gb-hit{position:absolute;left:0;top:0;width:100%;height:40px;transform-origin:0 0;transform:scaleY(1.3);opacity:.01;overflow:hidden;z-index:2}
.gb-hit iframe{display:block}
.gerr{margin:0;font-size:12.5px;line-height:52px;text-align:center;color:var(--mut)}
.app.gl::after{content:"";position:absolute;inset:0;z-index:30;background:rgba(16,20,34,.42);pointer-events:none;animation:cgfade .25s both}
@keyframes cgfade{from{opacity:0}}
.pane{gap:11px}.in input{height:48px}.pane .sw{padding-top:4px}
.pane .fine.tm{margin:0;padding:0 6px;line-height:1.55;font-size:11px}
.fine.tm u{color:#101422;text-decoration:underline;cursor:pointer}
/* section 3: the site's own palette (cream page, warm dark, orange accent) */
:host{--acc:#ff8a3d;--sheet:#fbf1ed;--ink:#16130f;--mut:rgba(22,19,15,.62);--nt:#16130f;--aqt:rgba(255,255,255,.86);font-family:Manrope,Poppins,system-ui,sans-serif}
*{font-family:inherit}
.app{background:#fbf1ed}
.app.s{background:radial-gradient(85% 42% at 88% -6%,rgba(255,138,61,.26),transparent 68%),radial-gradient(70% 38% at 0% 104%,rgba(196,114,122,.18),transparent 70%),#fbf1ed}
.wm,.wm b,.wm i,.tl{color:#16130f}
.sp img{filter:brightness(0)}
.cv path,.cover path{fill:#16130f}
.brand b{font-weight:600}.brand .bt{font-family:Manrope,Poppins,sans-serif;font-weight:800;font-size:27px;letter-spacing:-.03em}
h2{font-family:Manrope,Poppins,sans-serif;font-weight:800;letter-spacing:-.02em}
.in input{background:var(--aqt);border:1.5px solid rgba(22,19,15,.09);color:#16130f}
.in input:focus{border-color:#16130f}.in input::placeholder{color:rgba(22,19,15,.42)}
.btn{background:#16130f;color:#fff}.btn.o{background:#fff;color:#16130f;border:1.5px solid rgba(22,19,15,.18)}
.err,.lnk,.sw button,.fine u,.fine.tm u,.gb .lg button{color:#16130f}
.or:before,.or:after{background:rgba(22,19,15,.12)}
.gbx .gb-vis,.gbx .cc-gbtn{color:#16130f;border-color:rgba(22,19,15,.14)}
.gbx.ld .gb-vis,.gbx .cc-gbtn:disabled{background:#ECE3DE;color:rgba(22,19,15,.5)}
.gb-sp{border-color:rgba(22,19,15,.16);border-top-color:rgba(22,19,15,.7)}
.app.gl::after{background:rgba(22,19,15,.4)}
.gs{background:radial-gradient(85% 34% at 88% -4%,rgba(255,138,61,.24),transparent 68%),radial-gradient(70% 30% at 0% 100%,rgba(196,114,122,.16),transparent 70%),#fbf1ed}
.gt b,.gsl h2{font-family:Manrope,Poppins,sans-serif;font-weight:800}
.cd{border-color:#16130f;background:#fff}.st{border-color:#16130f}.st.b{background:#16130f}.gd b{border-color:#16130f}.gd b.on{background:#16130f}
.gb #gn{background:#fff;color:#16130f;border-color:#16130f;box-shadow:0 4px 0 #16130f}.gb #gn:active{box-shadow:0 1px 0 #16130f}
.invb{background:var(--aqt)!important;border:1.5px solid rgba(22,19,15,.09)}
/* curve fix */
.cv{overflow:visible}
.sheet::before{content:"";position:absolute;left:0;right:0;top:-2px;height:calc(var(--ch)*.42);background:#16130f;transition:height 1.5s cubic-bezier(.65,0,.2,1)}
.app.q .sheet::before,.app.typ .sheet::before{transition:height .5s cubic-bezier(.65,0,.2,1)}
.app.typ{--ch:150px}
.brand .bt,.brand p{transition:opacity .25s,transform .25s}
.app.typ .brand .bt,.app.typ .brand p{opacity:0;transform:translateY(-6px)}
`;
var HTML = `<div class="app s" id="app" role="main">

<div class="sp" aria-label="Comrade Connect"><img src="cc-mark.png" alt=""><div class="wm"><b>Comrade</b> <i>Connect</i></div><div class="tl">Your campus. Your voice.</div></div>

<img class="bm" src="cc-mark.png" alt="Comrade Connect">
<h1 class="hl" aria-label="Your campus. Your voice."><span class="l1">Your campus.</span><br><span class="l2">Your</span> <span class="l3 v">voice.</span></h1>
<button class="bk" data-go="w" aria-label="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
<div class="brand"><div class="row"><img src="cc-mark.png" alt=""><b>Comrade Connect</b></div><h1 class="bt" id="bt">Welcome back!</h1><p id="bs">Log in to continue.</p></div>

<div class="sheet">
 <svg class="cv" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0H100V20C100 31 76 40 50 40C24 40 0 31 0 20Z"/></svg>

 <div class="pane" id="pw">
  <p class="sb">Spill, buy, sell and go live with Kenyan comrades. Always anonymous.</p>
  <div class="chips"><span>Spill</span><span>Marketplace</span><span>Live</span></div>
  <button class="btn" data-go="u"><span class="t">Get started</span></button>
  <button class="btn o" data-go="l"><span class="t">Log in</span></button>
  <p class="fine">By continuing you agree to our <u>Terms</u> and <u>Privacy Policy</u>.</p>
 </div>

 <form class="pane on" id="pl" novalidate>
  <h2>Login</h2>
  <div class="f"><label for="le">Username</label><div class="in"><input id="le" type="text" placeholder="Enter your username" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false"></div></div>
  <div class="f"><label for="lp">Password</label><div class="in"><input id="lp" type="password" placeholder="Enter your password" autocomplete="current-password"><button type="button" class="eye" data-eye="lp" aria-label="Show password"><svg class="ey" viewBox="0 0 24 24"><path d="M2 12s3.600-7 10-7 10 7 10 7-3.600 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg><svg class="eo" viewBox="0 0 24 24"><path d="M3 3l18 18M10.600 5.100A10 10 0 0112 5c6.400 0 10 7 10 7a17 17 0 01-3.200 4M6.600 6.600C3.800 8.400 2 12 2 12s3.600 7 10 7c1.600 0 3-.4 4.300-1M9.900 9.900a3 3 0 004.200 4.200"/></svg></button></div></div>
  <button type="button" class="lnk" data-fg>Forgot password?</button>
  <p class="err" id="e1" role="alert"></p>
  <button class="btn" type="submit"><span class="t">Login</span><i class="sn"><b></b><b></b><b></b></i></button>
  <div class="or" data-or>Or</div>
  <div class="socs"><span class="gbx"></span></div>
  <p class="sw">Don't have an account? <button type="button" data-go="u">Sign up</button></p>
  <p class="fine tm">By continuing, you agree to Comrade Connect's <u data-t="/terms.html">Terms</u> and <u data-t="/terms.html">Usage Policy</u>, and acknowledge our <u data-t="/privacy.html">Privacy Policy</u>.</p>
 </form>

 <form class="pane" id="pu" novalidate>
  <h2>Sign up</h2>
  <div class="f"><label for="se">Username</label><div class="in"><input id="se" type="text" maxlength="20" placeholder="Choose a username" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false"></div></div>
  <div class="f"><label for="sp">Password</label><div class="in"><input id="sp" type="password" placeholder="Create a password" autocomplete="new-password"><button type="button" class="eye" data-eye="sp" aria-label="Show password"><svg class="ey" viewBox="0 0 24 24"><path d="M2 12s3.600-7 10-7 10 7 10 7-3.600 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg><svg class="eo" viewBox="0 0 24 24"><path d="M3 3l18 18M10.600 5.100A10 10 0 0112 5c6.400 0 10 7 10 7a17 17 0 01-3.200 4M6.600 6.600C3.800 8.400 2 12 2 12s3.600 7 10 7c1.600 0 3-.4 4.300-1M9.900 9.900a3 3 0 004.200 4.200"/></svg></button></div></div>
  <div class="f"><label for="sc">Confirm password</label><div class="in"><input id="sc" type="password" placeholder="Repeat your password" autocomplete="new-password"><button type="button" class="eye" data-eye="sc" aria-label="Show password"><svg class="ey" viewBox="0 0 24 24"><path d="M2 12s3.600-7 10-7 10 7 10 7-3.600 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg><svg class="eo" viewBox="0 0 24 24"><path d="M3 3l18 18M10.600 5.100A10 10 0 0112 5c6.400 0 10 7 10 7a17 17 0 01-3.200 4M6.600 6.600C3.800 8.400 2 12 2 12s3.600 7 10 7c1.600 0 3-.4 4.300-1M9.900 9.900a3 3 0 004.200 4.200"/></svg></button></div></div>
  <div class="f"><label for="sr">Invite code (optional)</label><div class="in"><input id="sr" type="text" maxlength="12" placeholder="Have a friend's code? Enter it" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" style="text-transform:uppercase"></div></div>
  <p class="err" id="e2" role="alert"></p>
  <button class="btn" type="submit"><span class="t">Sign up</span><i class="sn"><b></b><b></b><b></b></i></button>
  <div class="or" data-or>Or</div>
  <div class="socs"><span class="gbx"></span></div>
  <p class="sw">Already have an account? <button type="button" data-go="l">Log in</button></p>
  <p class="fine tm">By continuing, you agree to Comrade Connect's <u data-t="/terms.html">Terms</u> and <u data-t="/terms.html">Usage Policy</u>, and acknowledge our <u data-t="/privacy.html">Privacy Policy</u>.</p>
 </form>
</div>

<div class="gs" id="gs"><div class="gt"><img class="gl" alt=""><b>Comrade Connect</b></div>
<div class="gv"><div class="gk" id="gk">
<div class="gsl on"><div class="art"><div class="cd c1"><img alt="" src="img/intro/feed1.webp"></div><div class="cd c2"><img alt="" src="img/intro/feed2.webp"></div><div class="cd c3"><img alt="" src="img/intro/feed3.webp"></div><i class="st a"></i><i class="st b"></i><i class="st c"></i></div><h2>Spill it. Nobody will know it was you.</h2><p>The anonymous campus feed for Kirinyaga comrades. No name, no trace.</p></div>
<div class="gsl"><div class="art"><div class="cd c1"><img alt="" src="img/intro/mkt1.webp"></div><div class="cd c2"><img alt="" src="img/intro/mkt2.webp"></div><div class="cd c3"><img alt="" src="img/intro/mkt3.webp"></div><i class="st a"></i><i class="st b"></i><i class="st c"></i></div><h2>Buy and sell safely.</h2><p>Your money stays in escrow until you confirm the item with your handover code.</p></div>
<div class="gsl"><div class="art"><div class="cd c1"><img alt="" src="img/intro/ppl1.webp"></div><div class="cd c2"><img alt="" src="img/intro/ppl2.webp"></div><div class="cd c3"><img alt="" src="img/intro/ppl3.webp"></div><i class="st a"></i><i class="st b"></i><i class="st c"></i></div><h2>Find your people.</h2><p>Roommates, study groups, hostels, events and Kura, all in one place.</p></div>
</div></div>
<div class="gd" id="gd"><b class="on"></b><b></b><b></b></div>
<div class="gb"><button class="btn" id="gn">Show me around</button><p class="lg">Already a comrade? <button type="button" data-go="l">Log in</button></p><p class="fine">By continuing you agree to our <u data-t="/terms.html">Terms</u> and <u data-t="/privacy.html">Privacy Policy</u>.</p><button type="button" class="skp" data-skip>Just looking around</button></div></div>
<div class="cover" id="cover" aria-hidden="true"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path id="cp" d="M0 0H100V80C75 100 25 100 0 80Z"/></svg></div>
</div>`;
var host = null, root = null, app = null, tm = null, wantW = false, spl = false, gDone = false;
function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) {} return null; }
function cfg() { try { return JSON.parse(localStorage.getItem('cc_site_v1') || '{}') || {}; } catch (e) { return {}; } }
function $(s) { return root.querySelector(s); }
function all(s) { return [].slice.call(root.querySelectorAll(s)); }

function finish() {
  if (!host) return;
  var h = host; host = null; clearTimeout(tm); ss('cc_land', '1'); window.ccFirstRunOpen = false;
  h.style.transition = 'opacity .5s'; h.style.opacity = '0';
  setTimeout(function () { if (h.parentNode) h.parentNode.removeChild(h); }, 600);
  try { if (window.ccCkShow) setTimeout(window.ccCkShow, 400); } catch (e) {}
}

function build(state, mode) {
  if (host) return;
  host = document.createElement('div'); host.id = 'ccgate'; host.setAttribute('role', 'dialog'); host.setAttribute('aria-label', 'Welcome to Comrade Connect');
  root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<style>' + CSS + '</style>' + HTML;
  document.body.appendChild(host);
  app = root.getElementById('app'); gDone = false;
  window.ccFirstRunOpen = true;
  wire();
  if (state === 's') {
    spl = true; go('w'); app.className = 'app s'; app.style.setProperty('--b', '.9s');
    tm = setTimeout(function () {
      var next = function () { if (!host || !spl) return; spl = false; if (wantW) toWelcome(); else finish(); };
      if (document.readyState === 'complete') next(); else { window.addEventListener('load', next, { once: true }); setTimeout(next, 6000); }
    }, 6300);
  } else if (state === 'w') { go('w'); app.className = 'app w'; app.style.setProperty('--b', '0s'); }
  else { go('w'); app.className = 'app w'; app.style.setProperty('--b', '0s'); requestAnimationFrame(function () { requestAnimationFrame(function () { go(mode || 'l'); }); }); }
}
function toWelcome() {
  if (!host || !/\bs\b/.test(app.className)) return;
  gset(0); app.className = 'app w'; app.style.setProperty('--b', '.9s');
  setTimeout(function () { if (app) app.style.setProperty('--b', '0s'); }, 2200);
}

/* ---- screens ---- */
function go(k) {
  all('.pane').forEach(function (p) { p.classList.remove('on'); });
  $(k === 'u' ? '#pu' : k === 'l' ? '#pl' : '#pw').classList.add('on');
  $('#bt').textContent = k === 'u' ? 'Join the comrades' : 'Welcome back!';
  $('#bs').textContent = k === 'u' ? 'Create your account to get started.' : 'Log in to continue.';
  gLoad(false);
  app.className = 'app ' + (k === 'w' ? 'w' : 'a' + (k === 'u' ? ' su' : ''));
  if (k !== 'w') mountG();
}
var gi = 0, GL = ['Show me around', 'Next', 'Get started'];
function gset(i) {
  gi = Math.max(0, Math.min(2, i));
  $('#gk').style.transform = 'translateX(' + (-gi * 100) + '%)';
  all('.gsl').forEach(function (s, k) { s.classList.toggle('on', k === gi); });
  all('#gd b').forEach(function (d, k) { d.classList.toggle('on', k === gi); });
  $('#gn').textContent = GL[gi];
}
function sweep(cb) {
  var cv = $('#cover'), fast = matchMedia('(prefers-reduced-motion:reduce)').matches, dur = fast ? 10 : 800, done = false, ez = 'cubic-bezier(.55,0,.2,1)';
  function end() { if (done) return; done = true; setTimeout(function () { cb && cb(); }, 60); }
  cv.style.display = 'block';
  if (cv.animate) {
    var a = cv.animate([{ transform: 'translate3d(0,-100%,0)' }, { transform: 'translate3d(0,0,0)' }], { duration: dur, easing: ez, fill: 'forwards' });
    a.onfinish = end; setTimeout(end, dur + 400);
  } else {
    cv.style.transition = 'transform ' + dur + 'ms ' + ez; cv.style.transform = 'translate3d(0,-100%,0)'; void cv.offsetWidth;
    cv.style.transform = 'translate3d(0,0,0)'; setTimeout(end, dur + 60);
  }
}
function mountG() {
  if (gDone) return; var n = 0;
  (function tryIt() {
    if (!host) return;
    if (!window.ccGoogle) { if (n++ < 20) setTimeout(tryIt, 250); else hideG(); return; }
    gDone = true;
    if (!ccGoogle.on()) return hideG();
    all('.gbx').forEach(function (b) {
      try {
        var nat = !!(window.ccApp && ccApp.native), hit = b;
        if (!nat) { b.innerHTML = '<div class="gb-vis" aria-hidden="true">' + GSVG + '<span>Continue with Google</span><i class="gb-sp"></i></div><div class="gb-hit"></div>'; hit = b.querySelector('.gb-hit'); }
        var w = Math.max(200, Math.min(400, (app.clientWidth || 390) - 48));
        var r = ccGoogle.mount(hit, function () { sweep(function () { location.reload(); }); },
          function (t) { gLoad(false); var e = $('.pane.on .err'); if (e) e.textContent = t || 'Google sign-in failed. Try again.'; },
          { theme: 'outline', type: 'standard', shape: 'pill', size: 'large', text: 'continue_with', width: w, banner: true, busy: gLoad });
        if (r && r.then) r.then(function (ok) { if (ok === false) b.innerHTML = '<p class="gerr">Google sign-in could not load. Check your internet.</p>'; });
      } catch (e) {}
    });
  })();
}
var GSVG = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.9 2.3-8.5 2.3-6.3 0-11.6-4-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
function gLoad(on) { if (!app) return; app.classList.toggle('gl', !!on); all('.gbx').forEach(function (b) { b.classList.toggle('ld', !!on); }); }
function hideG() { all('[data-or],.socs').forEach(function (e) { e.style.display = 'none'; }); }

function wire() {
  var C = cfg(), lines = String(C.landing_captions || '').split('\n').map(function (l) { var p = l.split('|'); return [p[0].trim(), (p[1] || '').trim()]; }).filter(function (p) { return p[0]; });
  all('.gsl').forEach(function (s, k) { if (lines[k]) { s.querySelector('h2').textContent = lines[k][0]; if (lines[k][1]) s.querySelector('p').textContent = lines[k][1]; } });
  all('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.go); }); });
  all('[data-eye]').forEach(function (b) { b.onclick = function () { var i = root.getElementById(b.dataset.eye), h = i.type === 'password'; i.type = h ? 'text' : 'password'; b.classList.toggle('on', h); b.setAttribute('aria-label', h ? 'Hide password' : 'Show password'); }; });
  all('[data-skip]').forEach(function (b) { b.onclick = finish; });
  all('[data-t]').forEach(function (u) { u.onclick = function () { var p = u.dataset.t, site = window.ccOrigin ? window.ccOrigin() : (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'https://comradeconnect.co.ke' : location.origin), url = site + p; var fb = function () { try { window.open(url, '_blank', 'noopener'); } catch (e) { location.href = url; } }; if (window.ccApp && ccApp.open) ccApp.open(url).then(function (ok) { if (!ok) fb(); }, fb); else fb(); }; });
  all('[data-fg]').forEach(function (b) { b.onclick = function () { if (window.CC && CC.forgot) CC.forgot($('#le').value.trim()); }; });
  var wait = function (m) { m.textContent = 'The app is still starting. Try again in a second.'; };
  $('#pl').onsubmit = function (e) {
    e.preventDefault(); var m = $('#e1'), u = $('#le').value.trim(), p = $('#lp').value, b = this.querySelector('.btn');
    if (!u) return m.textContent = 'Enter your username.'; if (!p) return m.textContent = 'Enter your password.';
    if (!window.CC || !CC.restoreAccount) return wait(m); m.textContent = ''; b.classList.add('ld');
    CC.restoreAccount(u, p).then(function () { try { if (window.ccRemember) ccRemember(u, p); } catch (x) {} sweep(function () { location.reload(); }); },
      function (er) { b.classList.remove('ld'); m.textContent = (er && er.message) || 'That username or password is not right.'; });
  };
  (function fillRef(n) {                      // invite link ?ref=CODE fills the box by itself; typing a code saves it too (works for Google sign-up as well)
    var i = $('#sr'); if (!i) return;
    if (window.ccGetRef) { if (!i.value) i.value = ccGetRef() || ''; i.oninput = function () { i.value = i.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (window.ccSetRef) ccSetRef(i.value); }; }
    else if (n < 20) setTimeout(function () { fillRef(n + 1); }, 250);
  })(0);
  $('#pu').onsubmit = function (e) {
    e.preventDefault(); var m = $('#e2'), u = $('#se').value.trim(), p = $('#sp').value, b = this.querySelector('.btn');
    if (!/^[A-Za-z0-9_]{3,20}$/.test(u)) return m.textContent = 'Username: 3 to 20 letters, numbers or _';
    if (p.length < 8) return m.textContent = 'Use at least 8 characters.';
    if (p.toLowerCase() === u.toLowerCase()) return m.textContent = 'The password cannot be your username.';
    if (p !== $('#sc').value) return m.textContent = 'The passwords do not match.';
    if (window.ccSetRef && !ccSetRef(($('#sr') || {}).value)) return m.textContent = 'That invite code does not look right. Leave it empty to skip.';
    if (!window.CC || !CC.createAccount) return wait(m); m.textContent = ''; b.classList.add('ld');
    var r; try { r = CC.createAccount('password', { handle: u, password: p }); } catch (x) { b.classList.remove('ld'); return m.textContent = x.message || 'Could not create the account.'; }
    r.then(function () { sweep(finish); }, function (er) { b.classList.remove('ld'); m.textContent = (er && er.message) || 'Could not create the account. Try again.'; });
  };
  all('input').forEach(function (i, k) {
    i.addEventListener('focus', function () { app.classList.add('typ', 'q'); });
    i.addEventListener('blur', function () { setTimeout(function () { if (!root) return; var a = root.activeElement; if (!a || a.tagName !== 'INPUT') app.classList.remove('typ'); }, 120); });
    tw(i, k);
  });
  var gk = null;
  all('#gd b').forEach(function (d, k) { d.onclick = function () { gset(k); }; });
  $('#gn').onclick = function () { gi < 2 ? gset(gi + 1) : go('u'); };
  $('#gs .gl').src = $('.brand img').src;
  var gs = $('#gs'); gs.addEventListener('pointerdown', function (e) { gk = e.clientX; });
  gs.addEventListener('pointerup', function (e) { if (gk === null) return; var dx = e.clientX - gk; gk = null; if (Math.abs(dx) > 40) { swAt = Date.now(); gset(gi + (dx < 0 ? 1 : -1)); } });
  // tap the cards: next group of three (3 groups = 9 pictures), wrapping back to the first
  var swAt = 0;
  all('.gsl .art').forEach(function (a) { a.style.cursor = 'pointer'; a.addEventListener('click', function () { if (Date.now() - swAt < 400) return; gset(gi < 2 ? gi + 1 : 0); }); });
  gset(0);
}
/* typing hint inside the empty fields */
function tw(i, k) {
  var full = i.placeholder, n = 0, d = 1;
  function s() {
    if (!host || !i.isConnected) return; var t = 70;
    if (root.activeElement === i || i.value) { i.placeholder = full; n = full.length; d = -1; return setTimeout(s, 500); }
    n += d; i.placeholder = full.slice(0, n) + '|';
    if (d > 0 && n >= full.length) { i.placeholder = full; d = -1; t = 2200; } else if (d < 0 && n <= 0) { d = 1; t = 450; } else if (d < 0) t = 35;
    setTimeout(s, t);
  }
  setTimeout(s, 3500 + k * 600);
}

/* ---- the doors ---- */
function welcome() { wantW = true; if (!host) build('w'); else if (!spl) toWelcome(); }      // while the splash plays it only remembers; the splash end opens the cards
function openAuth(mode) {
  var k = mode === 'create' || mode === 'u' ? 'u' : 'l';
  if (!host) return build('a', k);
  clearTimeout(tm); spl = false; if (/\bs\b/.test(app.className)) { app.className = 'app w'; app.style.setProperty('--b', '0s'); }
  go(k);
}
window.ccGate = { welcome: welcome, open: openAuth, close: finish };
window.ccAuthPanel = openAuth;

/* the splash plays once per visit (reloads skip it, like the old loading screen) */
var ran = ss('cc_ran'); ss('cc_ran', '1');
if (!ran) build('s');
})();
