/* cc-me.js v1: edit your username and profile picture from the Me page.
   Replaces the "Edit profile" sheet from cc-profile.js (bio stays). Loaded after cc-profile.js. */
(function () {
  'use strict';
  if (window.__ccMe) return; window.__ccMe = 1;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var say = function (m) { try { toast(m); } catch (e) {} };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var call = function (p, o) { return window.CC ? CC.call(p, o) : Promise.reject(new Error('Not ready yet. Reload the page and try again.')); };
  var aid = function () { try { var a = window.ccAuth && ccAuth(); return a && a.aid && a.token ? a.aid : ''; } catch (e) { return ''; } };
  var key = function () { return 'cc_avatar:' + aid(); };            // ends with :aid, so signing out wipes it
  var getAv = function () { try { return aid() ? localStorage.getItem(key()) || '' : ''; } catch (e) { return ''; } };
  var setAv = function (v) { try { if (v) localStorage.setItem(key(), v); else localStorage.removeItem(key()); } catch (e) {} };
  var USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:34px;height:34px"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
  var CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:18px;height:18px"><path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="4"/></svg>';

  var css = document.createElement('style');
  css.textContent = '#mav.ccm-has{padding:0;overflow:hidden}#mav.ccm-has img{width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit}'
    + '.ccm-sh{position:fixed;inset:0;z-index:9999;background:rgba(14,15,11,.8);display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto}'
    + '.ccm-pic{width:96px;height:96px;border-radius:50%;margin:0 auto;display:grid;place-items:center;overflow:hidden;border:1.5px solid var(--line,rgba(255,255,255,.25))}'
    + '.ccm-pic img{width:100%;height:100%;object-fit:cover}'
    + '.ccm-r{display:flex;justify-content:center;gap:8px;margin-top:10px}';
  document.head.appendChild(css);

  function paintAvatar() {
    var av = $('#mav'); if (!av) return;
    var d = getAv();
    if (d) { if (!av.querySelector('img') || av.querySelector('img').src !== d) av.innerHTML = '<img alt="Your profile picture" src="' + d + '">'; av.classList.add('ccm-has'); }
    else { av.classList.remove('ccm-has'); if (av.querySelector('img')) av.textContent = (window.ME && ME.handle ? ME.handle[0] : '').toUpperCase(); }
  }
  var synced = '';
  function syncAvatar() {
    var a = aid(); if (!a || synced === a) return; synced = a;
    call('/api/me/avatar', { method: 'GET' }).then(function (d) { if (aid() !== a) return; setAv(d && d.avatar || ''); paintAvatar(); }).catch(function () { synced = ''; });
  }
  try { var d0 = drawMe; drawMe = function () { var r = d0.apply(this, arguments); try { paintAvatar(); syncAvatar(); } catch (e) {} return r; }; } catch (e) {}

  /* square 192px JPEG from any photo, small enough to keep on the profile */
  function shrink(file) {
    return new Promise(function (ok, bad) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        try {
          var s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 192;
          c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 192, 192);
          var q = 0.85, out = c.toDataURL('image/jpeg', q);
          while (out.length > 60000 && q > 0.3) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
          URL.revokeObjectURL(url); ok(out);
        } catch (e) { bad(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); bad(new Error('That file is not a photo')); };
      img.src = url;
    });
  }

  function openEdit() {
    var a = aid(); if (!a) { say('Sign in first, then edit your profile'); try { go('me'); } catch (e) {} return; }
    var handle = (window.ME && ME.handle) || '', bio = ''; try { bio = ST.get('cc_bio', ''); } catch (e) {}
    var pic = getAv(), newPic = null, removePic = false;
    var m = document.createElement('div'); m.className = 'ccm-sh';
    m.innerHTML = '<div class="box g" style="max-width:360px;width:100%"><h3>Edit profile</h3>'
      + '<div class="ccm-pic" id="ccm-p" style="margin-top:12px"></div>'
      + '<div class="ccm-r"><button type="button" class="btn g" id="ccm-ch" style="display:inline-flex;align-items:center;gap:6px">' + CAM + 'Change photo</button><button type="button" class="btn g" id="ccm-rm">Remove</button></div>'
      + '<input type="file" id="ccm-f" accept="image/*" hidden>'
      + '<label class="sub" style="display:block;margin-top:14px">Username</label>'
      + '<div class="fld"><input id="ccm-u" maxlength="20" autocapitalize="off" autocomplete="off" aria-label="Username" placeholder="3 to 20 letters, numbers or _"></div>'
      + '<label class="sub" style="display:block;margin-top:6px">Bio</label>'
      + '<div class="fld"><textarea id="ccm-b" maxlength="100" style="height:72px;resize:none" placeholder="Write a short bio (no numbers or links)" aria-label="Bio"></textarea></div>'
      + '<p class="sub" id="ccm-e" style="color:var(--bad,#E58A90);min-height:18px;margin:0"></p>'
      + '<div class="two" style="margin-top:8px"><button class="btn g" id="ccm-x">Cancel</button><button class="btn p" id="ccm-s">Save</button></div></div>';
    document.body.appendChild(m);
    var u = $('#ccm-u', m), b = $('#ccm-b', m), p = $('#ccm-p', m);
    u.value = handle; b.value = bio;
    function drawPic() { var s = newPic || (removePic ? '' : pic); p.innerHTML = s ? '<img alt="" src="' + s + '">' : USER; }
    drawPic();
    $('#ccm-ch', m).onclick = function () { $('#ccm-f', m).click(); };
    $('#ccm-f', m).onchange = async function (e) {
      var f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try { newPic = await shrink(f); removePic = false; drawPic(); } catch (er) { $('#ccm-e', m).textContent = er.message || 'Could not use that photo'; }
    };
    $('#ccm-rm', m).onclick = function () { newPic = null; removePic = true; drawPic(); };
    $('#ccm-x', m).onclick = function () { m.remove(); };
    $('#ccm-s', m).onclick = async function () {
      var err = $('#ccm-e', m), btn = $('#ccm-s', m); err.textContent = '';
      var h = u.value.trim().replace(/^@/, ''), v = b.value.trim().slice(0, 100);
      if (!/^[A-Za-z0-9_]{3,20}$/.test(h)) { err.textContent = 'Username: 3 to 20 letters, numbers or _'; return; }
      try { if (v && typeof contactHit === 'function' && contactHit(v)) { err.textContent = 'No phone numbers, handles or links in your bio'; return; } } catch (e) {}
      btn.disabled = true;
      try {
        if (h !== handle) { var r = await call('/api/me/handle', { body: { handle: h } }); ME.handle = (r && r.handle) || h; saveMe(); }
        if (newPic || removePic) { await call('/api/me/avatar', { body: { data: newPic || '' } }); setAv(newPic || ''); }
        ST.set('cc_bio', v);
        m.remove(); try { drawMe(); } catch (e) {} paintAvatar();
        var bb = $('#ccp-bio'); if (bb) bb.textContent = v || 'No bio yet. Tap Edit profile to add one.';
        say('Profile saved');
      } catch (er) { err.textContent = er.message || 'Could not save'; btn.disabled = false; }
    };
  }

  /* take over the existing Edit profile button (capture phase runs before its own handler) */
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('#ccp-edit'); if (!t) return;
    e.stopPropagation(); e.preventDefault(); openEdit();
  }, true);
  window.addEventListener('load', function () { setTimeout(function () { paintAvatar(); syncAvatar(); }, 300); });
  paintAvatar();
})();
