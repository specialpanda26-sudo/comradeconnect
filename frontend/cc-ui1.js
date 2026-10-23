/* cc-ui1.js v1: Section 1 helpers.
   - Robot (Tech): blinks by changing the eye shape from script, so it still blinks when the phone has "Remove animations" on
     (that setting switches every CSS animation off). Random gaps, sometimes a double blink.
   - Marks the box around the location chip so the CSS can keep it under the top bar. */
(function () {
  'use strict';
  if (window.__ccUi1) return; window.__ccUi1 = 1;

  /* robot */
  var eyes = [], base = '3.4', started = 0;
  function setRy(v) { for (var i = 0; i < eyes.length; i++) eyes[i].setAttribute('ry', v); }
  function blink() {
    if (document.hidden) return;
    setRy('0.4'); setTimeout(function () { setRy(base); }, 120);
  }
  function loop() {
    blink();
    if (Math.random() < 0.28) setTimeout(blink, 280);
    setTimeout(loop, 2200 + Math.random() * 3000);
  }
  function robot() {
    if (started) return;
    eyes = [].slice.call(document.querySelectorAll('#tkr .tke'));
    if (!eyes.length) return;
    base = eyes[0].getAttribute('ry') || '3.4';
    started = 1; setTimeout(loop, 1200);
  }

  /* chip wrapper */
  function chip() {
    var c = document.querySelector('#v-feed .ccc-chip');
    if (c && c.parentNode && !c.parentNode.classList.contains('cc-chipwrap') && c.parentNode.id !== 'v-feed') c.parentNode.classList.add('cc-chipwrap');
  }

  function tick() { robot(); chip(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
  [500, 1500, 3000, 6000].forEach(function (ms) { setTimeout(tick, ms); });
  try { new MutationObserver(function () { chip(); if (!started) robot(); }).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
})();
