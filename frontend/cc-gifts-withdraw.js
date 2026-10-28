/* cc-gifts-withdraw.js: a "Withdraw gifts to main wallet" button on the My gift link card (shows once you have received a gift).
   Calls POST /api/me/gift/withdraw. If the server keeps gifts in the same wallet already (no such route), it says so and opens the wallet. */
(function () {
  'use strict';
  if (window.__ccGW) return; window.__ccGW = 1;
  function say(m) { try { toast(m); } catch (e) { alert(m); } }
  function kes(n) { return 'KSh ' + Number(n || 0).toLocaleString('en-KE'); }
  function add() {
    var h = document.getElementById('ccgift'); if (!h || h.hidden || h.querySelector('#ccgw') || !h.querySelector('.big')) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'ccgw'; b.className = 'btn p'; b.textContent = 'Withdraw gifts to main wallet'; b.style.cssText = 'width:100%;margin-top:12px';
    b.onclick = function () { run(b); }; h.appendChild(b);
  }
  async function run(b) {
    if (!window.CC || !window.CC.call) return say('The app is still starting. Try again.');
    b.disabled = true; var old = b.textContent; b.textContent = 'Moving...';
    try {
      var r = await window.CC.call('/api/me/gift/withdraw', { body: {} });
      var n = r && (r.moved != null ? r.moved : r.amount);
      say(n != null ? kes(n) + ' moved to your main wallet' : 'Gifts moved to your main wallet');
      try { if (window.ccGiftsLoad) window.ccGiftsLoad(); } catch (e) {}
      try { window.dispatchEvent(new Event('cc-wallet-changed')); } catch (e) {}
    } catch (e) {
      var m = String((e && e.message) || '');
      if (/not found|404|cannot post|no such/i.test(m)) { say('Your gifts are already in your main wallet.'); try { window.go('market'); } catch (x) {} }
      else say(m || 'Could not move gifts right now. Try again.');
    }
    b.disabled = false; b.textContent = old;
  }
  new MutationObserver(function () { add(); }).observe(document.body, { childList: true, subtree: true });
  add();
})();
