/* Admin: Referral tester (Bot > Referral tester). Give it a referral link and a number: the server opens the link in a real
   browser, creates that many random sim_ accounts, logs each one out, retypes the link, and reports what worked and what failed.
   Loaded after admin-wabot.js. Uses api, render, SECTIONS, LABEL, esc, toast, $ from admin.html. */
(function () {
'use strict';
LABEL.refbot = 'Referral tester';
let timer = null, last = null;
const STATE = { idle: 'Ready', running: 'Running...', done: 'Finished', failed: 'The bot could not finish', stopped: 'Stopped', timeout: 'Stopped: it took too long', nocreate: 'Finished: no account was created' };

SECTIONS.refbot = () => {
  setTimeout(init, 0);
  return ['<div class="card" id="rb_box"><h3>Referral tester</h3>'
    + '<p class="sub">Paste a real referral link from the site you want to test. The bot opens it, checks the Sponsor box fills itself, creates random accounts (usernames start with <b>sim_</b>), presses Continue, closes the Telegram popup, logs out, types the link again, and repeats.</p>'
    + '<label class="fl" for="rb_link">Referral link<small>Must start with https://</small></label><input id="rb_link" inputmode="url" autocomplete="off" placeholder="https://yoursite.com/?ref=sponsor">'
    + '<label class="fl" for="rb_n">How many accounts<small>1 to 100</small></label><input id="rb_n" inputmode="numeric" maxlength="3" value="5" autocomplete="off">'
    + '<label class="fl" for="rb_dom">Email domain (optional)<small>Use a domain you own if the site refuses example.com</small></label><input id="rb_dom" autocomplete="off" placeholder="mydomain.com">'
    + '<label class="fl" for="rb_pass">Test password (optional)<small>8 to 40 characters. Leave empty and the bot chooses one</small></label><input id="rb_pass" autocomplete="off" placeholder="leave empty">'
    + '<label class="fl" for="rb_gap">Seconds between accounts (optional)<small>Raise it if the site starts refusing sign-ups</small></label><input id="rb_gap" inputmode="numeric" maxlength="2" placeholder="2">'
    + '<label class="fl"><input type="checkbox" id="rb_ok"> This is my own site. I understand every account is real and may get the signup bonus.</label>'
    + '<div class="row"><button id="rb_dry">Check the page first</button><button class="p" id="rb_go">Start test</button><button id="rb_stop" style="display:none">Stop</button></div>'
    + '<p class="err" id="rb_err"></p><p class="sub"><b id="rb_st">Checking...</b></p>'
    + '<div id="rb_bar" style="height:8px;border-radius:99px;background:var(--soft);overflow:hidden;display:none"><div id="rb_fill" style="height:100%;width:0;background:var(--pa,#06b6d4);transition:width .4s"></div></div>'
    + '<p class="sub" id="rb_hint"></p></div>'
    + '<div class="card"><h3>Live log</h3><pre id="rb_log" class="sub" style="white-space:pre-wrap;max-height:300px;overflow:auto;margin:0;font:12px/1.55 ui-monospace,Menlo,monospace">Nothing yet.</pre></div>'
    + '<div class="card" id="rb_res" style="display:none"><h3>Result</h3><p class="sub" id="rb_sum"></p><div id="rb_tbl" style="overflow-x:auto"></div>'
    + '<div class="row"><button id="rb_csv">Download list (CSV)</button><button id="rb_cp">Copy usernames</button><button id="rb_rep">Show full report</button><button id="rb_shot">Show screenshots</button></div>'
    + '<pre id="rb_repbox" class="sub" style="display:none;white-space:pre-wrap;max-height:320px;overflow:auto;font:12px/1.55 ui-monospace,Menlo,monospace"></pre><div id="rb_img"></div>'
    + '<p class="sub">"Created" only means the site accepted the sign-up. Now log in as the sponsor on that site and check the referral list shows the new <b>sim_</b> people and that the bonus was credited once for each.</p></div>'];
};

function paint(d) {
  if (!$('#rb_box')) return;
  last = d;
  const run = d.state === 'running';
  $('#rb_st').textContent = (STATE[d.state] || d.state) + (d.state !== 'idle' && d.link ? '  (' + (d.dry ? 'page check' : d.created + ' created, ' + d.failed + ' failed of ' + d.count) + ')' : '');
  $('#rb_stop').style.display = run ? '' : 'none'; $('#rb_go').disabled = $('#rb_dry').disabled = run;
  const bar = $('#rb_bar'); bar.style.display = run && !d.dry ? '' : 'none';
  $('#rb_fill').style.width = Math.min(100, Math.round(((d.created + d.failed) / Math.max(1, d.count)) * 100)) + '%';
  const miss = d.hasScript === false ? 'scripts/referral-bot.mjs is not in the repo yet.' : d.ready === false ? 'Playwright is not installed on the server yet (see setup steps).' : d.browser === false ? 'The Chromium browser is not installed on the server. The Render build command must also run the Playwright install.' : '';
  $('#rb_hint').textContent = d.hint || miss || (d.ai ? 'AI brain is on: the bot asks Gemini for help when it gets stuck.' : 'AI brain is off: add GEMINI_API_KEY on the server to turn it on.');
  const lg = $('#rb_log'); if (d.log && d.log.length) { const atEnd = lg.scrollTop + lg.clientHeight >= lg.scrollHeight - 30; lg.textContent = d.log.join('\n'); if (atEnd) lg.scrollTop = lg.scrollHeight; }
  const res = $('#rb_res'), acc = d.accounts || [];
  if (!run && (acc.length || d.report)) {
    res.style.display = '';
    const good = acc.filter((a) => a.ok).length;
    $('#rb_sum').textContent = d.dry ? 'Page check finished. Open the screenshot and the report to see what the bot found.' : good + ' of ' + acc.length + ' accounts created. ' + acc.filter((a) => a.relinked).length + ' times the link was typed again with the Sponsor box refilled.';
    $('#rb_tbl').innerHTML = acc.length ? '<div class="tbl" style="min-width:520px"><div class="r h" style="grid-template-columns:.4fr 1.6fr 1fr 1fr 1.6fr"><span>#</span><span>Username</span><span>Created</span><span>Logged out</span><span>Note</span></div>'
      + acc.map((a) => '<div class="r" style="grid-template-columns:.4fr 1.6fr 1fr 1fr 1.6fr;cursor:default"><span>' + a.n + '</span><span>' + esc(a.username) + '</span><span>' + (a.ok ? 'Yes' : 'No') + '</span><span>' + (a.ok ? (a.loggedOut ? 'Yes' : 'No') : '-') + '</span><span>' + esc(a.ok ? a.warn : a.why) + '</span></div>').join('') + '</div>' : '';
  } else if (run) res.style.display = 'none';
}
async function poll() {
  if (!$('#rb_box')) { clearInterval(timer); timer = null; return; }
  try { paint(await api('/api/admin/wa/refbot/status')); } catch (e) { if ($('#rb_st')) $('#rb_st').textContent = 'Could not reach the server. ' + e.message; }
}
function init() {
  if (!$('#rb_box')) return;
  poll(); if (!timer) timer = setInterval(poll, 2000);
  if (last && last.link && $('#rb_link') && !$('#rb_link').value) $('#rb_link').value = last.link;
}
async function go(btn, body) {
  $('#rb_err').textContent = ''; btn.disabled = true;
  try { paint(await api('/api/admin/wa/refbot/start', body)); } catch (x) { $('#rb_err').textContent = x.message; btn.disabled = false; }
}
const dl = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
const cell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
if (!window.__rbBound) {
  window.__rbBound = true;
  document.addEventListener('click', async (e) => {
    const t = (id) => e.target.closest('#' + id);
    const form = () => ({ link: $('#rb_link').value, count: $('#rb_n').value, domain: $('#rb_dom').value, pass: $('#rb_pass').value.trim(), delay: Math.round((parseFloat($('#rb_gap').value) || 0) * 1000) || '', confirm: $('#rb_ok').checked });
    let b;
    if ((b = t('rb_go'))) go(b, form());
    else if ((b = t('rb_dry'))) go(b, { ...form(), dry: true });
    else if ((b = t('rb_stop'))) { try { paint(await api('/api/admin/wa/refbot/stop', {})); } catch (x) { $('#rb_err').textContent = x.message; } }
    else if ((b = t('rb_csv')) && last) dl('referral-test-' + new Date().toISOString().slice(0, 10) + '.csv', ['n,username,password,created,sponsor_box,welcome_seen,popup,logged_out,link_retyped,problem,note'].concat((last.accounts || []).map((a) => [a.n, a.username, a.password, a.ok, a.sponsor, a.welcome, a.popup, a.loggedOut, a.relinked, a.problem, a.ok ? a.warn : a.why].map(cell).join(','))).join('\n'), 'text/csv');
    else if ((b = t('rb_cp')) && last) { const txt = (last.accounts || []).filter((a) => a.ok).map((a) => a.username).join('\n'); try { await navigator.clipboard.writeText(txt); toast('Copied ' + txt.split('\n').filter(Boolean).length + ' usernames'); } catch (x) { toast('Could not copy'); } }
    else if ((b = t('rb_rep')) && last) { const bx = $('#rb_repbox'); bx.textContent = last.report || 'No report was written.'; bx.style.display = bx.style.display === 'none' ? '' : 'none'; }
    else if ((b = t('rb_shot'))) {
      const all = (last && last.shots) || [], names = ['page.png', 'filled.png'].filter((x) => all.indexOf(x) > -1).concat(all.filter((x) => /^fail-/.test(x)).slice(0, 1));
      if (!names.length) return toast('No screenshot yet');
      $('#rb_img').innerHTML = '';
      for (const name of names) {
        try {
          const d = await api('/api/admin/wa/refbot/shot', { name }), im = document.createElement('img'), cp = document.createElement('p');
          im.alt = name; im.src = d.data; im.style.cssText = 'max-width:100%;border-radius:12px;margin-top:12px';
          cp.className = 'sub'; cp.textContent = name === 'page.png' ? 'What the bot saw when it opened the link.' : name === 'filled.png' ? 'The form after the bot filled it, before pressing Create Account.' : 'The first failed attempt.';
          $('#rb_img').append(im, cp);
        } catch (x) { toast(x.message); }
      }
    }
  });
}
})();
