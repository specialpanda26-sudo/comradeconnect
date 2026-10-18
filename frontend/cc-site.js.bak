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
  if (C.banner_on && C.banner_text) {
    if (!b) { b = document.createElement('div'); b.id = 'cc-banner'; b.setAttribute('role', 'status'); document.body.insertBefore(b, document.body.firstChild); }
    b.textContent = '';
    var t = document.createElement(https(C.banner_link) ? 'a' : 'span');
    t.textContent = C.banner_text;
    if (https(C.banner_link)) { t.href = C.banner_link; t.target = '_blank'; t.rel = 'noopener noreferrer'; }
    b.appendChild(t);
    document.documentElement.classList.add('cc-has-banner');
  } else { if (b) b.remove(); document.documentElement.classList.remove('cc-has-banner'); }
  // maintenance cover
  var m = q('#cc-maint');
  if (C.maintenance_on) {
    if (!m) { m = document.createElement('div'); m.id = 'cc-maint'; m.setAttribute('role', 'alert'); m.innerHTML = '<div><h1></h1><p></p></div>'; document.body.appendChild(m); }
    q('h1', m).textContent = 'Back soon';
    q('p', m).textContent = C.maintenance_text || 'We are fixing something. Please check again in a little while.';
  } else if (m) m.remove();
  links();
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
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
