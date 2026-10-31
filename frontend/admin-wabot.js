/* Admin: WhatsApp bot. Link a number (pairing code or QR), let Gemini answer customers, message your groups.
   Loaded after admin-push.js. Uses api, render, SECTIONS, LABEL, esc, toast, $ from admin.html. */
(function () {
'use strict';
LABEL.wabot = 'WhatsApp bot';
let timer = null;
const ST = { idle: 'Not linked', connecting: 'Connecting...', code: 'Waiting for you to type the code in WhatsApp', qr: 'Waiting for you to scan the QR', connected: 'Linked and running', reconnecting: 'Reconnecting...' };

SECTIONS.wabot = () => {
  setTimeout(init, 0);
  return ['<div class="card" id="wa_box"><h3>Link WhatsApp</h3><p class="sub">Link the number the bot should use. Use a spare number first, not your main one.</p>'
    + '<p class="sub"><b id="wa_st">Checking...</b></p><div id="wa_show" style="text-align:center"></div>'
    + '<div id="wa_form"><label class="fl" for="wa_num">WhatsApp number<small>With country code, digits only, like 2547XXXXXXXX. Needed for the pairing code, not for the QR.</small></label><input id="wa_num" inputmode="numeric" maxlength="15" placeholder="2547XXXXXXXX" autocomplete="off">'
    + '<div class="row"><button class="p" id="wa_code">Get pairing code</button><button id="wa_qr">Show QR code</button></div></div>'
    + '<div class="row" id="wa_off" style="display:none"><button id="wa_out">Disconnect</button></div><p class="err" id="wa_err"></p></div>'
    + '<div class="card"><h3>Customer replies (Gemini)</h3><p class="sub" id="wa_aist"></p>'
    + '<label class="fl"><input type="checkbox" id="wa_ai"> Reply to customers automatically (private chats only)</label>'
    + '<label class="fl" for="wa_kb">What the bot knows<small>Add prices, your M-Pesa details, support number, rules. It answers only from this text. If you reply to a customer yourself, the bot stays quiet in that chat for 30 minutes.</small></label><textarea id="wa_kb" rows="12" maxlength="20000"></textarea>'
    + '<div class="row"><button class="p" id="wa_kbs">Save</button></div><p class="sub" id="wa_kbo"></p></div>'
    + '<div class="card"><h3>Message my groups</h3><p class="sub">Sends one message to your WhatsApp groups, 25 at a time, one every 20 to 45 seconds, so the number is not banned. Admin-only groups are skipped. In any group, send <b>.spill skip</b> from your phone to leave it out.</p>'
    + '<label class="fl" for="wa_sl">Link<small>Must start with https://</small></label><input id="wa_sl" value="https://comradeconnect.co.ke" autocomplete="off">'
    + '<label class="fl" for="wa_sn">Extra line (optional)</label><input id="wa_sn" maxlength="300" placeholder="e.g. New on campus!" autocomplete="off">'
    + '<div class="row"><button class="p" id="wa_ss">Start</button><button id="wa_sm">Send next 25</button><button id="wa_sx">Stop</button></div><p class="err" id="wa_se"></p><p class="sub" id="wa_sp" style="white-space:pre-line"></p></div>'];
};

function paint(d) {
  if (!$('#wa_box')) return;
  const s = d.status || 'idle', on = s === 'connected' || s === 'reconnecting';
  $('#wa_st').textContent = (ST[s] || s) + (d.number && on ? ' (+' + d.number + ')' : '');
  $('#wa_form').style.display = on ? 'none' : '';
  $('#wa_off').style.display = on || s === 'code' || s === 'qr' || s === 'connecting' ? '' : 'none';
  const sh = $('#wa_show');
  if (s === 'code' && d.code) sh.innerHTML = '<div style="font-size:30px;font-weight:800;letter-spacing:5px;margin:12px 0">' + esc(d.code) + '</div><p class="sub">In WhatsApp tap Settings, Linked devices, Link a device, then <b>Link with phone number instead</b>, and type this code. Do it within a minute.</p>';
  else if (s === 'qr' && d.qr) { sh.innerHTML = '<img alt="QR" style="width:260px;max-width:100%;background:#fff;padding:8px;border-radius:12px"><p class="sub">In WhatsApp tap Settings, Linked devices, Link a device, and scan this. It refreshes by itself.</p>'; sh.querySelector('img').src = d.qr; }
  else sh.innerHTML = '';
  $('#wa_err').textContent = d.error || '';
  const a = d.ai || {};
  if ($('#wa_ai') && document.activeElement !== $('#wa_ai')) $('#wa_ai').checked = !!a.enabled;
  $('#wa_aist').textContent = !a.hasKey ? 'GEMINI_API_KEY is not set on the server, so the bot cannot reply yet.' : a.error ? 'Last Gemini problem: ' + a.error : 'Gemini key found.';
  const p = d.spill || {};
  $('#wa_sp').textContent = (p.message ? p.message + '\n' : '') + (p.running || p.done ? 'Sent ' + (p.done || 0) + ' of ' + (p.total || 0) + (p.failed ? ', failed ' + p.failed : '') + '. ' : '') + (p.pending ? p.pending + ' groups waiting.' : '');
}
async function poll() {
  if (!$('#wa_box')) { clearInterval(timer); timer = null; return; }
  try { paint(await api('/api/admin/wa/status')); } catch (e) { if ($('#wa_st')) $('#wa_st').textContent = 'Could not reach the bot server. ' + e.message; }
}
async function init() {
  if (!$('#wa_box')) return;
  poll(); if (!timer) timer = setInterval(poll, 3000);
  const ta = $('#wa_kb'); if (ta && !ta.dataset.l) { ta.dataset.l = '1'; try { ta.value = (await api('/api/admin/wa/knowledge')).text || ''; } catch (e) {} }
}
async function act(btn, errId, path, body, after) {
  $('#' + errId).textContent = ''; btn.disabled = true;
  try { const d = await api(path, body); paint(d); if (after) after(d); } catch (x) { $('#' + errId).textContent = x.message; }
  btn.disabled = false;
}
if (!window.__waBound) {
  window.__waBound = true;
  document.addEventListener('click', (e) => {
    const t = (id) => e.target.closest('#' + id);
    let b;
    if ((b = t('wa_code'))) act(b, 'wa_err', '/api/admin/wa/connect', { mode: 'code', number: $('#wa_num').value });
    else if ((b = t('wa_qr'))) act(b, 'wa_err', '/api/admin/wa/connect', { mode: 'qr' });
    else if ((b = t('wa_out'))) { if (confirm('Disconnect this WhatsApp number from the bot?')) act(b, 'wa_err', '/api/admin/wa/logout', {}); }
    else if ((b = t('wa_kbs'))) act(b, 'wa_kbo', '/api/admin/wa/knowledge', { text: $('#wa_kb').value }, () => { $('#wa_kbo').textContent = 'Saved. The bot uses it from the next message.'; });
    else if ((b = t('wa_ss'))) { if (confirm('Send this link to your groups now, 25 at a time?')) act(b, 'wa_se', '/api/admin/wa/spill/start', { link: $('#wa_sl').value, note: $('#wa_sn').value }); }
    else if ((b = t('wa_sm'))) act(b, 'wa_se', '/api/admin/wa/spill/more', {});
    else if ((b = t('wa_sx'))) act(b, 'wa_se', '/api/admin/wa/spill/stop', {});
  });
  document.addEventListener('change', (e) => { if (e.target.id === 'wa_ai') api('/api/admin/wa/ai', { enabled: e.target.checked }).then(paint).catch((x) => toast(x.message)); });
}
})();
