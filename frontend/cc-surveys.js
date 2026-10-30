/* cc-surveys.js: "Surveys" tab in Explore. A comrade answers a short survey and earns the reward the survey maker set (held a few hours,
   then added to the wallet). Anyone signed in can also make a survey: they pay the reward budget plus a small fee, an admin approves it,
   and unused money goes back to their wallet. Follows the campus picked in cc-campus.js. */
(function () {
'use strict';
var xt = document.getElementById('xt'), body = document.getElementById('xbody');
if (!xt || !body || window.__ccSurveys) return; window.__ccSurveys = 1;

var S = { list: [], rules: { feePercent: 10, minReward: 5, maxResponses: 1000, holdHours: 24, maxDays: 30, maxQuestions: 10 }, busy: false, err: '', ready: true, loaded: false };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var say = function (t) { try { if (typeof toast === 'function') toast(t); } catch (e) {} };
var call = function (p, o) { return window.CC ? CC.call(p, o) : Promise.reject(new Error('Not ready yet. Reload the page and try again.')); };
var signedIn = function () { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); };
var on = function () { return xt.querySelector('.tab[data-x="sy"].on'); };
var campusName = function () { return (window.ccCampus && ccCampus.name()) || 'your campus'; };
var kes = function (n) { return 'KSh ' + Number(n || 0).toLocaleString('en-KE'); };
var needSignIn = function (why) { say(why || 'Sign in first'); try { if (window.ccAuthPanel) window.ccAuthPanel(); } catch (e) {} };
var feeOf = function (a) { return Math.floor(a * S.rules.feePercent / 100 + 1e-9); };

var css = document.createElement('style');
css.textContent = '.sy-top{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between}.sy-top .btn{flex:none}'
  + '.sy-card{margin-top:12px}.sy-h{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}'
  + '.sy-t{margin:0;font-size:17px;font-weight:600;line-height:1.35;overflow-wrap:anywhere}.sy-by{margin:6px 0 0;font-size:12px;opacity:.7}'
  + '.sy-pay{flex:none;font-weight:800;font-size:13px;padding:5px 11px;border-radius:999px;background:rgba(127,127,127,.2);white-space:nowrap}'
  + '.sy-meta{font-size:12px;opacity:.7;margin-top:8px;line-height:1.5}.sy-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.sy-row>*{flex:1 1 120px}'
  + '.sy-form label.l{display:block;margin:12px 0 6px;font-size:12px;font-weight:600;opacity:.75}'
  + '.sy-form input[type=text],.sy-form input[type=date],.sy-form input[type=tel],.sy-form input[type=number],.sy-form select,.sy-form textarea{width:100%;box-sizing:border-box;border-radius:14px;border:1px solid var(--gb,rgba(255,255,255,.28));background:rgba(127,127,127,.12);color:inherit;padding:12px 14px;font:500 15px Poppins,system-ui,sans-serif}'
  + '.sy-form textarea{min-height:70px;resize:vertical}.sy-err{margin:10px 0 0;font-size:13px;color:var(--bad)}.sy-note{font-size:12px;opacity:.75;margin:10px 0 0;line-height:1.5}'
  + '.sy-q{margin-top:16px;padding-top:14px;border-top:1px solid var(--gb,rgba(255,255,255,.18))}.sy-q:first-of-type{border-top:0;padding-top:0}.sy-q h4{margin:0 0 8px;font-size:15px;line-height:1.4;overflow-wrap:anywhere}'
  + '.sy-opt{display:flex;align-items:center;gap:10px;padding:11px 12px;margin-top:6px;border-radius:14px;border:1.5px solid rgba(127,127,127,.35);cursor:pointer;font-size:14px;overflow-wrap:anywhere}.sy-opt input{margin:0;flex:none}'
  + '.sy-bar{height:8px;border-radius:99px;background:rgba(127,127,127,.2);margin-top:4px;overflow:hidden}.sy-bar i{display:block;height:100%;background:currentColor;opacity:.7;border-radius:99px}'
  + '.sy-mine{padding:12px 0;border-top:1px solid var(--gb,rgba(255,255,255,.18))}.sy-mine:first-of-type{border-top:0}.sy-mine b{overflow-wrap:anywhere}'
  + '.sy-qb{margin-top:12px;padding:12px;border-radius:16px;border:1px solid var(--gb,rgba(255,255,255,.2))}.sy-ans{margin:6px 0 0;padding:8px 10px;border-radius:12px;background:rgba(127,127,127,.12);font-size:13px;overflow-wrap:anywhere}'
  + '.sy-sheet{max-height:92vh;overflow:auto}';
document.head.appendChild(css);

if (!xt.querySelector('[data-x="sy"]')) xt.insertAdjacentHTML('beforeend', '<button class="tab g" data-x="sy">Surveys</button>');

function until(d) {
  var n = Math.round((Date.parse(d + 'T23:59:00') - Date.now()) / 86400000);
  return n <= 0 ? 'last day today' : n === 1 ? 'until tomorrow' : 'for ' + n + ' more days';
}

function paint() {
  if (!on()) return;
  var h = '<div class="sy-top"><div><h3 style="margin:0">Paid surveys at ' + esc(campusName()) + '</h3><p class="sub" style="margin:4px 0 0">Answer honestly and earn KSh into your wallet.</p></div>'
    + '<div style="display:flex;gap:8px"><button class="btn g" data-sy="mine">My surveys</button><button class="btn p" data-sy="add">Make a survey</button></div></div>';
  if (S.busy && !S.list.length) h += '<p class="sub" style="margin-top:14px">Loading...</p>';
  else if (S.err && !S.list.length) h += '<p class="sub" style="margin-top:14px">' + esc(S.err) + '</p><button class="btn g" data-sy="retry">Try again</button>';
  else if (!S.ready) h += '<article class="box g" style="margin-top:14px"><h3>Surveys are coming soon</h3><p class="sub" style="margin-top:6px">This feature is not switched on yet. Check back soon.</p></article>';
  else if (!S.list.length) h += '<article class="box g" style="margin-top:14px"><h3>No surveys open right now</h3><p class="sub" style="margin-top:6px">Need answers from students? Make a survey, set the reward, and comrades will respond.</p></article>';
  else h += S.list.map(function (x) {
    var done = x.myStatus && x.myStatus !== 'started';
    return '<article class="box g sy-card"><div class="sy-h"><p class="sy-t">' + esc(x.title) + '</p><span class="sy-pay">' + esc(kes(x.reward)) + '</span></div>'
      + (x.presentedBy ? '<p class="sy-by">Presented by ' + esc(x.presentedBy.name) + '</p>' : '')
      + (x.intro ? '<p class="sub" style="margin:8px 0 0;overflow-wrap:anywhere">' + esc(x.intro) + '</p>' : '')
      + '<div class="sy-meta">' + x.questions + ' question' + (x.questions === 1 ? '' : 's') + ' · about ' + x.minutes + ' min · ' + x.left + ' place' + (x.left === 1 ? '' : 's') + ' left · ' + esc(until(x.endsOn)) + '</div>'
      + '<div class="sy-row">' + (x.ownSurvey ? '<span class="badge">Your survey</span>' : x.myStatus === 'rejected' ? '<span class="badge">Not paid</span>' : done ? '<span class="badge">Answered</span>'
        : '<button class="btn p" data-sy="open" data-id="' + esc(x.id) + '">' + (x.myStatus === 'started' ? 'Continue' : 'Answer and earn ' + esc(kes(x.reward))) + '</button>') + '</div></article>';
  }).join('');
  body.innerHTML = h;
}
function load() {
  if (S.busy) return; S.busy = true; S.err = ''; paint();
  call('/api/surveys', { auth: signedIn() ? undefined : false })
    .then(function (d) { S.list = d.items || []; if (d.rules) S.rules = d.rules; S.ready = d.ready !== false; S.loaded = true; })
    .catch(function (e) { S.err = e.message || 'Could not load. Check your connection.'; })
    .then(function () { S.busy = false; paint(); });
}
function show() {
  [].forEach.call(xt.querySelectorAll('.tab'), function (t) { t.classList.toggle('on', t.dataset.x === 'sy'); });
  paint(); load();
}
xt.addEventListener('click', function (e) {
  var t = e.target.closest && e.target.closest('.tab'); if (!t || t.dataset.x !== 'sy') return;
  e.stopPropagation(); e.preventDefault(); show();
}, true);

function sheet(html) {
  var ov = document.createElement('div'); ov.className = 'cxm'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = '<div class="box g sy-form sy-sheet">' + html + '</div>';
  ov.close = function () { clearInterval(ov._t); ov.remove(); };
  ov.addEventListener('click', function (e) { if (e.target === ov) ov.close(); });
  document.body.appendChild(ov); return ov;
}
function q(ov, s) { return ov.querySelector(s); }

/* ---------- answer a survey ---------- */
function answerSheet(id) {
  if (!signedIn()) return needSignIn('Sign in to answer and earn');
  var ov = sheet('<p class="sub">Opening...</p><div class="cxr"><button class="btn g" data-q>Close</button></div>');
  q(ov, '[data-q]').onclick = ov.close;
  call('/api/surveys/' + id + '/start', { body: {} }).then(function (s) {
    var t0 = Date.now(), box = ov.firstChild;
    box.innerHTML = '<h3 style="padding-right:44px;overflow-wrap:anywhere">' + esc(s.title) + '</h3>'
      + (s.presentedBy ? '<p class="sy-by">Presented by ' + esc(s.presentedBy.name) + '</p>' : '')
      + (s.intro ? '<p class="sub" style="margin:8px 0 0;overflow-wrap:anywhere">' + esc(s.intro) + '</p>' : '')
      + '<p class="sy-note">You earn <b>' + esc(kes(s.reward)) + '</b>' + (s.holdHours ? ', added to your wallet ' + s.holdHours + ' hours after you answer' : '') + '. Answer honestly. Junk answers are not paid. No phone numbers or links.</p>'
      + s.questions.map(function (qq, i) {
        var inner = qq.type === 'text'
          ? '<textarea maxlength="300" placeholder="Your answer" aria-label="' + esc(qq.text) + '"></textarea>'
          : qq.options.map(function (o, k) {
            return '<label class="sy-opt"><input type="' + (qq.type === 'multi' ? 'checkbox' : 'radio') + '" name="' + qq.id + '" value="' + k + '"><span>' + esc(o) + '</span></label>';
          }).join('');
        return '<div class="sy-q" data-qid="' + qq.id + '" data-type="' + qq.type + '"><h4>' + (i + 1) + '. ' + esc(qq.text) + (qq.type === 'multi' ? ' <small style="opacity:.6">(pick all that apply)</small>' : '') + '</h4>' + inner + '</div>';
      }).join('')
      + '<p class="sy-err" id="sye" role="alert" hidden></p><div class="cxr"><button class="btn p" id="syg" disabled>Send answers</button><button class="btn g" data-q>Close</button></div>';
    var err = function (m) { var n = q(ov, '#sye'); n.textContent = m || ''; n.hidden = !m; };
    q(ov, '[data-q]').onclick = ov.close;
    var go = q(ov, '#syg');
    ov._t = setInterval(function () {
      var left = Math.ceil(s.minSeconds - (Date.now() - t0) / 1000);
      if (left > 0) go.textContent = 'Send answers (' + left + 's)'; else { go.textContent = 'Send answers'; go.disabled = false; clearInterval(ov._t); }
    }, 500);
    go.onclick = function () {
      err('');
      var ans = {}, bad = '';
      [].forEach.call(box.querySelectorAll('.sy-q'), function (n) {
        var qid = n.dataset.qid, ty = n.dataset.type;
        if (ty === 'text') { var v = n.querySelector('textarea').value.trim(); if (v.length < 2) bad = bad || 'Write a short answer for question ' + qid.slice(1); ans[qid] = v; }
        else {
          var picked = [].map.call(n.querySelectorAll('input:checked'), function (i) { return +i.value; });
          if (!picked.length) bad = bad || 'Pick an answer for question ' + qid.slice(1);
          ans[qid] = ty === 'single' ? picked[0] : picked;
        }
      });
      if (bad) return err(bad);
      go.disabled = true;
      call('/api/surveys/' + id + '/answer', { body: { answers: ans } }).then(function (r) {
        box.innerHTML = '<h3 style="padding-right:44px">Thank you!</h3><p style="margin:10px 0 0;line-height:1.6">You earned <b>' + esc(kes(r.reward)) + '</b>. '
          + (r.holdHours ? 'It will reach your wallet in ' + r.holdHours + ' hours.' : 'It is in your wallet now.') + '</p><div class="cxr"><button class="btn p" data-q>Done</button></div>';
        q(ov, '[data-q]').onclick = ov.close;
        try { if (window.ccPayChoice) ccPayChoice.paid(); } catch (e) {}
        load();
      }).catch(function (e) { go.disabled = false; err(e.message || 'Could not send'); load(); });
    };
  }).catch(function (e) { ov.firstChild.innerHTML = '<p class="sub">' + esc(e.message || 'Could not open this survey') + '</p><div class="cxr"><button class="btn g" data-q>Close</button></div>'; q(ov, '[data-q]').onclick = ov.close; load(); });
}

/* ---------- make a survey ---------- */
function makeSheet() {
  if (!signedIn()) return needSignIn('Sign in to make a survey');
  var R = S.rules, nQ = 0;
  var d = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), max = new Date(Date.now() + R.maxDays * 86400000).toISOString().slice(0, 10), min = new Date().toISOString().slice(0, 10);
  var ov = sheet('<h3 style="padding-right:44px">Make a paid survey</h3>'
    + '<label class="l" for="syt">Title</label><input type="text" id="syt" maxlength="90" placeholder="e.g. Where do students buy lunch?" autocomplete="off">'
    + '<label class="l" for="syi">Short intro (optional)</label><input type="text" id="syi" maxlength="300" placeholder="Why you are asking" autocomplete="off">'
    + '<div id="syqs"></div><div class="cxr"><button class="btn g" id="syaq">Add a question</button></div>'
    + '<label class="l" for="syw">How many responses do you want?</label><input type="number" id="syw" inputmode="numeric" min="1" max="' + R.maxResponses + '" value="20">'
    + '<label class="l" for="syr">Reward for each comrade (KSh, at least ' + R.minReward + ')</label><input type="number" id="syr" inputmode="numeric" min="' + R.minReward + '" value="' + Math.max(R.minReward, 10) + '">'
    + '<label class="l" for="syd">Last day the survey stays open</label><input type="date" id="syd" value="' + d + '" min="' + min + '" max="' + max + '">'
    + '<label class="l" for="syc">Who can answer?</label><select id="syc"><option value="">Students of my campus</option><option value="all">All campuses</option></select>'
    + '<div class="sy-qb" id="sycost" aria-live="polite"></div>'
    + '<p class="sy-note">You pay the reward budget plus a ' + R.feePercent + '% fee. An admin checks the survey before it goes live. If it is rejected, or if not all places are used, the unused money (and fee) returns to your wallet. No phone numbers or links.</p>'
    + '<p class="sy-err" id="sye" role="alert" hidden></p><div class="cxr"><button class="btn p" id="syg">Continue to payment</button><button class="btn g" data-q>Cancel</button></div>');
  var err = function (t) { var n = q(ov, '#sye'); n.textContent = t || ''; n.hidden = !t; };
  q(ov, '[data-q]').onclick = ov.close;
  function cost() {
    var w = Math.floor(+q(ov, '#syw').value) || 0, r = Math.floor(+q(ov, '#syr').value) || 0, b = w * r, f = feeOf(b);
    q(ov, '#sycost').innerHTML = '<b>Cost</b><br>Rewards: ' + w + ' × ' + kes(r) + ' = ' + kes(b) + '<br>Fee (' + R.feePercent + '%): ' + kes(f) + '<br><b>You pay: ' + kes(b + f) + '</b>';
  }
  function addQ() {
    if (nQ >= R.maxQuestions) return say('At most ' + R.maxQuestions + ' questions');
    nQ++;
    var n = document.createElement('div'); n.className = 'sy-qb';
    n.innerHTML = '<label class="l" style="margin-top:0">Question</label><input type="text" data-f="text" maxlength="160" placeholder="Write the question" autocomplete="off">'
      + '<label class="l">Answer type</label><select data-f="type"><option value="single">Pick one</option><option value="multi">Pick many</option><option value="text">Short written answer</option></select>'
      + '<div data-f="opwrap"><label class="l">Answers to pick from (one per line, 2 to 8)</label><textarea data-f="opts" placeholder="Yes&#10;No"></textarea></div>'
      + '<button class="btn g" data-rmq style="margin-top:8px">Remove question</button>';
    n.querySelector('[data-f=type]').onchange = function () { n.querySelector('[data-f=opwrap]').hidden = this.value === 'text'; };
    n.querySelector('[data-rmq]').onclick = function () { n.remove(); nQ--; };
    q(ov, '#syqs').appendChild(n);
  }
  addQ();
  q(ov, '#syaq').onclick = addQ;
  ov.addEventListener('input', cost); cost();
  q(ov, '#syg').onclick = function () {
    err('');
    var qs = [].map.call(ov.querySelectorAll('#syqs .sy-qb'), function (n) {
      var ty = n.querySelector('[data-f=type]').value;
      return { type: ty, text: n.querySelector('[data-f=text]').value.trim(), options: ty === 'text' ? undefined : n.querySelector('[data-f=opts]').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean) };
    });
    var title = q(ov, '#syt').value.trim();
    if (title.length < 5) return err('Give the survey a title of at least 5 letters');
    if (!qs.length) return err('Add at least one question');
    for (var i = 0; i < qs.length; i++) {
      if (qs[i].text.length < 3) return err('Question ' + (i + 1) + ': write the question');
      if (qs[i].type !== 'text' && (qs[i].options.length < 2 || qs[i].options.length > 8)) return err('Question ' + (i + 1) + ': give from 2 to 8 answers, one per line');
    }
    var w = Math.floor(+q(ov, '#syw').value), r = Math.floor(+q(ov, '#syr').value);
    if (!(w >= 1 && w <= R.maxResponses)) return err('Responses wanted must be from 1 to ' + R.maxResponses);
    if (!(r >= R.minReward)) return err('Reward must be at least ' + kes(R.minReward));
    var b = this; b.disabled = true;
    var body = { title: title, intro: q(ov, '#syi').value.trim(), questions: qs, wanted: w, reward: r, ends_on: q(ov, '#syd').value };
    if (q(ov, '#syc').value === 'all') body.campus = 'all';
    call('/api/surveys', { body: body }).then(function (s) { ov.close(); paySheet(s); })
      .catch(function (e) { b.disabled = false; err(e.message || 'Could not save'); });
  };
  setTimeout(function () { var n = q(ov, '#syt'); if (n) n.focus(); }, 80);
}

