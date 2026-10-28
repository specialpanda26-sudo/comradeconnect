/* cc-unilogos.js: every Kenyan university in the picker gets its own logo.
   Logo = the university's site icon (fetched by its web address). If it cannot load, the short name shows instead.
   Admin can override any logo: cc_site_v1 key "unilogo_<id>" with an https image link. */
(function () {
'use strict';
if (window.__ccUniLogos) return; window.__ccUniLogos = 1;
var U = [
['Kirinyaga University','kyu.ac.ke','KyU'],['University of Nairobi','uonbi.ac.ke','UoN'],['Kenyatta University','ku.ac.ke','KU'],
['Jomo Kenyatta University of Agriculture and Technology','jkuat.ac.ke','JKUAT'],['Moi University','mu.ac.ke','MU'],['Egerton University','egerton.ac.ke','EU'],
['Maseno University','maseno.ac.ke','MSU'],['Masinde Muliro University of Science and Technology','mmust.ac.ke','MMUST'],['Dedan Kimathi University of Technology','dkut.ac.ke','DeKUT'],
['Technical University of Kenya','tukenya.ac.ke','TUK'],['Technical University of Mombasa','tum.ac.ke','TUM'],['Pwani University','pu.ac.ke','PU'],
['University of Eldoret','uoeld.ac.ke','UoE'],['Chuka University','chuka.ac.ke','CU'],['Laikipia University','laikipia.ac.ke','LU'],
['Meru University of Science and Technology','must.ac.ke','MUST'],['Embu University','embuni.ac.ke','EmU'],['Kisii University','kisiiuniversity.ac.ke','KSU'],
['Karatina University','karu.ac.ke','KarU'],['Machakos University','mksu.ac.ke','MksU'],['Multimedia University of Kenya','mmu.ac.ke','MMU'],
['South Eastern Kenya University','seku.ac.ke','SEKU'],['Taita Taveta University','ttu.ac.ke','TTU'],['Jaramogi Oginga Odinga University','jooust.ac.ke','JOOUST'],
['Garissa University','gau.ac.ke','GAU'],['Kibabii University','kibu.ac.ke','KIBU'],["Murang'a University of Technology",'mut.ac.ke','MUT'],
['Rongo University','rongovarsity.ac.ke','RU'],['University of Kabianga','kabianga.ac.ke','UoK'],['Co-operative University of Kenya','cooperative.ac.ke','CUK'],
['Tom Mboya University','tmu.ac.ke','TMU'],['Alupe University','au.ac.ke','AU'],['Strathmore University','strathmore.edu','SU'],
['United States International University Africa','usiu.ac.ke','USIU'],['Catholic University of Eastern Africa','cuea.edu','CUEA'],['Daystar University','daystar.ac.ke','DU'],
['Mount Kenya University','mku.ac.ke','MKU'],['KCA University','kca.ac.ke','KCA'],['Kenya Methodist University','kemu.ac.ke','KeMU'],
['Africa Nazarene University','anu.ac.ke','ANU'],['Riara University','riarauniversity.ac.ke','RU'],['Zetech University','zetech.ac.ke','ZU'],
['Kabarak University','kabarak.ac.ke','KU'],['Kaimosi Friends University','kafu.ac.ke','KAFU'],['Gretsa University','gretsauniversity.ac.ke','GU'],
['Tharaka University','tharaka.ac.ke','TU'],['Lukenya University','lukenyauniversity.ac.ke','LU'],['Turkana University College','turkanauniversity.ac.ke','TUC'],
['Koitaleel Samoei University College','ksu.ac.ke','KSU'],['Bomet University College','buc.ac.ke','BUC'],['Kenya Highlands Evangelical University','kheu.ac.ke','KHEU'],
['Pan Africa Christian University','pacuniversity.ac.ke','PAC'],["St. Paul's University",'spu.ac.ke','SPU'],['Presbyterian University of East Africa','pueac.ac.ke','PUEA'],
['Management University of Africa','mua.ac.ke','MUA'],['Great Lakes University of Kisumu','gluk.ac.ke','GLUK'],['Africa International University','aiu.ac.ke','AIU'],
['Scott Christian University','scott.ac.ke','SCU']
];
var LOCAL = {'university of nairobi':'uon','south eastern kenya university':'seku','tom mboya university':'tmu','co-operative university of kenya':'cuk','university of kabianga':'kabianga','presbyterian university of east africa':'pueac',"st. paul's university":'spu','pan africa christian university':'panac','turkana university college':'turkana','bomet university college':'bomet','daystar university':'daystar'};   // logos kept in img/unilogos
var BY = {}; U.forEach(function (a) { BY[a[0].toLowerCase()] = a; });
function cfg() { try { return JSON.parse(localStorage.getItem('cc_site_v1') || '{}') || {}; } catch (e) { return {}; } }
function ini(n) { var w = (n || '').replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(function (x) { return x && !/^(of|and|the|for)$/i.test(x); }); return (w.map(function (x) { return x[0]; }).join('') || 'U').slice(0, 3).toUpperCase(); }
function src(a) {
  var c = cfg(), k = 'unilogo_' + a[0].toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (/^https:\/\/[^\s<>"']+$/i.test(c[k] || '')) return c[k];
  if (LOCAL[a[0].toLowerCase()]) return 'img/unilogos/' + LOCAL[a[0].toLowerCase()] + '.webp';
  return 'https://www.google.com/s2/favicons?domain=' + a[1] + '&sz=128';
}
window.ccUniLogo = function (name) {
  var a = BY[(name || '').toLowerCase()], span = document.createElement('span');
  span.className = 'ccul'; var i = document.createElement('i'); i.textContent = a ? a[2] : ini(name); span.appendChild(i);
  if (a) {
    var m = document.createElement('img'); m.alt = ''; m.loading = 'lazy'; m.referrerPolicy = 'no-referrer'; m.src = src(a);
    m.onload = function () { if (m.naturalWidth < 32) m.remove(); }; m.onerror = function () { m.remove(); };
    span.appendChild(m);
  }
  return span;
};
var st = document.createElement('style');
st.textContent = '.ccul{position:relative;width:38px;height:38px;border-radius:12px;background:#fff;display:inline-grid;place-items:center;flex:none;overflow:hidden;box-shadow:0 4px 14px rgba(254,129,60,.22),inset 0 0 0 1px rgba(14,15,11,.08)}'
  + '.ccul i{font:800 11px/1 Poppins,system-ui,sans-serif;font-style:normal;color:#0E0F0B;letter-spacing:-.02em}'
  + '.ccul img{position:absolute;inset:0;width:100%;height:100%;padding:5px;box-sizing:border-box;object-fit:contain;background:#fff}'
  + '#ccuniv .it.ccu{justify-content:flex-start}#ccuniv .it.ccu>span:nth-child(2){flex:1;min-width:0}'
  + '.ccc-chip .ccul{width:22px;height:22px;border-radius:7px;box-shadow:none}.ccc-chip .ccul i{font-size:8px}';
document.head.appendChild(st);
function paint() {
  var o = document.getElementById('ccuniv');
  if (o) [].forEach.call(o.querySelectorAll('button.it:not(.all):not(.ccu)'), function (b) {
    var n = b.querySelector('span'); if (!n) return;
    b.classList.add('ccu'); b.insertBefore(window.ccUniLogo(n.textContent), b.firstChild);
  });
  var ch = document.getElementById('ccLocChip');
  if (ch && !ch.querySelector('.ccul')) {
    var nm = ''; try { nm = localStorage.getItem('cc_campus_name') || 'Kirinyaga University'; } catch (e) {}
    var pin = ch.querySelector('svg'); var lg = window.ccUniLogo(nm); if (pin) ch.replaceChild(lg, pin); else ch.insertBefore(lg, ch.firstChild);
  }
}
function go() { paint(); new MutationObserver(paint).observe(document.body, { childList: true, subtree: true }); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
