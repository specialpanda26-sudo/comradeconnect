/* Kura: Campus Star Awards. A button on the home screen opens a full screen with three tabs:
   Compete (live races, prizes, leaders), Leaderboard (podium, filters, ranked list) and Enter competition (apply form).
   Tap a contestant for their page, then Vote now for the M-Pesa vote sheet. Layout follows the KuraStar site, in this app's black and white style.
   Uses window.CC from cc-core.js (call, needSignup, payNow, putFile). */
(function () {
'use strict';
var CCx = function () { return window.CC; };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var kes = function (n) { return 'KES ' + Number(n).toLocaleString('en-KE'); };
var nf = function (n) { n = Number(n) || 0; return n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(n); };
var $ = function (id) { return document.getElementById(id); };
var toast = function (t) { try { if (window.toast) window.toast(t); } catch (e) {} };
function call(path, body) { var c = CCx(); if (!c) return Promise.reject(new Error('Still loading. Try again in a moment.')); return c.call(path, body ? { body: body } : { auth: false }); }
function callAuth(path) { return CCx().call(path, {}); }

var S = { home: null, tab: 'compete', f: { campus: '', gender: '', division: '', q: '' }, board: null, busy: false, cur: null, pack: 0, tick: 0 };
var season = function () { return (S.home && S.home.season) || {}; };
var divName = function (d) { return d.name || d.label || d.id; };

var I = {
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>',
  starO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.6 2.6L16 9.5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-2h6l2 2h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 11l7.6-4M8.2 13l7.6 4"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>',
  crown: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9 2h6"/></svg>'
};

var css = document.createElement('style');
css.textContent = '#tpill.kt:not([hidden]){display:flex;margin-top:14px;padding:8px 16px;font-size:11px;opacity:.8}'
  + '.kgo{background:var(--ink)!important;color:var(--inkfg)!important;border:0!important}'
  + '.kdot{width:8px;height:8px;border-radius:50%;background:#f5c542;animation:kp 1.6s ease-out infinite}@keyframes kp{0%{box-shadow:0 0 0 0 rgba(245,197,66,.6)}100%{box-shadow:0 0 0 9px rgba(245,197,66,0)}}'
  + '#kura,.kpage{position:fixed;inset:0;background:var(--bg);color:var(--fg);overflow:auto;-webkit-overflow-scrolling:touch;font-family:Poppins,system-ui,sans-serif}#kura{z-index:8000}.kpage{z-index:8100}#kura[hidden],.kpage[hidden],.ksh[hidden]{display:none}'
  + '#kura svg,.kpage svg,.ksh svg{width:1em;height:1em;flex:none}'
  + '.kbar{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--bg) 88%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-bottom:1px solid var(--line);padding:calc(env(safe-area-inset-top,0px) + 10px) 14px 10px}'
  + '.kbr{display:flex;align-items:center;justify-content:space-between;gap:10px;max-width:760px;margin:auto}.kbrand{display:flex;align-items:center;gap:8px;font:700 17px Poppins,sans-serif}.kbrand svg{font-size:20px;color:#f5c542}'
  + '.kx{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--g);border:1px solid var(--gb);color:var(--fg);cursor:pointer;font-size:18px}'
  + '.kts{display:flex;gap:8px;max-width:760px;margin:10px auto 0;overflow-x:auto;scrollbar-width:none}.kts::-webkit-scrollbar{display:none}'
  + '.kts button{flex:none;padding:9px 16px;border-radius:999px;font:500 12.5px Poppins,sans-serif;color:var(--mut);background:var(--g);border:1px solid var(--gb);cursor:pointer}.kts button.on{background:var(--ink);color:var(--inkfg);border-color:var(--ink);font-weight:600}'
  + '.ktick{background:var(--g);border-bottom:1px solid var(--line);text-align:center;font-size:11px;padding:8px 12px;color:var(--mut)}.ktick b{color:var(--fg);letter-spacing:.04em;margin-right:6px}.ktick a{color:var(--fg);font-weight:600;margin-left:6px;text-decoration:underline;cursor:pointer}'
  + '.kw{max-width:760px;margin:auto;padding:16px 14px 90px}'
  + '.kcard{background:var(--g);border:1px solid var(--gb);border-radius:22px;box-shadow:var(--sh)}'
  + '.keb{display:flex;align-items:center;gap:6px;font:600 10.5px Poppins,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:var(--mut)}.keb svg{font-size:13px}'
  + '.kh1{font:700 34px/1.08 Poppins,sans-serif;letter-spacing:-.02em;margin:8px 0}.kh1 .ka{background:linear-gradient(90deg,#f5c542,#ff8a3d);-webkit-background-clip:text;background-clip:text;color:transparent}'
  + '.kh2{font:700 21px Poppins,sans-serif;margin:0}.kh3{display:flex;align-items:center;gap:8px;font:700 17px Poppins,sans-serif;margin:26px 0 12px}.kh3 svg{font-size:19px}'
  + '.ksub{color:var(--mut);font-size:13px;line-height:1.6}.kmsg{font-size:13px;margin-top:10px;min-height:18px}'
  + '.khero{position:relative;overflow:hidden;padding:22px 20px;margin-top:6px}.khero .wm{position:absolute;right:-50px;top:-24px;font-size:230px;opacity:.07;color:var(--fg);pointer-events:none}.khero>*{position:relative}'
  + '.krow{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;align-items:center}'
  + '.kb{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 20px;border-radius:999px;font:600 13px Poppins,sans-serif;background:var(--ink);color:var(--inkfg);border:1px solid var(--ink);cursor:pointer;flex:none}.kb.g{background:var(--g);color:var(--fg);border-color:var(--gb)}.kb.w{width:100%}.kb:disabled{opacity:.5}'
  + '.kcd{display:inline-block;margin-top:16px;padding:12px 14px;border-radius:18px;background:var(--g);border:1px solid var(--gb)}.kcd .keb{margin-bottom:8px}'
  + '.kcb{display:flex;gap:8px}.kcb div{width:60px;text-align:center;padding:9px 0 7px;border-radius:14px;background:var(--bg);border:1px solid var(--line)}.kcb b{display:block;font:700 22px Poppins,sans-serif;line-height:1.1}.kcb small{font-size:8.5px;letter-spacing:.1em;color:var(--mut)}'
  + '.kst{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.kst>div{padding:14px 6px;text-align:center}.kst b{display:block;font:700 22px Poppins,sans-serif}.kst small{font-size:11px;color:var(--mut)}'
  + '.kcl{padding:12px;margin-bottom:10px}.kcl .meta{font-size:10.5px;color:var(--mut)}.kvs{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:10px 0 8px}.kvs>div{display:flex;align-items:center;gap:8px;min-width:0;font:600 13px Poppins,sans-serif}.kvs small{display:block;font:400 11px Poppins,sans-serif;color:var(--mut)}.kvs>div:last-child{flex-direction:row-reverse;text-align:right}'
  + '.kbarx{height:7px;border-radius:9px;background:var(--line);overflow:hidden}.kbarx i{display:block;height:100%;background:var(--ink);border-radius:9px}.kapart{text-align:center;font-size:11.5px;color:var(--mut);margin:7px 0 9px}'
  + '.kpush{display:block;width:100%;padding:10px;border-radius:12px;border:1px solid var(--gb);background:var(--g);color:var(--fg);font:600 12px Poppins,sans-serif;cursor:pointer}'
  + '.klive{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none;margin:0 -14px;padding-left:14px;padding-right:14px}.klive::-webkit-scrollbar{display:none}.klive .kcl{flex:none;width:215px;margin:0}'
  + '.kpz{overflow:hidden;margin-top:18px}.kpza{position:relative;height:160px;background:radial-gradient(circle at 70% 30%,rgba(245,197,66,.45),transparent 55%),linear-gradient(135deg,#1b1b1b,#000);display:grid;place-items:center}.kpza svg{font-size:84px;color:#f5c542;filter:drop-shadow(0 6px 24px rgba(245,197,66,.5))}.kpza span{position:absolute;left:12px;top:12px;padding:5px 10px;border-radius:999px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.25);font:600 9.5px Poppins,sans-serif;letter-spacing:.08em;color:#fff}'
  + '.kpzb{padding:18px 16px}.kpzb .kh1{font-size:25px;margin:0 0 6px}.kpt{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}.kpt>div{padding:10px;border-radius:16px;background:var(--bg);border:1px solid var(--line)}.kpt svg{font-size:19px;display:block;margin-bottom:8px}.kpt b{display:block;font-size:12.5px}.kpt small{font-size:10px;color:var(--mut)}'
  + '.kpod{display:grid;grid-template-columns:1fr 1.08fr 1fr;gap:10px;align-items:end;margin-top:18px}.kpod .kt3{cursor:pointer;overflow:hidden;position:relative}.kpod .kt3:nth-child(2){margin-bottom:22px;border-color:#f5c542;box-shadow:0 0 0 1px rgba(245,197,66,.45),var(--sh)}'
  + '.kt3 .ph{position:relative;aspect-ratio:1/1.1;background:var(--g);overflow:hidden}.kt3 img{width:100%;height:100%;object-fit:cover;display:block}.kt3 .bd{position:absolute;left:8px;top:8px;padding:4px 9px;border-radius:999px;background:rgba(0,0,0,.6);color:#fff;font:600 10.5px Poppins,sans-serif;display:flex;gap:4px;align-items:center}.kt3:nth-child(2) .bd{background:#f5c542;color:#000}'
  + '.kt3 .in{padding:11px 11px 12px}.kt3 .cat{font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--mut)}.kt3 .nm{font:700 14px Poppins,sans-serif;margin:3px 0 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kt3 .un{font-size:10px;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kt3 .vt{display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:9px;border-top:1px solid var(--line)}.kt3 .vt b{font:700 19px Poppins,sans-serif}.kt3 .vt small{font-size:10px;color:var(--mut);margin-left:3px}'
  + '.kph{display:grid;place-items:center;width:100%;height:100%;background:var(--g);font:700 28px Poppins,sans-serif}'
  + '.kfl{padding:12px;margin-top:12px}.kfl select{width:100%;padding:11px 12px;border-radius:14px;border:1px solid var(--gb);background:var(--g);color:var(--fg);font:400 13px Poppins,sans-serif}.kdv{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.kdv button{display:flex;align-items:center;gap:9px;text-align:left;padding:10px 11px;border-radius:14px;border:1px solid var(--gb);background:var(--g);color:var(--fg);cursor:pointer;font:600 12px Poppins,sans-serif}.kdv button small{display:block;font:400 10px Poppins,sans-serif;color:var(--mut)}.kdv button.on{background:var(--ink);color:var(--inkfg)}.kdv button.on small{color:inherit;opacity:.7}.kdv svg{font-size:17px}'
  + '.kgn{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}.kgn button{padding:8px 16px;border-radius:999px;border:1px solid var(--gb);background:var(--g);color:var(--fg);font:500 12px Poppins,sans-serif;cursor:pointer}.kgn button.on{background:var(--ink);color:var(--inkfg);border-color:var(--ink)}'
  + '.ksr{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:14px;border:1px solid var(--gb);background:var(--g);min-width:170px;flex:1;max-width:260px}.ksr svg{font-size:16px;color:var(--mut)}.ksr input{all:unset;flex:1;min-width:0;font:400 13px Poppins,sans-serif;color:var(--fg)}'
  + '.klst{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}@media(max-width:520px){.klst{grid-template-columns:1fr}}@media(max-width:340px){.kpod{grid-template-columns:1fr}}'
  + '.kli{display:flex;align-items:center;gap:8px;padding:10px 9px;cursor:pointer;min-width:0}.kli .rk{font:700 20px Poppins,sans-serif;color:var(--mut);min-width:26px}.kli .av{width:42px;height:42px;border-radius:50%;overflow:hidden;flex:none;background:var(--g)}.kli .av img{width:100%;height:100%;object-fit:cover}.kli .av .kph{font-size:16px}.kli .m{flex:1;min-width:0}.kli .m b{display:flex;align-items:center;gap:4px;font:600 12.5px Poppins,sans-serif}.kli .m b span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kli .m b svg{font-size:13px;color:var(--mut)}.kli .m small{display:block;font-size:9.5px;color:var(--mut);line-height:1.35;margin-top:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.kli .v{text-align:right;flex:none;display:flex;align-items:center;gap:3px}.kli .v svg{font-size:13px;color:var(--mut)}.kli .v b{display:block;font:700 15px Poppins,sans-serif}.kli .v small{font-size:8.5px;color:var(--mut);letter-spacing:.06em}'
  + '.kpk{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:9px;margin-top:12px}.kpk>div{padding:13px 12px}.kpk b{display:block;font:700 20px Poppins,sans-serif}.kpk small{font-size:11px;color:var(--mut)}.kpk i{font-style:normal;display:block;font-size:10px;color:var(--mut);margin-top:4px}.kpk>div.pop{border-color:var(--fg)}'
  + '.kfoot{margin-top:34px;padding-top:14px;border-top:1px solid var(--line);font-size:11px;color:var(--mut);display:flex;justify-content:space-between;gap:8px}'
  + '.kpw{max-width:760px;margin:auto;padding:calc(env(safe-area-inset-top,0px) + 14px) 14px 90px}.kbk{display:inline-flex;align-items:center;gap:6px;color:var(--mut);font:500 12.5px Poppins,sans-serif;background:none;border:0;cursor:pointer;padding:6px 0}'
  + '.kpr{display:flex;gap:14px;margin-top:12px;align-items:flex-start}.kpr .pic{width:42%;max-width:250px;flex:none;aspect-ratio:3/4;border-radius:20px;overflow:hidden;background:var(--g);border:1px solid var(--gb)}.kpr .pic img{width:100%;height:100%;object-fit:cover}.kpr .pi{flex:1;min-width:0}.kpr h1{font:700 27px/1.1 Poppins,sans-serif;margin:6px 0;display:flex;align-items:center;gap:7px;overflow-wrap:anywhere}.kpr h1 svg{font-size:22px;color:var(--mut);flex:none}.kchip{display:inline-block;padding:5px 12px;border-radius:999px;border:1px solid var(--gb);background:var(--g);font:500 11px Poppins,sans-serif;color:var(--fg);margin:6px 6px 0 0;text-decoration:none}'
  + '.kns{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0;padding:14px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.kns b{display:block;font:700 22px Poppins,sans-serif}.kns small{font-size:10.5px;color:var(--mut)}'
  + '.kban{padding:11px 14px;border-radius:14px;border:1px solid rgba(245,197,66,.6);background:rgba(245,197,66,.12);font-size:12.5px;display:flex;gap:8px;align-items:center}.kban svg{color:#f5c542;font-size:16px}'
  + '.kbtns{display:flex;gap:8px;margin-top:12px}.kbtns .kb:first-child{flex:1}.kbtns .kb.g{padding:12px 14px}.kfine{text-align:center;font-size:11px;color:var(--mut);margin-top:8px}'
  + '.ksp{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 14px;border-radius:999px;border:1px solid var(--line);background:var(--g);margin-bottom:7px;font-size:13px}.ksp.mvp{border-color:rgba(245,197,66,.6);background:rgba(245,197,66,.12)}.ksp em{font-style:normal;font:700 9px Poppins,sans-serif;padding:2px 6px;border-radius:5px;background:#f5c542;color:#000;margin-left:6px}.ksp span:last-child{font-weight:600;font-size:12.5px}'
  + '.ksq{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);font-size:13px}.ksq b{font-weight:600}'
  + '.ksh{position:fixed;inset:0;z-index:8600;background:rgba(0,0,0,.7);display:flex;align-items:flex-end;justify-content:center}.ksh>div{width:100%;max-width:520px;max-height:94vh;overflow:auto;background:var(--bg);color:var(--fg);border:1px solid var(--gb);border-radius:26px 26px 0 0;padding:10px 18px calc(18px + env(safe-area-inset-bottom,0px));font-family:Poppins,sans-serif}.ksh .gr{width:46px;height:5px;border-radius:9px;background:var(--gb);margin:2px auto 14px}'
  + '.kvh{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.kvh h3{margin:0;font:700 21px Poppins,sans-serif}.kmini{display:flex;align-items:center;gap:11px;padding:12px 0;border-bottom:1px solid var(--line);margin-bottom:14px}.kmini .av{width:44px;height:44px;border-radius:50%;overflow:hidden;background:var(--g);flex:none}.kmini .av img{width:100%;height:100%;object-fit:cover}.kmini b{display:block;font-size:14px}.kmini small{font-size:11.5px;color:var(--mut)}'
  + '.kvg{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:10px}.kvg button{position:relative;text-align:left;padding:13px 13px 11px;border-radius:16px;border:1.5px solid var(--gb);background:var(--g);color:var(--fg);cursor:pointer;font-family:Poppins,sans-serif}.kvg button b{font:700 22px Poppins,sans-serif}.kvg button b small{font:400 11px Poppins,sans-serif;color:var(--mut);margin-left:4px}.kvg button span{display:block;font-size:13px;margin-top:6px}.kvg button i{display:block;font-style:normal;font-size:10.5px;color:var(--mut);margin-top:3px}.kvg button em{position:absolute;right:10px;top:8px;font:700 8.5px Poppins,sans-serif;letter-spacing:.08em;color:var(--mut);font-style:normal}.kvg button.on{border-color:var(--fg);background:color-mix(in srgb,var(--fg) 12%,transparent)}.kvg button.full{grid-column:1/-1}'
  + '.klb{display:block;font:600 13px Poppins,sans-serif;margin:16px 0 0}.kinp{width:100%;box-sizing:border-box;margin-top:8px;padding:12px 14px;border-radius:14px;border:1px solid var(--gb);background:var(--g);color:var(--fg);font:400 14px Poppins,sans-serif}'
  + '.kbo{display:flex;gap:8px;align-items:center;width:100%;margin-top:12px;padding:11px 12px;border-radius:14px;border:1px solid rgba(245,197,66,.6);background:rgba(245,197,66,.1);color:var(--fg);font:500 12.5px Poppins,sans-serif;cursor:pointer;text-align:left}.kbo svg{color:#f5c542;font-size:16px}'
  + '.ksec{display:flex;align-items:center;justify-content:center;gap:6px;font-size:11px;color:var(--mut);margin-top:11px}'
  + '.kfm h3{font:700 19px Poppins,sans-serif;margin:26px 0 4px;padding-bottom:10px;border-bottom:1px solid var(--line)}.kfm label{display:block;font:500 12.5px Poppins,sans-serif;margin:14px 0 0}.kfm label small{color:var(--mut);font-weight:400}.kfm .kinp{margin-top:6px}.kfm textarea.kinp{min-height:84px;resize:vertical}.k2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.k2 label{font-size:10.5px;color:var(--mut);margin:0}.k2 .kinp{margin-top:3px}'
  + '.kpu{display:flex;align-items:center;gap:12px;padding:12px;border-radius:18px;background:var(--g);border:1px solid var(--gb);cursor:pointer;margin-top:12px}.kpu .ic{width:50px;height:50px;border-radius:14px;background:var(--bg);display:grid;place-items:center;font-size:22px;overflow:hidden;flex:none}.kpu .ic img{width:100%;height:100%;object-fit:cover}.kpu b{display:block;font-size:13.5px}.kpu small{font-size:11px;color:var(--mut)}'
  + '.kgd{display:flex;gap:8px;margin-top:6px}.kgd button{flex:1;padding:11px;border-radius:12px;border:1px solid var(--gb);background:var(--g);color:var(--fg);font:500 13px Poppins,sans-serif;cursor:pointer}.kgd button.on{background:var(--ink);color:var(--inkfg);border-color:var(--ink)}'
  + '.kck{padding:14px;margin-top:14px}.kck h4{display:flex;align-items:center;gap:8px;margin:0 0 4px;font:700 15px Poppins,sans-serif}.kck .r{display:flex;gap:8px;margin-top:10px}.kck .r .kinp{margin:0;flex:1;min-width:0}'
  + '.kmy{padding:12px;margin-top:10px;display:flex;gap:10px;align-items:center}.kmy .m{flex:1;min-width:0}.kmy b{display:block;font-size:13.5px}.kmy small{display:block;font-size:11.5px;color:var(--mut)}';
document.head.appendChild(css);

/* ---------- home screen button ---------- */
function hero() {
  var tp = $('tpill'), host = tp && tp.parentNode;
  if (!host || $('kuraGo')) return;
  var b = document.createElement('button'); b.id = 'kuraGo'; b.className = 'btn kgo'; b.innerHTML = '<span class="kdot"></span>Kura: Campus Star Awards';
  var first = host.querySelector('[data-open]') || host.firstElementChild; first.insertAdjacentElement('afterend', b);
  var sub = document.createElement('div'); sub.id = 'kuraSub'; sub.className = 'sub'; sub.style.cssText = 'margin-top:12px;font-size:12px'; sub.textContent = 'Vote for your campus star with M-Pesa, or enter the contest.';
  host.insertBefore(sub, tp); tp.classList.add('kt');
  b.addEventListener('click', function () { openKura('compete'); });
}
function daysLeft(iso) { if (!iso) return ''; var d = Math.ceil((Date.parse(iso) - Date.now()) / 864e5); return d > 0 ? ' · closes in ' + d + ' day' + (d > 1 ? 's' : '') : ' · voting closed'; }
function loadHome() {
  return call('/api/kura/home').then(function (d) {
    S.home = d; var st = d.stats || {}, sub = $('kuraSub');
    if (sub && st.contestants) sub.textContent = st.contestants + ' contestants · ' + (st.votes || 0) + ' votes' + daysLeft(d.season && d.season.ends_at);
  }).catch(function () {});
}

/* ---------- shell: header, tabs, page ---------- */
function shell() {
  var o = $('kura'); if (o) return o;
  o = document.createElement('div'); o.id = 'kura'; o.hidden = true;
  o.innerHTML = '<div class="kbar"><div class="kbr"><div class="kbrand">' + I.star + 'Kura</div><button class="kx" data-k="close" aria-label="Close">' + I.x + '</button></div>'
    + '<div class="kts" id="ktabs"></div></div><div id="ktick"></div><div class="kw" id="kbody"></div>';
  document.body.appendChild(o); o.addEventListener('click', onClick); o.addEventListener('change', onChange); o.addEventListener('input', onInput);
  return o;
}
function openKura(tab) {
  var o = shell(); o.hidden = false; if (tab) S.tab = tab; o.scrollTop = 0;
  try { if (location.hash !== '#kura') history.replaceState(null, '', '#kura'); } catch (e) {}
  paint(); loadHome().then(paint);
}
function closeKura() { shell().hidden = true; closePage(); closeSheet(); clearInterval(S.tick); try { if (location.hash === '#kura') history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
function go(t) { S.tab = t; closePage(); $('kura').scrollTop = 0; paint(); }

function paint() {
  var s = season(), t = S.tab;
  $('ktabs').innerHTML = [['compete', 'Compete'], ['board', 'Leaderboard'], ['apply', 'Enter competition']].map(function (x) { return '<button data-k="tab" data-t="' + x[0] + '" class="' + (t === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('');
  $('ktick').innerHTML = s.prize_title ? '<div class="ktick"><b>' + (s.voting_open === false ? 'VOTING CLOSED' : 'NOW LIVE') + '</b>' + esc(s.prize_title) + (s.entries_open === false ? '' : '<a data-k="tab" data-t="apply">Enter free</a>') + '</div>' : '';
  clearInterval(S.tick);
  if (t === 'board') paintBoard(); else if (t === 'apply') paintApply(); else paintCompete();
}

/* ---------- home screen button ---------- */
function hero() {
  var tp = $('tpill'), host = tp && tp.parentNode;
  if (!host || $('kuraGo')) return;
  var b = document.createElement('button'); b.id = 'kuraGo'; b.className = 'btn kgo'; b.innerHTML = '<span class="kdot"></span>Kura: Campus Star Awards';
  var first = host.querySelector('[data-open]') || host.firstElementChild; first.insertAdjacentElement('afterend', b);
  var sub = document.createElement('div'); sub.id = 'kuraSub'; sub.className = 'sub'; sub.style.cssText = 'margin-top:12px;font-size:12px'; sub.textContent = 'Vote for your campus star with M-Pesa, or enter the contest.';
  host.insertBefore(sub, tp); tp.classList.add('kt');
  b.addEventListener('click', function () { openKura('compete'); });
}
function daysLeft(iso) { if (!iso) return ''; var d = Math.ceil((Date.parse(iso) - Date.now()) / 864e5); return d > 0 ? ' · closes in ' + d + ' day' + (d > 1 ? 's' : '') : ' · voting closed'; }
function loadHome() {
  return call('/api/kura/home').then(function (d) {
    S.home = d; var st = d.stats || {}, sub = $('kuraSub');
    if (sub && st.contestants) sub.textContent = st.contestants + ' contestants · ' + (st.votes || 0) + ' votes' + daysLeft(d.season && d.season.ends_at);
  }).catch(function () {});
}

/* ---------- shell: header, tabs, page ---------- */
function shell() {
  var o = $('kura'); if (o) return o;
  o = document.createElement('div'); o.id = 'kura'; o.hidden = true;
  o.innerHTML = '<div class="kbar"><div class="kbr"><div class="kbrand">' + I.star + 'Kura</div><button class="kx" data-k="close" aria-label="Close">' + I.x + '</button></div>'
    + '<div class="kts" id="ktabs"></div></div><div id="ktick"></div><div class="kw" id="kbody"></div>';
  document.body.appendChild(o); o.addEventListener('click', onClick); o.addEventListener('change', onChange); o.addEventListener('input', onInput);
  return o;
}
function openKura(tab) {
  var o = shell(); o.hidden = false; if (tab) S.tab = tab; o.scrollTop = 0;
  try { if (location.hash !== '#kura') history.replaceState(null, '', '#kura'); } catch (e) {}
  paint(); loadHome().then(paint);
}
function closeKura() { shell().hidden = true; closePage(); closeSheet(); clearInterval(S.tick); try { if (location.hash === '#kura') history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
function go(t) { S.tab = t; closePage(); $('kura').scrollTop = 0; paint(); }

function paint() {
  var s = season(), t = S.tab;
  $('ktabs').innerHTML = [['compete', 'Compete'], ['board', 'Leaderboard'], ['apply', 'Enter competition']].map(function (x) { return '<button data-k="tab" data-t="' + x[0] + '" class="' + (t === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('');
  $('ktick').innerHTML = s.prize_title ? '<div class="ktick"><b>' + (s.voting_open === false ? 'VOTING CLOSED' : 'NOW LIVE') + '</b>' + esc(s.prize_title) + (s.entries_open === false ? '' : '<a data-k="tab" data-t="apply">Enter free</a>') + '</div>' : '';
  clearInterval(S.tick);
  if (t === 'board') paintBoard(); else if (t === 'apply') paintApply(); else paintCompete();
}

/* ---------- shared pieces ---------- */
function photo(c) { return c && c.photo ? '<img src="' + esc(c.photo) + '" alt="" loading="lazy">' : '<span class="kph">' + esc(((c && c.name) || '?').charAt(0).toUpperCase()) + '</span>'; }
function accent(t) { var w = String(t || '').trim().split(/\s+/); if (w.length < 2) return esc(t); return esc(w.slice(0, -1).join(' ')) + ' <span class="ka">' + esc(w[w.length - 1]) + '</span>'; }
function prizeHtml(t) { return esc(t).replace(/(iPhone\s?\d+\w*|KES\s?[\d,]+|KSh\s?[\d,]+)/g, '<span class="ka">$1</span>'); }
function cdTarget() {
  var s = season(), n = Date.now();
  if (s.starts_at && Date.parse(s.starts_at) > n) return { t: s.starts_at, l: 'Competition starts in' };
  if (s.ends_at && Date.parse(s.ends_at) > n) return { t: s.ends_at, l: 'Voting closes in' };
  return null;
}
function countdown() {
  var c = cdTarget(); if (!c) return '';
  return '<div class="kcd"><div class="keb">' + I.clock + ' ' + c.l + '</div><div class="kcb"><div><b data-cd="d">0</b><small>DAYS</small></div><div><b data-cd="h">0</b><small>HRS</small></div><div><b data-cd="m">0</b><small>MIN</small></div><div><b data-cd="s">0</b><small>SEC</small></div></div></div>';
}
function startTick() {
  clearInterval(S.tick); var s = season(); if (!cdTarget() && !s.reveal_at) return;
  var run = function () {
    var c = cdTarget(), ms = Math.max(0, c ? Date.parse(c.t) - Date.now() : 0), v = { d: Math.floor(ms / 864e5), h: Math.floor(ms / 36e5) % 24, m: Math.floor(ms / 6e4) % 60, s: Math.floor(ms / 1e3) % 60 };
    ['d', 'h', 'm', 's'].forEach(function (k) { var els = document.querySelectorAll('[data-cd="' + k + '"]'); for (var i = 0; i < els.length; i++) els[i].textContent = k === 'd' ? v[k] : ('0' + v[k]).slice(-2); });
    var rv = document.querySelectorAll('[data-rv]');
    if (rv.length && s.reveal_at) { var r = Math.max(0, Date.parse(s.reveal_at) - Date.now()); for (var j = 0; j < rv.length; j++) rv[j].textContent = 'Reveals in ' + Math.floor(r / 864e5) + 'd ' + Math.floor(r / 36e5) % 24 + 'h ' + Math.floor(r / 6e4) % 60 + 'm ' + Math.floor(r / 1e3) % 60 + 's'; if (!r && !S.rvd) { S.rvd = 1; loadHome().then(paint); } }
  };
  run(); S.tick = setInterval(run, 1000);
}
function meta(r) { return esc(r.category) + ' · ' + esc(r.gender === 'female' ? 'Female' : 'Male') + ' · ' + esc(r.campus); }
function raceCard(r, live) {
  var a = r.lead, b = r.chaser, tot = (a.votes || 0) + (b.votes || 0), pct = tot ? Math.round(a.votes / tot * 100) : 50, apart = Math.max(0, a.votes - b.votes);
  return '<div class="kcard kcl"><div class="meta">' + meta(r) + (live ? ' · ' + r.size + ' in the race' : '') + '</div>'
    + '<div class="kvs"><div><span class="av kav">' + '</span><span>' + esc(a.name) + '<small>' + a.votes + ' votes</small></span></div><div><span>' + esc(b.name) + '<small>' + b.votes + ' votes</small></span></div></div>'
    + '<div class="kbarx"><i style="width:' + pct + '%"></i></div>'
    + (live ? '' : '<div class="kapart">Only ' + apart + ' vote' + (apart === 1 ? '' : 's') + ' apart</div>')
    + '<button class="kpush" data-k="open" data-id="' + esc(b.id) + '" style="' + (live ? 'margin-top:9px' : '') + '">' + (live ? esc(b.name) + ' · ' + r.gap + ' to lead' : 'Push ' + esc(b.name) + ' into 1st') + '</button></div>';
}
function topCard(c, i) {
  return '<div class="kcard kt3" data-k="open" data-id="' + esc(c.id) + '"><div class="ph">' + photo(c) + '<span class="bd">' + (i === 0 ? I.crown : '') + '#' + (i + 1) + '</span></div><div class="in"><div class="cat">' + esc(c.category) + '</div><div class="nm">' + esc(c.name) + '</div><div class="un">' + esc(c.campus) + '</div><div class="vt"><span><b>' + nf(c.votes) + '</b><small>votes</small></span>' + I.arrow + '</div></div></div>';
}
function packsStrip() {
  var p = season().packs || []; if (!p.length) return '';
  var unit = p[0] && p[0].votes ? Math.round(p[0].price / p[0].votes) : 10;
  return '<div class="kh3">' + I.heart + 'A little love goes a long way <span class="ksub" style="margin-left:auto;font-weight:400;font-size:11px">1 vote = ' + kes(unit) + '</span></div><div class="kpk">'
    + p.map(function (k) { return '<div class="kcard' + (k.popular ? ' pop' : '') + '"><b>' + k.votes + '</b><small>vote' + (k.votes > 1 ? 's' : '') + '</small><div style="font-weight:600;font-size:13px;margin-top:6px">' + kes(k.price) + '</div>' + (k.bonus ? '<i>+' + k.bonus + ' bonus included</i>' : '') + (k.popular ? '<i>Most popular</i>' : '') + '</div>'; }).join('') + '</div>';
}
function prizeArt() {
  var s = season();
  if (s.prize_image) return '<div class="kpa"><img alt="Prize" src="' + esc(s.prize_image) + '"></div>';
  if (s.prize_mystery) return '<div class="kpa kpq"><b>?</b><span>MYSTERY PRIZE</span>' + (s.reveal_at && Date.parse(s.reveal_at) > Date.now() ? '<small data-rv>Revealing soon</small>' : '') + '</div>';
  return '';
}
function prizeCard(compact) {
  var s = season(); if (!s.prize_title) return '';
  return '<div class="kcard kpz">' + prizeArt() + '<div class="kpza"><span>GRAND PRIZE · EVERY CATEGORY</span>' + I.trophy + '</div><div class="kpzb"><div class="kh1">' + prizeHtml(s.prize_title) + '</div>' + (s.prize_text ? '<p class="ksub" style="margin:0">' + esc(s.prize_text) + '</p>' : '')
    + (s.prizes && s.prizes.length ? '<div class="kpt">' + s.prizes.map(function (p) { return '<div>' + I.trophy + '<b>' + esc(p.label) + '</b><small>' + esc(p.sub || '') + '</small></div>'; }).join('') + '</div>' : '')
    + (compact || s.entries_open === false ? '' : '<div class="krow"><button class="kb" data-k="tab" data-t="apply">Enter free now ' + I.arrow + '</button><span class="ksub" style="font-size:11px">Free to enter · Open to every campus</span></div>') + '</div></div>';
}

/* ---------- tab 1: Compete ---------- */
function paintCompete() {
  var s = season(), h = S.home || {}, st = h.stats || {}, b = $('kbody');
  var live = s.voting_open !== false;
  b.innerHTML = '<div class="kcard khero"><span class="wm">' + I.starO + '</span><div class="keb">' + (live ? 'SEASON 1 · VOTING LIVE' : 'VOTING CLOSED') + '</div><div class="kh1">' + accent(s.title || 'Campus Star Awards') + '</div><p class="ksub" style="margin:0">' + esc(s.tagline || 'Back your favourite contestant or enter your own category.') + '</p>'
    + '<div class="krow"><button class="kb" data-k="tab" data-t="board">Vote now ' + I.arrow + '</button>' + (s.entries_open === false ? '' : '<button class="kb g" data-k="tab" data-t="apply">Enter the competition</button>') + '</div>'
    + '<p class="ksub" style="margin:14px 0 0;display:flex;align-items:center;gap:6px">' + I.heart + '<b style="color:var(--fg)">' + nf(st.votes || 0) + '</b> votes cast</p>' + countdown() + '</div>'
    + '<div class="kst"><div class="kcard"><b>' + (st.contestants || 0) + '</b><small>Contestants</small></div><div class="kcard"><b>' + (st.campuses || 0) + '</b><small>Campuses</small></div><div class="kcard"><b>' + nf(st.votes || 0) + '</b><small>Votes cast</small></div></div>'
    + (h.closest && h.closest.length ? '<div class="kh3"><span style="width:8px;height:8px;border-radius:50%;background:#e5484d"></span>Closest races right now</div>' + h.closest.map(function (r) { return raceCard(r, false); }).join('') : '')
    + (h.live && h.live.length ? '<div class="kh3">' + I.grid + 'Every race, live <span class="ksub" style="margin-left:auto;font-weight:400;font-size:11px">Swipe →</span></div><div class="klive">' + h.live.map(function (r) { return raceCard(r, true); }).join('') + '</div>' : '')
    + prizeCard(false)
    + (h.top && h.top.length ? '<div class="kh3">' + I.trophy + 'Leading the race<a class="ksub" data-k="tab" data-t="board" style="margin-left:auto;font-weight:600;font-size:12px;color:var(--fg);cursor:pointer">Full rankings ' + I.arrow + '</a></div><div class="klst" style="grid-template-columns:repeat(3,1fr);margin-top:0">' + h.top.map(topCard).join('') + '</div>' : (S.home ? '<p class="ksub" style="margin-top:20px">No contestants are live yet. Be the first to enter.</p>' : '<p class="ksub" style="margin-top:20px">Loading...</p>'))
    + packsStrip() + '<div class="kfoot"><span>Kura · Campus Star Awards</span><span>Votes are paid with M-Pesa</span></div>';
  // the little avatars in the race cards
  var avs = b.querySelectorAll('.kav'), list = []; ((h.closest || []).concat([])).forEach(function (r) { list.push(r.lead); }); ((h.live || [])).forEach(function (r) { list.push(r.lead); });
  Array.prototype.forEach.call(avs, function (el, i) { var c = list[i]; if (!c) return; el.style.cssText = 'width:34px;height:34px;border-radius:50%;overflow:hidden;flex:none;display:block;background:var(--g)'; el.innerHTML = photo(c); var im = el.querySelector('img'); if (im) im.style.cssText = 'width:100%;height:100%;object-fit:cover'; });
  startTick();
}

/* ---------- tab 2: Leaderboard ---------- */
function paintBoard() {
  var s = season(), f = S.f, st = (S.home && S.home.stats) || {}, camps = s.campuses || [], divs = s.divisions || [];
  var cc = S.board ? S.board.counts || {} : {};
  $('kbody').innerHTML = '<div class="keb">' + I.trophy + ' The people\'s leaderboard</div><div class="kh1" style="margin-bottom:4px">Campus Star <span class="ka">rankings</span></div>'
    + '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px"><p class="ksub" style="margin:0">Every vote counts. Rankings update the moment fans vote.</p><div style="text-align:right;flex:none"><b style="font:700 26px Poppins,sans-serif;display:block;line-height:1">' + nf(st.votes || 0) + '</b><small class="ksub" style="font-size:10.5px">Fan votes · Live</small></div></div>'
    + countdown() + '<div id="kpod"></div>'
    + '<p class="ksub" style="margin:18px 0 0;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:12px">Pick a campus, category and male or female to see each title race. Choose "All campuses" for the inter-campus battle.</p>'
    + '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:16px"><div><div class="keb">' + I.trophy + ' Competition</div><div class="kh2" style="margin-top:4px">' + esc(f.campus || 'All campuses') + '</div><div class="ksub" id="kcnt" style="font-size:12px">' + (S.board ? S.board.total + ' contestants' : 'Loading...') + '</div></div>'
    + '<label class="ksr">' + I.search + '<input id="kq" placeholder="Search a contestant..." value="' + esc(f.q) + '" maxlength="40" autocomplete="off"></label></div>'
    + '<div class="kcard kfl"><select id="kcamp" aria-label="Campus">' + '<option value="">All campuses</option>' + camps.map(function (c) { return '<option' + (c === f.campus ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>'
    + '<div class="kdv"><button data-k="div" data-d="" class="' + (!f.division ? 'on' : '') + '">' + I.grid + '<span>All divisions<small>' + (cc.all == null ? '' : cc.all + ' contestants') + '</small></span></button>'
    + divs.map(function (d) { return '<button data-k="div" data-d="' + esc(d.id) + '" class="' + (f.division === d.id ? 'on' : '') + '">' + I.star + '<span>' + esc(divName(d)) + '<small>' + (cc[d.id] || 0) + ' contestants</small></span></button>'; }).join('') + '</div>'
    + '<div class="kgn">' + [['', 'Male & Female'], ['female', 'Female'], ['male', 'Male']].map(function (x) { return '<button data-k="gen" data-g="' + x[0] + '" class="' + (f.gender === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div></div>'
    + '<div id="klist" class="klst"><p class="ksub">Loading...</p></div>' + packsStrip() + '<div class="kfoot"><span>Kura · Campus Star Awards</span><span>1 vote from KES 10</span></div>';
  startTick(); loadBoard();
}
function loadBoard() {
  var f = S.f, q = '?campus=' + encodeURIComponent(f.campus) + '&division=' + encodeURIComponent(f.division) + '&gender=' + encodeURIComponent(f.gender) + '&q=' + encodeURIComponent(f.q);
  call('/api/kura/board' + q).then(function (d) {
    if (S.tab !== 'board') return; S.board = d; var l = $('klist'); if (!l) return;
    var c = $('kcnt'); if (c) c.textContent = d.total + ' contestant' + (d.total === 1 ? '' : 's');
    var pod = $('kpod'); if (pod) pod.innerHTML = d.items.length >= 3 && !f.q ? '<div class="kpod">' + [1, 0, 2].map(function (i) { return topCard(d.items[i], i); }).join('') + '</div>' : '';
    l.innerHTML = d.items.length ? d.items.map(listItem).join('') : '<p class="ksub" style="grid-column:1/-1;margin-top:6px">No contestants here yet. Be the first: tap Enter competition.</p>';
    var counts = d.counts || {}; Array.prototype.forEach.call(document.querySelectorAll('.kdv button'), function (b) { var sm = b.querySelector('small'), k = b.dataset.d; if (sm) sm.textContent = (k ? counts[k] || 0 : counts.all || 0) + ' contestants'; });
  }).catch(function (e) { var l = $('klist'); if (l) l.innerHTML = '<p class="ksub">' + esc(e.message) + '</p>'; });
}
function listItem(c) {
  var r = c.rank < 10 ? '0' + c.rank : c.rank;
  return '<div class="kcard kli" data-k="open" data-id="' + esc(c.id) + '"><span class="rk">' + r + '</span><span class="av">' + photo(c) + '</span><span class="m"><b><span>' + esc(c.name) + '</span>' + (c.verified ? I.check : '') + '</b><small>' + esc(c.category) + ' · ' + esc(c.gender === 'female' ? 'Female' : 'Male') + ' · ' + esc(c.campus) + '</small></span><span class="v">' + I.chev + '<span><b>' + nf(c.votes) + '</b><small>VOTES</small></span></span></div>';
}

/* ---------- tab 2: Leaderboard ---------- */
function paintBoard() {
  var s = season(), f = S.f, st = (S.home && S.home.stats) || {}, camps = s.campuses || [], divs = s.divisions || [];
  var cc = S.board ? S.board.counts || {} : {};
  $('kbody').innerHTML = '<div class="keb">' + I.trophy + ' The people\'s leaderboard</div><div class="kh1" style="margin-bottom:4px">Campus Star <span class="ka">rankings</span></div>'
    + '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px"><p class="ksub" style="margin:0">Every vote counts. Rankings update the moment fans vote.</p><div style="text-align:right;flex:none"><b style="font:700 26px Poppins,sans-serif;display:block;line-height:1">' + nf(st.votes || 0) + '</b><small class="ksub" style="font-size:10.5px">Fan votes · Live</small></div></div>'
    + countdown() + '<div id="kpod"></div>'
    + '<p class="ksub" style="margin:18px 0 0;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:12px">Pick a campus, category and male or female to see each title race. Choose "All campuses" for the inter-campus battle.</p>'
    + '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:16px"><div><div class="keb">' + I.trophy + ' Competition</div><div class="kh2" style="margin-top:4px">' + esc(f.campus || 'All campuses') + '</div><div class="ksub" id="kcnt" style="font-size:12px">' + (S.board ? S.board.total + ' contestants' : 'Loading...') + '</div></div>'
    + '<label class="ksr">' + I.search + '<input id="kq" placeholder="Search a contestant..." value="' + esc(f.q) + '" maxlength="40" autocomplete="off"></label></div>'
    + '<div class="kcard kfl"><select id="kcamp" aria-label="Campus">' + '<option value="">All campuses</option>' + camps.map(function (c) { return '<option' + (c === f.campus ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>'
    + '<div class="kdv"><button data-k="div" data-d="" class="' + (!f.division ? 'on' : '') + '">' + I.grid + '<span>All divisions<small>' + (cc.all == null ? '' : cc.all + ' contestants') + '</small></span></button>'
    + divs.map(function (d) { return '<button data-k="div" data-d="' + esc(d.id) + '" class="' + (f.division === d.id ? 'on' : '') + '">' + I.star + '<span>' + esc(divName(d)) + '<small>' + (cc[d.id] || 0) + ' contestants</small></span></button>'; }).join('') + '</div>'
    + '<div class="kgn">' + [['', 'Male & Female'], ['female', 'Female'], ['male', 'Male']].map(function (x) { return '<button data-k="gen" data-g="' + x[0] + '" class="' + (f.gender === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div></div>'
    + '<div id="klist" class="klst"><p class="ksub">Loading...</p></div>' + packsStrip() + '<div class="kfoot"><span>Kura · Campus Star Awards</span><span>1 vote from KES 10</span></div>';
  startTick(); loadBoard();
}
function loadBoard() {
  var f = S.f, q = '?campus=' + encodeURIComponent(f.campus) + '&division=' + encodeURIComponent(f.division) + '&gender=' + encodeURIComponent(f.gender) + '&q=' + encodeURIComponent(f.q);
  call('/api/kura/board' + q).then(function (d) {
    if (S.tab !== 'board') return; S.board = d; var l = $('klist'); if (!l) return;
    var c = $('kcnt'); if (c) c.textContent = d.total + ' contestant' + (d.total === 1 ? '' : 's');
    var pod = $('kpod'); if (pod) pod.innerHTML = d.items.length >= 3 && !f.q ? '<div class="kpod">' + [1, 0, 2].map(function (i) { return topCard(d.items[i], i); }).join('') + '</div>' : '';
    l.innerHTML = d.items.length ? d.items.map(listItem).join('') : '<p class="ksub" style="grid-column:1/-1;margin-top:6px">No contestants here yet. Be the first: tap Enter competition.</p>';
    var counts = d.counts || {}; Array.prototype.forEach.call(document.querySelectorAll('.kdv button'), function (b) { var sm = b.querySelector('small'), k = b.dataset.d; if (sm) sm.textContent = (k ? counts[k] || 0 : counts.all || 0) + ' contestants'; });
  }).catch(function (e) { var l = $('klist'); if (l) l.innerHTML = '<p class="ksub">' + esc(e.message) + '</p>'; });
}
function listItem(c) {
  var r = c.rank < 10 ? '0' + c.rank : c.rank;
  return '<div class="kcard kli" data-k="open" data-id="' + esc(c.id) + '"><span class="rk">' + r + '</span><span class="av">' + photo(c) + '</span><span class="m"><b><span>' + esc(c.name) + '</span>' + (c.verified ? I.check : '') + '</b><small>' + esc(c.category) + ' · ' + esc(c.gender === 'female' ? 'Female' : 'Male') + ' · ' + esc(c.campus) + '</small></span><span class="v">' + I.chev + '<span><b>' + nf(c.votes) + '</b><small>VOTES</small></span></span></div>';
}

/* ---------- contestant page ---------- */
function page() { var p = $('kprof'); if (!p) { p = document.createElement('div'); p.id = 'kprof'; p.className = 'kpage'; p.hidden = true; document.body.appendChild(p); p.addEventListener('click', onClick); } return p; }
function closePage() { var p = $('kprof'); if (p) p.hidden = true; }
function openProfile(id) {
  var p = page(); p.hidden = false; p.scrollTop = 0; p.innerHTML = '<div class="kpw"><button class="kbk" data-k="pclose">' + I.back + ' All creators</button><p class="ksub">Loading...</p></div>';
  call('/api/kura/c/' + id).then(function (d) { drawProfile(p, d); }).catch(function (e) { p.innerHTML = '<div class="kpw"><button class="kbk" data-k="pclose">' + I.back + ' All creators</button><p class="ksub">' + esc(e.message) + '</p></div>'; });
}
var MEDAL = ['&#129351;', '&#129352;', '&#129353;'];
function drawProfile(p, d) {
  var c = d.contestant, s = season(), packs = s.packs || [], open = s.voting_open !== false; S.cur = { id: c.id, name: c.name, photo: c.photo, category: c.category, rank: d.rank, d: d };
  var soc = Object.keys(c.socials || {}).map(function (k) { var x = c.socials[k]; return '<a class="kchip" href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">' + esc(k.charAt(0).toUpperCase() + k.slice(1)) + '</a>'; }).join('');
  var min = packs.length ? Math.min.apply(null, packs.map(function (k) { return Number(k.price); })) : 0;
  p.innerHTML = '<div class="kpw" data-id="' + esc(c.id) + '"><button class="kbk" data-k="pclose">' + I.back + ' All creators</button>'
    + '<div class="kpr"><div class="pic">' + photo(c) + '</div><div class="pi"><div class="keb" style="flex-wrap:wrap;font-size:9.5px">' + esc(c.category) + ' · ' + esc(c.gender === 'female' ? 'Female' : 'Male') + ' · ' + esc(c.campus) + '</div>'
    + '<h1>' + esc(c.name) + (c.verified ? I.check : '') + '</h1><p class="ksub" style="margin:0">' + esc(c.tagline || 'Ready for your support.') + '</p>' + (c.bio ? '<p class="ksub" style="margin:8px 0 0;font-size:12px">' + esc(c.bio) + '</p>' : '') + (soc ? '<div>' + soc + '</div>' : '') + '</div></div>'
    + '<div class="kns"><div><b>' + Number(c.votes).toLocaleString('en-KE') + '</b><small>Fan votes</small></div><div><b>' + (c.followers || 0) + '</b><small>Followers</small></div><div><b>#' + d.rank + '</b><small>Overall ranking</small></div></div>'
    + '<div class="kban">' + I.crown + '<span>' + (d.rank === 1 ? '#1 on Kura &mdash; fans, keep the crown!' : (d.gap + ' more vote' + (d.gap === 1 ? '' : 's') + ' to pass ' + esc(d.above) + ' for #' + (d.rank - 1))) + '</span></div>'
    + '<div class="kbtns"><button class="kb" data-k="vote"' + (open && packs.length ? '' : ' disabled') + '>' + I.heart + (open ? ' Vote now' : ' Voting closed') + '</button><button class="kb g" data-k="follow">' + I.user + ' ' + (d.following ? 'Following' : 'Follow') + '</button><button class="kb g" data-k="share" aria-label="Share">' + I.share + '</button></div>'
    + (open && min ? '<div class="kfine">From ' + kes(min) + ' · Quick &amp; secure</div>' : '')
    + (d.supporters && d.supporters.length ? '<div class="kh3">Top supporters</div>' + d.supporters.map(function (u, i) { return '<div class="ksp' + (i === 0 ? ' mvp' : '') + '"><span>' + (i < 3 ? MEDAL[i] + ' ' : (i + 1) + '. ') + esc(u.name) + (i === 0 ? '<em>MVP</em>' : '') + '</span><span>' + u.votes + ' votes</span></div>'; }).join('') + '<p class="ksub" style="font-size:11px;margin:4px 0 0">Add your name when voting to claim the MVP spot.</p>' : '')
    + (d.squad && d.squad.length ? '<div class="kh3">The support squad<span style="margin-left:auto;color:var(--mut)">' + I.heart + '</span></div>' + d.squad.map(function (u) { return '<div class="ksq"><span>' + esc(u.name) + '</span><b>+' + u.votes + ' votes</b></div>'; }).join('') : '')
    + '<div class="kfoot"><span>Kura · Campus Star Awards</span></div></div>';
}
function refreshProfile(id) { loadHome().then(function () { var p = $('kprof'); if (p && !p.hidden) call('/api/kura/c/' + id).then(function (d) { drawProfile(p, d); }).catch(function () {}); if (S.tab === 'board') loadBoard(); else if (S.tab === 'compete') paintCompete(); }); }

/* ---------- vote sheet ---------- */
function closeSheet() { var h = $('kvote'); if (h) h.hidden = true; }
function openSheet() {
  var s = season(), packs = s.packs || [], cur = S.cur; if (!cur || !packs.length) return;
  var pop = packs.findIndex(function (k) { return k.popular; }); S.pack = pop >= 0 ? pop : 0;
  var h = $('kvote'); if (!h) { h = document.createElement('div'); h.id = 'kvote'; h.className = 'ksh'; document.body.appendChild(h); h.addEventListener('click', onClick); h.addEventListener('input', function (e) { if (e.target.id === 'ksn') S.supporter = e.target.value; }); }
  S.supporter = ''; h.hidden = false;
  h.innerHTML = '<div><div class="gr"></div><div class="kvh"><div><h3>Big love for ' + esc(cur.name) + '</h3><p class="ksub" style="margin:4px 0 0">Pay from your phone in seconds.</p></div><button class="kx" data-k="sclose" aria-label="Close">' + I.x + '</button></div>'
    + '<div class="kmini"><span class="av">' + photo(cur) + '</span><span><b>' + esc(cur.name) + '</b><small>' + esc(cur.category) + '</small></span></div><b style="font-size:13px">Choose your votes</b><div class="kvg" id="kvg"></div>'
    + '<label class="klb" for="ksn">Supporter name <span class="ksub" style="font-weight:400">(optional, shown publicly)</span></label><input class="kinp" id="ksn" maxlength="24" placeholder="Your name" autocomplete="off"><div id="kbo"></div>'
    + '<button class="kb w" id="kgoV" data-k="send" style="margin-top:14px;padding:15px"></button><div class="ksec">' + I.check + ' Secure payment. You enter your M-Pesa PIN only on your phone.</div></div>';
  paintPacks();
}
function paintPacks() {
  var packs = season().packs || [], cur = packs[S.pack] || packs[0]; if (!cur) return;
  $('kvg').innerHTML = packs.map(function (k, i) { var last = i === packs.length - 1 && packs.length % 2 === 1;
    return '<button data-k="pack" data-p="' + i + '" class="' + (i === S.pack ? 'on' : '') + (last ? ' full' : '') + '">' + (k.popular ? '<em>POPULAR</em>' : '') + '<b>' + k.votes + '<small>vote' + (k.votes > 1 ? 's' : '') + '</small></b><span>' + kes(k.price) + '</span>' + (k.bonus ? '<i>+' + k.bonus + ' bonus included</i>' : '') + '</button>'; }).join('');
  var pi = packs.findIndex(function (k) { return k.popular; }), pop = pi >= 0 ? packs[pi] : null;
  $('kbo').innerHTML = pop && pi !== S.pack && pop.votes > cur.votes ? '<button class="kbo" data-k="pack" data-p="' + pi + '">' + I.crown + 'Keep ' + esc(S.cur.name) + ' on top with +' + (pop.votes - cur.votes) + ' votes</button>' : '';
  $('kgoV').innerHTML = I.heart + ' Send ' + cur.votes + ' vote' + (cur.votes > 1 ? 's' : '') + ' · ' + kes(cur.price);
}
function send() {
  var packs = season().packs || [], pk = packs[S.pack], id = S.cur && S.cur.id; if (!pk || !id) return;
  var nm = ($('ksn') && $('ksn').value || '').trim(), c = CCx();
  c.needSignup('vote').then(function (ok) {
    if (!ok) return; closeSheet();
    c.payNow({ title: 'Vote for ' + S.cur.name, unit: pk.price, note: pk.votes + ' votes', done: 'Your votes are counted.', kind: 'kura',
      start: function (phone) { return call('/api/kura/vote', { contestant_id: id, pack: S.pack, phone: phone, name: nm }); },
      after: function () { return new Promise(function (r) { refreshProfile(id); r(); }); } });
  });
}
function follow(id) {
  CCx().needSignup('follow').then(function (ok) { if (!ok) return; return call('/api/kura/follow', { contestant_id: id }).then(function () { refreshProfile(id); }); }).catch(function (e) { toast(e.message); });
}
function share() {
  var c = S.cur; if (!c) return; var url = location.origin + location.pathname + '#kura', text = 'Vote for ' + c.name + ' on Kura: Campus Star Awards';
  if (navigator.share) navigator.share({ title: 'Kura', text: text, url: url }).catch(function () {});
  else if (navigator.clipboard) navigator.clipboard.writeText(text + ' ' + url).then(function () { toast('Link copied'); }, function () {});
}

/* ---------- tab 3: Enter competition ---------- */
function opts(list, cur, all) { return '<option value="">' + all + '</option>' + list.map(function (x) { var v = typeof x === 'string' ? x : x.id, n = typeof x === 'string' ? x : divName(x); return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join(''); }
function paintApply() {
  var s = season(), b = $('kbody'); S.gender = S.gender || '';
  var head = '<div style="text-align:center"><span class="kchip" style="margin:0">' + I.star + ' ' + esc(s.title || 'Campus Star Awards') + ' · ' + (s.entries_open === false ? 'Entries closed' : 'Entries open') + '</span><div class="kh1" style="margin:12px 0 4px">Enter the competition</div><p class="ksub" style="margin:0">Open to every campus. Win your campus, then take on the best across Kenya.</p><p style="margin:10px 0 0"><a data-k="scroll" style="font-size:13px;font-weight:600;text-decoration:underline;cursor:pointer;color:var(--fg)">Already applied? Check your status</a></p></div>';
  var check = '<div class="kcard kck" id="kcheck"><h4>' + I.search + ' Check my application</h4><p class="ksub" style="margin:0;font-size:12px">Use the email and mobile number you applied with.</p><div class="r"><input class="kinp" id="kc_email" type="email" placeholder="Email" autocapitalize="off"><input class="kinp" id="kc_phone" inputmode="numeric" maxlength="10" placeholder="07XX XXX XXX"><button class="kb" data-k="status" style="padding:10px 16px">Check</button></div><p class="kmsg" id="kcm"></p><div class="krow" style="margin-top:6px"><button class="kb g" data-k="mine">My entries</button></div><div id="kmine"></div></div>';
  if (s.entries_open === false) { b.innerHTML = head + prizeCard(true) + check + '<p class="ksub" style="margin-top:18px;text-align:center">Entries are closed for this season.</p>'; return; }
  b.innerHTML = head + '<div style="margin-top:16px">' + prizeCard(true) + '</div>' + check
    + '<div class="kfm"><h3>1. Your profile</h3><div class="kpu" data-k="pick"><span class="ic" id="kpic">' + I.cam + '</span><span><b>Profile photo <span style="color:#e5484d">*</span></b><small id="kpsm">Required — tap to upload a clear photo of you</small></span></div><input id="ka_photo" type="file" accept="image/*" hidden>'
    + '<label>Stage / creator name<input class="kinp" id="ka_name" maxlength="40" placeholder="Your stage name"></label>'
    + '<h3>2. Your competition</h3><label>Campus<select class="kinp" id="ka_campus">' + opts(s.campuses || [], '', 'Choose your campus') + '</select></label>'
    + '<label>Competing as</label><div class="kgd"><button type="button" data-k="gd" data-g="female" class="' + (S.gender === 'female' ? 'on' : '') + '">Female</button><button type="button" data-k="gd" data-g="male" class="' + (S.gender === 'male' ? 'on' : '') + '">Male</button></div>'
    + '<label>Division<select class="kinp" id="ka_div">' + opts(s.divisions || [], '', 'Choose a division') + '</select></label><label>Category<select class="kinp" id="ka_cat"><option value="">Choose a category</option></select></label>'
    + '<h3>3. About you &amp; contact</h3><label>Your social pages <small>(optional)</small></label><div class="k2">'
    + [['ig', 'Instagram'], ['tt', 'TikTok'], ['yt', 'YouTube'], ['x', 'X (Twitter)'], ['fb', 'Facebook'], ['sc', 'Snapchat']].map(function (x) { return '<label>' + x[1] + '<input class="kinp" id="ka_' + x[0] + '" maxlength="40" placeholder="@username" autocapitalize="off"></label>'; }).join('') + '</div>'
    + '<label>Tagline <small>(optional)</small><input class="kinp" id="ka_tag" maxlength="80" placeholder="One line about you"></label><label>Bio <small>(optional)</small><textarea class="kinp" id="ka_bio" maxlength="300" placeholder="What do you do? Dance, comedy, music..."></textarea></label>'
    + '<label>Phone number <small>(for payouts)</small><input class="kinp" id="ka_phone" inputmode="numeric" maxlength="10" placeholder="0712 345 678"></label><label>Email<input class="kinp" id="ka_email" type="email" maxlength="200" placeholder="you@example.com" autocapitalize="off"></label>'
    + '<p class="ksub" style="font-size:11px;margin:6px 0 0">Do not put phone numbers or links in your name or bio. Add your pages in the social fields.</p><p class="kmsg" id="kam"></p>'
    + '<button class="kb w" id="ka_go" data-k="submit" style="padding:15px;margin-top:6px">Apply to join</button><p class="kfine">Free to join. We review every application before your page goes live.</p></div>';
}
function fillCats() {
  var d = (season().divisions || []).filter(function (x) { return x.id === $('ka_div').value; })[0];
  $('ka_cat').innerHTML = '<option value="">Choose a category</option>' + ((d && d.categories) || []).map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
}
function shrink(file) {
  return new Promise(function (res, rej) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () { var k = Math.min(1, 1200 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(function (b) { b ? res(b) : rej(new Error('That photo could not be read.')); }, 'image/jpeg', 0.85); };
    img.onerror = function () { rej(new Error('That photo could not be read. Pick a JPG or PNG.')); }; img.src = url;
  });
}
function submit() {
  if (S.busy) return; var m = $('kam'), v = function (i) { return ($(i).value || '').trim(); }, say = function (t) { m.textContent = t; };
  var f = $('ka_photo').files[0]; if (!v('ka_name') || !v('ka_campus') || !S.gender || !v('ka_div') || !v('ka_cat') || !v('ka_email') || !v('ka_phone')) return say('Fill in your name, campus, Female or Male, division, category, phone and email.');
  if (!f) return say('Add a clear photo of you.');
  CCx().needSignup('enter').then(function (ok) {
    if (!ok) return; S.busy = true; $('ka_go').disabled = true; say('Uploading your photo...');
    return shrink(f).then(function (blob) {
      return call('/api/kura/photo-url', { content_type: 'image/jpeg', bytes: blob.size }).then(function (u) {
        return CCx().putFile(u.upload_url, blob, 'image/jpeg').then(function (r) { if (!r.ok) throw new Error('The photo did not upload. Try again.'); say('Sending your entry...');
          var soc = {}; [['ig', 'instagram'], ['tt', 'tiktok'], ['yt', 'youtube'], ['x', 'x'], ['fb', 'facebook'], ['sc', 'snapchat']].forEach(function (p) { if (v('ka_' + p[0])) soc[p[1]] = v('ka_' + p[0]); });
          return call('/api/kura/apply', { name: v('ka_name'), tagline: v('ka_tag'), bio: v('ka_bio'), email: v('ka_email'), phone: v('ka_phone'), campus: v('ka_campus'), gender: S.gender, division: v('ka_div'), category: v('ka_cat'), photo_key: u.key, socials: soc }); });
      });
    }).then(function () { toast('Entry sent. We will review it soon.'); S.gender = ''; paintApply(); var mm = $('kcm'); if (mm) mm.textContent = 'Entry sent. Use Check to see its status.'; $('kura').scrollTop = 0; })
      .catch(function (e) { say(e.message); }).then(function () { S.busy = false; var g = $('ka_go'); if (g) g.disabled = false; });
  });
}
var STAT = { pending: 'Waiting for review', approved: 'Live', rejected: 'Not accepted', hidden: 'Hidden' };
function status() {
  var m = $('kcm'), em = ($('kc_email').value || '').trim(), ph = ($('kc_phone').value || '').replace(/\s/g, ''); m.textContent = 'Checking...';
  call('/api/kura/status', { email: em, phone: ph }).then(function (d) {
    if (!d.found) return (m.textContent = 'No application found for that email and number.');
    m.innerHTML = esc(d.name) + ': <b>' + esc(STAT[d.status] || d.status) + '</b>' + (d.note ? ' · ' + esc(d.note) : '') + (d.id ? ' <a data-k="open" data-id="' + esc(d.id) + '" style="text-decoration:underline;cursor:pointer">View my page</a>' : '');
  }).catch(function (e) { m.textContent = e.message; });
}
function mine() {
  var p = $('kmine'); p.innerHTML = '<p class="ksub">Loading...</p>';
  CCx().needSignup('see your entries').then(function (ok) {
    if (!ok) { p.innerHTML = '<p class="ksub">Sign up first, then tap My entries again.</p>'; return; }
    return callAuth('/api/kura/me').then(function (d) {
      var a = d.applications || [];
      p.innerHTML = a.length ? a.map(function (x) { return '<div class="kcard kmy"><span class="m"><b>' + esc(x.name) + '</b><small>' + esc(x.campus) + ' · ' + esc(x.category) + '</small><small>' + esc(STAT[x.status] || x.status) + (x.status === 'approved' ? ' · ' + (x.votes || 0) + ' votes' : '') + (x.status === 'rejected' && x.note ? ' · ' + esc(x.note) : '') + '</small></span>' + (x.status === 'approved' ? '<button class="kb" data-k="open" data-id="' + esc(x.id) + '">View</button>' : '') + '</div>'; }).join('') : '<p class="ksub">You have not entered yet.</p>';
    });
  }).catch(function (e) { p.innerHTML = '<p class="ksub">' + esc(e.message) + '</p>'; });
}

/* ---------- events ---------- */
function onClick(e) {
  var b = e.target.closest('[data-k]'); if (!b) return; var k = b.dataset.k, id = b.dataset.id;
  if (k === 'close') return closeKura();
  if (k === 'tab') { e.preventDefault(); return go(b.dataset.t); }
  if (k === 'open') { e.stopPropagation(); return openProfile(id); }
  if (k === 'pclose') return closePage();
  if (k === 'vote') return openSheet();
  if (k === 'sclose') return closeSheet();
  if (k === 'pack') { S.pack = +b.dataset.p; return paintPacks(); }
  if (k === 'send') return send();
  if (k === 'follow') return follow((S.cur || {}).id);
  if (k === 'share') return share();
  if (k === 'div') { S.f.division = b.dataset.d; return paintBoard(); }
  if (k === 'gen') { S.f.gender = b.dataset.g; return paintBoard(); }
  if (k === 'gd') { S.gender = b.dataset.g; Array.prototype.forEach.call(document.querySelectorAll('[data-k="gd"]'), function (x) { x.classList.toggle('on', x === b); }); return; }
  if (k === 'pick') return $('ka_photo').click();
  if (k === 'scroll') { var c = $('kcheck'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (k === 'status') return status();
  if (k === 'mine') return mine();
  if (k === 'submit') return submit();
}
function onChange(e) {
  var t = e.target.id;
  if (t === 'kcamp') { S.f.campus = e.target.value; paintBoard(); }
  else if (t === 'ka_div') fillCats();
  else if (t === 'ka_photo') {
    var f = e.target.files[0], ic = $('kpic'), sm = $('kpsm'); if (!f) return;
    if (sm) sm.textContent = f.name; if (ic) { var u = URL.createObjectURL(f); ic.innerHTML = '<img alt="" src="' + u + '">'; }
  }
}
var qt; function onInput(e) { if (e.target.id !== 'kq') return; S.f.q = e.target.value.trim(); clearTimeout(qt); qt = setTimeout(loadBoard, 300); }

function boot() { hero(); loadHome(); if (location.hash === '#kura') openKura('compete'); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
window.addEventListener('hashchange', function () { if (location.hash === '#kura') openKura(); });
})();
