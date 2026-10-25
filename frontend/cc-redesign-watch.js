/* cc-redesign-watch.js v1 (section 7): Watch like the redesign.
   Videos: record / upload buttons, 2-column clip cards with a gradient poster, play button, caption and like pill.
   Live: gradient LIVE cards with a Watch button, Go live card with an orange button, live room card.
   Styles only: all real video and live code (record, upload, likes, report, rooms, chat, hearts) is untouched. */
(function(){'use strict';
if(window.__crdWatch)return;window.__crdWatch=1;
var W='html body #v-videos',L='html body #v-live';
var BL=['radial-gradient(42% 52% at 24% 38%,#ff8a3d 0,transparent 72%),radial-gradient(44% 52% at 80% 60%,#c4727a 0,transparent 72%),radial-gradient(40% 40% at 45% 95%,#ffd9b8 0,transparent 72%)',
'radial-gradient(45% 50% at 20% 30%,#a9b8a2 0,transparent 72%),radial-gradient(45% 50% at 80% 75%,#c4727a 0,transparent 72%),radial-gradient(40% 40% at 70% 15%,#ffd9b8 0,transparent 72%)',
'radial-gradient(45% 55% at 25% 70%,#c4727a 0,transparent 72%),radial-gradient(50% 50% at 78% 35%,#ff8a3d 0,transparent 72%),radial-gradient(40% 40% at 50% 5%,#ffe7d2 0,transparent 72%)',
'radial-gradient(48% 50% at 75% 25%,#ffd9b8  0,transparent 72%),radial-gradient(48% 50% at 30% 80%,#ff8a3d 0,transparent 72%),radial-gradient(40% 40% at 90% 90%,#a9b8a2 0,transparent 72%)',
'radial-gradient(45% 55% at 20% 25%,#ff8a3d 0,transparent 72%),radial-gradient(45% 55% at 85% 80%,#a9b8a2 0,transparent 72%),radial-gradient(40% 40% at 60% 40%,#c4727a 0,transparent 72%)'];
var CSS=[
W+'>.sub,'+L+'>.sub{color:var(--mut);font-size:13px}',
W+' .fld{display:flex;align-items:center;background:var(--g);border-radius:999px;box-shadow:var(--sh);padding:0 20px;border:0}',
W+' .fld input{width:100%;height:52px;border:0!important;background:none!important;box-shadow:none!important;padding:0!important;font:600 14px Manrope,sans-serif;color:var(--fg)}',
W+' .two .btn.p,'+L+' .btn.p{background:var(--ink);color:var(--inkfg)}',
W+' #vl.vgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}',
W+' #vl>.sub{grid-column:1/3}',
W+' #vl .vcard{position:relative;display:flex;flex-direction:column;aspect-ratio:auto;padding:0!important;border-radius:28px;overflow:hidden;background:var(--g)!important;box-shadow:var(--sh);border:0}',
W+' #vl .vcard::after{display:none}',
W+' #vl .vcard>div:first-child{position:absolute;top:10px;left:10px;right:10px;z-index:2;display:flex;justify-content:space-between}',
W+' #vl .vcard>div:first-child .badge{background:rgba(255,255,255,.9);color:#16130f;font-size:10px;padding:4px 9px}',
W+' #vl .vcard>div:nth-child(2){margin:0!important;height:150px;flex:none}',
W+' #vl .vcard video,'+W+' #vl .vcard .poster{width:100%;height:150px;aspect-ratio:auto;max-height:none;border-radius:0;object-fit:cover;pointer-events:none}',
W+' #vl .vcard .poster{position:relative;font-size:0;background-color:#fff8f4;background-image:var(--crdp,none)}',
W+' #vl .vcard .poster::after{content:"";position:absolute;left:50%;top:50%;width:46px;height:46px;transform:translate(-50%,-50%);border:0;border-radius:50%;background:rgba(255,255,255,.92) url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Cpath d=%27M9 6.5v11l9-5.5z%27 fill=%27%2316130f%27/%3E%3C/svg%3E") center/26px no-repeat}',
W+' #vl .vcard>p{position:static;margin:10px 14px 0!important;color:var(--fg);text-shadow:none;font-size:13px!important;font-weight:800;line-height:1.3!important;-webkit-line-clamp:2}',
W+' #vl .vcard .bar{position:static;display:flex;gap:6px;margin:8px 14px 14px;pointer-events:auto;background:none;border:0;padding:0;box-shadow:none}',
W+' #vl .vcard .bar .act{height:32px;padding:0 12px;border-radius:999px;background:rgba(255,138,61,.13);color:var(--fg);font-size:12px;font-weight:800;border:0;display:inline-flex;align-items:center;gap:5px}',
W+' #vl .vcard .vlk{color:var(--fg);padding:0 12px;min-height:32px}',
W+' #vl .vcard .vlk.liked{background:var(--ink);color:var(--inkfg)}',
W+' #vl .vcard .vlk svg{width:14px;height:14px}',
W+' #vl .vcard .bar .wa{display:none}',
W+' #vl .vcard:nth-child(5n+1){--crdp:'+BL[0]+'}',W+' #vl .vcard:nth-child(5n+2){--crdp:'+BL[1]+'}',W+' #vl .vcard:nth-child(5n+3){--crdp:'+BL[2]+'}',W+' #vl .vcard:nth-child(5n+4){--crdp:'+BL[3]+'}',W+' #vl .vcard:nth-child(5n+5){--crdp:'+BL[4]+'}',
L+' #lvl.vgrid{display:grid;gap:14px}',
L+' #lvl article.box{position:relative;overflow:hidden;isolation:isolate;background:#fff8f4!important;border:0;border-radius:32px;padding:18px;color:#16130f;box-shadow:var(--sh)}',
L+' #lvl article.box::before{content:"";position:absolute;inset:-25%;z-index:-1;filter:blur(30px);opacity:.95;background:var(--crdp)}',
L+' #lvl article.box:nth-child(5n+1){--crdp:'+BL[1]+'}',L+' #lvl article.box:nth-child(5n+2){--crdp:'+BL[2]+'}',L+' #lvl article.box:nth-child(5n+3){--crdp:'+BL[3]+'}',L+' #lvl article.box:nth-child(5n+4){--crdp:'+BL[4]+'}',L+' #lvl article.box:nth-child(5n+5){--crdp:'+BL[0]+'}',
L+' #lvl h3{font-size:19px;font-weight:800;letter-spacing:-.02em;color:#16130f}',
L+' #lvl .lvst,'+L+' #lvl .lvs{color:#16130f;font-weight:700;font-size:12px}',
L+' .live-b{display:inline-block;background:#d9334a;color:#fff;font-weight:800;font-size:11px;letter-spacing:.1em;padding:4px 10px;border-radius:999px}',
L+' #lvl .btn.p{background:#16130f;color:#fff;height:46px}',
L+' #lvset,'+L+' #room{border-radius:28px;padding:18px;background:var(--g);box-shadow:var(--sh);border:0}',
L+' #lvset .fld{background:rgba(22,19,15,.05);border-radius:999px;padding:0 18px;border:0;box-shadow:none;margin-top:10px}',
L+' #lvset .fld input{width:100%;height:50px;border:0!important;background:none!important;box-shadow:none!important;font:600 14px Manrope,sans-serif;color:var(--fg);padding:0}',
L+' #golive,'+L+' #ccl-go{background:linear-gradient(135deg,#ffa05a,#ee7a4f)!important;color:#1d0f06!important;box-shadow:0 10px 24px rgba(238,122,79,.35)}',
L+' #room .btn.g{background:var(--g);box-shadow:var(--sh)}',
L+' #room input,'+L+' #lf input{border-radius:999px;border:0;background:rgba(22,19,15,.05);padding:0 16px;height:46px;color:var(--fg);font:600 14px Manrope,sans-serif}'
].join('\n');
var st=document.createElement('style');st.id='cc-redesign-watch-css';st.textContent=CSS;document.head.appendChild(st);
})();
