(function () {
  try {
    var t = localStorage.getItem('cc_theme');
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    var dark = t === 'dark' || (!t && window.matchMedia && matchMedia('(prefers-color-scheme:dark)').matches);
    if (m) m.setAttribute('content', dark ? '#17130f' : '#fbf1ed');
  } catch (e) {}
})();
