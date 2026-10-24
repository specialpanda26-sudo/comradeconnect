(function () {
'use strict';
var D = null, busy = false;
function $(s, r) { return (r || document).querySelector(s); }
function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function say(m) { try { toast(m); } catch (e) { alert(m); } }
var kes = function (n) { return 'KSh ' + Number(n || 0).toLocaleString('en-KE'); };
var call = function () { return window.CC.call.apply(null, arguments); };
var home = function () { return location.origin + '/'; };
function linkUrl() { return home() + D.link.path; }
function btn(label, cls, fn) { var b = el('button', 'btn ' + cls, label); b.type = 'button'; b.onclick = fn; return b; }

function sheet(title, intro) {
  var m = el('div'); m.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(16,20,34,.8);display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto';
  var b = el('div', 'box g'); b.style.cssText = 'max-width:360px;width:100%';
  b.appendChild(el('h3', '', title)); var p = el('p', 'sub', intro); p.style.marginTop = '6px'; b.appendChild(p);
  m.appendChild(b); document.body.appendChild(m); m.box = b; m.close = function () { m.remove(); }; return m;
}
function field(m, ph, val, max) {
  var f = el('div', 'fld'); f.style.marginTop = '10px'; var i = el('input'); i.placeholder = ph; i.value = val || ''; i.maxLength = max || 40; i.setAttribute('aria-label', ph);
  i.autocapitalize = 'off'; i.autocomplete = 'off'; f.appendChild(i); m.box.appendChild(f); return i;
}

async function load() {
  var au = window.ccAuth && window.ccAuth(); if (!au || !au.token) return;
  try { D = await call('/api/me/gift'); draw(); } catch (e) {}
}
function edit() {
  var L = D.link, m = sheet(L ? 'Edit your gift link' : 'Create your gift link', 'People who open your link can send you a gift by M-Pesa. Do not put phone numbers or links in the name or note.');
  var t = field(m, 'Name shown on the page', L ? L.title : '', 40), s = field(m, 'Link name, e.g. molly', L ? L.slug : '', 24), n = field(m, 'Short note (optional)', L ? L.blurb : '', 160);
  var e = el('p', 'sub'); e.style.cssText = 'color:var(--bad,#FFFFFF);min-height:18px'; m.box.appendChild(e);
  var go = btn(L ? 'Save' : 'Create link', 'p', async function () {
    go.disabled = true; e.textContent = '';
    try { await call('/api/me/gift', { body: { title: t.value, slug: s.value, blurb: n.value } }); m.close(); say(L ? 'Saved' : 'Your gift link is ready'); load(); }
    catch (x) { e.textContent = x.message; go.disabled = false; }
  });
  var two = el('div', 'two'); two.appendChild(btn('Cancel', 'g', function () { m.close(); })); two.appendChild(go); m.box.appendChild(two);
}
async function toggle() {
  try { await call('/api/me/gift', { body: { active: !D.link.active } }); say(D.link.active ? 'Link paused' : 'Link is live'); load(); } catch (e) { say(e.message); }
}
async function copy() { try { await navigator.clipboard.writeText(linkUrl()); say('Link copied'); } catch (e) { say('Select the link and copy it'); } }
async function share() {
  var text = 'Support ' + D.link.title + ' with a gift on Comrade Connect';
  if (navigator.share) { try { await navigator.share({ title: D.link.title, text: text, url: linkUrl() }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  copy();
}
function draw() {
  var host = $('#ccgift'); if (!host || !D) return;
  host.textContent = ''; host.hidden = false;
  var hd = el('div'); hd.style.cssText = 'display:flex;align-items:center;gap:10px';
  hd.innerHTML = '<span aria-hidden="true" style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:var(--aq,#A8DCE7);color:var(--nt,#101422);flex:none"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg></span>';
  var ht = el('div'); var t1 = el('b', '', 'My gift link'); t1.style.cssText = 'font-size:17px;display:block'; ht.appendChild(t1);   /* not an h3: the Me page hides every card that has an h3 behind its menu */ var hs = el('div', 'sub', 'Get gifts from friends and fans by M-Pesa'); hs.style.fontSize = '12px'; ht.appendChild(hs); hd.appendChild(ht); host.appendChild(hd);
  if (!D.link) {
    var t = el('p', 'sub', 'Get a link you can paste on your WhatsApp status, Instagram bio or page. When someone opens it they can buy you a coffee, lunch or any amount by M-Pesa, with no account needed. We keep ' + D.fee_percent + '% and the rest goes to your wallet.'); t.style.marginTop = '6px'; host.appendChild(t);
    var cb = btn('Create my gift link', 'p', edit); cb.style.cssText = 'width:100%;margin-top:10px'; host.appendChild(cb); return;
  }
  var u = el('div', 'fld'); u.style.marginTop = '8px'; var ui = el('input'); ui.readOnly = true; ui.value = linkUrl(); ui.setAttribute('aria-label', 'Your gift link'); ui.onfocus = function () { ui.select(); }; u.appendChild(ui); host.appendChild(u);
  if (!D.link.active) { var p = el('p', 'note', 'This link is paused. People who open it see that it is not active.'); p.style.marginTop = '6px'; host.appendChild(p); }
  var two = el('div', 'two'); two.style.marginTop = '10px'; two.appendChild(btn('Copy link', 'g', copy)); two.appendChild(btn('Share', 'p', share)); host.appendChild(two);
  var two2 = el('div', 'two'); two2.style.marginTop = '8px'; two2.appendChild(btn('Edit', 'g', edit)); two2.appendChild(btn(D.link.active ? 'Pause' : 'Turn on', 'g', toggle)); host.appendChild(two2);
  if (!D.earned.count) { var z = el('p', 'note', 'No gifts yet. When someone sends you one, it shows here and in your wallet.'); z.style.marginTop = '12px'; host.appendChild(z); return; }
  var hr = el('div'); hr.style.cssText = 'height:1px;background:var(--line,rgba(255,255,255,.12));margin:14px 0'; host.appendChild(hr);
  host.appendChild(el('div', 'sub', 'Received in gifts'));
  var big = el('div', 'big', kes(D.earned.net)); host.appendChild(big);
  var s = el('p', 'note', D.earned.count + ' gift' + (D.earned.count === 1 ? '' : 's') + ', ' + kes(D.earned.last30) + ' in the last 30 days. We keep ' + D.fee_percent + '% of each gift, the rest is in your wallet.'); s.style.marginTop = '4px'; host.appendChild(s);
  D.recent.forEach(function (g) {
    var r = el('div'); r.style.cssText = 'display:flex;justify-content:space-between;gap:10px;margin-top:10px;font-size:13px';
    var l = el('div'); l.appendChild(el('b', '', (g.name || 'A supporter') + ' sent ' + (g.item === 'custom' ? 'a gift' : 'a ' + g.item)));
    if (g.message) { var q = el('div', 'sub', g.message); q.style.overflowWrap = 'anywhere'; l.appendChild(q); }
    r.appendChild(l); r.appendChild(el('span', '', '+' + kes(g.net))); host.appendChild(r);
  });
}
function mount() {
  var cur = $('#ccgift');
  if (cur) { var au0 = window.ccAuth && window.ccAuth(); if (au0 && au0.token) { if (!D && !busy) { busy = true; load().then(function () { busy = false; }, function () { busy = false; }); } } else { cur.hidden = true; D = null; } return; }
  var anchor = $('#mecard'); if (!anchor) return;
  var au = window.ccAuth && window.ccAuth(); if (!au || !au.token) return;      // gifts are for signed-in accounts only
  var box = el('div', 'box g'); box.id = 'ccgift'; box.hidden = true; anchor.after(box); load();
}
window.ccGiftsLoad = load;
setInterval(function () { if (!document.hidden) mount(); }, 1500);
mount();
})();
