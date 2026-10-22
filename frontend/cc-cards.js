/* cc-cards.js v2: photo cards in the TikTok photo-post style. The whole photo is shown (never cropped) on top of a blurred copy of itself,
   a dark fade sits at the bottom, and the title and price sit on a frosted strip over the photo. Market browse, club products and the hostel photo hero use it.
   The only script work is copying each photo's address into a CSS variable for the blurred backdrop; no markup is changed. */
(function () {
'use strict';
if (window.__ccCards) return; window.__ccCards = 1;
var s = document.createElement('style'); s.id = 'cc-cards-css';
s.textContent = [
'.mc{position:relative;isolation:isolate;background:linear-gradient(160deg,#272B3B,#101422)!important}',
'.mc::before,.hshero::before{content:"";position:absolute;inset:-24px;z-index:0;background:var(--ccimg,none) center/cover no-repeat;filter:blur(24px) saturate(140%);transform:scale(1.15);pointer-events:none}',
'.mc .mm{position:relative;z-index:1;width:100%;aspect-ratio:3/4;object-fit:contain;border-radius:0;background:transparent!important;animation:none}',
'.mc .mm.poster{aspect-ratio:3/4!important;background:transparent!important;color:#fff;align-content:start}',
'.mc::after{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(180deg,rgba(16,20,34,0) 45%,rgba(16,20,34,.8) 100%)}',
'.mc .mb{position:absolute;left:8px;right:8px;bottom:8px;z-index:3;padding:9px 11px;border-radius:14px;color:#fff;background:rgba(16,20,34,.4);-webkit-backdrop-filter:blur(10px) saturate(150%);backdrop-filter:blur(10px) saturate(150%);border:1px solid rgba(255,255,255,.16)}',
'.mc .mb b{color:#fff;font-size:13px;font-weight:600;line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}',
'.mc .mb em{display:block;color:#fff;font-style:normal;font-weight:700;font-size:14px;margin-top:2px}',
'.mc .mb small{display:block;color:rgba(255,255,255,.82);font-size:10.5px;line-height:1.3;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.mc .mb small.mtl{display:none!important}',
'.mc .mb .ccrt{color:#fff}'
,
'.hshero{position:relative;isolation:isolate;margin-top:12px;border-radius:16px;overflow:hidden;cursor:zoom-in;background:linear-gradient(160deg,#272B3B,#101422)}',
'.hshero img{position:relative;z-index:1;display:block;width:100%;aspect-ratio:4/3;object-fit:contain}',
'.hshero::after{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(180deg,rgba(16,20,34,0) 45%,rgba(16,20,34,.82) 100%)}',
'.hshl{position:absolute;left:10px;right:10px;bottom:10px;z-index:3;padding:9px 12px;border-radius:14px;color:#fff;background:rgba(16,20,34,.4);-webkit-backdrop-filter:blur(10px) saturate(150%);backdrop-filter:blur(10px) saturate(150%);border:1px solid rgba(255,255,255,.16)}',
'.hshl b{display:block;font-size:16px;font-weight:600;overflow-wrap:anywhere}',
'.hshl span{display:block;font-size:13px;font-weight:700;margin-top:2px}',
'.evc{overflow:hidden}',
'.evh{position:relative;margin:-2px -2px 0;padding:34px 14px 14px;border-radius:14px;color:#fff;background:linear-gradient(160deg,#A8DCE7,#272B3B 55%,#101422)}',
'.evh b{display:block;font-size:17px;font-weight:600;line-height:1.25;overflow-wrap:anywhere}',
'.evh .evd{position:absolute;top:10px;left:12px;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:600;background:rgba(16,20,34,.4);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.16)}'

].join('\n');
document.head.appendChild(s);

function url(img) { var u = img.currentSrc || img.getAttribute('src') || ''; return u ? 'url("' + u.replace(/["\\\n]/g, encodeURIComponent) + '")' : ''; }
function paint() {
  [].forEach.call(document.querySelectorAll('.mc img.mm, .hshero img'), function (img) {
    var box = img.closest('.mc, .hshero'), u = url(img);
    if (box && u && box.getAttribute('data-ccp') !== u) { box.style.setProperty('--ccimg', u); box.setAttribute('data-ccp', u); }
  });
}
var t = 0;
function soon() { if (t) return; t = requestAnimationFrame(function () { t = 0; paint(); }); }
new MutationObserver(soon).observe(document.body || document.documentElement, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', soon); soon();
})();
