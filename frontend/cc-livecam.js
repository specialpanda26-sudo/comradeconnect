/* cc-livecam.js v1: TikTok-style comments on Live.
   New comments rise over the bottom-left of the video, older ones are pushed up and fade away, so everyone can read the chat while watching.
   In full screen there is a comment box on the video too (the normal one sits below the video, which full screen hides).
   Loaded after cc-live.js. It only wraps addComment / openRoom / leaveRoom, it never changes what Live sends to the server. */
(function () {
  'use strict';
  if (window.__ccLiveCam) return; window.__ccLiveCam = 1;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var MAX = 7, LIFE = 10000, FADE = 700;            // bubbles on screen, how long each stays, fade-out time
  var warm = 0;                                     // the first seconds in a room load the chat history: do not replay it as floating bubbles
  var reduce = false; try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var css = document.createElement('style');
  css.textContent = [
    '#ccl-float{position:absolute;left:10px;bottom:12px;width:76%;max-width:340px;max-height:46%;display:flex;flex-direction:column;justify-content:flex-end;gap:6px;overflow:hidden;pointer-events:none;z-index:4;',
    '-webkit-mask-image:linear-gradient(to top,#000 62%,transparent);mask-image:linear-gradient(to top,#000 62%,transparent)}',
    '.cclf-b{display:flex;align-items:flex-start;gap:8px;align-self:flex-start;max-width:100%;padding:5px 12px 5px 5px;border-radius:18px;background:rgba(0,0,0,.42);color:#fff;font:500 13px/1.3 Poppins,Manrope,sans-serif;',
    'opacity:1;transition:opacity ' + FADE + 'ms ease;animation:cclf-in .32s cubic-bezier(.2,.8,.2,1);overflow-wrap:anywhere;text-shadow:0 1px 2px rgba(0,0,0,.35)}',
    '.cclf-b.out{opacity:0}',
    '.cclf-a{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font:700 12px Poppins,Manrope,sans-serif;color:#fff;text-shadow:none}',
    '.cclf-t{min-width:0}.cclf-n{display:block;font-weight:700;font-size:11.5px;opacity:.92}',
    '@keyframes cclf-in{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}',
    '@media(prefers-reduced-motion:reduce){.cclf-b{animation:none}}',
    '#rmedia.ccl-fs #ccl-float{bottom:calc(70px + env(safe-area-inset-bottom,0px));left:12px;width:78%}',
    '#ccl-mini #ccl-float,#ccl-mini #ccl-fin{display:none}',
    '#ccl-fin{display:none;position:absolute;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:7;gap:8px;align-items:center}',
    '#rmedia.ccl-fs #ccl-fin{display:flex}',
    '#ccl-fin input{flex:1;min-width:0;height:44px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.45);color:#fff;padding:0 16px;font:500 14px Poppins,Manrope,sans-serif;outline:none}',
    '#ccl-fin input::placeholder{color:rgba(255,255,255,.7)}',
    '#ccl-fin button{flex:none;width:44px;height:44px;border-radius:50%;border:0;background:#fff;color:#101422;display:grid;place-items:center;cursor:pointer;padding:0}',
    '#ccl-fin button svg{width:20px;height:20px}'
  ].join('');
  document.head.appendChild(css);

  var SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>';
  var hue = function (n) { var h = 0; n = String(n || ''); for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) % 360; return h; };

  function ensure() {
    var m = $('#rmedia'); if (!m) return null;
    var f = $('#ccl-float', m);
    if (!f) { f = document.createElement('div'); f.id = 'ccl-float'; f.setAttribute('aria-hidden', 'true'); m.appendChild(f); }   // aria-hidden: the normal chat list below stays the screen-reader version
    if (!$('#ccl-fin', m)) {
      var fm = document.createElement('form'); fm.id = 'ccl-fin'; fm.setAttribute('autocomplete', 'off');
      fm.innerHTML = '<input maxlength="140" placeholder="Add a comment..." aria-label="Add a comment"><button type="submit" aria-label="Send">' + SEND + '</button>';
      fm.onsubmit = function (e) {
        e.preventDefault();
        var i = fm.querySelector('input'), b = fm.querySelector('button'), t = i.value.trim();
        if (!t || typeof cur === 'undefined' || !cur || !window.CC) return;
        b.disabled = true;
        CC.call('/api/live/' + cur.id + '/comment', { body: { text: t } }).then(function (c) { i.value = ''; addComment(c); })
          .catch(function (er) { try { toast(er.message); } catch (x) {} }).then(function () { b.disabled = false; });
      };
      m.appendChild(fm);
    }
    return f;
  }

  function float(c) {
    if (document.hidden || !c || !c.text) return;
    var box = ensure(); if (!box) return;
    var b = document.createElement('div'); b.className = 'cclf-b';
    var a = document.createElement('span'); a.className = 'cclf-a'; a.textContent = String(c.name || '?').trim().charAt(0).toUpperCase() || '?';
    a.style.background = 'linear-gradient(135deg,hsl(' + hue(c.name) + ' 70% 55%),hsl(' + ((hue(c.name) + 40) % 360) + ' 70% 42%))';
    var t = document.createElement('span'); t.className = 'cclf-t';
    var n = document.createElement('span'); n.className = 'cclf-n'; n.textContent = c.name || 'Comrade';
    t.append(n, document.createTextNode(c.text));      // textContent only: a comment can never inject HTML
    b.append(a, t); box.appendChild(b);
    while (box.children.length > MAX) box.firstChild.remove();
    setTimeout(function () { b.classList.add('out'); setTimeout(function () { try { b.remove(); } catch (e) {} }, reduce ? 0 : FADE); }, LIFE);
  }

  /* every new comment that the Live room adds to its chat list also rises over the video */
  try {
    var _ac = addComment;
    addComment = function (c) {
      var fresh = !!(c && c.id && !seenC.has(c.id));
      var r = _ac.apply(this, arguments);
      if (fresh) {
        var age = c.at ? Date.now() - Date.parse(c.at) : 0;
        if (Date.now() > warm || (age > -60000 && age < 30000)) float(c);
      }
      return r;
    };
    var _or = openRoom;
    openRoom = function () { warm = Date.now() + 2500; var r = _or.apply(this, arguments); try { ensure(); } catch (e) {} return r; };
    var _lr = leaveRoom;
    leaveRoom = function () { try { var f = $('#ccl-float'); if (f) f.textContent = ''; var i = $('#ccl-fin input'); if (i) i.value = ''; } catch (e) {} return _lr.apply(this, arguments); };
  } catch (e) { try { console.warn('cc-livecam: could not hook the Live room', e); } catch (x) {} }
})();