/* ---------- pay for a survey (wallet or M-Pesa) ---------- */
function paySheet(s) {
  var total = s.total != null ? s.total : (s.budget + s.fee), done = false;
  var ov = sheet('<h3 style="padding-right:44px">Pay for your survey</h3><p class="sub" style="margin:6px 0 0;overflow-wrap:anywhere">' + esc(s.title || 'Survey') + '</p>'
    + '<p style="margin:14px 0 0;font-size:22px;font-weight:800">' + esc(kes(total)) + '</p>'
    + '<p class="sy-note">Rewards ' + esc(kes(s.budget)) + ' + fee ' + esc(kes(s.fee)) + '. Your money is held safely. An admin approves the survey, then it goes live. Unused money returns to your wallet.</p>'
    + '<div id="syhost"></div><div id="syph"><label class="l" for="syp">M-Pesa number</label><input type="tel" id="syp" inputmode="tel" maxlength="14" placeholder="0712345678" autocomplete="tel"></div>'
    + '<div id="sysp"></div><p class="sy-err" id="sye" role="alert" hidden></p><div class="cxr"><button class="btn p" id="syg">Pay ' + esc(kes(total)) + '</button><button class="btn g" data-q>Pay later</button></div>');
  var err = function (t) { var n = q(ov, '#sye'); n.textContent = t || ''; n.hidden = !t; };
  q(ov, '[data-q]').onclick = function () { ov.close(); if (!done) say('Saved. Pay from My surveys when you are ready.'); };
  var wc = null;
  if (window.ccPayChoice) wc = ccPayChoice.mount(q(ov, '#syhost'), { need: function () { return total; }, onChange: function (m) { q(ov, '#syph').hidden = m === 'wallet'; } });
  var wallet = function () { return !!wc && wc.mode() === 'wallet'; };
  var go = q(ov, '#syg');
  go.onclick = function () {
    err('');
    if (wallet()) {
      go.disabled = true;
      return call('/api/surveys/' + s.id + '/pay', { body: { method: 'wallet' } }).then(function () { done = true; try { ccPayChoice.paid(); } catch (e) {} ov.close(); say('Paid. We will tell you when it is approved.'); load(); })
        .catch(function (e) { go.disabled = false; err((e.status === 402 && wc && wc.short()) || e.message || 'Could not pay'); });
    }
    var ph = q(ov, '#syp').value.replace(/\s/g, '');
    if (!/^(07|01)\d{8}$|^\+?254[17]\d{8}$/.test(ph)) return err('Enter a Safaricom or Airtel number like 0712345678');
    go.disabled = true;
    call('/api/surveys/' + s.id + '/pay', { body: { method: 'mpesa', phone: ph } }).then(function (d) {
      q(ov, '#sysp').innerHTML = '<p class="sub" style="margin-top:12px">Check your phone and enter your M-Pesa PIN...</p>';
      return window.CC.waitPaid(d.id, function () {});
    }).then(function () { done = true; ov.close(); say('Paid. We will tell you when it is approved.'); load(); })
      .catch(function (e) { go.disabled = false; q(ov, '#sysp').innerHTML = ''; err(e.message || 'Payment did not go through'); });
  };
}

