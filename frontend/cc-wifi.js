/* cc-wifi.js v1
   Explore > Wi-Fi: share a network (SSID + password + real GPS location), and Wi-Fi resellers listing plans
   (Mbps and prices) and installation details. No emojis: outline SVG icons only. Loaded after cc-core.js. */
(function () {
  'use strict';
  var X = window.__ccx; if (!X || !X.XP) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var say = function (m) { try { toast(m); } catch (e) {} };
  var kes = function (n) { return 'KSh ' + Number(n).toLocaleString('en-KE'); };
  var PER = { hour: 'hour', day: 'day', week: 'week', month: 'month' };
  var TECH = ['Fibre', 'Wireless radio', 'Hotspot vouchers', 'Mobile 4G or 5G', 'Other'];

  var IC = {
    wifi: '<path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor"/>',
    pin: '<path d="M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    tool: '<path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-2.6-.7-.7-2.6z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  var ic = function (n) { return '<svg class="wf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + '</svg>'; };

  var css = document.createElement('style');
  css.textContent = [
    '.wf-ic{width:16px;height:16px;vertical-align:-3px;margin-right:6px;flex:none}',
    '.wfr{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:12px;background:rgba(127,127,127,.12);margin-top:8px}',
    '.wfr small{display:block;font-size:11px;color:var(--mut)}',
    '.wfr b{font-size:14px;overflow-wrap:anywhere}',
    '.wfr .acts{display:flex;gap:6px;flex:none}',
    '.wfp{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:12px;background:rgba(127,127,127,.12);margin-top:8px}',
    '.wfp b.m{font-size:20px;line-height:1}',
    '.wfp small{display:block;font-size:12px;color:var(--mut);margin-top:3px}',
    '.wfp .pr{text-align:right;font-weight:700;font-size:15px}',
    '.wfp .pr small{font-weight:400}',
    '.wfi{margin-top:12px;padding:10px 12px;border-radius:12px;border:1px dashed var(--line)}',
    '.wfi p{margin:4px 0 0;font-size:13px;overflow-wrap:anywhere}',
    '.wfk{display:grid;gap:10px;margin-top:10px}',
    '.wfk button.big{display:flex;align-items:center;gap:12px;text-align:left;width:100%;padding:14px;border-radius:14px;border:1px solid var(--line);background:rgba(127,127,127,.1);color:inherit}',
    '.wfk button.big svg{width:26px;height:26px;margin:0}',
    '.wfk button.big small{display:block;color:var(--mut);font-size:12px;margin-top:2px}',
    '.wff label.cb{display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:13px}',
    '.wff .h{font-size:12px;color:var(--mut);margin:6px 0 0}',
    '.wff .pk{border:1px solid var(--line);border-radius:12px;padding:10px;margin-top:10px}',
    '.wff .pk .g3{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}',
    '.wfl{display:flex;align-items:center;gap:10px;margin-top:12px;padding:10px 12px;border-radius:12px;border:1px solid var(--line);font-size:13px}',
    '.wfl.ok{border-color:#22c55e}',
    'a.act{text-decoration:none}'
  ].join('');
  document.head.appendChild(css);

  /* ---------- location ---------- */
  function getLoc() {
    return new Promise(function (res, rej) {
      if (!navigator.geolocation) return rej(new Error('This browser cannot share a location. Use your phone.'));
      navigator.geolocation.getCurrentPosition(function (p) {
        res({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy || 0) });
      }, function (e) {
        rej(new Error(e && e.code === 1 ? 'Location is blocked. Allow location for this site in your browser settings, then try again.'
          : e && e.code === 3 ? 'Getting your location took too long. Move near a window or outside and try again.'
          : 'Could not get your location. Switch on GPS and try again.'));
      }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    });
  }
  function km(a, b) {
    var R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function dist(d) { return d < 1 ? Math.max(10, Math.round(d * 100) * 10) + ' m' : d.toFixed(1) + ' km'; }
  var hasLoc = function (w) { return typeof w.lat === 'number' && typeof w.lng === 'number'; };

  /* ---------- cards ---------- */
  var when = function (w) { return X.xwhen(w); };
  function mapLink(w) { return hasLoc(w) ? '<a class="act" href="https://www.google.com/maps/dir/?api=1&destination=' + w.lat + ',' + w.lng + '" target="_blank" rel="noopener">' + ic('pin') + 'Directions</a>' : ''; }
  function ownerBtn(w) { return w.mine ? '<button class="act" data-wf="rm" data-id="' + esc(w.id) + '">Remove</button>' : X.xrep(w); }
  function votes(w) {
    var up = Math.round(((w.votes || 0) + (w.score || 0)) / 2), down = (w.votes || 0) - up;
    return '<button class="act' + (w.my_vote === 1 ? ' liked' : '') + '" data-xa="wup" data-id="' + esc(w.id) + '">Works ' + up + '</button><button class="act' + (w.my_vote === -1 ? ' liked' : '') + '" data-xa="wdn" data-id="' + esc(w.id) + '">Not working ' + down + '</button>';
  }
  function head(w, label, s) {
    var d = s.near && hasLoc(w) ? km(s.near, w) : null;
    return '<div class="flex items-center justify-between"><span><span class="badge">' + label + '</span>' + (w.tech ? '<span class="badge" style="margin-left:6px">' + esc(w.tech) + '</span>' : '')
      + (w.zone ? '<span class="badge" style="margin-left:6px">@' + esc(w.zone) + '</span>' : '') + (d !== null ? '<span class="badge" style="margin-left:6px">' + dist(d) + ' away</span>' : '') + '</span>' + when(w) + '</div>';
  }
  function row(label, value, acts) { return '<div class="wfr"><div><small>' + label + '</small><b>' + value + '</b></div>' + (acts ? '<div class="acts">' + acts + '</div>' : '') + '</div>'; }

  function shareCard(w, s) {
    var shown = s.shown && s.shown[w.id], pw;
    if (w.has_password === false || (!w.has_password && w.password === null)) pw = row('Password', 'Open network, no password');
    else if (w.locked) pw = '<div class="wfr"><div><small>Password</small><b>Hidden</b></div><div class="acts"><button class="act" data-wf="signin">' + ic('key') + 'Sign in to see it</button></div></div>';
    else pw = row('Password', shown ? esc(w.password) : '&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;',
      '<button class="act" data-wf="sh" data-id="' + esc(w.id) + '">' + (shown ? 'Hide' : 'Show') + '</button><button class="act" data-wf="cp" data-k="pw" data-id="' + esc(w.id) + '" aria-label="Copy password">' + ic('copy') + 'Copy</button>');
    var down = (w.votes || 0) - Math.round(((w.votes || 0) + (w.score || 0)) / 2), up = (w.votes || 0) - down;
    return '<article class="box g">' + head(w, ic('wifi') + 'Free to join', s)
      + '<p style="margin:12px 0 2px;font-weight:600;overflow-wrap:anywhere">' + esc(w.place) + (down >= up + 3 ? ' <span class="sub">(reported not working)</span>' : '') + '</p>'
      + (w.business ? '<p class="sub" style="margin:0">' + esc(w.business) + '</p>' : '')
      + row('Wi-Fi name (SSID)', esc(w.ssid), '<button class="act" data-wf="cp" data-k="ssid" data-id="' + esc(w.id) + '" aria-label="Copy Wi-Fi name">' + ic('copy') + 'Copy</button>')
      + pw
      + (w.speed_note ? '<p class="sub" style="margin:10px 0 0">Speed: ' + esc(w.speed_note) + '</p>' : '')
      + '<div class="bar" style="margin-top:12px">' + votes(w) + mapLink(w) + ownerBtn(w) + '</div></article>';
  }

  function resellerCard(w, s) {
    var pk = Array.isArray(w.packages) ? w.packages : [];
    var plans = pk.map(function (p) {
      return '<div class="wfp"><div><b class="m">' + esc(p.mbps) + ' Mbps</b><small>' + esc(p.name) + '</small></div><div class="pr">' + kes(p.price) + '<small>per ' + (PER[p.period] || esc(p.period)) + '</small></div></div>';
    }).join('');
    var fee = w.install_fee === 0 ? 'Free installation' : (typeof w.install_fee === 'number' ? 'Installation ' + kes(w.install_fee) + ' (one time)' : 'Installation: ask the seller');
    var inst = '<div class="wfi"><b style="font-size:13px">' + ic('tool') + fee + '</b>'
      + (w.install_time ? '<p>Time to install: ' + esc(w.install_time) + '</p>' : '') + (w.install_notes ? '<p>Includes: ' + esc(w.install_notes) + '</p>' : '') + '</div>';
    var contact = '';
    if (w.contact_phone) contact = '<a class="act" href="tel:+' + esc(w.contact_phone) + '">' + ic('phone') + 'Call</a><a class="act" href="https://wa.me/' + esc(w.contact_phone) + '" target="_blank" rel="noopener">' + ic('chat') + 'WhatsApp</a>';
    else if (w.locked && w.has_phone) contact = '<button class="act" data-wf="signin">' + ic('phone') + 'Sign in to call</button>';
    return '<article class="box g">' + head(w, ic('wifi') + 'Wi-Fi plans', s)
      + '<p style="margin:12px 0 2px;font-weight:700;font-size:16px;overflow-wrap:anywhere">' + esc(w.place) + '</p>'
      + (w.coverage ? '<p class="sub" style="margin:0">Covers: ' + esc(w.coverage) + '</p>' : '')
      + plans + inst
      + '<div class="bar" style="margin-top:12px">' + (w.mine ? '' : X.xmsg(w, 'seller')) + contact + mapLink(w) + ownerBtn(w) + '</div></article>';
  }

  function spotCard(w, s) {
    var down = (w.votes || 0) - Math.round(((w.votes || 0) + (w.score || 0)) / 2), up = (w.votes || 0) - down;
    return '<article class="box g">' + head(w, 'Speed: ' + esc(w.speed_note || 'unknown'), s)
      + '<p style="margin:12px 0 12px;font-weight:600;overflow-wrap:anywhere">' + esc(w.place) + (down >= up + 3 ? ' <span class="sub">(reported not working)</span>' : '') + '</p>'
      + '<div class="bar">' + votes(w) + ownerBtn(w) + '</div></article>';
  }

  /* ---------- forms ---------- */
  var inp = function (id, ph, max, extra) { return '<div class="fld" style="margin-top:10px"><input id="' + id + '" maxlength="' + max + '" placeholder="' + esc(ph) + '" aria-label="' + esc(ph) + '"' + (extra || '') + '></div>'; };
  var sel = function (id, label, opts, cur) { return '<select id="' + id + '" aria-label="' + esc(label) + '">' + opts.map(function (o) { return '<option' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>'; };
  function locBox(s, need) {
    var l = s.loc;
    return '<div class="wfl' + (l ? ' ok' : '') + '">' + ic('pin')
      + '<div style="flex:1;min-width:0">' + (l ? 'Location saved, accurate to about ' + l.accuracy + ' m' : (need ? 'Stand next to the router, then tap the button. We use your real location so comrades can find it.' : 'Optional: add your shop or base location so comrades near you find you.')) + '</div>'
      + '<button type="button" class="act" data-wf="loc">' + (l ? 'Update' : 'Use my real location') + '</button></div>';
  }
  function shareForm(s) {
    return '<article class="box g wff"><b style="font-size:15px">Share a Wi-Fi network</b>'
      + '<p class="h">For a company, hostel, shop or home. Only share a network you own or have permission to share. Passwords are shown only to signed-in comrades.</p>'
      + inp('wf_pl', 'Place or company, e.g. Njeri Plots', 60) + inp('wf_bz', 'Owner or company name (optional)', 60)
      + inp('wf_ss', 'Wi-Fi name (SSID)', 32, ' autocapitalize="off" autocomplete="off" spellcheck="false"')
      + inp('wf_pw', 'Wi-Fi password', 63, ' autocapitalize="off" autocomplete="off" spellcheck="false"')
      + '<label class="cb"><input type="checkbox" id="wf_op"> Open network, no password</label>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">' + sel('wf_zn', 'Zone', ZONES) + sel('wf_sp', 'Speed', ['Fast', 'OK', 'Slow'], 'OK') + '</div>'
      + inp('wf_mb', 'Speed in Mbps (optional)', 5, ' inputmode="numeric"')
      + locBox(s, true)
      + '<label class="cb"><input type="checkbox" id="wf_ok"> I own this network or have permission to share it</label>'
      + '<div class="bar" style="margin-top:14px"><button class="btn p" data-wf="save-share">Share Wi-Fi</button><button class="act" data-wf="cancel">Cancel</button></div></article>';
  }
  function planRows(n) {
    var h = '';
    for (var i = 0; i < n; i++) {
      h += '<div class="pk"><div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:13px">Plan ' + (i + 1) + '</b>' + (n > 1 ? '<button type="button" class="act" data-wf="pk-" data-i="' + i + '" aria-label="Remove plan ' + (i + 1) + '">' + ic('x') + 'Remove</button>' : '') + '</div>'
        + inp('wf_pn' + i, 'Plan name, e.g. Home 10', 30)
        + '<div class="g3"><div class="fld" style="margin:0"><input id="wf_pm' + i + '" inputmode="numeric" maxlength="5" placeholder="Mbps, e.g. 10" aria-label="Mbps"></div><div class="fld" style="margin:0"><input id="wf_pp' + i + '" inputmode="numeric" maxlength="7" placeholder="Price in KSh" aria-label="Price in KSh"></div></div>'
        + '<div style="margin-top:8px">' + sel('wf_pd' + i, 'Lasts', ['per month', 'per week', 'per day', 'per hour'], 'per month') + '</div></div>';
    }
    return h;
  }
  function resellerForm(s) {
    var n = s.npk || 1;
    return '<article class="box g wff"><b style="font-size:15px">Sell Wi-Fi plans and installation</b>'
      + '<p class="h">For Wi-Fi resellers, ISPs and installers. Add every plan with its speed and price, then the installation details, so comrades can compare.</p>'
      + inp('wf_pl', 'Business name, e.g. Kutus Fibre Hub', 60)
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">' + sel('wf_zn', 'Main zone', ZONES) + sel('wf_tc', 'Connection type', TECH, 'Fibre') + '</div>'
      + inp('wf_cv', 'Areas you cover, e.g. Kutus town and Kagio', 200)
      + '<b style="display:block;margin-top:16px;font-size:14px">Plans: speed and price</b>' + planRows(n)
      + (n < 8 ? '<button type="button" class="act" data-wf="pk+" style="margin-top:10px">' + ic('plus') + 'Add another plan</button>' : '')
      + '<b style="display:block;margin-top:16px;font-size:14px">Installation</b>'
      + inp('wf_if', 'Installation fee in KSh (write 0 if free)', 6, ' inputmode="numeric"')
      + inp('wf_it', 'How long it takes, e.g. Within 24 hours', 40)
      + inp('wf_in', 'What is included, e.g. Router and 20 m of cable', 300)
      + '<b style="display:block;margin-top:16px;font-size:14px">Contact</b>'
      + inp('wf_ph', 'Phone or WhatsApp number (optional)', 14, ' inputmode="tel" autocomplete="off"')
      + '<p class="h">Signed-in comrades see Call and WhatsApp buttons. Everyone can also message you anonymously inside the app.</p>'
      + locBox(s, false)
      + '<label class="cb"><input type="checkbox" id="wf_ok"> I own this business or I am an authorised agent</label>'
      + '<div class="bar" style="margin-top:14px"><button class="btn p" data-wf="save-reseller">Post my plans</button><button class="act" data-wf="cancel">Cancel</button></div></article>';
  }
  function chooser() {
    return '<article class="box g"><b style="font-size:15px">What do you want to add?</b><div class="wfk">'
      + '<button type="button" class="big" data-wf="mode-share">' + ic('key') + '<span><b>Share my Wi-Fi</b><small>Name, password and real location, so comrades can connect</small></span></button>'
      + '<button type="button" class="big" data-wf="mode-reseller">' + ic('tool') + '<span><b>Sell Wi-Fi plans and installation</b><small>Mbps, prices, installation fee and contact</small></span></button>'
      + '</div><div class="bar" style="margin-top:12px"><button class="act" data-wf="cancel">Cancel</button></div></article>';
  }

  /* ---------- the screen ---------- */
  X.XP.wf = function (s, L) {
    var h = '<p class="sub">Find free Wi-Fi, or compare Wi-Fi plans and installation from resellers around campus and the hostels.</p>';
    var form = s.mode === 'choose' ? chooser() : s.mode === 'share' ? shareForm(s) : s.mode === 'reseller' ? resellerForm(s) : '';
    h += '<button class="btn p" data-wf="add" style="width:100%">' + ic('plus') + 'Add Wi-Fi or plans</button>' + form;
    var chips = [['', 'All'], ['share', 'Free to join'], ['reseller', 'Plans and installation']];
    h += '<div class="tabs z" style="padding:0">' + chips.map(function (c) { return '<button class="tab g' + ((s.kind || '') === c[0] ? ' on' : '') + '" data-wf="kind" data-k="' + c[0] + '">' + c[1] + '</button>'; }).join('')
      + '<button class="tab g' + (s.near ? ' on' : '') + '" data-wf="near">' + ic('pin') + (s.near ? 'Nearest first' : 'Near me') + '</button></div>';
    h += X.zchips(s);
    var list = L.slice();
    if (s.near) list.sort(function (a, b) { return (hasLoc(a) ? km(s.near, a) : 1e9) - (hasLoc(b) ? km(s.near, b) : 1e9); });
    h += list.length ? list.map(function (w) { return w.kind === 'share' ? shareCard(w, s) : w.kind === 'reseller' ? resellerCard(w, s) : spotCard(w, s); }).join('')
      : X.xempty(s, s.kind === 'reseller' ? 'No Wi-Fi plans here yet. Are you a reseller? Add yours.' : s.kind === 'share' ? 'No shared Wi-Fi here yet. Share yours.' : 'No Wi-Fi here yet. Be the first.');
    return h + X.xmore(s);
  };

  /* ---------- actions ---------- */
  var v = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
  var chk = function (id) { var e = document.getElementById(id); return !!(e && e.checked); };
  var plain = function (t, what) { try { if (t && typeof contactHit === 'function' && contactHit(t)) { say('No phone numbers, handles or links in ' + what + '.'); return false; } } catch (e) {} return true; };
  var need = function (m) { say(m); return null; };

  function readShare(s) {
    var place = v('wf_pl'), ssid = v('wf_ss'), open = chk('wf_op'), pw = (document.getElementById('wf_pw') || {}).value || '';
    if (place.length < 2) return need('Add the place or company name');
    if (!plain(place, 'the place name') || !plain(v('wf_bz'), 'the company name')) return null;
    if (!ssid) return need('Add the Wi-Fi name (SSID)');
    if (!open && pw.length < 8) return need('The password must be at least 8 characters. Tick "Open network" if it has none.');
    if (!s.loc) return need('Tap "Use my real location" while you are at the network');
    if (!chk('wf_ok')) return need('Tick the box to confirm you own this network or have permission to share it');
    var mb = parseInt(v('wf_mb'), 10), sp = v('wf_sp');
    return { kind: 'share', place: place, business: v('wf_bz'), ssid: ssid, password: open ? null : pw, open: open, zone: v('wf_zn'), speed_note: mb > 0 ? sp + ', ' + mb + ' Mbps' : sp, lat: s.loc.lat, lng: s.loc.lng, accuracy: s.loc.accuracy, consent: true };
  }
  function readReseller(s) {
    var place = v('wf_pl'); if (place.length < 2) return need('Add the business name');
    if (!plain(place, 'the business name') || !plain(v('wf_cv'), 'the coverage') || !plain(v('wf_it'), 'the install time') || !plain(v('wf_in'), 'the install details')) return null;
    var pk = [], n = s.npk || 1;
    for (var i = 0; i < n; i++) {
      var name = v('wf_pn' + i), mbps = parseInt(v('wf_pm' + i), 10), price = parseInt(v('wf_pp' + i), 10), per = v('wf_pd' + i).replace('per ', '');
      if (!name || !(mbps > 0) || !(price > 0)) return need('Plan ' + (i + 1) + ': add the name, the Mbps and the price in KSh');
      if (!plain(name, 'a plan name')) return null;
      pk.push({ name: name, mbps: mbps, price: price, period: per });
    }
    var fee = v('wf_if'); if (fee === '' || !(parseInt(fee, 10) >= 0)) return need('Add the installation fee in KSh. Write 0 if installation is free.');
    if (!chk('wf_ok')) return need('Tick the box to confirm you own this business or are an authorised agent');
    var o = { kind: 'reseller', place: place, zone: v('wf_zn'), tech: v('wf_tc'), coverage: v('wf_cv'), packages: pk, install_fee: parseInt(fee, 10), install_time: v('wf_it'), install_notes: v('wf_in'), contact_phone: v('wf_ph'), consent: true };
    if (s.loc) { o.lat = s.loc.lat; o.lng = s.loc.lng; o.accuracy = s.loc.accuracy; }
    return o;
  }

  async function onClick(e) {
    var b = e.target.closest('[data-wf]'); if (!b || !$('#xbody') || !$('#xbody').contains(b)) return;
    e.stopImmediatePropagation(); e.preventDefault();
    var s = X.exs('wf'), a = b.dataset.wf, id = b.dataset.id, item = id ? s.items.filter(function (y) { return y.id === id; })[0] : null;
    try {
      if (a === 'add') { s.mode = 'choose'; return X.paintX(); }
      if (a === 'cancel') { s.mode = ''; s.loc = null; s.npk = 1; return X.paintX(); }
      if (a === 'mode-share') { s.mode = 'share'; return X.paintX(); }
      if (a === 'mode-reseller') { s.mode = 'reseller'; s.npk = 1; return X.paintX(); }
      if (a === 'pk+') { s.npk = Math.min(8, (s.npk || 1) + 1); return X.paintX(); }
      if (a === 'pk-') { return removePlan(s, +b.dataset.i); }
      if (a === 'kind') { s.kind = b.dataset.k; s.items = []; s.loaded = false; return X.loadX('wf', true); }
      if (a === 'sh') { s.shown = s.shown || {}; s.shown[id] = !s.shown[id]; return X.paintX(); }
      if (a === 'cp' && item) { try { await navigator.clipboard.writeText(b.dataset.k === 'pw' ? item.password : item.ssid); say('Copied'); } catch (er) { say('Could not copy. Select the text and copy it.'); } return; }
      if (a === 'signin') { await X.ensureAccount(); s.loaded = false; return X.loadX('wf', true); }
      if (a === 'near') {
        if (s.near) { s.near = null; return X.paintX(); }
        b.disabled = true; try { var l = await getLoc(); s.near = { lat: l.lat, lng: l.lng }; } catch (er) { say(er.message); } return X.paintX();
      }
      if (a === 'loc') {
        b.disabled = true; var old = b.textContent; b.textContent = 'Getting location...';
        try {
          var p = await getLoc();
          if (p.accuracy > 300) { s.loc = null; say('Location is only accurate to ' + p.accuracy + ' m. Stand next to the router, switch on GPS and try again.'); }
          else { s.loc = p; say('Location saved'); }
        } catch (er) { s.loc = null; say(er.message); }
        return X.paintX();
      }
      if (a === 'rm' && item) {
        if (!window.confirm('Remove this from Wi-Fi? ' + (item.kind === 'share' ? 'The password is deleted too.' : ''))) return;
        await X.call('/api/c/wifi/' + id + '/remove', { body: {} });
        s.items = s.items.filter(function (y) { return y.id !== id; }); say('Removed'); return X.paintX();
      }
      if (a === 'save-share' || a === 'save-reseller') {
        var body = a === 'save-share' ? readShare(s) : readReseller(s); if (!body) return;
        b.disabled = true;
        var ok = await X.createX('wf', body);
        b.disabled = false;
        if (ok) { s.mode = ''; s.loc = null; s.npk = 1; say(body.kind === 'share' ? 'Shared. Thank you, comrade' : 'Your plans are live'); X.doneX('wf', body.kind === 'share' ? 3 : 2, body.kind === 'share' ? 'Shared Wi-Fi' : 'Posted Wi-Fi plans'); }
      }
    } catch (err) { say(err.message || 'Something went wrong'); if (b && b.disabled) b.disabled = false; }
  }
  function removePlan(s, i) {                       // shift the later plans up, then drop the last row
    var n = s.npk || 1, F = ['wf_pn', 'wf_pm', 'wf_pp', 'wf_pd'];
    for (var j = i; j < n - 1; j++) F.forEach(function (p) { var a = document.getElementById(p + j), c = document.getElementById(p + (j + 1)); if (a && c) a.value = c.value; });
    s.npk = Math.max(1, n - 1); X.paintX();
  }
  window.addEventListener('click', onClick, true);   // window capture runs before the Explore handler, so only data-wf buttons are taken
  window.ccWifi = { getLoc: getLoc };
  try { if (X.xt === 'wf') X.paintX(); } catch (e) {}
})();
