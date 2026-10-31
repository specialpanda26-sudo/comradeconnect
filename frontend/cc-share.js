(function () {
  'use strict';
  function fix() {
    var a = document.getElementById('locA');
    if (!a || a.__ccs) return;
    a.__ccs = 1; a.textContent = 'Share my location';
    a.addEventListener('click', function (e) {
      if (!navigator.share) return;
      e.preventDefault();
      var t = ''; try { t = decodeURIComponent((a.href.split('text=')[1] || '')); } catch (x) {}
      navigator.share({ text: t }).catch(function () {});
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fix); else fix();
})();
