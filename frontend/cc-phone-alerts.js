/* cc-phone-alerts.js: puts app news in the PHONE's notification panel (not the pop-up banner inside the app).
   - app updates, admin announcements, daily check-in reminder
   - account activity: deposits, withdrawals paid/rejected, refunds, gifts, sales, order and admin approvals
   Uses the native Android plugin @capacitor/local-notifications (needs the app rebuilt once with it). Does nothing on the website.
   Alerts while the app is fully closed come from the server (Firebase push); this file covers everything the app itself notices. */
(function () {
  'use strict';
  if (window.__ccPA) return; window.__ccPA = 1;
  var cap = window.Capacitor;
  if (!cap || !(cap.isNativePlatform && cap.isNativePlatform())) return;
  var LN = null;
  try { if (cap.isPluginAvailable && cap.isPluginAvailable('LocalNotifications')) LN = (cap.Plugins && cap.Plugins.LocalNotifications) || cap.registerPlugin('LocalNotifications'); } catch (e) { LN = null; }
  if (!LN) return;
  var CH = 'cc_alerts', DONE = 'ccpa_done', BASE = 'ccpa_base';
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function signed() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
  function call(p) { return window.ccCall ? window.ccCall(p, { auth: false }) : Promise.reject(new Error('not ready')); }
  function kes(n) { return 'KSh ' + Number(n || 0).toLocaleString('en-KE'); }
  function done() { try { var a = JSON.parse(ls(DONE) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function mark(k) { var a = done(); if (a.indexOf(k) < 0) { a.push(k); ls(DONE, JSON.stringify(a.slice(-300))); } }
  function hash(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 2147483000 + 1; }
  function on() { try { var o = JSON.parse(ls('cs_nt') || '{"n2":1}'); return o.n2 !== 0; } catch (e) { return true; } }

  function allowed() {
    return LN.checkPermissions().then(function (p) { if (p.display === 'granted') return true; if (p.display === 'denied') return false; return LN.requestPermissions().then(function (r) { return r.display === 'granted'; }); }).catch(function () { return false; });
  }
  function ensureChannel() { try { if (LN.createChannel) return Promise.resolve(LN.createChannel({ id: CH, name: 'Comrade Connect alerts', description: 'Account, updates and reminders', importance: 4, visibility: 1, vibration: true, lights: true })).catch(function () {}); } catch (e) {} return Promise.resolve(); }

  /* once-only alert: key makes sure the same news never shows twice */
  function post(key, title, body, extra) {
    if (!on() || done().indexOf(key) >= 0) return Promise.resolve(false);
    return allowed().then(function (ok) {
      if (!ok) return false;
      return ensureChannel().then(function () {
        return LN.schedule({ notifications: [{ id: hash(key), title: title, body: body, channelId: CH, schedule: { at: new Date(Date.now() + 800) }, extra: extra || {} }] });
      }).then(function () { mark(key); return true; });
    }).catch(function () { return false; });
  }

  /* ---------- 1. app update, admin announcements ---------- */
  function news() {
    try { var u = JSON.parse(ls('cc_upd_pending') || 'null'); if (u && u.n) post('upd' + u.n, 'Update available', 'A new version of Comrade Connect is ready. Tap to update.', { view: 'update' }); } catch (e) {}
    try {
      var C = JSON.parse(ls('cc_site_v1') || '{}') || {};
      if (C.notice_on && C.notice_text) post('nt' + hash(C.notice_text), C.notice_title || 'Notice', C.notice_text, { view: 'bell' });
      if (C.banner_on && C.banner_text) post('bn' + hash(C.banner_text), 'Announcement', C.banner_text, { view: 'bell' });
      if (C.maintenance_on) post('mt' + hash(C.maintenance_text || 'm'), 'Maintenance', C.maintenance_text || 'We are fixing something. Please check again in a little while.', { view: 'bell' });
    } catch (e) {}
  }

  /* ---------- 2. account activity: deposits, withdrawals, admin approvals ---------- */
  var KIND = { topup: 'Deposit received', gift: 'Gift received', refund: 'Refund received', sale: 'Sale paid to your wallet', referral: 'Invite reward added' };
  function account() {
    if (!signed()) return;
    var first = ls(BASE) === null, seeded = false;
    Promise.all([call('/api/wallet/stats').catch(function () { return null; }), call('/api/wallet').catch(function () { return null; }), call('/api/orders/mine').catch(function () { return null; })]).then(function (r) {
      var st = r[0], w = r[1], o = r[2], batch = [];
      ((st && st.ledger) || []).forEach(function (x) {
        var k = 'lg' + (x.id || [x.kind, x.amount, x.note, x.at || x.created_at || x.ts].join('|'));
        var t = KIND[x.kind]; if (!t || !(Number(x.amount) > 0)) { if (first) mark(k); return; }
        if (first) { mark(k); return; } batch.push([k, t, kes(x.amount) + (x.note ? '. ' + x.note : '') + ' Your wallet balance is updated.', { view: 'rewards' }]);
      });
      ((w && w.withdrawals) || []).forEach(function (x) {
        if (x.status !== 'paid' && x.status !== 'rejected' && x.status !== 'approved') return;
        var k = 'wd' + x.id + x.status; if (first) { mark(k); return; }
        if (x.status === 'paid') batch.push([k, 'Withdrawal paid', kes(x.net == null ? x.amount : x.net) + ' was sent to your M-Pesa' + (x.payout_ref ? '. Ref ' + x.payout_ref : '') + '.', { view: 'orders' }]);
        else if (x.status === 'approved') batch.push([k, 'Withdrawal approved', 'An admin approved your ' + kes(x.amount) + ' withdrawal. It is being sent.', { view: 'orders' }]);
        else batch.push([k, 'Withdrawal rejected', kes(x.amount) + ' is back in your wallet.', { view: 'orders' }]);
      });
      ((o && o.orders) || []).forEach(function (x) {
        var k = 'or' + x.id + x.status; if (first) { mark(k); return; }
        var m = { paid: 'Payment confirmed', released: x.role === 'seller' ? 'Order completed, money released' : 'Order completed', cancelled: 'Order cancelled', refunded: 'Order refunded', shipped: 'Order on the way' }[x.status];
        if (m) batch.push([k, m, (x.title || x.item || 'Your order') + ' is now ' + x.status + '.', { view: 'orders' }]);
      });
      if (first) { ls(BASE, '1'); return; }
      batch.slice(0, 6).reduce(function (p, b) { return p.then(function () { return post(b[0], b[1], b[2], b[3]); }); }, Promise.resolve());
    }).catch(function () {});
  }

  /* ---------- 3. daily check-in reminder (9:00 every day, pushed to tomorrow once you check in) ---------- */
  function remind(tomorrow) {
    var d = new Date(); d.setHours(9, 0, 0, 0); if (tomorrow || d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    allowed().then(function (ok) {
      if (!ok) return; return ensureChannel().then(function () {
        return LN.cancel({ notifications: [{ id: 91001 }] }).catch(function () {}).then(function () {
          return LN.schedule({ notifications: [{ id: 91001, title: 'Daily check-in', body: 'Check in today to keep your streak and earn points.', channelId: CH, schedule: { at: d, every: 'day', allowWhileIdle: true }, extra: { view: 'rewards' } }] });
        });
      });
    }).catch(function () {});
  }
  window.addEventListener('cc-streak-checkin', function () { remind(true); });

  /* ---------- tapping a phone notification ---------- */
  try {
    LN.addListener('localNotificationActionPerformed', function (a) {
      var v = a && a.notification && a.notification.extra && a.notification.extra.view || '';
      try {
        if (v === 'update' && window.ccApp && window.ccApp.checkUpdate) window.ccApp.checkUpdate();
        else if (v === 'rewards') window.go('rewards');
        else if (v === 'orders') { window.go('market'); setTimeout(function () { var b = document.querySelector('#mseg button[data-s="orders"]'); if (b) b.click(); }, 400); }
        else { var bell = document.querySelector('.ccb'); if (bell) bell.click(); }
      } catch (e) {}
    });
  } catch (e) {}

  function tick() { if (!on()) return; news(); account(); }
  setTimeout(function () { tick(); remind(false); }, 9000);
  setInterval(function () { if (!document.hidden) tick(); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(tick, 1500); });
  window.addEventListener('cc-wallet-changed', function () { setTimeout(account, 1500); });
})();
