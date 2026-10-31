/* cc-promo.js: "Offers and updates" box on the Me page. Optional. Nothing is stored unless the person ticks a box and taps Save. */
(function () {
  'use strict';
  if (window.__ccPromo) return; window.__ccPromo = 1;
  var $ = function (id) { return document.getElementById(id); };
  var IN = 'width:100%;margin:6px 0 14px;padding:12px 14px;border-radius:14px;border:1px solid var(--gb,rgba(255,255,255,.28));background:transparent;color:inherit;font:inherit;box-sizing:border-box';
  var waLinked = false;
  function say(t) { var s = $('ccpst'); if (s) s.textContent = t; }
  function fill() {
    if (typeof CC_API === 'undefined' || !$('ccpe')) return;
    fetch(CC_API + '/api/me/promo').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) return;
      $('ccpe').checked = !!d.email_ok; $('ccps').checked = !!d.sms_ok;
      waLinked = !!d.wa_linked; $('ccpw').checked = !!d.wa_ok && waLinked;
      $('ccpwp').placeholder = d.wa_last4 ? 'Your linked number (ends ' + d.wa_last4 + ')' : 'Your linked WhatsApp number';
      $('ccpwp').style.display = waLinked ? '' : 'none'; $('ccpwl').style.display = waLinked ? 'none' : '';
      if (d.email) $('ccpem').value = d.email; if (d.phone) $('ccpph').value = d.phone;
    }).catch(function () {});
  }
  function save() {
    var body = { email: $('ccpem').value.trim(), phone: $('ccpph').value.trim(), email_ok: $('ccpe').checked, sms_ok: $('ccps').checked, wa_ok: $('ccpw').checked, wa_phone: $('ccpwp').value.trim() };
    if (body.wa_ok && !waLinked) return say('Link your WhatsApp number first.');
    say('Saving...');
    fetch(CC_API + '/api/me/promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) { say(x.ok ? (body.email_ok || body.sms_ok || body.wa_ok ? 'Saved. Thank you! You can switch this off any time.' : 'Saved. You will not get offers.') : (x.d.error || 'Could not save. Sign in and try again.')); })
      .catch(function () { say('Could not reach the server. Check your internet.'); });
  }
  function mount() {
    var me = $('v-me'); if (!me) return false;
    if ($('ccpromo')) return true;
    var box = document.createElement('div'); box.className = 'box g'; box.id = 'ccpromo';
    box.innerHTML = '<h3>Offers and updates</h3><p class="sub" style="margin-bottom:10px">Optional. Get app updates and offers by email, SMS or WhatsApp. We never share your details, and every message has a way to stop.</p>'
      + '<div class="rw"><span>Email me</span><input type="checkbox" class="sw" id="ccpe" aria-label="Email me offers and updates"></div>'
      + '<input id="ccpem" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" maxlength="120" style="' + IN + '">'
      + '<div class="rw"><span>Text me</span><input type="checkbox" class="sw" id="ccps" aria-label="Text me offers and updates"></div>'
      + '<input id="ccpph" type="tel" inputmode="tel" autocomplete="tel" placeholder="0712 345 678" maxlength="20" style="' + IN + '">'
      + '<div class="rw"><span>WhatsApp me</span><input type="checkbox" class="sw" id="ccpw" aria-label="WhatsApp me offers and updates"></div>'
      + '<p class="sub" style="margin:6px 0 8px">Offers go only to the number you verified. Reply STOP to any message to stop.</p>'
      + '<button class="btn g" id="ccpwl" type="button" style="display:none;margin-bottom:12px">Link my WhatsApp number</button>'
      + '<input id="ccpwp" type="tel" inputmode="tel" autocomplete="tel" placeholder="Your linked WhatsApp number" maxlength="20" style="' + IN + '">'
      + '<div class="two"><button class="btn g" id="ccpsv" type="button">Save</button></div><p class="sub" id="ccpst" style="margin-top:10px"></p>';
    var after = Array.prototype.filter.call(me.querySelectorAll('.box'), function (b) { var h = b.querySelector('h3'); return h && /^Notifications/i.test(h.textContent); })[0];
    if (after) after.insertAdjacentElement('afterend', box); else me.appendChild(box);
    $('ccpsv').onclick = save;
    $('ccpwl').onclick = function () { if (window.ccPhoneLinkOpen) window.ccPhoneLinkOpen(); else say('Linking is not available yet. Update the app and try again.'); };
    $('ccpw').onchange = function () { if (this.checked && !waLinked) { this.checked = false; say('Link your WhatsApp number first.'); } };
    fill();
    return true;
  }
  window.addEventListener('cc-phone-linked', function () { fill(); });
  var go = function () { mount(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  document.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('[data-v="me"]'); if (t) setTimeout(function () { mount(); fill(); }, 300); });
})();