/* ---------- results (maker) ---------- */
function resultsSheet(id) {
  var ov = sheet('<h3 style="padding-right:44px">Results</h3><div id="syb"><p class="sub" style="margin-top:10px">Loading...</p></div><div class="cxr"><button class="btn g" id="sycsv" hidden>Download CSV</button><button class="btn g" data-q>Close</button></div>');
  q(ov, '[data-q]').onclick = ov.close;
  var box = q(ov, '#syb'), data = null;
  function draw() {
    var r = data;
    var h = '<p class="sub" style="margin:6px 0 0"><b>' + r.responses + '</b> of ' + r.wanted + ' responses</p>';
    r.questions.forEach(function (qq, i) {
      h += '<div class="sy-q"><h4>' + (i + 1) + '. ' + esc(qq.text) + '</h4>';
      if (qq.type === 'text') h += qq.answers.length ? qq.answers.map(function (a) { return '<p class="sy-ans">' + esc(a) + '</p>'; }).join('') : '<p class="sub">No answers yet.</p>';
      else qq.options.forEach(function (o) { var p = qq.answered ? Math.round(o.count * 100 / qq.answered) : 0; h += '<div style="margin-top:8px;font-size:13px">' + esc(o.text) + ' <b>' + o.count + '</b> (' + p + '%)<div class="sy-bar"><i style="width:' + p + '%"></i></div></div>'; });
      h += '</div>';
    });
    if (r.list.length) h += '<p class="sub" style="margin:16px 0 0"><b>Report a junk answer</b></p><p class="sy-note" style="margin-top:4px">If an answer is clearly nonsense, flag it within the hold time. An admin decides and no reward is paid for junk.</p>'
      + r.list.map(function (a) {
        return '<div class="sy-mine"><span class="sub">Answer #' + a.n + '</span>' + (a.flagged ? ' <span class="badge">Flagged</span>' : '') + '<div class="sy-ans">' + esc(Object.keys(a.answers).map(function (k) { return a.answers[k]; }).join(' · ')) + '</div>'
          + (!a.flagged && a.status === 'done' ? '<button class="btn g" data-flag="' + esc(a.id) + '" style="margin-top:8px">Flag as junk</button>' : '') + '</div>';
      }).join('');
    box.innerHTML = h; q(ov, '#sycsv').hidden = !r.responses;
  }
  function refresh() { call('/api/surveys/' + id + '/results').then(function (r) { data = r; draw(); }).catch(function (e) { box.innerHTML = '<p class="sub">' + esc(e.message || 'Could not load') + '</p>'; }); }
  q(ov, '#sycsv').onclick = function () {
    try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + data.csv], { type: 'text/csv' })); a.download = 'survey-results.csv'; document.body.appendChild(a); a.click(); a.remove(); }
    catch (e) { say('Could not make the file'); }
  };
  box.addEventListener('click', function (e) {
    var b = e.target.closest('[data-flag]'); if (!b) return;
    var note = prompt('Why is it junk? (optional)', ''); if (note === null) return;
    b.disabled = true;
    call('/api/surveys/' + id + '/flag', { body: { response: b.dataset.flag, note: note } }).then(function () { say('Flagged. An admin will check it.'); refresh(); }).catch(function (er) { b.disabled = false; say(er.message || 'Could not flag'); });
  });
  refresh();
}

