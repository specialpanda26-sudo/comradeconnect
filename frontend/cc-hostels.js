/* cc-hostels.js v1
   Explore > Hostels: caretakers post vacant rooms (exact GPS location, room photos, services included, directions);
   comrades browse vacancies and write honest reviews. Caretakers register once; the admin sets the fee
   (Admin > Money settings > Hostel caretaker registration fee, 0 = free). Loaded after cc-core.js and cc-wifi.js. */
(function () {
  'use strict';
  var X = window.__ccx; if (!X || !X.XP) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var say = function (m) { try { toast(m); } catch (e) {} };
  var kes = function (n) { return 'KSh ' + Number(n || 0).toLocaleString('en-KE'); };
  var okPhone = function (v) { return /^(07|01)(?!(\d)\2{7}$)\d{8}$/.test(v); };
  var MAXP = 8;
  var ROOMS = ['Single', 'Bedsitter', 'Double', 'Shared', 'One bedroom'];
  var AMEN = ['Water', 'Electricity', 'Wi-Fi', 'Security', 'Laundry', 'Parking', 'Gas', 'Furnished', 'CCTV', 'Shower', 'Study room'];
  var CFG = null;                                                   // { fee, registered, amenities, rooms, photos }

  var IC = {
    pin: '<path d="M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>'
  };
  var ic = function (n) { return '<svg class="hs-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + '</svg>'; };

  var css = document.createElement('style');
  css.textContent = [
    '.hs-ic{width:16px;height:16px;vertical-align:-3px;margin-right:6px;flex:none}',
    '.hsph{display:flex;gap:8px;overflow-x:auto;margin:12px -2px 0;padding:0 2px 6px;scroll-snap-type:x mandatory}',
    '.hsph img{flex:none;height:150px;width:auto;max-width:78%;border-radius:14px;object-fit:cover;scroll-snap-align:start;cursor:zoom-in;background:rgba(127,127,127,.15)}',
    '.hsnp{margin-top:12px;padding:18px;border-radius:14px;border:1px dashed var(--line);font-size:12px;color:var(--mut);text-align:center}',
    '.hsc{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;border:1px solid var(--line);font-size:12px;margin:0 6px 8px 0;cursor:pointer}',
    '.hsc input{margin:0;accent-color:currentColor}',
    '.hsl{display:flex;align-items:center;gap:10px;margin-top:12px;padding:10px 12px;border-radius:12px;border:1px solid var(--line);font-size:13px}',
    '.hsl.ok{border-color:#A8BBA3}',
    '.hsa{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 4px}',
    '.hsa a.btn,.hsa button.btn{padding:11px 18px;text-decoration:none;display:inline-flex;align-items:center}',
    '.hstag{display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;background:rgba(127,127,127,.14);margin:0 6px 6px 0}',
    '.hsv{background:#727E6E;color:#fff;border-color:#727E6E}.hsv.full{background:#6b7280;border-color:#6b7280}',
    '.hsp{position:relative;display:inline-block;margin:0 8px 8px 0}.hsp img{height:84px;border-radius:12px}',
    '.hsp button{position:absolute;top:-6px;right:-6px;width:24px;height:24px;border-radius:50%;padding:0}',
    '.hsf label.l{display:block;font-size:12px;color:var(--mut);margin:14px 0 6px}',
    '#hszoom{position:fixed;inset:0;z-index:9800;background:rgba(14,15,11,.92);display:flex;align-items:center;justify-content:center;padding:14px}',
    '#hszoom img{max-width:100%;max-height:100%;border-radius:10px}'
  ].join('');
  document.head.appendChild(css);

  /* ---------- helpers ---------- */
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
  var dist = function (d) { return d < 1 ? Math.max(10, Math.round(d * 100) * 10) + ' m away' : d.toFixed(1) + ' km away'; };
  var hasLoc = function (h) { return typeof h.lat === 'number' && typeof h.lng === 'number'; };
  var dirUrl = function (h) { return 'https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=' + h.lat + ',' + h.lng; };
  var mapUrl = function (h) { return 'https://www.openstreetmap.org/?mlat=' + h.lat + '&mlon=' + h.lng + '#map=18/' + h.lat + '/' + h.lng; };
  var val = function (id) { var e = document.getElementById(id); return e ? String(e.value).trim() : ''; };
  var chk = function (id) { var e = document.getElementById(id); return !!(e && e.checked); };
  var chips = function (prefix, list) { return list.map(function (n) { return '<label class="hsc"><input type="checkbox" id="' + prefix + n.replace(/\W/g, '') + '">' + esc(n) + '</label>'; }).join(''); };
  var picked = function (prefix, list) { return list.filter(function (n) { return chk(prefix + n.replace(/\W/g, '')); }); };
  var inp = function (id, ph, max, extra) { return '<div class="fld" style="margin-top:10px"><input id="' + id + '" maxlength="' + (max || 60) + '" placeholder="' + esc(ph) + '" aria-label="' + esc(ph) + '"' + (extra || '') + '></div>'; };
  var sel = function (id, label, opts, cur) { return '<select id="' + id + '" aria-label="' + esc(label) + '">' + opts.map(function (o) { return '<option' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>'; };

  function loadCfg(force) {
    if (CFG && !force) return Promise.resolve(CFG);
    return X.call('/api/hostels/caretaker', { auth: false }).then(function (d) { CFG = d; if (d.amenities) AMEN = d.amenities; if (d.rooms) ROOMS = d.rooms; return d; });
  }

  /* photos: one hidden file input, outside #xbody so repainting never touches it */
  var fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*'; fi.multiple = true; fi.hidden = true; document.body.appendChild(fi);
  fi.onchange = async function () {
    var target = fi.dataset.t, files = Array.prototype.slice.call(fi.files || []); fi.value = '';
    var s = X.exs('hs'); s.photos = s.photos || [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i]; if (!/^image\//.test(f.type)) { say('Room photos only. Videos are not allowed here.'); continue; }
      try {
        var blob = await X.toJpeg(f);
        if (target === 'form') { if (s.photos.length >= MAXP) { say('Up to ' + MAXP + ' photos'); break; } s.photos.push({ blob: blob, url: URL.createObjectURL(blob) }); }
        else { var h = s.items.filter(function (y) { return y.id === target; })[0]; if (!h) continue; if ((h.photos || []).length >= MAXP) { say('Up to ' + MAXP + ' photos'); break; } h.photos = (h.photos || []).concat(await uploadOne(target, blob)); say('Photo added'); }
      } catch (e) { say(e.message || 'Could not use that photo'); }
    }
    X.paintX();
  };
  async function uploadOne(hostelId, blob) {                         // returns [url]
    var u = await X.call('/api/media/upload-url', { body: { kind: 'hostel_photo', content_type: 'image/jpeg', bytes: blob.size, hostel_id: hostelId } });
    var r; try { r = await X.putFile(u.upload_url, blob, 'image/jpeg'); } catch (e) { throw new Error('The photo upload did not go through. Check your connection and try again.'); }
    if (!r.ok) throw new Error('The photo did not upload (' + r.status + '). Try again.');
    var d = await X.call('/api/media/' + u.id + '/complete', { body: {} });
    return [d.url];
  }
  function zoom(src) {
    var z = document.createElement('div'); z.id = 'hszoom'; z.innerHTML = '<img alt="Room photo" src="' + esc(src) + '">'; z.onclick = function () { z.remove(); }; document.body.appendChild(z);
  }

  /* ---------- cards ---------- */
  function card(h, s) {
    var full = !(h.vacancies > 0), d = s.near && hasLoc(h) ? ' <span class="hstag">' + ic('pin').replace('class="hs-ic"', 'class="hs-ic" style="margin-right:3px"') + dist(km(s.near, h)) + '</span>' : '';
    var photos = (h.photos || []).length ? '<div class="hsph">' + h.photos.map(function (u) { return '<img src="' + esc(u) + '" alt="Room at ' + esc(h.name) + '" loading="lazy" decoding="async" data-hs="zoom" data-src="' + esc(u) + '">'; }).join('') + '</div>'
      : '<div class="hsnp">' + ic('cam') + 'No room photos yet</div>';
    var am = (h.amenities || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) { return '<span class="hstag">' + esc(x) + '</span>'; }).join('');
    var act = '';
    if (hasLoc(h)) act += '<a class="btn p" href="' + esc(dirUrl(h)) + '" target="_blank" rel="noopener">' + ic('pin') + 'Directions</a><a class="btn g" href="' + esc(mapUrl(h)) + '" target="_blank" rel="noopener">' + ic('map') + 'View on map</a>';
    if (h.contact_phone) act += '<a class="btn g" href="tel:+' + esc(h.contact_phone) + '">' + ic('phone') + 'Call caretaker</a>';
    else if (h.has_phone) act += '<button class="btn g" data-hs="signin">' + ic('key') + 'Sign in to see the phone</button>';
    var own = h.mine ? '<button class="act" data-hs="vm" data-id="' + esc(h.id) + '" aria-label="One room less">- 1 room</button><button class="act" data-hs="vp" data-id="' + esc(h.id) + '" aria-label="One room more">+ 1 room</button>'
      + '<button class="act" data-hs="addph" data-id="' + esc(h.id) + '">' + ic('cam') + 'Add photos</button><button class="act" data-hs="rm" data-id="' + esc(h.id) + '">Remove</button>'
      : X.xmsg(h, 'caretaker') + X.xrep(h);
    return '<article class="box g"><div class="flex items-center justify-between"><span><span class="badge hsv' + (full ? ' full' : '') + '">' + (full ? 'Full' : h.vacancies + (h.vacancies === 1 ? ' room vacant' : ' rooms vacant')) + '</span><span class="badge" style="margin-left:6px">@' + esc(h.zone) + '</span>' + d + '</span>' + X.xwhen(h) + '</div>'
      + photos
      + '<p style="margin:12px 0 2px;font-weight:600;font-size:16px;overflow-wrap:anywhere">' + esc(h.name) + '</p>'
      + (h.rent ? '<p style="margin:0 0 8px;font-weight:600">' + kes(h.rent) + ' <span class="sub">a month</span></p>' : '')
      + (h.room_types ? '<p class="sub" style="margin:0 0 8px">Rooms: ' + esc(h.room_types) + '</p>' : '')
      + (am ? '<div style="margin:4px 0 6px"><span class="sub" style="display:block;margin-bottom:6px">Services included</span>' + am + '</div>' : '')
      + (h.address ? '<p class="sub" style="margin:0 0 6px;overflow-wrap:anywhere">' + ic('pin') + esc(h.address) + '</p>' : '')
      + (h.review ? '<p class="sub" style="margin:0 0 6px;overflow-wrap:anywhere">' + esc(h.review) + '</p>' : '')
      + (act ? '<div class="hsa">' + act + '</div>' : '')
      + '<div class="bar">' + (h.mine ? '' : '') + own + '</div></article>';
  }
  function reviewCard(h) {
    return '<article class="box g"><div class="flex items-center justify-between"><span><span class="badge">@' + esc(h.zone) + '</span>' + (h.rating ? '<span class="badge" style="margin-left:6px">' + h.rating + '/5</span>' : '') + '</span>' + X.xwhen(h) + '</div>'
      + '<p style="margin:12px 0 2px;font-weight:600">' + esc(h.name) + '</p>' + (h.rent ? '<p class="sub" style="margin:0 0 8px">' + kes(h.rent) + ' a month</p>' : '')
      + '<p class="sub" style="margin:0 0 12px;overflow-wrap:anywhere">' + esc(h.review || '') + '</p>'
      + '<div class="bar">' + (h.mine ? '<button class="act" data-hs="rm" data-id="' + esc(h.id) + '">Remove</button>' : X.xrep(h)) + '</div></article>';
  }

  /* ---------- forms ---------- */
  function registerCard(s) {
    return '<article class="box g hsf"><b style="font-size:15px">Register as a hostel caretaker</b>'
      + '<p class="sub" style="margin:6px 0 0">Caretakers register once, then post vacancies with the exact location, room photos and the services included. Comrades see them in Explore and get directions.</p>'
      + '<div id="hsrg"><label class="l" for="hs_rph">M-Pesa number to pay with</label>' + inp('hs_rph', 'M-Pesa number, e.g. 0712345678', 10, ' inputmode="numeric"')
      + '<div class="rw" style="margin-top:12px"><span><b>Registration fee</b></span><b>' + kes(CFG ? CFG.fee : 0) + '</b></div>'
      + '<p class="note" id="hs_re" style="color:var(--fg)"></p>'
      + '<div class="bar" style="margin-top:12px"><button class="btn p" data-hs="reg-pay">Pay with M-Pesa</button><button class="act" data-hs="cancel">Cancel</button></div></div></article>';
  }
  function vacancyForm(s) {
    var ph = (s.photos || []).map(function (p, i) { return '<span class="hsp"><img src="' + esc(p.url) + '" alt=""><button type="button" class="act" data-hs="rmph" data-i="' + i + '" aria-label="Remove photo">x</button></span>'; }).join('');
    var loc = s.loc ? '<div class="hsl ok">' + ic('pin') + '<span>Location saved (' + s.loc.lat.toFixed(5) + ', ' + s.loc.lng.toFixed(5) + '), accurate to ' + s.loc.accuracy + ' m</span></div>'
      : '<div class="hsl">' + ic('pin') + '<span>Stand at the hostel gate and tap the button, so comrades get exact directions.</span></div>';
    return '<article class="box g hsf"><b style="font-size:15px">Post a vacancy</b>'
      + '<p class="sub" style="margin:6px 0 0">Use the real hostel. No phone numbers or links in the text; put your number in the phone box.</p>'
      + inp('hs_n', 'Hostel name, e.g. Sunrise Hostel', 60) + inp('hs_r', 'Monthly rent in KSh, e.g. 4500', 6, ' inputmode="numeric"') + inp('hs_v', 'Rooms vacant now, e.g. 3 (0 if full)', 3, ' inputmode="numeric"')
      + '<div style="margin-top:10px">' + sel('hs_z', 'Zone', ZONES) + '</div>'
      + '<label class="l">Room types</label><div>' + chips('hs_rt_', ROOMS) + '</div>'
      + '<label class="l">Services included in the rent</label><div>' + chips('hs_am_', AMEN) + '</div>'
      + inp('hs_a', 'Landmark and directions, e.g. 200 m past the gate, blue door', 160)
      + inp('hs_p', 'Caretaker phone, e.g. 0712345678 (signed-in comrades only)', 10, ' inputmode="numeric"')
      + loc + '<div class="bar" style="margin-top:10px"><button class="btn g" data-hs="loc">' + ic('pin') + (s.loc ? 'Update location' : 'Use my real location') + '</button></div>'
      + '<label class="l">Room photos (' + (s.photos || []).length + ' of ' + MAXP + ')</label><div>' + ph + '</div><div class="bar"><button class="btn g" data-hs="pick">' + ic('cam') + 'Add room photos</button></div>'
      + inp('hs_d', 'Anything else comrades should know', 400)
      + '<div class="bar" style="margin-top:14px"><button class="btn p" data-hs="save-vacancy">Post vacancy</button><button class="act" data-hs="cancel">Cancel</button></div></article>';
  }
  function reviewForm() {
    return '<article class="box g hsf"><b style="font-size:15px">Review a hostel</b>' + inp('hs_n', 'Hostel name, e.g. Sunrise Hostel', 60) + inp('hs_r', 'Monthly rent in KSh, e.g. 4500', 6, ' inputmode="numeric"')
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">' + sel('hs_z', 'Zone', ZONES)
      + '<select id="hs_q" aria-label="Rating">' + ['5/5 Excellent', '4/5 Good', '3/5 Fair', '2/5 Poor', '1/5 Bad'].map(function (x, i) { return '<option value="' + (5 - i) + '"' + (i === 1 ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>'
      + inp('hs_d', 'Your honest review, no names or numbers', 400)
      + '<div class="bar" style="margin-top:14px"><button class="btn p" data-hs="save-review">Post review</button><button class="act" data-hs="cancel">Cancel</button></div></article>';
  }

  /* ---------- the screen ---------- */
  var s0 = X.exs('hs'); if (!s0.kind) s0.kind = 'vacancy';
  X.XP.hs = function (s, L) {
    s.kind = s.kind || 'vacancy';
    var h = '<p class="sub">Find hostels with vacant rooms, see photos, the exact location and directions. Caretakers can post vacancies. Comrades can also review hostels honestly.</p>';
    var form = s.mode === 'register' ? registerCard(s) : s.mode === 'vacancy' ? vacancyForm(s) : s.mode === 'review' ? reviewForm() : '';
    h += '<button class="btn p" data-hs="add-vacancy" style="width:100%">' + ic('plus') + 'Post a vacancy (caretakers)</button><button class="btn g" data-hs="add-review" style="width:100%;margin-top:8px">Review a hostel</button>' + form;
    h += '<div class="tabs z" style="padding:0"><button class="tab g' + (s.kind === 'vacancy' ? ' on' : '') + '" data-hs="kind" data-k="vacancy">Vacancies</button><button class="tab g' + (s.kind === 'review' ? ' on' : '') + '" data-hs="kind" data-k="review">Reviews</button>'
      + (s.kind === 'vacancy' ? '<button class="tab g' + (s.only ? ' on' : '') + '" data-hs="only">Rooms available</button><button class="tab g' + (s.near ? ' on' : '') + '" data-hs="near">' + ic('pin') + (s.near ? 'Nearest first' : 'Near me') + '</button>' : '') + '</div>';
    h += X.zchips(s);
    var list = L.slice();
    if (s.kind === 'vacancy') {
      if (s.only) list = list.filter(function (x) { return x.vacancies > 0; });
      list.sort(function (a, b) { return ((b.vacancies > 0) - (a.vacancies > 0)) || (s.near ? (hasLoc(a) ? km(s.near, a) : 1e9) - (hasLoc(b) ? km(s.near, b) : 1e9) : 0); });
      h += list.length ? list.map(function (x) { return card(x, s); }).join('') : X.xempty(s, s.only ? 'No hostel with free rooms here right now.' : 'No vacancies here yet. Are you a caretaker? Post yours.');
    } else {
      h += list.length ? list.map(reviewCard).join('') : X.xempty(s, 'No hostel reviews here yet. Be the first.');
    }
    return h + X.xmore(s);
  };

  /* ---------- actions ---------- */
  function readVacancy(s) {
    var n = val('hs_n'), rent = parseInt(val('hs_r'), 10), vac = parseInt(val('hs_v'), 10), ph = val('hs_p').replace(/\s/g, '');
    if (n.length < 2) return say('Add the hostel name') || null;
    if (!(rent >= 1)) return say('Add the monthly rent in KSh') || null;
    if (!(vac >= 0)) return say('Add how many rooms are vacant (0 if full)') || null;
    if (!s.loc) return say('Tap Use my real location while you are at the hostel') || null;
    if (!(s.photos || []).length) return say('Add at least one room photo so comrades can see the rooms') || null;
    if (ph && !okPhone(ph)) return say('Phone number like 0712345678') || null;
    return { kind: 'vacancy', name: n, zone: val('hs_z'), rent: rent, vacancies: vac, room_types: picked('hs_rt_', ROOMS), amenities: picked('hs_am_', AMEN), address: val('hs_a'), review: val('hs_d'), contact_phone: ph, lat: s.loc.lat, lng: s.loc.lng, accuracy: s.loc.accuracy };
  }
  async function pay(b, s) {
    var ph = val('hs_rph').replace(/\s/g, ''), box = $('#hsrg'), err = $('#hs_re');
    if (!okPhone(ph)) { err.textContent = 'Enter a Safaricom or Airtel number like 0712345678.'; return; }
    var P = document.createElement('div'); box.textContent = ''; box.appendChild(P);
    var ps = window.ccSteps && window.ccSteps.paySteps(P, ph, CFG.fee, 'plan');
    try {
      var d = await X.call('/api/hostels/caretaker/register', { body: { phone: ph } });
      if (d.registered) { CFG.registered = true; s.mode = 'vacancy'; return X.paintX(); }
      if (ps) ps.go('prompt');
      await window.CC.waitPaid(d.id, function (st) { if (ps) ps.go(st); });
      if (ps) ps.go('done'); await new Promise(function (r) { setTimeout(r, 1100); });
      if (ps) ps.stop();
      CFG.registered = true; s.mode = 'vacancy'; say('You are registered. Post your vacancy.'); X.paintX();
    } catch (x) {
      if (ps) { if (x.pending) ps.stop(); else ps.fail(x.message); }
      P.appendChild(Object.assign(document.createElement('p'), { className: 'note', textContent: x.message, style: 'margin-top:12px' }));
      var again = document.createElement('button'); again.className = 'btn g'; again.textContent = 'Back'; again.style.marginTop = '12px';
      again.onclick = async function () { try { await loadCfg(true); } catch (e) {} if (CFG && CFG.registered) s.mode = 'vacancy'; X.paintX(); }; P.appendChild(again);
    }
  }
  async function onClick(e) {
    var b = e.target.closest('[data-hs]'); if (!b || !$('#xbody') || !$('#xbody').contains(b)) return;
    e.stopImmediatePropagation(); e.preventDefault();
    var s = X.exs('hs'), a = b.dataset.hs, id = b.dataset.id, item = id ? s.items.filter(function (y) { return y.id === id; })[0] : null;
    try {
      if (a === 'zoom') return zoom(b.dataset.src);
      if (a === 'cancel') { s.mode = ''; s.loc = null; s.photos = []; return X.paintX(); }
      if (a === 'kind') { s.kind = b.dataset.k; s.mode = ''; s.items = []; s.loaded = false; return X.loadX('hs', true); }
      if (a === 'only') { s.only = !s.only; return X.paintX(); }
      if (a === 'signin') { await X.ensureAccount(); s.loaded = false; return X.loadX('hs', true); }
      if (a === 'near') {
        if (s.near) { s.near = null; return X.paintX(); }
        b.disabled = true; try { var l = await getLoc(); s.near = { lat: l.lat, lng: l.lng }; } catch (er) { say(er.message); } return X.paintX();
      }
      if (a === 'add-review') { s.mode = 'review'; return X.paintX(); }
      if (a === 'add-vacancy') {                                          // caretakers must be signed up, and registered when the admin set a fee
        await X.ensureAccount(); b.disabled = true;
        try { await loadCfg(true); } catch (er) { b.disabled = false; return say(er.message || 'Could not check your registration. Try again.'); }
        s.mode = CFG.registered ? 'vacancy' : 'register'; s.photos = s.photos || []; return X.paintX();
      }
      if (a === 'reg-pay') { b.disabled = true; return pay(b, s); }
      if (a === 'loc') {
        b.disabled = true; b.textContent = 'Getting location...';
        try { var p = await getLoc(); if (p.accuracy > 300) { s.loc = null; say('Location is only accurate to ' + p.accuracy + ' m. Stand at the hostel gate, switch on GPS and try again.'); } else { s.loc = p; say('Location saved'); } }
        catch (er) { s.loc = null; say(er.message); }
        return X.paintX();
      }
      if (a === 'pick') { fi.dataset.t = 'form'; return fi.click(); }
      if (a === 'addph') { fi.dataset.t = id; return fi.click(); }
      if (a === 'rmph') { var r = (s.photos || []).splice(+b.dataset.i, 1)[0]; if (r) URL.revokeObjectURL(r.url); return X.paintX(); }
      if ((a === 'vm' || a === 'vp') && item) {
        var n = Math.max(0, (item.vacancies || 0) + (a === 'vp' ? 1 : -1)); b.disabled = true;
        var d = await X.call('/api/hostels/' + id + '/vacancies', { body: { vacancies: n } }); item.vacancies = d.vacancies; return X.paintX();
      }
      if (a === 'rm' && item) {
        if (!window.confirm('Remove this hostel post?')) return;
        await X.call('/api/hostels/' + id + '/remove', { body: {} }); s.items = s.items.filter(function (y) { return y.id !== id; }); say('Removed'); return X.paintX();
      }
      if (a === 'save-review') {
        var n2 = val('hs_n'), rv = val('hs_d'); if (n2.length < 2 || rv.length < 3) return say('Add the hostel name and your review');
        b.disabled = true;
        var ok = await X.createX('hs', { kind: 'review', name: n2, zone: val('hs_z'), rent: parseInt(val('hs_r'), 10) || null, rating: +val('hs_q') || null, review: rv });
        b.disabled = false; if (ok) { s.mode = ''; s.kind = 'review'; s.items = s.items.filter(function (x) { return x.kind === 'review'; }); X.doneX('hs', 2, 'Reviewed a hostel'); }
        return;
      }
      if (a === 'save-vacancy') {
        var body = readVacancy(s); if (!body) return;
        b.disabled = true; var blobs = (s.photos || []).slice(), failed = 0;
        var ok2 = await X.createX('hs', body, async function (d2) {
          d2.photos = [];
          for (var i = 0; i < blobs.length; i++) {
            b.textContent = 'Uploading photo ' + (i + 1) + ' of ' + blobs.length + '...';
            try { d2.photos = d2.photos.concat(await uploadOne(d2.id, blobs[i].blob)); } catch (er) { failed++; }
          }
        });
        b.disabled = false;
        if (ok2) {
          blobs.forEach(function (p) { URL.revokeObjectURL(p.url); }); s.photos = []; s.loc = null; s.mode = ''; s.kind = 'vacancy'; s.items = s.items.filter(function (x) { return x.kind === 'vacancy'; });
          if (failed) say(failed + ' photo' + (failed > 1 ? 's' : '') + ' did not upload. Tap Add photos on your post to try again.');
          X.doneX('hs', 3, 'Posted a vacancy');
        }
      }
    } catch (err) { say(err.message || 'Something went wrong'); if (b && b.disabled) b.disabled = false; }
  }
  window.addEventListener('click', onClick, true);                       // window capture runs before the Explore handler, so only data-hs buttons are taken
  window.ccHostels = { getLoc: getLoc };
  try { if (X.xt === 'hs') X.paintX(); } catch (e) {}
})();
