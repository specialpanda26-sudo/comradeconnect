/* cc-hostels-post.js v1: hostel vacancy posting in the app. Loaded after cc-maps.js.
   Caretakers register once (the admin sets the fee, 0 = free), then post a vacancy with their real GPS location,
   room photos, the room types and the services included. Owners can change the rooms left or remove a post.
   It only wraps existing actions. Nothing is removed. */
(function () {
'use strict';
if (window.ccHostelPost) return;
var M = window.ccMaps && window.ccMaps.x;
if (!M || typeof A === 'undefined') return;
var q = function (s, r) { return (r || document).querySelector(s); };
var qa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = M.esc, say = M.say, call = M.call, icon = M.icon;
var ROOMS = ['Single', 'Bedsitter', 'Double', 'Shared', 'One bedroom'];
var AMEN = ['Water', 'Electricity', 'Wi-Fi', 'Security', 'Laundry', 'Parking', 'Gas', 'Furnished', 'CCTV', 'Shower', 'Study room'];
var MAXP = 8, CFG = null, MINE = [], fi = null;
var kes = function (n) { return 'KES ' + Number(n || 0).toLocaleString('en-KE'); };
var okPhone = function (v) { return /^(07|01)\d{8}$/.test(v); };

function loadCfg(force) {
  if (CFG && !force) return Promise.resolve(CFG);
  return call('GET', '/api/hostels/caretaker').then(function (d) {
    CFG = d; if (d.amenities && d.amenities.length) AMEN = d.amenities; if (d.rooms && d.rooms.length) ROOMS = d.rooms; if (d.photos) MAXP = d.photos; return d;
  });
}
function reopen() {
  var t = S.stack[S.stack.length - 1];
  if (t && t.name === 'sec' && t.arg === 'hostels') S.stack.pop();
  A.sec('hostels');
}
function chipRow(attr, list) {
  return '<div class="chips cchv-c">' + list.map(function (n) { return '<button type="button" class="chip" ' + attr + '="' + esc(n) + '">' + esc(n) + '</button>'; }).join('') + '</div>';
}
function picked(sh, attr) { return qa('[' + attr + '].on', sh).map(function (b) { return b.getAttribute(attr); }); }
function fld(l, i) { return '<div class="fld"><label>' + l + '</label>' + i + '</div>'; }

/* ---------- photos ---------- */
function pickFiles() {
  return new Promise(function (res) {
    if (fi && fi.parentNode) fi.parentNode.removeChild(fi);
    fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/jpeg,image/png,image/webp'; fi.multiple = true; fi.hidden = true;
    fi.onchange = function () { res(Array.prototype.slice.call(fi.files || [])); };
    document.body.appendChild(fi); fi.click();
  });
}
function uploadOne(hostelId, file) {
  var type = (file.type || 'image/jpeg').toLowerCase().split(';')[0];
  if (['image/jpeg', 'image/png', 'image/webp'].indexOf(type) < 0) return Promise.reject(new Error('Use a JPG, PNG or WebP photo.'));
  if (file.size > 12 * 1048576) return Promise.reject(new Error('That photo is over 12 MB. Pick a smaller one.'));
  return call('POST', '/api/media/upload-url', { kind: 'hostel_photo', content_type: type, bytes: file.size, hostel_id: hostelId }).then(function (d) {
    var fd = new FormData(); fd.append('cacheControl', '3600'); fd.append('', new Blob([file], { type: type }));
    return fetch(d.upload_url, { method: 'PUT', body: fd }).then(function (r) {
      if (!r.ok) throw new Error('A photo did not upload (' + r.status + ').');
      return call('POST', '/api/media/' + d.id + '/complete', {});
    }, function () { throw new Error('A photo did not go through. Check your connection.'); });
  });
}

/* ---------- registration ---------- */
function registerSheet() {
  var fee = CFG ? CFG.fee : 0;
  openSheet('Register as a caretaker',
    '<div class="card" style="margin-bottom:12px"><div class="eyebrow">One-time fee</div><div style="font-size:30px;font-weight:800;letter-spacing:-.04em">' + kes(fee) + '</div></div>'
    + '<p class="sub1" style="margin-bottom:10px">Caretakers register once. Then you can post vacant rooms with your exact location on the map, room photos and the services included. Comrades find you on the Hostel map and get directions.</p>'
    + '<p class="note" style="margin:0 0 12px">Only register if you manage or own the hostel. Fake posts are removed and the account can be banned.</p>'
    + '<button type="button" class="btn o" id="chr-go">Pay ' + kes(fee) + ' and register</button>',
    function (sh) {
      q('#chr-go', sh).onclick = function () {
        closeSheet();
        A.payflow(fee, 'Hostel caretaker registration', function () {
          if (CFG) CFG.registered = true; say('You are registered. Post your vacancy.'); setTimeout(vacancyForm, 350);
        }, { ctx: { purpose: 'caretaker' } });
      };
    });
}

/* ---------- the vacancy form ---------- */
function vacancyForm() {
  var st = { loc: null, files: [] }, zones = typeof ZONES !== 'undefined' ? ZONES : [];
  openSheet('Post a vacancy',
    '<div class="cchv">'
    + fld('Hostel name', '<input class="in" id="hv-n" maxlength="60" autocomplete="off" placeholder="Sunrise Hostel">')
    + '<div class="two">' + fld('Rent per month (KES)', '<input class="in" id="hv-r" type="number" inputmode="numeric" min="1" max="200000" placeholder="4500">') + fld('Rooms vacant now', '<input class="in" id="hv-v" type="number" inputmode="numeric" min="0" max="500" placeholder="3">') + '</div>'
    + fld('Zone', '<select class="in" id="hv-z">' + zones.map(function (z) { return '<option>' + esc(z) + '</option>'; }).join('') + '</select>')
    + fld('Room types', chipRow('data-rt', ROOMS))
    + fld('Services included in the rent', chipRow('data-am', AMEN))
    + fld('Landmark and directions', '<input class="in" id="hv-a" maxlength="160" autocomplete="off" placeholder="200 m past the gate, blue door">')
    + fld('Caretaker phone (signed-in comrades only)', '<input class="in" id="hv-p" type="tel" inputmode="tel" maxlength="10" placeholder="0712345678">')
    + '<div class="fld"><label>Exact location</label><button type="button" class="btn w" id="hv-lb">' + icon('pin') + ' Use my real location</button><p class="note" id="hv-ls">Stand at the hostel gate, switch on GPS, then tap. Comrades get exact directions.</p><div id="hv-map" hidden></div></div>'
    + '<div class="fld"><label>Room photos (<span id="hv-pc">0</span> of ' + MAXP + ')</label><div class="cchv-ph" id="hv-ph"></div><button type="button" class="btn w" id="hv-pb">' + icon('plus') + ' Add room photos</button><p class="note">At least one photo, so comrades can see the rooms.</p></div>'
    + fld('Anything else comrades should know', '<textarea class="in" id="hv-d" maxlength="400"></textarea>')
    + '<label class="ccchk"><input type="checkbox" id="hv-ok"> I manage this hostel or have the owner\'s permission to post it</label>'
    + '<button type="button" class="btn o" id="hv-go">Post vacancy</button>'
    + '<p class="note">No phone numbers or links in the text. Put your number in the phone box.</p></div>',
    function (sh) {
      var $ = function (s) { return q(s, sh); };
      qa('[data-rt],[data-am]', sh).forEach(function (b) { b.onclick = function () { b.classList.toggle('on'); }; });
      function paintPh() {
        $('#hv-pc').textContent = st.files.length;
        var box = $('#hv-ph'); box.innerHTML = '';
        st.files.forEach(function (f, i) {
          var w = document.createElement('span'); w.className = 'cchv-p';
          var im = document.createElement('img'); im.alt = 'Room photo ' + (i + 1); im.src = f.url;
          var x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Remove photo'); x.textContent = 'x';
          x.onclick = function () { try { URL.revokeObjectURL(f.url); } catch (e) {} st.files.splice(i, 1); paintPh(); };
          w.appendChild(im); w.appendChild(x); box.appendChild(w);
        });
      }
      $('#hv-pb').onclick = function () {
        pickFiles().then(function (fs) {
          fs.forEach(function (f) {
            if (!/^image\//.test(f.type)) return say('Room photos only. Videos are not allowed here.');
            if (st.files.length >= MAXP) return say('Up to ' + MAXP + ' photos');
            st.files.push({ file: f, url: URL.createObjectURL(f) });
          });
          paintPh();
        });
      };
      $('#hv-lb').onclick = function () {
        var b = this; b.disabled = true; $('#hv-ls').textContent = 'Finding you...';
        M.locate(true).then(function (m) {
          b.disabled = false; st.loc = m.acc > 300 ? null : m;
          $('#hv-ls').textContent = m.acc > 300 ? 'Not accurate enough (' + m.acc + ' m). Stand at the hostel gate, switch on GPS and try again.' : 'Location saved, accurate to ' + m.acc + ' m.';
          if (st.loc) { var box = $('#hv-map'); box.hidden = false; box.innerHTML = '<div class="ccmini-map" data-lat="' + m.lat + '" data-lng="' + m.lng + '"></div>'; M.mountMini(box.firstChild); }
        }, function (e) { b.disabled = false; $('#hv-ls').textContent = e.message; });
      };
      $('#hv-go').onclick = function () {
        var name = $('#hv-n').value.trim(), rent = parseInt($('#hv-r').value, 10), vac = parseInt($('#hv-v').value, 10), ph = $('#hv-p').value.replace(/\s/g, ''), rt = picked(sh, 'data-rt');
        if (name.length < 2) return say('Add the hostel name');
        if (!(rent >= 1)) return say('Add the monthly rent in KES');
        if (!(vac >= 0)) return say('Add how many rooms are vacant (0 if full)');
        if (!rt.length) return say('Pick at least one room type');
        if (!st.loc) return say('Tap Use my real location while you are at the hostel');
        if (!st.files.length) return say('Add at least one room photo');
        if (ph && !okPhone(ph)) return say('Phone number like 0712345678');
        if (!$('#hv-ok').checked) return say('Tick the box to confirm you may post this hostel');
        var go = this, files = st.files.slice(), failed = 0; go.disabled = true; go.textContent = 'Posting...';
        call('POST', '/api/c/hostels', { kind: 'vacancy', name: name, zone: $('#hv-z').value, rent: rent, vacancies: vac, room_types: rt, amenities: picked(sh, 'data-am'), address: $('#hv-a').value.trim(), review: $('#hv-d').value.trim(), contact_phone: ph, lat: st.loc.lat, lng: st.loc.lng, accuracy: st.loc.acc }).then(function (d) {
          var i = 0;
          function next() {
            if (i >= files.length) return Promise.resolve();
            var f = files[i++]; go.textContent = 'Uploading photo ' + i + ' of ' + files.length + '...';
            return uploadOne(d.id, f.file).catch(function () { failed++; }).then(next);
          }
          return next();
        }).then(function () {
          files.forEach(function (f) { try { URL.revokeObjectURL(f.url); } catch (e) {} });
          closeSheet(); say(failed ? failed + ' photo' + (failed > 1 ? 's' : '') + ' did not upload. Open Your vacancies and tap Add photos.' : 'Vacancy posted. Comrades can find it on the Hostel map.');
          reopen();
        }, function (e) {
          go.disabled = false; go.textContent = 'Post vacancy';
          if (e && e.status === 403) { loadCfg(true).then(function () { closeSheet(); if (!CFG.registered) registerSheet(); }, function () {}); }
          say(e.message);
        });
      };
    });
}

/* ---------- entry point: the "Post a vacancy" button ---------- */
var _sf = A.secform;
A.secform = function (id) {
  if (id !== 'hostels') return _sf.apply(this, arguments);
  if (!M.signedIn()) return M.needAcct();
  loadCfg(true).then(function (c) { if (c.registered) vacancyForm(); else registerSheet(); }, function (e) { say(e.message || 'Could not check your registration. Try again.'); });
};

/* ---------- "Your vacancies" card on top of the Hostels page ---------- */
function loadMine() {
  if (!M.signedIn()) { MINE = []; return Promise.resolve(); }
  return call('GET', '/api/c/hostels?kind=vacancy&limit=30').then(function (d) {
    MINE = (d.items || []).filter(function (x) { return x.mine && x.kind === 'vacancy'; }); try { refresh(); } catch (e) {}
  }, function () {});
}
var _pre = SEC.hostels && SEC.hostels.pre;
if (SEC.hostels) SEC.hostels.pre = function () {
  var h = _pre ? _pre.apply(this, arguments) : '';
  if (!MINE.length) return h;
  return h + '<div class="card" style="margin:12px 0"><b>Your vacancies</b>' + MINE.map(function (x) {
    var n = x.vacancies || 0, id = esc(x.id);
    return '<div class="cchv-o"><div><b>' + esc(x.name) + '</b><small>' + (n > 0 ? n + (n === 1 ? ' room left' : ' rooms left') : 'Full') + ' · ' + (x.photos || []).length + ' photo' + ((x.photos || []).length === 1 ? '' : 's') + '</small></div>'
      + '<div class="cchv-b"><button type="button" class="btn w sm" data-act="hvown" data-arg="' + id + '|m" aria-label="One room less">- 1</button><button type="button" class="btn w sm" data-act="hvown" data-arg="' + id + '|p" aria-label="One room more">+ 1</button>'
      + '<button type="button" class="btn w sm" data-act="hvown" data-arg="' + id + '|ph">' + icon('plus') + ' Photos</button><button type="button" class="btn w sm" data-act="hvown" data-arg="' + id + '|rm">Remove</button></div></div>';
  }).join('') + '</div>';
};
A.hvown = function (a) {
  var p = String(a).split('|'), id = p[0], op = p[1], x = MINE.filter(function (m) { return m.id === id; })[0];
  if (!x || !M.signedIn()) return;
  if (op === 'm' || op === 'p') {
    var n = Math.max(0, (x.vacancies || 0) + (op === 'p' ? 1 : -1));
    return call('POST', '/api/hostels/' + id + '/vacancies', { vacancies: n }).then(function (d) { x.vacancies = d.vacancies; reopen(); }, function (e) { say(e.message); });
  }
  if (op === 'rm') {
    if (!window.confirm('Remove this hostel post?')) return;
    return call('POST', '/api/hostels/' + id + '/remove', {}).then(function () { say('Removed'); reopen(); }, function (e) { say(e.message); });
  }
  if (op === 'ph') {
    var have = (x.photos || []).length;
    return pickFiles().then(function (fs) {
      fs = fs.slice(0, Math.max(0, MAXP - have)); if (!fs.length) return say('This post already has ' + MAXP + ' photos');
      var i = 0, bad = 0;
      (function next() {
        if (i >= fs.length) { say(bad ? bad + ' photo' + (bad > 1 ? 's' : '') + ' did not upload' : 'Photos added'); return reopen(); }
        say('Uploading photo ' + (i + 1) + ' of ' + fs.length + '...');
        uploadOne(id, fs[i++]).catch(function () { bad++; }).then(next);
      })();
    });
  }
};
var _sec = A.sec;
A.sec = function (a) { var r = _sec.apply(this, arguments); if (a === 'hostels') loadMine(); return r; };

window.ccHostelPost = { reload: loadMine };
})();