/* ---------- my surveys: answers I gave, surveys I made ---------- */
function mineSheet() {
  if (!signedIn()) return needSignIn('Sign in to see your surveys');
  var ov = sheet('<h3 style="padding-right:44px">My surveys</h3><div id="sym"><p class="sub" style="margin-top:10px">Loading...</p></div><div class="cxr"><button class="btn g" data-q>Close</button></div>');
  q(ov, '[data-q]').onclick = ov.close;
  var box = q(ov, '#sym'), M = null;
  var STATE = { unpaid: 'Not paid yet', pending: 'Waiting for approval', live: 'Live', ended: 'Ended', rejected: 'Not approved' };
  function draw() {
    var h = '';
    if (M.made.length) h += '<p class="sub" style="margin:12px 0 0"><b>Surveys I made</b></p>' + M.made.map(function (s) {
      return '<div class="sy-mine"><b>' + esc(s.title) + '</b><div class="sy-meta">' + esc(STATE[s.status] || s.status) + (s.status === 'rejected' && s.note ? ': ' + esc(s.note) : '') + ' · ' + s.filled + ' of ' + s.wanted + ' responses · ' + esc(kes(s.reward)) + ' each'
        + (s.status !== 'unpaid' ? '<br>Paid ' + esc(kes(s.paid)) + (s.refunded ? ' · returned ' + esc(kes(s.refunded)) : '') : '<br>To pay: ' + esc(kes(s.total))) + '</div>'
        + '<div class="sy-row">' + (s.status === 'unpaid' ? '<button class="btn p" data-m="pay" data-id="' + esc(s.id) + '">Pay now</button><button class="btn g" data-m="rm" data-id="' + esc(s.id) + '">Delete</button>' : '')
        + (s.status !== 'unpaid' && s.status !== 'rejected' ? '<button class="btn g" data-m="res" data-id="' + esc(s.id) + '">Results</button>' : '')
        + (s.status === 'live' || s.status === 'pending' ? '<button class="btn g" data-m="stop" data-id="' + esc(s.id) + '">Stop and refund unused</button>' : '') + '</div></div>';
    }).join('');
    if (M.answered.length) h += '<p class="sub" style="margin:14px 0 0"><b>Surveys I answered</b></p>' + M.answered.map(function (a) {
      return '<div class="sy-mine"><b>' + esc(a.title) + '</b><div class="sy-meta">' + esc(kes(a.reward)) + ' · ' + esc(a.status === 'paid' ? 'Paid to wallet' : a.status === 'waiting' ? 'Waiting to be paid' : 'Not paid') + '</div></div>';
    }).join('');
    box.innerHTML = h || '<p class="sub" style="margin-top:10px">Nothing here yet. Answer a survey to earn, or make one of your own.</p>';
  }
  function refresh() {
    call('/api/surveys/mine').then(function (m) { if (m.ready === false) box.innerHTML = '<p class="sub" style="margin-top:10px">Surveys are not switched on yet.</p>'; else { M = m; draw(); } })
      .catch(function (e) { box.innerHTML = '<p class="sub" style="margin-top:10px">' + esc(e.message || 'Could not load') + '</p>'; });
  }
  box.addEventListener('click', function (e) {
    var b = e.target.closest('[data-m]'); if (!b) return;
    var id = b.dataset.id, s = M && M.made.filter(function (x) { return x.id === id; })[0], a = b.dataset.m;
    if (a === 'res') return resultsSheet(id);
    if (a === 'pay' && s) { ov.close(); return paySheet({ id: s.id, title: s.title, budget: s.budget, fee: s.fee, total: s.total }); }
    if (a === 'stop') {
      if (!confirm('Stop this survey now? Money for unused places and its fee goes back to your wallet.')) return;
      b.disabled = true; return call('/api/surveys/' + id + '/stop', { body: {} }).then(function () { say('Stopped. Unused money returned.'); refresh(); load(); try { ccPayChoice.paid(); } catch (x) {} }).catch(function (er) { b.disabled = false; say(er.message); });
    }
    if (a === 'rm') {
      if (!confirm('Delete this unpaid survey?')) return;
      b.disabled = true; return call('/api/surveys/' + id + '/remove', { body: {} }).then(function () { refresh(); }).catch(function (er) { b.disabled = false; say(er.message); });
    }
  });
  refresh();
}

body.addEventListener('click', function (e) {
  if (!on()) return;
  var b = e.target.closest('[data-sy]'); if (!b) return; var a = b.dataset.sy;
  e.preventDefault();
  if (a === 'add') return makeSheet();
  if (a === 'mine') return mineSheet();
  if (a === 'retry') return load();
  if (a === 'open') return answerSheet(b.dataset.id);
});
})();
