/* Site editor client: applies what the admin changed in admin.html > Site editor.
   Safe by design: values go in with textContent / setAttribute only, never as HTML. If the server is slow or down,
   the last saved copy is used, and if there is none the page shows its built-in words. */
(function () {
'use strict';
var KEY = 'cc_site_v1', API = (typeof CC_API !== 'undefined' ? CC_API : '').replace(/\/$/, '');
var SOC = [['social_whatsapp', 'WhatsApp'], ['social_instagram', 'Instagram'], ['social_tiktok', 'TikTok'], ['social_x', 'X'], ['social_youtube', 'YouTube'], ['social_telegram', 'Telegram'], ['social_facebook', 'Facebook'], ['social_website', 'Website']];
var C = {}, started = false;
function q(s, r) { return (r || document).querySelector(s); }
function https(u) { return /^https:\/\/[^\s<>"']+$/i.test(u || ''); }
function saved() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }

function styleTag() { var s = q('#cc-site-css'); if (!s) { s = document.createElement('style'); s.id = 'cc-site-css'; document.head.appendChild(s); } return s; }

function apply() {
  // words: elements marked data-cc="key"
  document.querySelectorAll('[data-cc]').forEach(function (el) {
    var k = el.getAttribute('data-cc');
    if (!/^[a-z][a-z0-9_]+$/.test(k) || /^(SELECT|OPTION|INPUT|TEXTAREA)$/.test(el.tagName)) return; // never rewrite form controls
    if (!el.hasAttribute('data-cc-orig')) el.setAttribute('data-cc-orig', el.textContent);
    el.textContent = C[k] ? C[k] : el.getAttribute('data-cc-orig');
  });
  // switches and extra styling
  var css = '';
  [['hide_videos', 'videos'], ['hide_live', 'live'], ['hide_market', 'market'], ['hide_rewards', 'rewards']].forEach(function (p) {
    if (C[p[0]]) css += '#tb button[data-v="' + p[1] + '"]{display:none!important}';
  });
  if (C.custom_css) css += C.custom_css;
  styleTag().textContent = css;
  // announcement banner
  var b = q('#cc-banner');
  var gone = ''; try { gone = localStorage.getItem('cc_banner_read') || ''; } catch (e) {}
  if (C.banner_on && C.banner_text && gone !== C.banner_text) {   // once read (closed), the same announcement never shows again
    if (!b) { b = document.createElement('div'); b.id = 'cc-banner'; b.setAttribute('role', 'status'); document.body.insertBefore(b, document.body.firstChild); }
    b.textContent = '';
    var t = document.createElement(https(C.banner_link) ? 'a' : 'span');
    t.textContent = C.banner_text;
    if (https(C.banner_link)) { t.href = C.banner_link; t.target = '_blank'; t.rel = 'noopener noreferrer'; }
    b.appendChild(t);
    var x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Close announcement'); x.textContent = '\u00d7';
    x.style.cssText = 'all:unset;cursor:pointer;margin-left:12px;font-size:18px;line-height:1;padding:0 4px;opacity:.8';
    x.onclick = function () { try { localStorage.setItem('cc_banner_read', C.banner_text); } catch (e) {} b.remove(); document.documentElement.classList.remove('cc-has-banner'); };
    b.appendChild(x);
    document.documentElement.classList.add('cc-has-banner');
  } else { if (b) b.remove(); document.documentElement.classList.remove('cc-has-banner'); }
  // "Get the app" card for people on the website (never inside the app, never in an installed web app)
  var ga = q('#cc-getapp-card'), gaGone = 0; try { gaGone = +localStorage.getItem('cc_getapp_card') || 0; } catch (e) {}
  var inApp = !!(window.ccApp && window.ccApp.native) || !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  var installed = false; try { installed = !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); } catch (e) {}
  if (C.getapp_on && !inApp && !installed && Date.now() - gaGone > 3 * 864e5) {
    if (!ga) {
      ga = document.createElement('div'); ga.id = 'cc-getapp-card'; ga.setAttribute('role', 'status');
      ga.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(78px + env(safe-area-inset-bottom,0px));z-index:900;display:flex;align-items:center;gap:10px;max-width:460px;margin:0 auto;padding:10px 10px 10px 14px;border-radius:18px;background:#101422;color:#fff;border:1px solid rgba(255,255,255,.25);box-shadow:0 8px 28px rgba(0,0,0,.35);font:600 13px Poppins,system-ui,sans-serif';
      var gt = document.createElement('span'); gt.style.cssText = 'flex:1;line-height:1.35'; ga.appendChild(gt);
      var gb = document.createElement('button'); gb.type = 'button'; gb.textContent = 'Get the app';
      gb.style.cssText = 'all:unset;cursor:pointer;padding:9px 14px;border-radius:999px;background:#fff;color:#101422;font:700 13px Poppins,system-ui,sans-serif';
      gb.onclick = function () { if (window.ccGetApp) window.ccGetApp(); };
      ga.appendChild(gb);
      var gx = document.createElement('button'); gx.type = 'button'; gx.setAttribute('aria-label', 'Close'); gx.textContent = '\u00d7';
      gx.style.cssText = 'all:unset;cursor:pointer;font-size:20px;line-height:1;padding:4px 8px;opacity:.8';
      gx.onclick = function () { try { localStorage.setItem('cc_getapp_card', String(Date.now())); } catch (e) {} ga.remove(); };
      ga.appendChild(gx);
      setTimeout(function () { if (!q('#cc-getapp-card')) document.body.appendChild(ga); }, 6000);
    }
    var gtx = ga.firstChild; if (gtx) gtx.textContent = C.getapp_text || 'Get the free app: faster, with phone alerts.';
  } else if (ga) ga.remove();
  // maintenance cover
  var m = q('#cc-maint');
  var bypass = !!(window.ccStaff && window.ccStaff.ok);   // a signed-in admin (checked with the server) sees the real site
  if (C.maintenance_on && !bypass) {
    if (!m) { m = document.createElement('div'); m.id = 'cc-maint'; m.setAttribute('role', 'alert'); m.innerHTML = '<div><h1></h1><p></p></div>'; document.body.appendChild(m); staffBox(m); }
    q('h1', m).textContent = 'Back soon';
    q('p', m).textContent = C.maintenance_text || 'We are fixing something. Please check again in a little while.';
  } else if (m) m.remove();
  links();
  try { document.dispatchEvent(new CustomEvent('cc-site', { detail: C })); } catch (e) {}
}

// "Staff sign in" on the maintenance cover: only an admin account gets past it
function staffBox(m) {
  var box = m.firstChild; if (!box || !window.ccStaff) return;
  var btn = document.createElement('button'); btn.type = 'button'; btn.id = 'cc-staff-btn'; btn.textContent = 'Staff sign in';
  var f = document.createElement('div'); f.id = 'cc-staff-f'; f.hidden = true;
  var u = document.createElement('input'); u.placeholder = 'Username'; u.autocomplete = 'username'; u.autocapitalize = 'off'; u.setAttribute('aria-label', 'Username');
  var p = document.createElement('input'); p.type = 'password'; p.placeholder = 'Password'; p.autocomplete = 'current-password'; p.setAttribute('aria-label', 'Password');
  var go = document.createElement('button'); go.type = 'button'; go.textContent = 'Sign in';
  var e = document.createElement('p'); e.id = 'cc-staff-e'; e.setAttribute('role', 'alert');
  f.append(u, p, go, e); box.append(btn, f);
  btn.onclick = function () { f.hidden = !f.hidden; if (!f.hidden) u.focus(); };
  function run() {
    e.textContent = ''; go.disabled = true; go.textContent = 'Checking...';
    window.ccStaff.signIn(u.value, p.value).then(function () { p.value = ''; }, function (x) { e.textContent = x && x.message ? x.message : 'Could not sign in.'; })
      .then(function () { go.disabled = false; go.textContent = 'Sign in'; });
  }
  go.onclick = run; p.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') run(); });
}

// links from the editor go on top of Me > Join our community
function links() {
  var box = q('#ccl'); if (!box) return;
  box.querySelectorAll('[data-cc-soc]').forEach(function (n) { n.remove(); });
  var frag = document.createDocumentFragment();
  SOC.forEach(function (s) {
    if (!https(C[s[0]])) return;
    var a = document.createElement('a'); a.className = 'rw'; a.setAttribute('data-cc-soc', '1'); a.href = C[s[0]]; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.style.cssText = 'text-decoration:none;color:inherit';
    var l = document.createElement('span'); l.textContent = s[1]; var b = document.createElement('b'); b.textContent = 'Join';
    a.appendChild(l); a.appendChild(b); frag.appendChild(a);
  });
  if (frag.childNodes.length) {
    box.insertBefore(frag, box.firstChild);
    var empty = box.querySelector(':scope > p.sub'); if (empty && /once the admin adds/.test(empty.textContent)) empty.remove();
  }
  var mail = q('[data-cc-mail]');
  if (C.contact_email && !mail) {
    var f = q('footer'); if (f) { var p = document.createElement('p'); p.setAttribute('data-cc-mail', '1'); p.style.cssText = 'margin-top:12px'; var a2 = document.createElement('a'); a2.href = 'mailto:' + C.contact_email; a2.textContent = C.contact_email; a2.style.color = 'inherit'; p.appendChild(a2); f.appendChild(p); }
  } else if (mail && !C.contact_email) mail.remove();
}

function boot() {
  C = saved(); apply();                                   // instant, from the last visit
  if (!API) return;
  fetch(API + '/api/site-content', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.content) return;
      C = d.content; try { localStorage.setItem(KEY, JSON.stringify(C)); } catch (e) {}
      apply();
    }).catch(function () {});
  // the Me page redraws itself, so re-add links when it does
  if (!started) { started = true; new MutationObserver(function () { if (q('#ccl') && !q('#ccl [data-cc-soc]') && Object.keys(C).some(function (k) { return k.indexOf('social_') === 0; })) links(); }).observe(document.body, { childList: true, subtree: true }); }
}
window.ccSiteApply = apply;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
