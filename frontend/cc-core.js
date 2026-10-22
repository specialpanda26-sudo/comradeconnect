/* Comrade Connect, Section 3A: account token, Market, escrow and wallet, all talking to the Worker.
   Loaded after the main script in index.html, so it can use $, $$, esc, toast, ago, ME, ST, ZONES, openDm, shut and friends.
   The fetch shim in <head> adds X-Aid and X-Token to every call to CC_API. */
(function () {
'use strict';
let FEE = 7;                                             // percent; replaced by the server's value (admin > Money and fees) as soon as it loads
const CFG = { ppk: 10, min: 1, max: 150000, wfp: 0, wff: 0, pmin: 1, pmax: 150000 };
const kes = (n) => 'KSh ' + Number(n).toLocaleString('en-KE');
const net = (p) => p - Math.floor((p * FEE) / 100);      // same rounding as the Worker
const connected = () => typeof CC_API === 'string' && CC_API.indexOf('YOUR-SUBDOMAIN') < 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function loadConfig() {                              // fee %, boost prices and payout rules, so the screens always match the server
  try {
    const r = await fetch(CC_API + '/api/config'); if (!r.ok) return;
    const d = await r.json();
    if (Number.isFinite(d.fee_percent)) FEE = d.fee_percent;
    if (Array.isArray(d.zones) && d.zones.length) { ZONES.splice(0, ZONES.length, ...d.zones.map(String)); try { if (window.ccDrawZones) window.ccDrawZones(); } catch (e) {} }
    CFG.pmin = d.price_min || 1; CFG.pmax = d.price_max || 150000;
    { const mp = document.getElementById('mpr'); if (mp) mp.placeholder = 'Price in KSh (' + CFG.pmin.toLocaleString('en-US') + ' to ' + CFG.pmax.toLocaleString('en-US') + ')'; }
    CFG.min = d.withdraw_min || 1; CFG.ppk = d.points_per_ksh || 10; CFG.max = d.withdraw_max || 150000; CFG.wfp = d.withdraw_fee_percent || 0; CFG.wff = d.withdraw_fee_flat || 0;
    const bs = [...document.querySelectorAll('#dm .pl .act')];
    (d.boost_plans || []).forEach((p, i) => { const b = bs[i]; if (!b) return; b.dataset.pr = p.price; b.dataset.du = p.hours === 24 ? '24 hours' : '3 days'; b.innerHTML = '<b>KSh ' + p.price + '</b>' + b.dataset.du; });
    const on = bs.find((b) => b.classList.contains('sel')) || bs[0]; if (on) on.click();      // refreshes the price the boost screen will charge and show
  } catch (e) { /* offline: the built-in values stay */ }
}
if (typeof CC_API === 'string' && CC_API.indexOf('YOUR-SUBDOMAIN') < 0) loadConfig();

/* ---------- small popup sheet ---------- */
function sheet(html) {
  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto';
  m.innerHTML = '<div class="box g" style="max-width:360px;width:100%">' + html + '</div>';
  document.body.appendChild(m);
  m.close = () => m.remove();
  return m;
}
const copyText = async (t) => { try { await navigator.clipboard.writeText(t); toast('Copied'); } catch (e) { toast('Select the text and copy it'); } };

/* ---------- account: token from the server ---------- */
const saveAuth = (a) => {
  try { const o = window.ccAuth && window.ccAuth(); if (o && o.aid !== a.aid) { S.mine = []; S.orders = []; S.wallet = null; } } catch (e) {}   // another account: forget the old lists
  try { localStorage.setItem('cc_auth', JSON.stringify(a)); } catch (e) {}
};
async function rawPost(path, body) {
  let r;
  try { r = await fetch(CC_API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); }
  catch (e) { throw new Error('Could not reach the server. Check your internet and try again.'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(ccErr(r.status, d.error)), { status: r.status });
  return d;
}
/* ---------- anonymous account with a password you choose (no random code) ---------- */
function registerFlow() {
  return new Promise((done, fail) => {
    const m = sheet('<h3>Create your anonymous account</h3><p class="sub" style="margin-top:6px">Pick a username and a password you will remember. No email, no phone number. Your password is the only way back in on a new phone.</p>'
      + '<div class="fld" style="margin-top:10px"><input id="ccw-u" placeholder="Username (3 to 20 letters, numbers or _)" maxlength="20" autocomplete="off" autocapitalize="off" aria-label="Username"></div>'
      + '<div class="fld"><input id="ccw-p" type="password" placeholder="Password (at least 8 characters)" maxlength="100" autocomplete="new-password" aria-label="Password"></div>'
      + '<div class="fld"><input id="ccw-p2" type="password" placeholder="Type the password again" maxlength="100" autocomplete="new-password" aria-label="Confirm password"></div>'
      + '<p class="sub" id="ccw-e" style="color:#f87171;min-height:18px"></p>'
      + '<button class="btn p" id="ccw-go" style="width:100%">Create account</button>'
      + '<button class="btn g" id="ccw-rand" style="width:100%;margin-top:6px">Skip: give me a random recovery code</button>'
      + '<button class="btn g" id="ccw-x" style="width:100%;margin-top:6px">Cancel</button>');
    const $q = (s) => m.querySelector(s), err = (t) => { $q('#ccw-e').textContent = t || ''; };
    const run = async (body) => {
      $q('#ccw-go').disabled = $q('#ccw-rand').disabled = true; err('');
      try { const d = await rawPost('/api/auth/register', body); m.close(); done(d); }
      catch (e) { err(e.message); $q('#ccw-go').disabled = $q('#ccw-rand').disabled = false; }
    };
    $q('#ccw-go').onclick = () => {
      const u = $q('#ccw-u').value.trim(), p = $q('#ccw-p').value;
      if (!/^[A-Za-z0-9_]{3,20}$/.test(u)) return err('Username: 3 to 20 letters, numbers or _');
      if (p.length < 8) return err('The password needs at least 8 characters');
      if (p.toLowerCase() === u.toLowerCase()) return err('The password cannot be your username');
      if (p !== $q('#ccw-p2').value) return err('The two passwords do not match');
      run({ handle: u, password: p });
    };
    $q('#ccw-rand').onclick = () => run({});
    $q('#ccw-x').onclick = () => { m.close(); fail(new Error('Sign in to continue')); };
  });
}
function showWelcome(d) {
  return new Promise((done) => {
    const m = sheet('<h3>Account created</h3><p class="sub" style="margin-top:6px">Sign in on any phone with your username and password. We cannot show or reset your password, so keep it safe.</p>'
      + '<div class="rw" style="margin-top:12px"><span>Username</span><b>' + esc(d.handle || '') + '</b></div><div class="rw"><span>Account ID</span><b>' + esc(d.aid) + '</b></div>'
      + '<label class="sub" style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="ccwl-ok"> I will remember my password</label>'
      + '<button class="btn p" id="ccwl-go" style="width:100%;margin-top:12px" disabled>Continue</button>');
    m.querySelector('#ccwl-ok').onchange = (e) => { m.querySelector('#ccwl-go').disabled = !e.target.checked; };
    m.querySelector('#ccwl-go').onclick = () => { m.close(); done(); };
  });
}
let regBusy = null;
function showRecovery(d) {
  if (!d.recovery_code) return showWelcome(d);
  return new Promise((done) => {
    const m = sheet('<h3>Save your recovery code</h3><p class="sub" style="margin-top:6px">This is the only way to get your account back on a new phone. We cannot show it again. Screenshot it or write it down.</p>'
      + '<div class="rw" style="margin-top:12px"><span>Account ID</span><b id="ccaid">' + esc(d.aid) + '</b></div>'
      + '<div class="rw"><span>Recovery code</span><b id="ccrec" style="letter-spacing:1px">' + esc(d.recovery_code) + '</b></div>'
      + '<button class="btn g" id="cccp" style="width:100%;margin-top:12px">Copy both</button>'
      + '<label class="sub" style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="ccok"> I saved my account ID and recovery code</label>'
      + '<button class="btn p" id="ccgo" style="width:100%;margin-top:12px" disabled>Continue</button>');
    m.querySelector('#cccp').onclick = () => copyText('Comrade Connect account ID: ' + d.aid + '\nRecovery code: ' + d.recovery_code);
    m.querySelector('#ccok').onchange = (e) => { m.querySelector('#ccgo').disabled = !e.target.checked; };
    m.querySelector('#ccgo').onclick = () => { m.close(); done(); };
  });
}
/* ---------- Google sign-in (one tap, works on any phone) ---------- */
const googleOn = () => typeof CC_GOOGLE_ID === 'string' && CC_GOOGLE_ID.length > 10;
let gsiP = null;
function loadGsi() {
  if (window.google && google.accounts && google.accounts.id) return Promise.resolve(true);
  if (gsiP) return gsiP;
  gsiP = new Promise((res) => {
    const sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true;
    sc.onload = () => res(true); sc.onerror = () => { gsiP = null; res(false); };
    setTimeout(() => res(false), 8000);
    document.head.appendChild(sc);
  });
  return gsiP;
}
async function googleSignIn(credential, link) {                    // the fetch shim sends the guest token too, so a guest account is linked, not lost
  const d = await rawPost('/api/auth/google', { credential, mode: link ? 'link' : 'signin' });
  saveAuth({ aid: d.aid, token: d.token });
  ME.aid = d.aid; ME.google = 1;
  try { const j = JSON.parse(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); if (j.email) { const [u, dom] = String(j.email).split('@'); ME.gmask = u.slice(0, 2) + '***@' + dom; } } catch (e) {}
  saveMe();
  setTimeout(() => { attributeRef(); syncVer(); }, 0);
  return d;
}
/* One Tap on the website: signed-out visitors get Google's own account list by itself (like the phone). Not in the app (it has its own picker). */
async function ccOneTap() {
  try {
    if (!googleOn() || (window.ccApp && window.ccApp.native) || navigator.onLine === false) return;
    const a = window.ccAuth && window.ccAuth();
    if (ME.google || (a && a.token)) return;
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.protocol !== 'https:') return;   // Google refuses One Tap on plain http
    let until = 0; try { until = +localStorage.getItem('cc_tap_until') || 0; } catch (e) {}
    if (Date.now() < until) return;
    if (!(await loadGsi())) return;
    google.accounts.id.initialize({ client_id: CC_GOOGLE_ID, auto_select: false, cancel_on_tap_outside: true, use_fedcm_for_prompt: true,
      callback: async (resp) => { try { await googleSignIn(resp.credential); location.reload(); } catch (e) { toast(e.message || 'Google sign-in failed. Try again.'); } } });
    google.accounts.id.prompt((n) => {
      try { if (n.isDismissedMoment() || n.isSkippedMoment()) localStorage.setItem('cc_tap_until', String(Date.now() + 864e5)); } catch (e) {}   // asked once a day at most
    });
  } catch (e) {}
}
window.addEventListener('load', () => setTimeout(ccOneTap, 3500));
async function mountGoogle(box, onDone, onErr, opts) {
  if (!googleOn()) return false;
  if (window.ccApp && window.ccApp.native) return window.ccApp.mountGoogle(box, onDone, onErr, opts, googleSignIn);
  if (!(await loadGsi())) { box.innerHTML = '<p class="sub">Google sign-in could not load. Check your internet.</p>'; return false; }
  google.accounts.id.initialize({ client_id: CC_GOOGLE_ID, callback: async (resp) => { try { onDone(await googleSignIn(resp.credential, !!(opts && opts.link))); } catch (e) { onErr(e.message); } } });
  google.accounts.id.renderButton(box, Object.assign({ theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'pill', width: 280 }, opts || {}));
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !(location.protocol === 'https:' && !location.port) && box.parentNode && !box.parentNode.querySelector('.cc-lhint')) {
    const n = document.createElement('p'); n.className = 'sub cc-lhint'; n.style.cssText = 'font-size:11px;margin-top:8px;text-align:center';
    n.textContent = 'Local test: Google must list ' + location.origin + ' under Authorized JavaScript origins.'; box.insertAdjacentElement('afterend', n);
  }
  return true;
}
function chooseSignIn() {                                    // resolves 'google' or 'guest'; rejects on cancel
  return new Promise((done, fail) => {
    const m = sheet('<h3>Sign in to continue</h3><p class="sub" style="margin-top:6px">One tap with Google keeps your orders and wallet safe and works on any phone.</p>'
      + '<div id="ccg" style="display:flex;justify-content:center;margin-top:14px;min-height:44px"></div>'
      + '<p class="sub" id="ccg-e" style="color:#f87171;min-height:18px;margin-top:6px"></p>'
      + '<button class="btn g" id="ccg-guest" style="width:100%;margin-top:6px">No Google? Create an anonymous account</button>'
      + '<button class="btn g" id="ccg-x" style="width:100%;margin-top:6px">Cancel</button>');
    m.querySelector('#ccg-guest').onclick = () => { m.close(); done('guest'); };
    m.querySelector('#ccg-x').onclick = () => { m.close(); fail(new Error('Sign in to continue')); };
    mountGoogle(m.querySelector('#ccg'), () => { m.close(); done('google'); }, (msg) => { m.querySelector('#ccg-e').textContent = msg; });
  });
}
// Make sure this phone has a server account. New accounts get a fresh server-made ID (the old browser-only ID is public in the Feed).
async function ensureAccount() {
  if (!connected()) throw new Error('We cannot reach the service right now. Please try again in a moment.');
  const a = window.ccAuth && window.ccAuth();
  if (a && a.token && a.aid) { if (ME.aid !== a.aid) { ME.aid = a.aid; saveMe(); } return a; }
  if (regBusy) return regBusy;
  regBusy = (async () => {
    if (googleOn() && (await chooseSignIn()) === 'google') return window.ccAuth();
    const d = await registerFlow();
    saveAuth({ aid: d.aid, token: d.token });
    if (ME.aid && ME.aid !== d.aid) ME.oldAid = ME.aid;
    ME.aid = d.aid; saveMe();
    await showRecovery(d);
    return { aid: d.aid, token: d.token };
  })();
  try { const a = await regBusy; setTimeout(() => { attributeRef(); syncVer(); }, 0); return a; } finally { regBusy = null; }
}
// Tickets (event tickets and support tickets) need a real account. Anyone can look, but must sign up first; after signing up they tap the button again.
async function needSignup(what) {
  const a = window.ccAuth && window.ccAuth();
  if (a && a.token && a.aid) return true;
  toast('Sign up first to ' + what + '. Then tap it again.');
  try { await ensureAccount(); } catch (e) {}
  return false;
}
async function restoreAccount(aid, code) {
  aid = String(aid || '').trim(); code = String(code || '');                 // a password is case-sensitive: the server upper-cases old recovery codes itself
  if (!aid || !code.trim()) throw new Error('Enter your account ID or username, and your password or recovery code');
  const d = await rawPost('/api/auth/recover', { aid, recovery_code: code });
  saveAuth({ aid: d.aid, token: d.token });
  ME.aid = d.aid; saveMe();
  setTimeout(() => { syncVer(); refreshReferral(true); }, 0);
  return d;
}
function promptRestore(msg, title) {
  if (document.getElementById('ccrst')) return;
  const m = sheet('<h3>' + esc(title || 'Sign in again') + '</h3><p class="sub" style="margin-top:6px">' + esc(msg || 'This phone is not signed in to your account.') + '</p>'
    + (googleOn() ? '<div id="ccrg" style="display:flex;justify-content:center;margin-top:12px;min-height:44px"></div><p class="sub" style="text-align:center;margin-top:8px">or use the recovery code you saved</p>' : '<p class="sub">Enter the account ID and recovery code you saved.</p>')
    + '<div class="fld" style="margin-top:10px"><input id="ccrst-a" placeholder="Account ID or username" autocomplete="off" autocapitalize="off" aria-label="Account ID or username"></div>'
    + '<div class="fld"><input id="ccrst-c" type="password" placeholder="Password or recovery code" autocomplete="off" autocapitalize="off" aria-label="Password or recovery code"></div>'
    + '<p class="sub" id="ccrst-e" style="color:#f87171;min-height:18px"></p>'
    + '<div class="two"><button class="btn g" id="ccrst-x">Cancel</button><button class="btn p" id="ccrst-go">Restore</button></div>');
  m.id = 'ccrst';
  m.querySelector('#ccrst-x').onclick = () => m.close();
  if (googleOn()) mountGoogle(m.querySelector('#ccrg'), () => { m.close(); toast('Signed in'); refreshAll(); try { drawMe(); drawMe2(); } catch (e) {} }, (e) => { m.querySelector('#ccrst-e').textContent = e; });
  m.querySelector('#ccrst-go').onclick = async () => {
    const b = m.querySelector('#ccrst-go'); b.disabled = true;
    try { await restoreAccount(m.querySelector('#ccrst-a').value, m.querySelector('#ccrst-c').value); m.close(); toast('Account restored'); refreshAll(); }
    catch (e) { m.querySelector('#ccrst-e').textContent = e.message; b.disabled = false; }
  };
}
// Me > Restore an account now really restores (needs the account ID and the recovery code).
(function wireRestore() {
  const b = document.getElementById('rrs'); if (!b) return;
  b.onclick = async () => {
    const aid = (document.getElementById('raid') || {}).value, code = (document.getElementById('rcode') || {}).value;
    if (!connected()) return toast('Restore works once the server is connected');
    b.disabled = true;
    try { await restoreAccount(aid, code); toast('Account restored on this phone'); refreshAll(); } catch (e) { toast(e.message); }
    b.disabled = false;
  };
  if (googleOn() && b.parentElement) {
    const gb = document.createElement('div'); gb.style.cssText = 'display:flex;justify-content:center;margin:10px 0;min-height:44px';
    b.parentElement.insertBefore(gb, b.parentElement.firstChild);
    mountGoogle(gb, () => { toast('Signed in with Google'); refreshAll(); }, (e) => toast(e));
  }
  const a = window.ccAuth && window.ccAuth(), box = b.parentElement && b.parentElement.querySelector('p.sub');
  if (box) box.textContent = 'Use the account ID and recovery code you saved when you first used the Market.' + (a ? ' Your account ID on this phone: ' + a.aid : '');
})();

/* ---------- API helper ---------- */
async function call(path, o) {
  o = o || {};
  if (!connected()) throw new Error('We cannot reach the service right now. Please try again in a moment.');
  if (o.auth !== false) await ensureAccount();
  let r;
  try {
    r = await fetch(CC_API + path, { method: o.method || (o.body ? 'POST' : 'GET'), headers: o.body ? { 'Content-Type': 'application/json' } : undefined, body: o.body ? JSON.stringify(o.body) : undefined });
  } catch (e) { throw new Error('Could not reach the server. Check your internet and try again.'); }
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && o.auth !== false) { promptRestore(); throw new Error('Please restore your account first'); }
  if (!r.ok) throw Object.assign(new Error(ccErr(r.status, d.error)), { status: r.status });
  return d;
}
window.ccCall = call;
// Wallet and referral pay-ins from older code (boost, top-up) need the account first.
if (typeof window.ccRun === 'function') {
  const old = window.ccRun;
  window.ccRun = function (phone, amount, purpose, ref, ok, fail, onStep) {
    ensureAccount().then(() => old(phone, amount, purpose, ref, ok, fail, onStep)).catch((e) => fail(e.message || 'Could not start the payment'));
  };
}

/* ---------- Market state ---------- */
const S = { sub: 'browse', list: [], page: 1, more: false, mine: [], orders: [], wallet: null, loading: {}, error: {}, armed: '', photos: [], sending: false, buyL: null, paying: false };
const LS = { pending: 'Waiting for admin verification', approved: 'Live', rejected: 'Rejected', sold: 'Sold', removed: 'Removed' };
const OS = {
  held: ['Paid. Held safely in escrow', 'Buyer paid. Hand over the item'],
  handed: ['Seller says it was handed over', 'Waiting for the buyer to confirm'],
  released: ['Completed. The seller was paid', 'Completed. You were paid'],
  disputed: ['Dispute open. Admin is reviewing', 'Dispute open. Admin is reviewing'],
  refunded: ['Refunded to your wallet', 'Refunded to the buyer'],
};
const pic = (l, big) => (l.photos && l.photos.length
  ? '<img src="' + esc(l.photos[0]) + '" alt="" class="mm" decoding="async">'
  : '<div class="mm poster" style="font-size:11px;padding:10px;aspect-ratio:' + (big ? '4/3' : '1') + '">No photo</div>');
const retry = (k) => '<p class="sub" style="grid-column:1/3"><button class="btn g" data-retry="' + k + '">Could not load. Tap to retry</button></p>';
const loadingP = '<p class="sub" style="grid-column:1/3">Loading...</p>';

/* ---------- saved copy of the last lists, shown instantly while fresh data loads ---------- */
const cget = (k) => { const v = ST.get('cc_c_' + k, null); return v && v.d && Date.now() - v.t < 7 * 864e5 ? v.d : null; };
const cset = (k, d) => ST.set('cc_c_' + k, { t: Date.now(), d });
const ckey = (k) => { const a = window.ccAuth && window.ccAuth(); return a && a.aid ? k + ':' + a.aid : null; };   // per account, so another sign-in never sees these

async function loadBrowse(reset) {
  if (S.loading.browse) return;
  S.loading.browse = true; S.error.browse = false;
  if (reset) { S.page = 1; if (!S.list.length) { const c = cget('browse'); if (c) { S.list = c.listings || []; S.more = !!c.more; } } }
  draw();
  try {
    const d = await call('/api/market/listings?page=' + S.page + '&limit=12', { auth: false });
    const items = d.listings || [];
    S.list = S.page === 1 ? items : S.list.concat(items); S.more = !!d.hasMore;
    if (S.page === 1) cset('browse', { listings: items, more: S.more });
  } catch (e) { S.error.browse = e.message || true; }
  S.loading.browse = false; draw();
}
async function loadMine() {
  if (S.loading.mine) return;
  S.loading.mine = true; S.error.mine = false;
  { const k = ckey('mine'); const c = !S.mine.length && k ? cget(k) : null; if (c) S.mine = c; }
  draw();
  try { S.mine = (await call('/api/market/mine')).listings || []; const k = ckey('mine'); if (k) cset(k, S.mine); } catch (e) { S.error.mine = e.message || true; }
  S.loading.mine = false; draw();
}
async function loadOrders(quiet) {
  if (S.loading.orders) return;
  S.loading.orders = true; S.error.orders = false; syncVer();
  { const k = ckey('orders'); const c = !S.orders.length && !S.wallet && k ? cget(k) : null; if (c) { S.orders = c.orders || []; S.wallet = c.wallet || null; } }
  if (!quiet) draw();
  try {
    const [o, w] = await Promise.all([call('/api/orders/mine'), call('/api/wallet')]);
    S.orders = o.orders || []; S.wallet = w;
    const k = ckey('orders');                                  // the 6-digit handover code is never saved; it shows after the refresh
    if (k) cset(k, { orders: S.orders.map((x) => Object.assign({}, x, { code: x.code ? '...' : '' })), wallet: w });
    try {                                                      // tell the seller once when a withdrawal is paid or rejected
      const done = (w.withdrawals || []).filter((x) => x.status === 'paid' || x.status === 'rejected'), first = ST.get('cc_wd_seen', null) === null, seen = ST.get('cc_wd_seen', []) || [];
      done.filter((x) => !seen.includes(x.id)).forEach((x) => {
        seen.push(x.id);
        if (first) return;                                     // first run on this phone: remember old ones, do not announce them
        const msg = x.status === 'paid' ? 'Withdrawal paid. ' + kes(x.net == null ? x.amount : x.net) + ' was sent to your M-Pesa' + (x.payout_ref ? '. Ref ' + x.payout_ref : '') + '.' : 'Withdrawal rejected. ' + kes(x.amount) + ' is back in your wallet.';
        toast(msg); try { notify(x.status === 'paid' ? 'Withdrawal paid' : 'Withdrawal rejected', msg); } catch (e) {}
      });
      ST.set('cc_wd_seen', seen.slice(-100));
    } catch (e) { /* notifications are a bonus */ }
    S.orders.filter((x) => x.role === 'seller' && x.status === 'released').forEach((x) => {   // award the sale points once
      const seen = ST.get('cc_rel_seen', []);
      if (!seen.includes(x.id)) { seen.push(x.id); ST.set('cc_rel_seen', seen.slice(-100)); try { earn(10, 'Sale completed', 1); } catch (e) {} }
    });
  } catch (e) { S.error.orders = e.message || true; }
  S.loading.orders = false; draw();
}
function refreshAll() { if (S.sub === 'browse') loadBrowse(true); if (S.sub === 'mine') loadMine(); if (S.sub === 'orders') loadOrders(); }

/* ---------- drawing ---------- */
const dbtn = (k, t, id) => '<button class="act" data-a="' + k + '" data-id="' + id + '">' + t + '</button>';
const SHLD = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>';
function sellerBits(l) {
  const s = l.seller || {}, a = [];
  if (s.rating && s.rating.count) a.push('\u2605 ' + Number(s.rating.avg) + ' (' + Number(s.rating.count) + ')');
  if (s.verified) a.push('Verified seller'); else if (s.student) a.push('Student');
  return a;
}
function draw() {
  $$('#mseg button').forEach((b) => b.classList.toggle('on', b.dataset.s === S.sub));
  $('#mbrowse').hidden = S.sub !== 'browse'; $('#mmine').hidden = S.sub !== 'mine'; $('#mord').hidden = S.sub !== 'orders';
  if (S.sub === 'browse') {
    const q = $('#mkq').value.trim().toLowerCase();
    const a = S.list.filter((l) => !q || (l.title + ' ' + (l.description || '')).toLowerCase().includes(q));
    let h = a.map((l) => '<button class="mc g" data-id="' + esc(l.id) + '">' + pic(l) + '<div class="mb"><b>' + esc(l.title) + '</b><em>' + kes(l.price) + '</em><small>@' + esc(l.zone || 'Campus') + (l.condition ? ', ' + esc(l.condition) : '') + '</small><small class="mtl">' + SHLD + 'Escrow protected</small><small class="mtl">' + esc(sellerBits(l).join(' \u00B7 ') || 'New seller') + '</small></div></button>').join('');
    if (S.loading.browse && !S.list.length) h = loadingP;
    else if (S.error.browse) h += retry('browse');
    else if (!a.length) h = '<p class="sub" style="grid-column:1/3">' + (S.list.length ? 'Nothing matches. Try another word.' : 'No items yet. Sell the first one.') + '</p>';
    else if (S.more && !q) h += '<p style="grid-column:1/3;text-align:center"><button class="btn g" data-more="1">Load more</button></p>';
    $('#mgrid').innerHTML = h;
  }
  if (S.sub === 'mine') {
    let h = S.mine.filter((l) => l.status !== 'removed').map((l) => '<div class="box g" style="margin-top:12px"><div class="flex items-center justify-between"><span class="mst">' + esc(LS[l.status] || l.status) + '</span><time class="sub">' + ago(l.createdAt) + '</time></div><h3 style="margin:10px 0 2px">' + esc(l.title) + '</h3><b>' + kes(l.price) + '</b>'
      + (l.status === 'rejected' && l.reject_reason ? '<p class="sub" style="margin-top:6px">' + esc(l.reject_reason) + '</p>' : '')
      + (['pending', 'approved', 'rejected'].includes(l.status) ? '<div style="margin-top:10px">' + dbtn('rm', S.armed === l.id + 'rm' ? 'Tap again to remove it' : 'Remove listing', l.id) + '</div>' : '') + '</div>').join('');
    if (S.loading.mine && !S.mine.length) h = '<p class="sub" style="margin-top:12px">Loading...</p>';
    else if (S.error.mine) h = '<p class="sub" style="margin-top:12px"><button class="btn g" data-retry="mine">Could not load. Tap to retry</button></p>' + h;
    else if (!h) h = '<p class="sub" style="margin-top:12px">No listings yet. Take a photo of something you want to sell.</p>';
    $('#mlist').innerHTML = h;
  }
  if (S.sub === 'orders') {
    const lbl = document.querySelector('#mord .box .sub'); if (lbl) lbl.textContent = 'Wallet (sales and refunds)';
    const bal = S.wallet ? S.wallet.balance : 0;
    $('#wb').textContent = S.wallet ? kes(bal) : '...'; $('#wd').disabled = !bal;
    let w = document.getElementById('wlg'); if (!w) { $('#mord .box').insertAdjacentHTML('afterend', '<div id="wlg"></div>'); w = document.getElementById('wlg'); }
    const wds = (S.wallet ? S.wallet.withdrawals || [] : []).filter((x) => x.status !== 'rejected');   // rejected ones are announced once, never listed
    w.innerHTML = wds.length ? '<div class="box g" style="margin-top:14px"><h3>Withdrawals</h3>' + wds.slice(0, 5).map((x) => '<div class="rw"><span>' + kes(x.amount) + '<small>' + (x.fee ? 'Fee ' + kes(x.fee) + ', you get ' + kes(x.net) + '. ' : '') + ago(Date.parse(x.created_at)) + '</small></span><b>' + ({ requested: 'Waiting for admin', sending: 'Sending to M-Pesa', paid: 'Paid', rejected: 'Rejected, money returned' }[x.status] || esc(x.status)) + '</b>' + (x.status === 'requested' ? '<button class="act" data-wdc="' + esc(x.id) + '">Cancel</button>' : '') + '</div>' + wdTrack(x)).join('') + '</div>' : '';
    let h = S.orders.map((o) => {
      const buy = o.role === 'buyer', r = buy ? 0 : 1, live = o.status === 'held' || o.status === 'handed';
      let main = '', info = '';
      if (buy) {
        if (live) main = dbtn('received', S.armed === o.id + 'received' ? 'Tap again to release the money' : 'I received it', o.id) + dbtn('dispute', 'Report a problem', o.id);
        info = (o.seller_phone ? sellerBox(o.seller_phone) : (live || o.status === 'released' ? '<p class="sub" style="margin:0 0 8px">This seller did not add a number. Use "Message seller anonymously" on the item.</p>' : '')) + (live ? 'Your handover code is <b style="font-size:18px;letter-spacing:2px">' + esc(o.code || '') + '</b>. Check the item first. You can give the seller this code, or tap "I received it". Never do either before you have the item.'
          : o.status === 'released' ? 'You confirmed. The seller was paid.' : o.status === 'refunded' ? 'The money is back in your wallet.' : '');
      } else {
        if (o.status === 'held') main = dbtn('handed', 'I handed it over', o.id) + dbtn('dispute', 'Report a problem', o.id);
        if (o.status === 'handed') main = '<div class="fld" style="width:100%"><input class="hc" inputmode="numeric" maxlength="6" placeholder="Buyer 6-digit code" aria-label="Handover code"></div>' + dbtn('code', 'Enter code to get paid', o.id) + dbtn('dispute', 'Report a problem', o.id);
        info = o.status === 'released' ? 'You received ' + kes(o.you_receive) + ' after the ' + FEE + '% fee. It is in your wallet.'
          : o.status === 'held' ? 'The money is safe in escrow. Hand over the item, then tap "I handed it over".'
          : o.status === 'handed' ? 'Ask the buyer for their 6-digit code, or wait for them to confirm.' + (o.auto_release_at ? ' If they say nothing, the money is released on ' + new Date(o.auto_release_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }) + '.' : '')
          : o.status === 'refunded' ? 'The buyer was refunded.' : '';
        if (o.status === 'released' && S.wallet && S.wallet.balance >= CFG.min) main = dbtn('withdraw', 'Withdraw to M-Pesa', o.id);
      }
      if (o.status === 'disputed') info = 'An admin will review this and decide.' + (o.dispute_reason ? ' Reason given: ' + esc(o.dispute_reason) : '');
      return '<div class="box g"><div class="flex items-center justify-between"><span class="badge">' + (buy ? 'Buying' : 'Selling') + '</span><span class="mst">' + OS[o.status][r] + '</span></div><h3 style="margin:10px 0 2px">' + esc(o.title) + '</h3><b>' + kes(o.amount) + '</b>'
        + (info ? '<p class="sub" style="margin-top:6px">' + info + '</p>' : '') + (main ? '<div class="two" style="margin-top:12px;flex-wrap:wrap">' + main + '</div>' : '') + '</div>';
    }).join('');
    if (S.loading.orders && !S.orders.length) h = '<p class="sub">Loading...</p>';
    else if (S.error.orders) h = '<p class="sub"><button class="btn g" data-retry="orders">Could not load. Tap to retry</button></p>' + h;
    else if (!h) h = '<p class="sub">No orders yet. Buy something from Browse, or list an item to sell.</p>';
    $('#olist').innerHTML = h;
  }
}

/* ---------- events ---------- */
$('#mseg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; S.sub = b.dataset.s; S.armed = ''; draw(); refreshAll(); };
$('#mkq').oninput = draw;
$('#tb').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && b.dataset.v === 'market') { draw(); refreshAll(); } });
document.addEventListener('click', (e) => {
  const r = e.target.closest('[data-retry]'); if (r) { const k = r.dataset.retry; if (k === 'browse') loadBrowse(true); if (k === 'mine') loadMine(); if (k === 'orders') loadOrders(); }
  if (e.target.closest('[data-more]')) { S.page++; loadBrowse(false); }
});
setInterval(() => {                                      // keep orders fresh while the person is looking at them
  if (document.hidden || document.body.dataset.view !== 'market' || S.sub !== 'orders') return;
  loadOrders(true);
}, 20000);
$('#mgrid').onclick = (e) => { const b = e.target.closest('.mc'); if (b) openListing(b.dataset.id); };

function openListing(id) {
  const l = S.list.find((x) => x.id === id) || S.mine.find((x) => x.id === id); if (!l) return;
  const strip = (l.photos || []).length > 1 ? '<div style="display:flex;gap:8px;overflow-x:auto;margin-top:8px">' + l.photos.slice(1).map((u) => '<img src="' + esc(u) + '" alt="" style="height:70px;border-radius:10px" loading="lazy">').join('') + '</div>' : '';
  $('#mvb').innerHTML = pic(l, 1) + strip + '<div class="flex items-center justify-between" style="margin-top:14px"><b style="font-size:22px">' + kes(l.price) + '</b><span class="badge">Escrow protected</span></div><h3 style="margin:8px 0 4px;font-size:17px">' + esc(l.title) + '</h3><p class="note" style="margin-top:0">@' + esc(l.zone || 'Campus') + (l.condition ? ', ' + esc(l.condition) : '') + ', listed ' + ago(l.createdAt) + ' by @' + esc(l.seller ? l.seller.handle : 'Seller') + '</p><p style="font-size:13px;line-height:1.7;margin:12px 0;overflow-wrap:anywhere">' + esc(l.description || 'No description.') + '</p>';
  $('#mvbuy').hidden = !!l.mine || l.status !== 'approved'; $('#mvdm').hidden = !!l.mine; $('#mvbuy').dataset.id = id; $('#mvdm').dataset.id = id; openDm('mkview');
}
$('#mvdm').onclick = () => { const l = S.list.find((x) => x.id === $('#mvdm').dataset.id); if (!l) return; try { dmKey = 'mk:' + l.id; dmSnip = l.title; } catch (e) {} openDm('dm'); };

/* ---------- animated steps (escrow checkout and withdrawals) ---------- */
function stepsCss() {
  if (document.getElementById('cc-steps-css')) return;
  const st = document.createElement('style'); st.id = 'cc-steps-css';
  st.textContent = '.cs-h{margin:14px 0 0;font-size:13px;color:var(--mut)}.cs-h b{color:var(--fg);font-size:20px;display:block;margin-top:2px}'
    + '.cs-l{list-style:none;margin:16px 0 0;padding:0}.cs-m{margin:10px 0 0}'
    + '.cs-l .cs-s{display:flex;gap:14px;position:relative;padding-bottom:20px;opacity:.38;transition:opacity .45s}.cs-m .cs-s{padding-bottom:14px}.cs-l .cs-s:last-child{padding-bottom:0}'
    + '.cs-l .cs-s::before,.cs-l .cs-s::after{content:"";position:absolute;left:13px;top:30px;bottom:2px;width:2px;border-radius:2px}.cs-l .cs-s::before{background:var(--line)}'
    + '.cs-l .cs-s::after{background:var(--fg);transform:scaleY(0);transform-origin:top;transition:transform .6s ease .15s}.cs-l .cs-s:last-child::before,.cs-l .cs-s:last-child::after{display:none}'
    + '.cs-l .cs-s.d::after{transform:scaleY(1)}.cs-l .cs-s.a,.cs-l .cs-s.d,.cs-l .cs-s.f{opacity:1}'
    + '.cs-i{width:28px;height:28px;flex:none;border-radius:50%;border:2px solid var(--gb);background:var(--g);display:grid;place-items:center;position:relative;z-index:1;transition:background .35s,border-color .35s}'
    + '.cs-l .cs-s.a .cs-i{border-color:var(--fg);animation:cs-pulse 1.6s ease-out infinite}'
    + '.cs-l .cs-s.a .cs-i::after{content:"";width:12px;height:12px;border-radius:50%;border:2px solid var(--fg);border-top-color:transparent;animation:cs-spin .8s linear infinite}'
    + '.cs-l .cs-s.d .cs-i{background:var(--fg);border-color:var(--fg)}'
    + '.cs-l .cs-s.d .cs-i::after{content:"";width:6px;height:11px;border:solid var(--bg);border-width:0 2.5px 2.5px 0;transform:rotate(45deg) translate(-1px,-1px);animation:cs-pop .35s ease-out}'
    + '.cs-l .cs-s.f .cs-i{border-color:#f87171;background:rgba(248,113,113,.15)}.cs-l .cs-s.f .cs-i::after{content:"\\00d7";color:#f87171;font-size:20px;line-height:1;font-weight:700}'
    + '.cs-l b{display:block;font-size:14px;line-height:1.35;margin-top:3px}.cs-l small{display:block;font-size:12px;color:var(--mut);line-height:1.5;margin-top:2px;overflow-wrap:anywhere}'
    + '.cs-e{margin:14px 0 0;font-size:12px;color:#f87171;line-height:1.5}'
    + '@keyframes cs-spin{to{transform:rotate(360deg)}}@keyframes cs-pop{from{transform:rotate(45deg) translate(-1px,-1px) scale(0)}}'
    + '@keyframes cs-pulse{0%{box-shadow:0 0 0 0 rgba(128,128,128,.5)}100%{box-shadow:0 0 0 12px rgba(128,128,128,0)}}';
  document.head.appendChild(st);
}
const stepLi = (c, t, sub) => '<div class="cs-s ' + c + '"><span class="cs-i"></span><div><b>' + t + '</b><small>' + (sub || '') + '</small></div></div>';
// Money-in progress: send the prompt > enter the PIN > verify > done. go() takes 'send' | 'prompt' | 'manual' | 'verify' | 'done'.
// kind: 'escrow' (default) | 'deposit' | 'plan' | 'boost' | 'club'. Only the wording of the heading and the last step changes.
const PAYKIND = {
  escrow: ['Paying', 'Payment received', (a) => kes(a) + ' is held safely in escrow', 'Held safely in escrow'],
  deposit: ['Depositing', 'Money added to your wallet', (a) => kes(a) + ' is now in your wallet', 'Added to your wallet'],
  plan: ['Paying', 'Payment received', () => 'Your wholesaler plan is being switched on', 'Plan activated'],
  boost: ['Paying', 'Payment received', () => 'Your post is being pinned to the top', 'Boost activated'],
  club: ['Paying', 'Payment received', () => 'Your payment is confirmed', 'Payment confirmed'],
};
function paySteps(box, phone, amount, kind) {
  stepsCss();
  const K = PAYKIND[kind] || PAYKIND.escrow;
  let at = 0, manual = false, tm = 0, t0 = Date.now(), dead = false;
  const card = () => !!(window.ccCardMode && window.ccCardMode());
  const T = () => card()
    ? [['Opening secure card page', 'Visa or Mastercard'], ['Pay on the card page', 'Your card details never reach Comrade Connect'], ['Verifying payment', 'Confirming with the bank'], [K[1], K[2](amount)]]
    : manual
    ? [['Starting your payment', 'Reference created for ' + kes(amount)], ['Pay with M-Pesa, then enter the code', 'Waiting for your M-Pesa code'], ['Checking your payment', 'An admin confirms it, usually within a few minutes'], [K[3], K[2](amount)]]
    : [['Sending M-Pesa prompt', 'To ' + esc(phone)], ['Prompt sent. Enter your PIN', 'Check your phone'], ['Verifying payment', 'Confirming with M-Pesa'], [K[1], K[2](amount)]];
  const draw = (bad) => {
    box.innerHTML = '<p class="cs-h">' + K[0] + '<b>' + kes(amount) + '</b></p><div class="cs-l" role="status" aria-live="polite">'
      + T().map((x, i) => stepLi(bad && i === at ? 'f' : i < at || at === 4 ? 'd' : i === at ? 'a' : '', x[0], i === 1 && i === at && !bad ? '<span id="cs-t">' + (card() ? 'Finish on the card page' : 'Check your phone') + '</span>' : x[1])).join('') + '</div>';
  };
  const tick = () => { const n = box.querySelector('#cs-t'); if (!n) return; const s = Math.floor((Date.now() - t0) / 1000);
    n.textContent = (card() ? 'Finish on the card page' : manual ? 'Waiting for your M-Pesa code' : 'Check your phone') + ' (' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ')'
      + (!manual && !card() && s > 40 ? '. No prompt? Check the number you entered.' : ''); };
  const api = {
    go(st) {
      if (dead) return;
      if (st === 'manual') { manual = true; at = 1; } else at = { send: 0, prompt: 1, verify: 2, done: 4 }[st] ?? at;
      draw(false); clearInterval(tm); t0 = Date.now(); if (at === 1) tm = setInterval(tick, 1000);
    },
    fail(msg) { clearInterval(tm); draw(true); if (msg) box.insertAdjacentHTML('beforeend', '<p class="cs-e">' + esc(msg) + '</p>'); },
    stop() { dead = true; clearInterval(tm); },
  };
  api.go('send'); return api;
}
// Withdrawal progress (live, inside the withdraw sheet): request sent > request received > sending / admin > money sent.
// Polls the wallet until the withdrawal is paid or rejected (about 2 minutes for automatic payouts); a by-hand payout is shown as waiting for the admin.
function wdSteps(box, amount, phone) {
  stepsCss();
  let at = 0, dead = false, manual = false;
  const T = () => [['Sending your request', 'To ' + esc(phone)], ['Request received', kes(amount) + ' is set aside from your wallet'],
    [manual ? 'Being sent to your M-Pesa' : 'Sending to your M-Pesa now', manual ? 'Taking a little longer than usual. You can close this, we will tell you when it lands' : 'This usually takes under a minute'], ['Money sent to your M-Pesa', kes(amount) + ' (less any fee) is on its way to ' + esc(phone)]];
  const draw = (bad, last) => {
    box.innerHTML = '<p class="cs-h">Withdrawing<b>' + kes(amount) + '</b></p><div class="cs-l" role="status" aria-live="polite">'
      + T().map((x, i) => stepLi(bad && i === at ? 'f' : i < at || at === 4 ? 'd' : i === at ? 'a' : '', i === 3 && last ? last[0] : x[0], i === 3 && last ? last[1] : x[1])).join('') + '</div>';
  };
  const api = {
    go(n, m) { if (dead) return; at = n; if (m === 'manual') manual = true; draw(false); },
    done(ref) { if (dead) return; at = 4; draw(false, ['Money sent to your M-Pesa', ref ? 'M-Pesa ref ' + esc(ref) : 'Check your M-Pesa messages']); },
    fail(msg) { if (dead) return; draw(true); if (msg) box.insertAdjacentHTML('beforeend', '<p class="cs-e">' + esc(msg) + '</p>'); },
    stop() { dead = true; },
    get dead() { return dead; },
  };
  draw(false); return api;
}
// Runs a withdrawal request with live progress inside `box`. Resolves with { status } when it ends or is left waiting for the admin; throws a normal Error if the request is refused.
async function withdrawFlow(box, amount, phone, ask, poll) {
  const ws = wdSteps(box, amount, phone); ws.go(0); await sleep(500);
  let r;
  try { r = await ask(); } catch (e) { ws.fail(e.message); throw e; }
  ws.go(1); await sleep(900);
  const sending = r.status === 'sending'; ws.go(2, sending ? 'auto' : 'manual');
  if (!sending) return { status: 'requested', ws };
  for (let i = 0; i < 40 && !ws.dead; i++) {
    await sleep(3000);
    let w = null; try { w = await poll(r.id); } catch (e) { continue; }
    if (!w) continue;
    if (w.status === 'paid') { await sleep(400); ws.done(w.payout_ref); return { status: 'paid', ws }; }
    if (w.status === 'rejected') { ws.fail('The payout could not be sent. The money is back in your wallet.'); return { status: 'rejected', ws }; }
    if (w.status === 'requested') { ws.go(2, 'manual'); return { status: 'requested', ws }; }   // the automatic payout gave up and left it for an admin
  }
  return { status: 'sending', ws };
}
// Withdrawal tracker shown under each request in the wallet.
function wdTrack(x) {
  stepsCss();
  const paid = x.status === 'paid', rej = x.status === 'rejected';
  return '<div class="cs-l cs-m">' + stepLi('d', 'Request sent', ago(Date.parse(x.created_at)))
    + stepLi(paid ? 'd' : rej ? 'f' : 'a', rej ? 'Could not be sent' : paid ? 'Approved' : x.status === 'sending' ? 'Sending to your M-Pesa now' : 'Being sent to your M-Pesa', rej ? 'The money is back in your wallet' : paid ? '' : x.status === 'sending' ? 'This usually takes under a minute' : 'Taking a little longer than usual')
    + (rej ? '' : stepLi(paid ? 'd' : '', 'Money sent to your M-Pesa', paid && x.payout_ref ? 'M-Pesa ref ' + esc(x.payout_ref) : '')) + '</div>';
}

/* ---------- buy ---------- */
const bs = (n) => $$('#dm [data-bs]').forEach((x) => { x.hidden = x.dataset.bs !== String(n); });
$('#mvbuy').onclick = () => {
  const l = S.list.find((x) => x.id === $('#mvbuy').dataset.id); if (!l) return; S.buyL = l;
  $('#bt').textContent = l.title; $('#bp').textContent = kes(l.price); $('#bh').textContent = kes(l.price);
  $('#bn').textContent = 'The seller receives ' + kes(net(l.price)) + ' after a ' + FEE + '% fee, and only after you confirm you received the item.';
  S.usePts = false; S.ptsKsh = 0; { const el = $('#bpts'); if (el) el.remove(); }
  call('/api/points').then((pt) => {   // points can only cover the platform fee on this purchase
    const c = Math.min(Math.floor((l.price * FEE) / 100 + 1e-9), Math.floor(pt.points / (pt.per_ksh || CFG.ppk)));
    if (c < 1 || S.buyL !== l) return; S.ptsKsh = c;
    const row = document.createElement('label'); row.id = 'bpts'; row.className = 'sub'; row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:10px';
    row.innerHTML = '<input type="checkbox"> Use ' + (c * (pt.per_ksh || CFG.ppk)) + ' points to save ' + kes(c) + ' on this item';
    row.querySelector('input').onchange = (e) => { S.usePts = e.target.checked; $('#bp').textContent = kes(l.price - (S.usePts ? c : 0)); };
    $('#bn').after(row);
  }).catch(() => {});
  bs(1); $('#bph').value = ''; $('#bpe').textContent = ''; openDm('buy');
};
$('#bpay').onclick = async () => {
  if (S.paying || !S.buyL) return;
  const v = $('#bph').value.replace(/\s/g, '');
  if (!/^(07|01)(?!(\d)\2{7}$)\d{8}$/.test(v)) return ($('#bpe').textContent = 'Enter a Safaricom or Airtel number like 0712345678.');
  const l = S.buyL; S.paying = true; bs(3);
  const pay = l.price - (S.usePts ? S.ptsKsh : 0), ps = paySteps($('#dm [data-bs="3"]'), v, pay);
  try {
    const d = await call('/api/market/buy', { body: { listing_id: l.id, phone: v, use_points: !!S.usePts } });
    try { localStorage.setItem('cc_pending', JSON.stringify({ id: d.id, amount: d.amount, t: Date.now() })); } catch (e) {}
    ps.go('prompt');
    await waitPaid(d.id, (st) => ps.go(st));
    try { localStorage.removeItem('cc_pending'); } catch (e) {}
    ps.go('done'); await sleep(1100);                        // let the last tick play before the receipt screen
    S.list = S.list.filter((x) => x.id !== l.id);
    $('#bok').textContent = 'Payment received. ' + kes(d.amount) + (d.credit ? ' plus ' + kes(d.credit) + ' of points' : '') + ' for ' + l.title + ' is held safely in escrow. Tap Done to see it under Orders.';
    bs(4); ccTick($('#bok')); loadOrders(true);
    try { window.ccReceipt && ccReceipt.show({ item: l.title, amount: d.amount, credit: d.credit, ref: d.id, via: 'M-Pesa', onDone: () => { try { $('#bdone').click(); } catch (e) {} } }); } catch (e) {}
  } catch (e) {
    if (e.pending) { ps.stop(); toast(e.message); shut(); S.sub = 'orders'; draw(); loadOrders(); }
    else { ps.fail(e.message); await sleep(1800); $('#bpe').textContent = e.message; bs(1); }
  }
  ps.stop(); S.paying = false;
};
$('#bdone').onclick = () => { shut(); S.sub = 'orders'; draw(); loadOrders(); };
['dx5', 'dx6', 'dx7'].forEach((i) => { $('#' + i).onclick = shut; });

/* ---------- seller number, shown to the buyer after payment ---------- */
function sellerBox(p) {
  const loc = '0' + String(p).replace(/^254/, ''), intl = String(p).replace(/\D/g, '');
  return '<div style="padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.06);margin-bottom:10px"><span class="sub" style="display:block;margin:0">Seller phone number</span><b style="font-size:18px;letter-spacing:1px">' + esc(loc) + '</b>'
    + '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><a class="btn g" style="text-decoration:none;padding:8px 14px" href="tel:+' + esc(intl) + '">Call</a><a class="btn g" style="text-decoration:none;padding:8px 14px" target="_blank" rel="noopener" href="https://wa.me/' + esc(intl) + '">WhatsApp</a></div>'
    + '<span class="note" style="display:block;margin-top:6px">Use it only to arrange the handover. Keep the payment inside the app so you stay protected.</span></div>';
}
/* ---------- sell ---------- */
async function toJpeg(file) {
  const bmp = await createImageBitmap(file), s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Could not read that photo');
  if (blob.size > 5 * 1048576) throw new Error('That photo is still over 5 MB. Try a smaller one.');
  return blob;
}
function drawPrev() {
  $('#mprev').innerHTML = S.photos.map((p, i) => '<span style="position:relative;display:inline-block;margin:0 8px 8px 0"><img src="' + p.url + '" alt="" style="height:90px;border-radius:12px"><button type="button" class="act" data-rp="' + i + '" aria-label="Remove photo" style="position:absolute;top:2px;right:2px;padding:2px 8px">x</button></span>').join('')
    + (S.photos.length ? '<div class="note">' + S.photos.length + ' of ' + (window.ccPhotoCap || 5) + ' photos added.</div>' : '');
}
window.resetSell = () => {
  S.photos.forEach((p) => URL.revokeObjectURL(p.url)); S.photos = []; S.sending = false; drawPrev();
  ['mti', 'mpr', 'mde'].forEach((i) => { $('#' + i).value = ''; });
  $('#mzo').innerHTML = ZONES.concat(['Other']).map((z) => '<option>' + esc(z) + '</option>').join('');
  $('#mcp').value = ST.get('cc_sellphone', '') || ST.get('cc_phone', '');
  $('#msub').disabled = false; $('#msub').textContent = 'Post item';
};
$('#mprev').onclick = (e) => { const b = e.target.closest('[data-rp]'); if (!b) return; const p = S.photos.splice(+b.dataset.rp, 1)[0]; if (p) URL.revokeObjectURL(p.url); drawPrev(); };
async function addPhoto(f) {
  if (!f) return;
  if (!f.type.startsWith('image/')) return toast('Listings take photos only. Videos go in Clips.');
  if (S.photos.length >= (window.ccPhotoCap || 5)) return toast((window.ccPhotoCap || 5) > 5 ? 'Up to ' + window.ccPhotoCap + ' photos per listing' : 'Up to 5 photos per listing. Join the wholesalers community (Me page) to add more.');
  try { const blob = await toJpeg(f); S.photos.push({ blob, url: URL.createObjectURL(blob) }); drawPrev(); } catch (e) { toast(e.message || 'Could not use that photo'); }
}
['mphi', 'mgi'].forEach((i) => { $('#' + i).onchange = (e) => { addPhoto(e.target.files[0]); e.target.value = ''; }; });
$('#mph').onclick = () => $('#mphi').click(); $('#mgal').onclick = () => $('#mgi').click();
// Sends a file to Supabase Storage with the one-time upload URL the Worker gave us (same call the official Supabase client makes).
async function putFile(url, blob, type) {
  const fd = new FormData();
  fd.append('cacheControl', '3600');
  fd.append('', new Blob([blob], { type: type || blob.type }));
  return fetch(url, { method: 'PUT', body: fd });
}
async function uploadPhoto(listingId, blob) {
  const u = await call('/api/media/upload-url', { body: { kind: 'listing_photo', content_type: 'image/jpeg', bytes: blob.size, listing_id: listingId } });
  let r; try { r = await putFile(u.upload_url, blob, 'image/jpeg'); } catch (e) { throw new Error('The photo upload did not go through. Check your connection and try again.'); }
  if (!r.ok) throw new Error('The photo did not upload (' + r.status + '). Try again.');
  await call('/api/media/' + u.id + '/complete', { body: {} });
}
$('#msub').onclick = async () => {
  if (S.sending) return;
  const t = $('#mti').value.trim(), p = Math.round(+$('#mpr').value), d = $('#mde').value.trim();
  if (t.length < 3) return toast('Add a title for your item');
  if (!(p >= CFG.pmin && p <= CFG.pmax)) return toast('Enter a price between KSh ' + CFG.pmin.toLocaleString('en-US') + ' and KSh ' + CFG.pmax.toLocaleString('en-US'));
  if (!S.photos.length) return toast('Add at least one photo so buyers can see the item');
  const cp = $('#mcp').value.replace(/[\s-]/g, '');
  if (!/^(07|01)\d{8}$/.test(cp) && !/^\+?254[17]\d{8}$/.test(cp)) return toast('Add your phone number like 0712345678. Buyers see it only after they pay.');
  const wh = wordHit(t + ' ' + d); if (wh) modLog('listing', t + ' ' + d);
  if (wh || contactHit(t + ' ' + d)) return toast('Remove phone numbers, handles and links. Buyers can message you inside Comrade Connect.');
  const bot = BOT.on ? spillBot(t + ' ' + d, p) : { v: 'approve', why: '' };
  if (bot.v === 'reject') return toast('Spill Bot: ' + botSay('moderator', t + ' ' + d));
  if (p > 15000 && !idOK()) return needId();
  S.sending = true; const btn = $('#msub'); btn.disabled = true; btn.textContent = 'Uploading...';
  let id = null;
  try {
    const l = await call('/api/market/listings', { body: { title: t, description: d || 'No description.', price: p, zone: $('#mzo').value, condition: $('#mco').value, contact_phone: cp, category: ($('#mcat') || {}).value || 'General' } });
    id = l.id; ST.set('cc_sellphone', cp);
    for (let i = 0; i < S.photos.length; i++) { btn.textContent = 'Uploading photo ' + (i + 1) + ' of ' + S.photos.length + '...'; await uploadPhoto(id, S.photos[i].blob); }
    shut(); S.sub = 'mine'; draw(); loadMine(); toast(l.status === 'approved' ? 'Your item is live' : 'Sent for admin verification');
  } catch (e) {
    if (id) { try { await call('/api/market/listings/' + id + '/remove', { body: {} }); } catch (x) {} }
    toast(e.message || 'Could not send your listing');
  }
  S.sending = false; btn.disabled = false; btn.textContent = 'Post item';
};
$('#msell').onclick = () => openDm('sell');

/* ---------- my listings, orders ---------- */
$('#mlist').onclick = async (e) => {
  const b = e.target.closest('button[data-a]'); if (!b || b.dataset.a !== 'rm') return;
  const id = b.dataset.id;
  if (S.armed !== id + 'rm') { S.armed = id + 'rm'; draw(); setTimeout(() => { S.armed = ''; draw(); }, 5000); return; }
  S.armed = '';
  try { await call('/api/market/listings/' + id + '/remove', { body: {} }); toast('Listing removed'); } catch (err) { toast(err.message); }
  loadMine();
};
function askReason(done) {
  const m = sheet('<h3>Report a problem</h3><p class="sub" style="margin-top:6px">Say what went wrong. An admin will read it and decide. Do not put phone numbers or links.</p><div class="fld" style="margin-top:10px"><textarea id="ccwhy" maxlength="300" style="height:90px;resize:none" aria-label="What went wrong"></textarea></div><p class="sub" id="ccwhy-e" style="color:#f87171;min-height:18px"></p><div class="two"><button class="btn g" id="ccwhy-x">Cancel</button><button class="btn p" id="ccwhy-go">Send</button></div>');
  m.querySelector('#ccwhy-x').onclick = () => m.close();
  m.querySelector('#ccwhy-go').onclick = async () => {
    const v = m.querySelector('#ccwhy').value.trim(); if (v.length < 5) return (m.querySelector('#ccwhy-e').textContent = 'Write at least a few words.');
    const g = m.querySelector('#ccwhy-go'); g.disabled = true;
    try { await done(v); m.close(); } catch (e) { m.querySelector('#ccwhy-e').textContent = e.message; g.disabled = false; }
  };
}
$('#olist').onclick = async (e) => {
  const b = e.target.closest('button[data-a]'); if (!b) return;
  const id = b.dataset.id, k = b.dataset.a, o = S.orders.find((x) => x.id === id); if (!o) return;
  try {
    if (k === 'received') {
      if (S.armed !== id + k) { S.armed = id + k; draw(); setTimeout(() => { S.armed = ''; draw(); }, 5000); return; }
      S.armed = ''; await call('/api/orders/' + id + '/received', { body: {} }); toast('Money released to the seller. Thanks for confirming.');
    } else if (k === 'withdraw') { $('#wd').click(); return; }
    else if (k === 'handed') { await call('/api/orders/' + id + '/handed', { body: {} }); toast('Marked as handed over.'); }
    else if (k === 'code') {
      const v = ((b.parentElement.querySelector('.hc') || {}).value || '').replace(/\D/g, '');
      if (v.length !== 6) return toast('Enter the buyer\'s 6-digit code');
      await call('/api/orders/' + id + '/confirm', { body: { code: v } }); toast('Money released to your wallet.');
    } else if (k === 'dispute') { askReason(async (why) => { await call('/api/orders/' + id + '/dispute', { body: { reason: why } }); toast('Dispute opened. An admin will review it.'); loadOrders(); }); return; }
  } catch (err) { toast(err.message); }
  loadOrders();
};

/* ---------- cancel a withdrawal the admin has not paid yet ---------- */
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-wdc]'); if (!b) return;
  if (!confirm('Cancel this withdrawal? The money goes back to your wallet.')) return;
  b.disabled = true;
  try { await call('/api/wallet/withdraw/' + b.dataset.wdc + '/cancel', { body: {} }); toast('Cancelled. Money is back in your wallet.'); loadOrders(); }
  catch (err) { toast(err.message); b.disabled = false; }
});

/* ---------- wallet withdrawal ---------- */
$('#wd').onclick = async () => {
  const bal = S.wallet ? S.wallet.balance : 0; if (!bal) return;
  if (!idOK()) return needId();
  if (typeof bioGate === 'function' && !(await bioGate())) return toast('Fingerprint check failed');
  const m = sheet('<h3>Withdraw to M-Pesa</h3><p class="sub" style="margin-top:6px">Available: ' + kes(bal) + '. The money is sent straight to your M-Pesa, usually within a minute. Smallest withdrawal: ' + kes(CFG.min) + '. Largest: ' + kes(CFG.max) + '.' + (CFG.wfp || CFG.wff ? ' Withdrawal fee: ' + (CFG.wfp ? CFG.wfp + '%' : '') + (CFG.wfp && CFG.wff ? ' + ' : '') + (CFG.wff ? kes(CFG.wff) : '') + '.' : '') + '</p>'
    + '<div class="fld" style="margin-top:10px"><input id="ccwp" inputmode="numeric" maxlength="12" placeholder="M-Pesa number, e.g. 0712345678" aria-label="M-Pesa number"></div>'
    + '<div class="fld"><input id="ccwa" type="number" inputmode="numeric" value="' + Math.min(bal, CFG.max) + '" aria-label="Amount in KSh"></div>'
    + '<p class="sub" id="ccw-e" style="color:#f87171;min-height:18px"></p><div class="two"><button class="btn g" id="ccw-x">Cancel</button><button class="btn p" id="ccw-go">Request</button></div>');
  m.querySelector('#ccw-x').onclick = () => m.close();
  m.querySelector('#ccwp').value = '';
  m.querySelector('#ccw-go').onclick = async () => {
    const amount = Math.floor(+m.querySelector('#ccwa').value), phone = m.querySelector('#ccwp').value.replace(/\s/g, ''), er = m.querySelector('#ccw-e');
    if (!(amount >= CFG.min && amount <= Math.min(bal, CFG.max))) return (er.textContent = 'Enter an amount from ' + kes(CFG.min) + ' up to ' + kes(Math.min(bal, CFG.max)));
    if (!/^(07|01)\d{8}$/.test(phone)) return (er.textContent = 'Enter a Safaricom or Airtel number like 0712345678.');
    const g = m.querySelector('#ccw-go'); g.disabled = true;
    const box = m.firstChild; box.innerHTML = '<div id="ccw-prog"></div><button class="btn p" id="ccw-ok" style="width:100%;margin-top:14px" hidden>Done</button>';
    const ok = box.querySelector('#ccw-ok'); ok.onclick = () => m.close();
    try {
      const r = await withdrawFlow(box.querySelector('#ccw-prog'), amount, phone, () => call('/api/wallet/withdraw', { body: { amount, phone } }),
        async (id) => ((await call('/api/wallet')).withdrawals || []).find((x) => x.id === id));
      ok.hidden = false; r.ws.stop(); loadOrders();
    } catch (err) { ok.hidden = false; ok.textContent = 'Close'; }
  };
};

draw();
if (document.body.dataset.view === 'market') refreshAll();

/* ---------- ID verification status (server is the truth) ---------- */
async function syncVer() {
  const a = window.ccAuth && window.ccAuth();
  if (!connected() || !a || !a.token) return;                          // never prompts: only runs for a signed-in phone
  try {
    const d = await call('/api/verify/status', { auth: false }), r = d.request;
    if (d.verified) ME.ver = { st: 'approved', role: d.badge || 'Student', waitBadge: r && r.status === 'pending' && r.claimed_role && r.claimed_role !== 'Student' ? r.claimed_role : '' };
    else if (r && r.status === 'pending') ME.ver = { st: 'pending', role: r.claimed_role || 'Student', bc: { st: r.barcode_check || 'none' } };
    else if (r && r.status === 'rejected') ME.ver = { st: 'rejected', role: r.claimed_role || 'Student', note: r.decision_note || '' };
    else ME.ver = null;
    saveMe(); if (typeof drawVer === 'function') drawVer();
  } catch (e) { /* offline: keep what the phone last knew */ }
}
window.ccSyncVer = syncVer;
document.getElementById('tb') && document.getElementById('tb').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && b.dataset.v === 'me') syncVer(); });

/* ---------- referrals ---------- */
const REF_RE = /^[A-Z0-9]{4,12}$/;
try {                                                                   // remember ?ref=CODE from the invite link until it has been used
  const q = (new URLSearchParams(location.search).get('ref') || '').trim().toUpperCase();
  if (REF_RE.test(q)) ST.set('cc_ref', q);
} catch (e) {}
let refBusy = false;
async function attributeRef() {                                         // after the account exists; safe to call any time
  const code = ST.get('cc_ref', ''), a = window.ccAuth && window.ccAuth();
  if (!code || !connected() || !a || !a.token || refBusy) return;
  refBusy = true;
  try { await call('/api/referral/attribute', { body: { code }, auth: false }); ST.set('cc_ref', ''); toast('Invite code applied. Your friend earns a reward after your first purchase.'); }
  catch (e) { if (e.status && e.status < 500 && e.status !== 401 && e.status !== 429) ST.set('cc_ref', ''); }   // used up, invalid, own code or too late: stop trying; network or server trouble: try again next time
  refBusy = false; refreshReferral(true);
}
async function refreshReferral(quiet, signIn) {
  const set = (o) => { window.ccRef = o; if (typeof drawLedger === 'function') drawLedger(); };
  if (!connected()) return set({ state: 'none' });
  let a = window.ccAuth && window.ccAuth();
  if (!a || !a.token) {
    if (!signIn) return set({ state: 'none' });
    try { await ensureAccount(); } catch (e) { return toast(e.message || 'Could not sign in'); }
  }
  if (!quiet) set({ state: 'loading' });
  try {
    const d = await call('/api/referral/me', { auth: false });
    set({ state: 'ok', code: d.code, pending: d.pending, unlocked: d.unlocked, earned: d.earned, unlock_days: d.unlock_days, by: d.referred_by_someone });
    if (ST.get('cc_ref', '')) attributeRef();
  } catch (e) { set(window.ccRef && window.ccRef.state === 'ok' ? window.ccRef : { state: 'error' }); }
}
window.ccRefresh = refreshReferral;
window.ccUseCode = async (code) => {
  code = String(code || '').trim().toUpperCase();
  if (!REF_RE.test(code)) return toast('That code does not look right');
  try { await ensureAccount(); await call('/api/referral/attribute', { body: { code } }); ST.set('cc_ref', ''); toast('Code applied. Your friend earns a reward after your first purchase.'); }
  catch (e) { toast(e.message); }
  refreshReferral(true);
};
if (window.ccAuth && window.ccAuth()) { attributeRef(); syncVer(); }


/* ---------- anonymous messages (server) ---------- */
const DM = { on: false, pending: false, tid: null, ref: null, lid: null, title: '', msgs: [], timer: null, sending: false, muted: false, blocked: false };
const LOCAL_NOTE = $('#dmnote') ? $('#dmnote').textContent : '';
const dmSection = () => document.querySelector('#dm section[data-v=dm]');
function drawMsgs() {
  const box = $('#dmlog');
  box.innerHTML = DM.msgs.length ? DM.msgs.map((x) => x.system ? '<p class="note" style="justify-self:center;text-align:center">' + esc(x.body) + '</p>'
    : '<div class="bub" data-mid="' + esc(x.id) + '" data-mine="' + (x.mine ? 1 : 0) + '" style="' + (x.mine ? '' : 'justify-self:start;background:var(--card2,#2a2a2a);color:inherit;cursor:pointer') + '">' + esc(x.body) + '</div>').join('')
    : '<p class="note" style="justify-self:start">No messages yet. Say hi.</p>';
  box.scrollTop = box.scrollHeight;
  $('#dmact').hidden = !DM.tid; $('#dmhint').hidden = !DM.tid || !DM.msgs.some((x) => !x.mine && !x.system);
  const mb = $('#dmact [data-m=mute]'), bb = $('#dmact [data-m=block]');
  mb.textContent = DM.muted ? 'Muted for 24 hours' : 'Mute 24 hours'; bb.textContent = DM.blocked ? 'Unblock' : 'Block';
}
async function loadThread(quiet) {
  if (!DM.tid) return;
  try { const d = await call('/api/messages/thread/' + DM.tid, { auth: false }); DM.msgs = d.messages || []; drawMsgs(); }
  catch (e) { if (!quiet) toast(e.message); }
}
async function findThread() {                                       // for a listing: is there already a conversation about it?
  const a = window.ccAuth && window.ccAuth(); if (!a || !a.token || !DM.lid) return;
  try { const d = await call('/api/messages/inbox', { auth: false }), t = (d.threads || []).find((x) => x.listing && x.listing.id === DM.lid); if (t) { DM.tid = t.id; DM.muted = t.muted; DM.blocked = t.blocked; } } catch (e) {}
}
const stopPoll = () => { clearInterval(DM.timer); DM.timer = null; };
const origBuildDm = typeof buildDm === 'function' ? buildDm : function () {};
window.buildDm = function () {
  stopPoll();
  if (!DM.pending) { DM.on = false; $('#dmnote').textContent = LOCAL_NOTE; $('#dmact').hidden = true; $('#dmhint').hidden = true; return origBuildDm(); }
  DM.pending = false; DM.on = true;
  $('#dmnote').textContent = 'Neither of you sees the other\'s name. Numbers, handles, links and off-site payments are blocked.';
  $('#dmq').textContent = DM.title ? 'About: ' + DM.title : '';
  drawMsgs();
  (async () => {
    if (!DM.tid) await findThread();
    await loadThread(true);
    DM.timer = setInterval(() => { const sec = dmSection(); if (!$('#dm').classList.contains('on') || !sec || sec.hidden || !DM.on) return stopPoll(); loadThread(true); }, 15000);
  })();
};
function openThread(o) { Object.assign(DM, { tid: o.tid || null, ref: o.ref || null, lid: o.lid || (o.ref ? o.ref.id : null), title: o.title || '', msgs: [], muted: false, blocked: false, pending: true }); openDm('dm'); }
$('#mvdm').onclick = () => {                                       // Market: message the seller about this item
  const l = S.list.find((x) => x.id === $('#mvdm').dataset.id); if (!l) return;
  if (!connected()) { try { dmKey = 'mk:' + l.id; dmSnip = l.title; } catch (e) {} return openDm('dm'); }
  openThread({ lid: l.id, title: l.title });
};
const oldDmSubmit = $('#dmf').onsubmit;
$('#dmf').onsubmit = async (e) => {
  if (!DM.on) return oldDmSubmit.call($('#dmf'), e);
  e.preventDefault();
  const i = $('#dmi'), t = i.value.trim(); if (!t || DM.sending) return;
  if (typeof contactHit === 'function' && contactHit(t)) return toast('Remove phone numbers, handles and links. Keep the chat inside Comrade Connect.');
  DM.sending = true;
  try {
    const d = await call('/api/messages/send', { body: DM.tid ? { thread_id: DM.tid, body: t } : DM.ref ? { ref_type: DM.ref.type, ref_id: DM.ref.id, body: t } : { listing_id: DM.lid, body: t } });
    DM.tid = d.thread_id; i.value = ''; await loadThread(true);
    if (!DM.timer) DM.timer = setInterval(() => { const sec = dmSection(); if (!$('#dm').classList.contains('on') || !sec || sec.hidden || !DM.on) return stopPoll(); loadThread(true); }, 15000);
  } catch (err) { toast(err.message); }
  DM.sending = false;
};
let blockArmed = false;
$('#dmact').onclick = async (e) => {
  const b = e.target.closest('button[data-m]'); if (!b || !DM.tid) return;
  try {
    if (b.dataset.m === 'mute') { await call('/api/messages/mute', { body: { thread_id: DM.tid } }); DM.muted = true; toast('Muted for 24 hours'); }
    else if (DM.blocked) { await call('/api/messages/unblock', { body: { thread_id: DM.tid } }); DM.blocked = false; toast('Unblocked'); }
    else if (!blockArmed) { blockArmed = true; b.textContent = 'Tap again to block'; setTimeout(() => { blockArmed = false; drawMsgs(); }, 5000); return; }
    else { blockArmed = false; await call('/api/messages/block', { body: { thread_id: DM.tid } }); DM.blocked = true; toast('Blocked. They cannot message you.'); }
  } catch (err) { toast(err.message); }
  drawMsgs();
};
$('#dmlog').addEventListener('click', (e) => {                      // tap a message from the other person to report it
  const b = e.target.closest('.bub[data-mid]'); if (!b || !DM.on || b.dataset.mine === '1') return;
  askReason(async (why) => { await call('/api/messages/report', { body: { message_id: b.dataset.mid, reason: why } }); toast('Reported. An admin will read it.'); });
});
/* inbox in Me */
async function drawInbox() {
  const a = window.ccAuth && window.ccAuth(); if (!connected() || !a || !a.token) return;
  try {
    const d = await call('/api/messages/inbox', { auth: false }), ts = d.threads || [];
    $('#dml').innerHTML = ts.length ? ts.map((t) => '<div class="rw"><span>' + esc(t.listing && t.listing.title ? t.listing.title : 'Chat with @' + t.with)
      + '<small>' + (t.last ? (t.last.mine ? 'You: ' : '') + esc(t.last.body.slice(0, 40)) : 'No messages') + (t.muted ? ' (muted)' : '') + (t.blocked ? ' (blocked)' : '') + '</small></span>'
      + '<button class="act" data-t="' + esc(t.id) + '" data-n="' + esc(t.listing && t.listing.title || '') + '">Open' + (t.unread ? ' (' + t.unread + ')' : '') + '</button></div>').join('')
      : '<p class="sub">No messages yet. Open a Market item and tap "Message seller anonymously".</p>';
  } catch (e) { /* offline: keep what is shown */ }
}
const origDrawMe2 = typeof drawMe2 === 'function' ? drawMe2 : function () {};
window.drawMe2 = function () { origDrawMe2.apply(this, arguments); drawInbox(); };
const oldDml = $('#dml').onclick;
$('#dml').onclick = (e) => {
  const b = e.target.closest('button[data-t]');
  if (b) { const t = b.dataset.t; return openThread({ tid: t, title: b.dataset.n }); }
  if (oldDml) oldDml.call($('#dml'), e);
};

/* ---------- Explore on the server: roommates, study groups, polls, Hearts, Wi-Fi, hostels, services, study tips, zone ratings ---------- */
const XK = { rm: 'rooms', sg: 'groups', pl: 'polls', ht: 'hearts', wf: 'wifi', hs: 'hostels', sv: 'services', sn: 'tips' };
const XT = { rm: 'room', sg: 'group', pl: 'poll', ht: 'hearts', wf: 'wifi', hs: 'hostel', sv: 'service', sn: 'tip' };
const ZONED = new Set(['rm', 'ht', 'wf', 'hs', 'sv']);                     // tabs the server can filter by zone
const SVC = ['Printing', 'Cyber', 'Gas refill', 'Laundry', 'Food', 'Boda', 'General'];
const EX = {}, GONE = new Set(), LIKED = new Set();
const exs = (k) => (EX[k] = EX[k] || { items: [], page: 1, more: false, loading: false, error: '', loaded: false, at: 0, zone: 'All', cat: 'All', q: '', form: false, gate: false, busy: false, seq: 0 });
const hasAuth = () => { const a = window.ccAuth && window.ccAuth(); return !!(a && a.token); };
const xon = () => connected() && !!XK[xt];                                // only the tabs the Worker serves; Notices, Events, Top spills and Search keep their own screens
const rent$ = (n) => (n || n === 0) ? 'KSh ' + Number(n).toLocaleString('en-KE') : '';
const xopt = (a, sel) => a.map((x) => '<option' + (x === sel ? ' selected' : '') + '>' + esc(x) + '</option>').join('');
const xin = (id, ph, m, extra) => '<div class="fld" style="margin-top:10px"><input id="' + id + '" maxlength="' + (m || 60) + '" placeholder="' + esc(ph) + '"' + (extra || '') + '></div>';

async function loadX(k, reset) {
  const s = exs(k); if (s.loading) return;
  if (k === 'ht' && !hasAuth()) { s.gate = true; s.loaded = true; if (xt === k) paintX(); return; }
  s.loading = true; s.error = ''; const seq = ++s.seq;
  if (reset) s.page = 1;
  if (xt === k) paintX();
  try {
    const qs = '?page=' + s.page + (ZONED.has(k) && s.zone !== 'All' ? '&zone=' + encodeURIComponent(s.zone) : '') + ((k === 'wf' || k === 'hs') && s.kind ? '&kind=' + s.kind : '');
    const d = await call('/api/c/' + XK[k] + qs, { auth: k === 'ht' ? undefined : false });
    if (seq !== s.seq) return;                                                // a newer request (zone changed) owns the list
    s.items = s.page === 1 ? d.items || [] : s.items.concat(d.items || []); s.more = !!d.hasMore; s.loaded = true; s.gate = false; s.at = Date.now();
  } catch (e) {
    if (seq !== s.seq) return;
    if (k === 'ht' && e.status === 403) s.gate = true; else { s.error = e.message; if (s.page > 1) s.page--; }
  }
  s.loading = false; if (xt === k) paintX();
}

const zchips = (s) => '<div class="tabs z" style="padding:0">' + ['All'].concat(ZONES).map((z) => '<button class="tab g' + (z === s.zone ? ' on' : '') + '" data-xz="' + esc(z) + '">' + esc(z) + '</button>').join('') + '</div>';
const xadd = (t) => '<button class="btn p" data-xa="new" style="width:100%">' + t + '</button>';
const xmore = (s) => s.more ? '<button class="btn g" data-xa="more" style="width:100%"' + (s.loading ? ' disabled' : '') + '>' + (s.loading ? 'Loading...' : 'Load more') + '</button>' : '';
const xempty = (s, m) => s.error ? '<p class="sub"><button class="btn g" data-xa="retry">Could not load. Tap to retry</button><br>' + esc(s.error) + '</p>' : (!s.loaded || (s.loading && !s.items.length) ? '<p class="sub">Loading...</p>' : '<div class="empty">' + m + '</div>');
const xbar = (inner) => '<div class="bar">' + inner + '</div>';
const xmsg = (x, who) => '<button class="act" data-xa="dm" data-id="' + esc(x.id) + '">Message ' + who + ' anonymously</button>';
const xrep = (x) => '<button class="act" data-xa="rp" data-id="' + esc(x.id) + '">Report</button>';
const xwhen = (x) => '<span class="views">' + esc(ago(x.createdAt)) + '</span>';
const visible = (k) => exs(k).items.filter((x) => !GONE.has(k + ':' + x.id));

const XP = {
  rm(s, L) {
    return '<div class="box g"><b style="font-size:13px">Stay safe</b><p class="sub" style="margin-top:6px">Visit the room before you pay. Meet in a public place first. Never send a deposit to someone you have not met. Report anything that looks like a scam.</p></div>' + xadd('Post a room or roommate request') + zchips(s)
      + (L.length ? L.map((r) => '<article class="box g"><div class="flex items-center justify-between"><span><span class="badge">' + (r.kind === 'offering' ? 'Has a room' : 'Needs a roommate') + '</span><span class="badge" style="margin-left:6px">@' + esc(r.zone) + '</span></span>' + xwhen(r) + '</div>'
        + (r.rent ? '<p style="margin:12px 0 4px;font-weight:600">' + rent$(r.rent) + ' a month</p>' : '') + '<p class="sub" style="margin:8px 0 14px;overflow-wrap:anywhere">' + esc(r.details || r.title) + '</p>'
        + xbar(r.mine ? '<span class="views">Your post</span>' : xmsg(r, '') + xrep(r)) + '</article>').join('') : xempty(s, 'No roommate posts here yet. Be the first.')) + xmore(s);
  },
  sg(s, L) {
    return xadd('Start a study group') + (L.length ? L.map((g) => '<article class="box g"><div class="flex items-center justify-between"><b style="font-size:16px">' + esc(g.name) + '</b>' + xwhen(g) + '</div><p class="sub" style="margin:8px 0 14px;overflow-wrap:anywhere">'
      + esc(g.details || '') + (g.details ? '<br>' : '') + g.members + ' of ' + g.max_members + ' comrades joined</p>'
      + xbar('<button class="act' + (g.joined ? ' liked' : '') + '" data-xa="join" data-id="' + esc(g.id) + '">' + (g.joined ? 'Joined. Tap to leave' : (g.members >= g.max_members ? 'Full' : 'Join')) + '</button>' + (g.mine ? '<span class="views">Your group</span>' : xmsg(g, 'organiser') + xrep(g))) + '</article>').join('') : xempty(s, 'No study groups yet. Start one.')) + xmore(s);
  },
  pl(s, L) {
    return xadd('Create a poll') + (L.length ? L.map((p) => {
      const tot = (p.counts || []).reduce((a, b) => a + b, 0), show = p.voted !== null && p.voted !== undefined || p.closed;
      return '<article class="box g"><div class="flex items-center justify-between" style="gap:10px"><b style="font-size:15px;line-height:1.4;overflow-wrap:anywhere">' + esc(p.question) + '</b></div>'
        + p.options.map((o, i) => { const pc = tot ? Math.round(p.counts[i] / tot * 100) : 0; return '<button class="opt" data-xa="vote" data-id="' + esc(p.id) + '" data-i="' + i + '"' + (show ? ' disabled' : '') + '><i style="width:' + (show ? pc : 0) + '%"></i><span>' + esc(o) + (p.voted === i ? ' (your vote)' : '') + '</span>' + (show && tot ? '<span style="float:right">' + pc + '%</span>' : '') + '</button>'; }).join('')
        + '<div class="flex items-center justify-between" style="margin-top:10px"><span class="sub" style="font-size:11px">' + tot + ' votes' + (p.closed ? ', closed' : '') + '</span>' + (p.mine ? '' : xrep(p)) + '</div></article>';
    }).join('') : xempty(s, 'No polls yet. Create the first one.')) + xmore(s);
  },
  ht(s, L) {
    const safe = '<div class="box g"><b style="font-size:13px">Hearts: dating and friendship</b><p class="sub" style="margin-top:6px">18+ only. You stay anonymous by handle. When two people tap Interested on each other\'s posts, a private chat opens. Post your own too, so others can be interested in you. Numbers, handles and links are blocked, so keep the chat inside Comrade Connect. Never send money, airtime or fare to anyone you meet here. Meet in a public place and tell a friend.</p></div>';
    if (s.gate) return safe + '<button class="btn p" data-xa="h18" style="width:100%">I am 18 or older. Show Hearts</button>' + (s.error ? '<p class="sub">' + esc(s.error) + '</p>' : '');
    return safe + xadd('Post to Hearts') + zchips(s) + (L.length ? L.map((p) => {
      const m = /^\[([^\]]{1,20})\]\s*/.exec(p.content), look = m ? m[1] : '', txt = m ? p.content.slice(m[0].length) : p.content;
      return '<article class="box g"><div class="flex items-center justify-between"><span>' + (look ? '<span class="badge">' + esc(look) + '</span>' : '') + '<span class="badge" style="margin-left:6px">@' + esc(p.zone) + '</span></span>' + xwhen(p) + '</div>'
        + '<p class="sub" style="margin:12px 0 14px;overflow-wrap:anywhere">' + esc(txt) + '</p>'
        + xbar(p.mine ? '<span class="views">Your post</span>' : (p.interested ? '<span class="views">Interest sent</span>' : '<button class="act" data-xa="hi" data-id="' + esc(p.id) + '">Interested</button>') + xrep(p)) + '</article>';
    }).join('') : xempty(s, 'No posts here yet. Be the first.')) + xmore(s);
  },
  wf(s, L) {
    const form = s.form ? '<article class="box g"><b style="font-size:15px">Share a Wi-Fi spot</b><p class="sub" style="margin:6px 0 10px">Tell comrades where Wi-Fi works. Do not post passwords or network details here. Passwords stay with the owner.</p>'
      + xin('x_wp', 'Place, e.g. Library 2nd floor or Njeri Plots', 60) + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px"><select id="x_wz" aria-label="Zone">' + xopt(ZONES) + '</select><select id="x_ws" aria-label="Speed">' + xopt(['Fast', 'OK', 'Slow'], 'OK') + '</select></div>'
      + '<div class="bar" style="margin-top:14px"><button class="btn p" data-xa="save">Share</button><button class="act" data-xa="cancel">Cancel</button></div></article>' : '';
    return '<p class="sub">Find places around campus and the hostels where Wi-Fi works, and tell others when it does not.</p>' + xadd('Share a Wi-Fi spot') + form + zchips(s)
      + (L.length ? L.map((w) => { const up = Math.round(((w.votes || 0) + (w.score || 0)) / 2), down = (w.votes || 0) - up;
        return '<article class="box g"><div class="flex items-center justify-between"><span><span class="badge">Speed: ' + esc(w.speed_note || 'unknown') + '</span><span class="badge" style="margin-left:6px">@' + esc(w.zone) + '</span></span>' + xwhen(w) + '</div>'
          + '<p style="margin:12px 0 12px;font-weight:600;overflow-wrap:anywhere">' + esc(w.place) + (down >= up + 3 ? ' <span class="sub">(reported not working)</span>' : '') + '</p>'
          + xbar('<button class="act' + (w.my_vote === 1 ? ' liked' : '') + '" data-xa="wup" data-id="' + esc(w.id) + '">Works ' + up + '</button><button class="act' + (w.my_vote === -1 ? ' liked' : '') + '" data-xa="wdn" data-id="' + esc(w.id) + '">Not working ' + down + '</button>' + (w.mine ? '' : xrep(w))) + '</article>'; }).join('') : xempty(s, 'No Wi-Fi spots here yet. Be the first.')) + xmore(s);
  },
  hs(s, L) {
    const form = s.form ? '<article class="box g"><b>Review a hostel</b>' + xin('x_hn', 'Hostel name, e.g. Sunrise Hostel', 60) + xin('x_hr', 'Monthly rent in KSh, e.g. 4500', 6, ' inputmode="numeric"')
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px"><select id="x_hz" aria-label="Zone">' + xopt(ZONES) + '</select><select id="x_hq" aria-label="Rating">' + ['5/5 Excellent', '4/5 Good', '3/5 Fair', '2/5 Poor', '1/5 Bad'].map((x, i) => '<option value="' + (5 - i) + '"' + (i === 1 ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></div>'
      + xin('x_hv', 'Your honest review, no names or numbers', 400) + '<div class="bar" style="margin-top:14px"><button class="btn p" data-xa="save">Post</button><button class="act" data-xa="cancel">Cancel</button></div></article>' : '';
    return '<p class="sub">Honest hostel and plot reviews from comrades.</p>' + xadd('Review a hostel') + form + zchips(s)
      + (L.length ? L.map((h) => '<article class="box g"><div class="flex items-center justify-between"><span><span class="badge">@' + esc(h.zone) + '</span>' + (h.rating ? '<span class="badge" style="margin-left:6px">' + h.rating + '/5</span>' : '') + '</span>' + xwhen(h) + '</div>'
        + '<p style="margin:12px 0 2px;font-weight:600">' + esc(h.name) + '</p>' + (h.rent ? '<p class="sub" style="margin:0 0 8px">' + rent$(h.rent) + ' a month</p>' : '') + '<p class="sub" style="margin:0 0 12px;overflow-wrap:anywhere">' + esc(h.review || '') + '</p>'
        + xbar(h.mine ? '<span class="views">Your review</span>' : xrep(h)) + '</article>').join('') : xempty(s, 'No hostel reviews here yet. Be the first.')) + xmore(s);
  },
  sv(s, L) {
    const form = s.form ? '<article class="box g"><b>Add a service</b>' + xin('x_st', 'Business name, e.g. Quick Print Point', 80) + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px"><select id="x_sc" aria-label="Category">' + xopt(SVC, 'Printing') + '</select><select id="x_sz" aria-label="Zone">' + xopt(ZONES) + '</select></div>'
      + xin('x_sp', 'Price, e.g. KSh 5 a page', 40) + xin('x_sd', 'What they do and opening hours', 400) + '<p class="sub" style="margin-top:8px">No phone numbers. Comrades reach you with anonymous messages.</p><div class="bar" style="margin-top:14px"><button class="btn p" data-xa="save">Post</button><button class="act" data-xa="cancel">Cancel</button></div></article>' : '';
    const cats = ['All'].concat(SVC, [...new Set(L.map((x) => x.category))].filter((c) => !SVC.includes(c)));
    const F = L.filter((x) => s.cat === 'All' || x.category === s.cat).sort((x, y) => (y.featured ? 1 : 0) - (x.featured ? 1 : 0));
    const ic = (d, n) => '<svg viewBox="0 0 24 24" width="' + (n || 16) + '" height="' + (n || 16) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none">' + d + '</svg>';
    const IC = { phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>', chat: '<path d="M21 12a8 8 0 0 1-11.7 7L4 20l1.1-4.6A8 8 0 1 1 21 12z"/>',
      pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      truck: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.7"/><circle cx="17" cy="17.5" r="1.7"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>' };
    const line = 'border-top:1px solid color-mix(in srgb,currentColor 14%,transparent)';
    const info = (icon, label, text) => '<div style="display:flex;gap:10px;align-items:flex-start;margin:0 0 8px;font-size:13px;font-weight:300;line-height:1.5"><span style="margin-top:2px;opacity:.75">' + ic(IC[icon], 15) + '</span><span style="overflow-wrap:anywhere"><b style="font-weight:600">' + label + '</b> ' + esc(text) + '</span></div>';
    const card = (x) => {
      const tel = String(x.phone || '').replace(/[^\d+]/g, ''), wa = String(x.whatsapp || '').replace(/\D/g, '');
      const price = String(x.offerings || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 15).map((l) => { const p = l.split(/\s*\|\s*/); return '<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;' + line + '"><span style="font-weight:300">' + esc(p[0]) + '</span><b style="white-space:nowrap;font-weight:600">' + esc(p[1] || '') + '</b></div>'; }).join('');
      const maps = x.location ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(x.location + ' Kirinyaga University') : '';
      const bt = 'style="padding:11px 20px;text-decoration:none"';
      const act = (tel ? '<a class="btn p" ' + bt + ' href="tel:' + esc(tel) + '">' + ic(IC.phone) + 'Call</a>' : '') + (wa ? '<a class="btn g" ' + bt + ' href="https://wa.me/' + esc(wa) + '?text=' + encodeURIComponent('Hi ' + x.title + ', I found you on Comrade Connect.') + '" target="_blank" rel="noopener noreferrer">' + ic(IC.chat) + 'WhatsApp</a>' : '')
        + (maps ? '<a class="btn g" ' + bt + ' href="' + esc(maps) + '" target="_blank" rel="noopener noreferrer">' + ic(IC.pin) + 'Directions</a>' : '');
      return '<article class="box g"><div class="flex items-center justify-between"><span><span class="badge">' + esc(x.category) + '</span><span class="badge" style="margin-left:6px">@' + esc(x.zone || 'Whole campus') + '</span>'
        + (x.official ? '<span class="badge" style="margin-left:6px;display:inline-flex;gap:5px;align-items:center">' + ic(IC.check, 12) + 'Verified</span>' : '') + (x.delivery ? '<span class="badge" style="margin-left:6px;display:inline-flex;gap:5px;align-items:center">' + ic(IC.truck, 12) + 'Delivers</span>' : '') + '</span>' + xwhen(x) + '</div>'
        + '<p style="margin:12px 0 2px;font-weight:600">' + esc(x.title) + '</p>' + (x.price_note ? '<p class="sub" style="margin:0 0 8px">' + esc(x.price_note) + '</p>' : '')
        + (x.details ? '<p class="sub" style="margin:0 0 12px;overflow-wrap:anywhere">' + esc(x.details) + '</p>' : '')
        + (x.hours ? info('clock', 'Hours', x.hours) : '') + (x.location ? info('pin', 'Find them', x.location) : '')
        + (price ? '<div style="margin:6px 0 14px;font-size:13px">' + price + '</div>' : '')
        + (act ? '<div class="bar" style="flex-wrap:wrap;gap:8px;margin-bottom:8px">' + act + '</div>' : '')
        + xbar(x.mine ? '<span class="views">Your service</span>' : (x.official ? '' : xmsg(x, '')) + xrep(x)) + '</article>';
    };
    return '<p class="sub">Printing, gas, laundry, food and boda near the hostels. Verified services have phone, hours and prices. Or message one anonymously.</p>' + xadd('Add a service') + form
      + '<div class="tabs z" style="padding:0">' + cats.map((c) => '<button class="tab g' + (c === s.cat ? ' on' : '') + '" data-xc="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div>' + zchips(s)
      + (F.length ? F.map(card).join('') : xempty(s, 'No services here yet. Add one.')) + xmore(s);
  },
  sn(s, L) {
    const form = s.form ? '<article class="box g"><b>Share a study tip</b>' + xin('x_nu', 'Unit, e.g. STAT 201', 40) + xin('x_nt', 'Your tip or short notes', 300) + '<div class="bar" style="margin-top:14px"><button class="btn p" data-xa="save">Post</button><button class="act" data-xa="cancel">Cancel</button></div></article>' : '';
    const q = s.q.toLowerCase(), F = L.filter((x) => !q || (x.unit + ' ' + x.tip).toLowerCase().includes(q));
    return '<p class="sub">Revision tips by unit from other comrades.</p>' + xadd('Share a study tip') + form + '<div class="fld" style="margin-top:4px"><input id="x_q" maxlength="30" placeholder="Search by unit or topic" value="' + esc(s.q) + '"></div>'
      + (F.length ? F.map((x) => '<article class="box g"><div class="flex items-center justify-between"><span class="badge">' + esc(x.unit || 'General') + '</span>' + xwhen(x) + '</div><p style="margin:12px 0 12px;overflow-wrap:anywhere">' + esc(x.tip) + '</p>'
        + xbar('<button class="act' + (LIKED.has(x.id) ? ' liked' : '') + '" data-xa="like" data-id="' + esc(x.id) + '">Helpful ' + (x.likes || 0) + '</button>' + (x.mine ? '' : xrep(x))) + '</article>').join('') : xempty(s, 'No study tips yet. Share one.')) + xmore(s);
  },
};

const keepForm = () => { const o = {}; $$('#xbody [id]').forEach((el) => { if ('value' in el) o[el.id] = el.type === 'checkbox' ? el.checked : el.value; }); const f = document.activeElement; return { o, f: f && f.id && $('#xbody').contains(f) ? [f.id, f.selectionStart, f.selectionEnd] : null }; };
const backForm = (st) => { Object.keys(st.o).forEach((id) => { const el = document.getElementById(id); if (el) { if (el.type === 'checkbox') el.checked = st.o[id]; else el.value = st.o[id]; } }); if (st.f) { const el = document.getElementById(st.f[0]); if (el) { el.focus(); try { el.setSelectionRange(st.f[1], st.f[2]); } catch (e) {} } } };
function paintX() {
  const k = xt; if (!XP[k]) return;
  $$('#xt .tab').forEach((t) => t.classList.toggle('on', t.dataset.x === k));
  const st = keepForm(), s = exs(k); $('#xbody').innerHTML = XP[k](s, visible(k)); backForm(st);
}
new MutationObserver(() => { if (document.body.dataset.view === 'explore' && xon()) { const s = exs(xt); drawX(); if (s.loaded && !s.loading && Date.now() - s.at > 60000) loadX(xt, true); } }).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });

/* actions: a capturing listener, so the old local handlers never run while the Worker is connected */
const reportX = (k, id) => askReason(async (why) => { await call('/api/report', { body: { type: XT[k], id, reason: why } }); GONE.add(k + ':' + id); toast('Reported. It is hidden for you while an admin reviews it.'); paintX(); });
const patchItem = (k, id, f) => { const x = exs(k).items.find((y) => y.id === id); if (x) f(x); return x; };
async function xclick(e) {
  if (!xon()) return;
  const k = xt, s = exs(k);
  const z = e.target.closest('[data-xz]'), c = e.target.closest('[data-xc]'), b = e.target.closest('[data-xa]');
  if (!z && !c && !b) return;
  e.stopPropagation();
  if (z) { s.zone = z.dataset.xz; s.items = []; s.loaded = false; return loadX(k, true); }
  if (c) { s.cat = c.dataset.xc; return paintX(); }
  const a = b.dataset.xa, id = b.dataset.id, item = id ? s.items.find((y) => y.id === id) : null;
  try {
    if (a === 'retry') return loadX(k, true);
    if (a === 'more') { s.page++; return loadX(k, false); }
    if (a === 'new') { if (s.form === false && ['wf', 'hs', 'sv', 'sn'].includes(k)) { s.form = true; return paintX(); } return openDm(k); }
    if (a === 'cancel') { s.form = false; return paintX(); }
    if (a === 'rp') return reportX(k, id);
    if (a === 'dm' && item) return openThread({ ref: { type: XT[k], id }, title: (item.title || item.name || '').slice(0, 60) });
    if (a === 'h18') { b.disabled = true; s.error = ''; try { await ensureAccount(); await call('/api/me/adult', { body: { confirm: true } }); s.gate = false; s.loaded = false; return loadX('ht', true); } catch (err) { s.error = err.message; s.gate = true; paintX(); return; } }
    if (a === 'join' && item) { const r = await call('/api/c/groups/' + id + (item.joined ? '/leave' : '/join'), { body: {} }); patchItem(k, id, (g) => { g.joined = !!r.joined; g.members = r.members !== undefined ? r.members : Math.max(0, g.members + (r.joined ? 1 : -1)); }); return paintX(); }
    if (a === 'vote' && item) { const r = await call('/api/c/polls/' + id + '/vote', { body: { option: +b.dataset.i } }); patchItem(k, id, (p) => { p.counts = r.counts; p.voted = r.voted; }); paintX(); return earn(1, 'Voted', 1); }
    if (a === 'hi' && item) { const r = await call('/api/c/hearts/' + id + '/interest', { body: {} }); patchItem(k, id, (p) => { p.interested = true; }); paintX(); if (r.matched && r.thread_id) { toast('It is a match! A private chat is open.'); return openThread({ tid: r.thread_id, title: 'Hearts match' }); } return toast('Interest sent'); }
    if ((a === 'wup' || a === 'wdn') && item) { const r = await call('/api/c/wifi/' + id + '/vote', { body: { value: a === 'wup' ? 1 : -1 } }); patchItem(k, id, (w) => { w.score = r.score; w.votes = r.votes; w.my_vote = r.my_vote; }); return paintX(); }
    if (a === 'like' && item) { const r = await call('/api/c/tips/' + id + '/like', { body: {} }); LIKED.add(id); patchItem(k, id, (t) => { t.likes = typeof r.likes === 'number' ? r.likes : t.likes; }); return paintX(); }
    if (a === 'save') return saveInline(k, b);
  } catch (err) { toast(err.message); if (b.disabled) b.disabled = false; }
}
async function createX(k, body, after) {                                   // one place for every create: server first, screen second
  const s = exs(k); if (s.busy) return false; s.busy = true;
  try {
    const d = await call('/api/c/' + XK[k], { body });
    s.items.unshift(d); s.loaded = true; if (after) await after(d);
    s.zone !== 'All' && d.zone && d.zone !== s.zone && (s.zone = 'All');
    return true;
  } catch (err) { toast(err.message); return false; } finally { s.busy = false; }
}
const doneX = (k, pts, why) => { shut(); const s = exs(k); s.form = false; xt = k; paintX(); earn(pts, why); };
const val = (id) => (document.getElementById(id) || { value: '' }).value.trim();
window.__ccx = { toJpeg, putFile, XP, exs, paintX, createX, doneX, loadX, visible, zchips, xwhen, xrep, xmsg, xempty, xmore, call, ensureAccount, get xt() { return xt; } };   // lets cc-wifi.js build the Wi-Fi screen
async function saveInline(k, btn) {
  if (k === 'wf') {
    const place = val('x_wp'); if (place.length < 2) return toast('Add the place');
    if (typeof contactHit === 'function' && contactHit(place)) return toast('No numbers, handles or links. Passwords stay with the owner.');
    btn.disabled = true; const ok = await createX('wf', { place, zone: val('x_wz'), speed_note: val('x_ws') }); btn.disabled = false; if (ok) { toast('Shared. Thank you, comrade'); doneX('wf', 2, 'Shared Wi-Fi'); }
  } else if (k === 'hs') {
    const name = val('x_hn'), review = val('x_hv'); if (name.length < 2 || review.length < 3) return toast('Add the hostel name and your review');
    if (typeof contactHit === 'function' && contactHit(review)) return toast('No phone numbers, handles or links in a review.');
    btn.disabled = true; const ok = await createX('hs', { name, zone: val('x_hz'), rent: parseInt(val('x_hr')) || null, rating: +val('x_hq') || null, review }); btn.disabled = false; if (ok) doneX('hs', 3, 'Reviewed a hostel');
  } else if (k === 'sv') {
    const title = val('x_st'), details = val('x_sd'); if (title.length < 3 || details.length < 3) return toast('Add the name and what they do');
    if (typeof contactHit === 'function' && contactHit(title + ' ' + details + ' ' + val('x_sp'))) return toast('No phone numbers, handles or links. Comrades will message you in the app.');
    btn.disabled = true; const ok = await createX('sv', { title, category: val('x_sc'), zone: val('x_sz'), price_note: val('x_sp'), details }); btn.disabled = false; if (ok) doneX('sv', 3, 'Added a service');
  } else if (k === 'sn') {
    const unit = val('x_nu').toUpperCase(), tip = val('x_nt'); if (!unit || tip.length < 5) return toast('Fill in the unit and your tip');
    if (typeof contactHit === 'function' && contactHit(tip)) return toast('No phone numbers, handles or links in a tip.');
    btn.disabled = true; const ok = await createX('sn', { unit, tip }); btn.disabled = false; if (ok) doneX('sn', 3, 'Shared a study tip');
  }
}
/* the existing sheets (room, study group, poll, Hearts) keep their forms; only the save buttons change */
const NOTE = { at: 0, job: null };
function loadNotices() {                                                    // admin notices from the Worker into the existing Notices tab
  if (NOTE.job || Date.now() - NOTE.at < 60000 || !window.ccNT) return;
  NOTE.job = call('/api/notices', { auth: false }).then((d) => {
    window.ccNT.splice(0, window.ccNT.length, ...(d.notices || []).map((n) => ({ id: n.id, t: n.title, b: n.body || '', c: 'General', p: n.pinned, a: Math.max(0, Math.floor((Date.now() - n.createdAt) / 864e5)) })));
    NOTE.at = Date.now();
  }).catch(() => {}).finally(() => { NOTE.job = null; if (xt === 'nt') drawX(); });
}
function initExplore() {
  const baseDrawX = drawX;                                                  // taken after the page's own load handlers, so ours is the outermost layer
  drawX = function () {
    if (!xon()) { if (xt === 'nt' && connected()) loadNotices(); return baseDrawX(); }
    const k = xt, s = exs(k); paintX();
    if (!s.loaded && !s.loading) loadX(k, true);
  };
  const set = (id, fn) => { const old = $(id).onclick; $(id).onclick = (e) => (connected() ? fn(e) : old && old.call($(id), e)); };
  set('#rmS', async (e) => {
    const rent = +$('#rmb').value, note = $('#rmn').value.trim(), kind = $('#rmt').value === 'have' ? 'offering' : 'looking', zone = $('#rmz').value;
    if (!rent || rent < 500 || note.length < 3) return toast('Add a monthly budget and a short note');
    if (contactHit(note)) return toast('Please do not share numbers or handles. Use anonymous messages.');
    e.target.disabled = true; const ok = await createX('rm', { kind, zone, rent, details: note, title: (kind === 'offering' ? 'Room in ' : 'Looking for a room in ') + zone }); e.target.disabled = false;
    if (ok) { $('#rmb').value = $('#rmn').value = ''; doneX('rm', 3, 'Posted a listing'); }
  });
  set('#sgS', async (e) => {
    const u = $('#sgu').value.trim(), w = $('#sgw').value.trim(), p = $('#sgp').value.trim();
    if (!u || !w || !p) return toast('Add the unit, time and place');
    if (contactHit(u + ' ' + w + ' ' + p)) return toast('No numbers or handles. Members talk through anonymous messages.');
    e.target.disabled = true;
    const ok = await createX('sg', { name: u, unit: u, details: w + ' at ' + p, max_members: 10 }, async (g) => { g.members = 0; g.max_members = g.max_members || 10; g.joined = false; try { const r = await call('/api/c/groups/' + g.id + '/join', { body: {} }); g.joined = true; g.members = r.members || 1; } catch (x) {} });
    e.target.disabled = false; if (ok) { $('#sgu').value = $('#sgw').value = $('#sgp').value = ''; doneX('sg', 3, 'Started a study group'); }
  });
  set('#plS', async (e) => {
    const q = $('#plq').value.trim(), o = ['plo1', 'plo2', 'plo3'].map((i) => $('#' + i).value.trim()).filter(Boolean);
    if (q.length < 5 || o.length < 2) return toast('Add a question and at least two options');
    if (contactHit(q + ' ' + o.join(' '))) return toast('No numbers or handles in a poll.');
    e.target.disabled = true; const ok = await createX('pl', { question: q, options: o }, (p) => { p.counts = p.options.map(() => 0); p.voted = null; p.closed = false; }); e.target.disabled = false;
    if (ok) { ['plq', 'plo1', 'plo2', 'plo3'].forEach((i) => ($('#' + i).value = '')); doneX('pl', 3, 'Created a poll'); }
  });
  set('#htS', async (e) => {
    const note = $('#htn').value.trim(), look = $('#htl').value;
    if (note.length < 10) return toast('Write a short note about yourself');
    if (contactHit(note)) return toast('No numbers or handles in your post. Chats open after you both tap Interested.');
    if (/(send|tuma|need|want).{0,25}(money|airtime|fare|mpesa|cash|rent)|sponsor|sugar/i.test(note)) return toast('Hearts posts cannot ask for money or gifts.');
    e.target.disabled = true; const ok = await createX('ht', { content: ('[' + look + '] ' + note).slice(0, 300), zone: $('#htz').value }, (p) => { p.interested = false; }); e.target.disabled = false;
    if (ok) { $('#htn').value = ''; doneX('ht', 3, 'Posted on Hearts'); }
  });
  $('#xbody').addEventListener('click', xclick, true);
  $('#xbody').addEventListener('input', (e) => { if (e.target.id === 'x_q' && xon()) { exs('sn').q = e.target.value; paintX(); } });
  $('#morebox').addEventListener('click', (e) => {                          // Feed story: message the poster through the Worker
    const b = e.target.closest('button[data-a=dm]'); if (!b || !connected() || !tgt2 || tgt2.kind !== 'post' || !UUID_RE.test(String(tgt2.id))) return;
    e.stopPropagation(); openThread({ ref: { type: 'post', id: tgt2.id }, title: (typeof dmSnip === 'string' ? dmSnip : '') });
  }, true);
  /* zone ratings */
  const RQ = [['safety', 'Safety'], ['quiet', 'Quiet (5 = very quiet)'], ['value', 'Value for money']]; let PQ = {}, ZB = null;
  const baseRate = buildRate, oldRows = $('#rrows').onclick, oldRsub = $('#rsub').onclick, baseBoard = drawBoard;
  buildRate = function () { if (!connected()) return baseRate(); PQ = {}; $('#rz').innerHTML = ZONES.map((z) => '<option>' + esc(z) + '</option>').join(''); $('#rrows').innerHTML = RQ.map(([k, l]) => '<div class="rr"><span>' + l + '</span><div class="stars" data-k="' + k + '">' + [1, 2, 3, 4, 5].map((n) => '<button type="button" data-n="' + n + '" aria-label="' + l + ' ' + n + ' out of 5">' + n + '</button>').join('') + '</div></div>').join(''); };
  $('#rrows').onclick = (e) => { if (!connected()) return oldRows && oldRows.call($('#rrows'), e); const b = e.target.closest('button'); if (!b) return; const g = b.parentElement; PQ[g.dataset.k] = +b.dataset.n; [...g.children].forEach((x) => x.classList.toggle('on', x === b)); };
  $('#rsub').onclick = async (e) => {
    if (!connected()) return oldRsub && oldRsub.call($('#rsub'), e);
    if (RQ.some(([k]) => !PQ[k])) return toast('Pick a score for safety, quiet and value');
    e.target.disabled = true;
    try { await call('/api/c/zones/rate', { body: { zone: $('#rz').value, safety: PQ.safety, noise: 6 - PQ.quiet, value: PQ.value } }); shut(); toast('Rating saved. Thanks for helping other comrades.'); loadBoard(); }
    catch (err) { toast(err.message); }
    e.target.disabled = false;
  };
  function paintBoard() {
    const by = {}; (ZB || []).forEach((z) => { by[z.zone] = z; });
    const R = ZONES.map((z) => { const o = by[z]; return o ? { z, n: o.ratings, s: o.safety, q: 6 - o.noise, v: o.value, avg: (o.safety + (6 - o.noise) + o.value) / 3 } : { z, n: 0, s: 0, q: 0, v: 0, avg: 0 }; }).sort((a, b) => b.avg - a.avg);
    $('#lbd').innerHTML = R.map((r, i) => '<div class="lb"><b>' + (i + 1) + '</b><span>@' + esc(r.z) + '<small>' + (r.n ? 'Safety ' + r.s.toFixed(1) + '  Quiet ' + r.q.toFixed(1) + '  Value ' + r.v.toFixed(1) + '  (' + r.n + ' ratings)' : 'No ratings yet') + '</small></span><em>' + (r.n ? r.avg.toFixed(1) : '-') + '</em><div class="mtr"><i style="width:' + (r.avg / 5 * 100) + '%"></i></div></div>').join('');
  }
  async function loadBoard() { if (!connected()) return; try { ZB = (await call('/api/c/zones', { auth: false })).zones || []; paintBoard(); } catch (err) { /* keep the old board */ } }
  drawBoard = function () { if (!connected() || ZB === null) return baseBoard(); paintBoard(); };
  loadBoard();
  if (document.body.dataset.view === 'explore') drawX();
}
/* ---------- Club shop and event tickets on the server ---------- */
const CS = { member: null, products: [], orders: [], events: [], tickets: [], loaded: false, err: '', at: 0, job: null };
const CSTAT = { pending: 'Waiting for payment', paid: 'Paid. Collect on campus', collected: 'Collected', cancelled: 'Cancelled', refunded: 'Refunded to your wallet' };
const stockWord = (q) => (q <= 0 ? 'Out of stock' : q <= 10 ? 'Low stock (' + q + ' left)' : 'In stock');
const evDate = (d) => new Date(d + 'T00:00:00+03:00').toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
function loadClub(quiet) {
  if (CS.job) return CS.job;
  CS.err = '';
  if (!quiet) drawClubX();
  CS.job = (async () => {
    const authed = hasAuth(), get = (p) => call(p, { auth: false });
    const [pr, ev, me, od, tk] = await Promise.allSettled([get('/api/club/products'), get('/api/events'), authed ? get('/api/club/me') : Promise.resolve({ member: false }), authed ? get('/api/club/orders/mine') : Promise.resolve({ orders: [] }), authed ? get('/api/tickets/mine') : Promise.resolve({ tickets: [] })]);
    if (pr.status === 'fulfilled') CS.products = pr.value.products || []; else CS.err = pr.reason.message;
    if (ev.status === 'fulfilled') CS.events = ev.value.events || []; else CS.err = CS.err || ev.reason.message;
    if (me.status === 'fulfilled') CS.member = !!me.value.member;
    if (od.status === 'fulfilled') CS.orders = od.value.orders || [];
    if (tk.status === 'fulfilled') CS.tickets = tk.value.tickets || [];
    CS.loaded = pr.status === 'fulfilled' || ev.status === 'fulfilled'; CS.at = Date.now();
  })().finally(() => { CS.job = null; drawClubX(); });
  return CS.job;
}
function drawClubX() {
  if (!$('#v-club')) return;
  const sub = csub;
  $$('#cseg button').forEach((b) => b.classList.toggle('on', b.dataset.s === sub));
  $('#cseg [data-s=cart]').textContent = 'Tickets';
  ['shop', 'cart', 'ord', 'help'].forEach((k) => { $('#c' + k).hidden = sub !== k; });
  $('#cmem').innerHTML = CS.member
    ? '<div class="flex items-center justify-between"><span class="badge">Active member</span></div><p class="sub" style="margin-top:10px">You can order from the Club shop and collect on campus.</p>'
    : '<h3>Join the Club</h3><p class="sub" style="margin:6px 0 12px">Joining is free. Members order everyday items at Club prices and collect them on campus.</p><button class="btn p" id="cjoin" style="width:100%">Join the Club</button>';
  const retryBtn = '<p class="sub" style="grid-column:1/3"><button class="btn g" data-retry="1">Could not load. Tap to retry</button><br>' + esc(CS.err) + '</p>';
  if (sub === 'shop') {
    $('#cgrid').innerHTML = CS.err && !CS.products.length ? retryBtn : !CS.loaded ? '<p class="sub" style="grid-column:1/3">Loading...</p>' : !CS.products.length ? '<p class="sub" style="grid-column:1/3">The shop opens soon.</p>'
      : CS.products.map((p) => '<div class="mc g" style="cursor:default"><div class="mm poster" style="aspect-ratio:1;font-size:11px;padding:8px">Club</div><div class="mb"><b>' + esc(p.name) + '</b><em>' + kes(p.price) + '</em><small>' + stockWord(p.stock) + '</small>'
        + '<button class="act" data-buy="' + esc(p.id) + '" style="margin-top:8px;width:100%;justify-content:center"' + (p.stock <= 0 ? ' disabled' : '') + '>' + (p.stock <= 0 ? 'Sold out' : 'Buy') + '</button></div></div>').join('');
  }
  if (sub === 'cart') {
    const mine = CS.tickets.map((t) => window.ccTk ? window.ccTk.card(t) : '<div class="box g" style="margin-top:12px"><div class="flex items-center justify-between"><b>' + esc(t.event || 'Event') + '</b><span class="badge">' + (t.status === 'valid' ? 'Valid' : t.status === 'used' ? 'Used' : 'Cancelled') + '</span></div>'
      + '<p class="sub" style="margin:6px 0 0">' + (t.date ? esc(evDate(t.date)) : '') + (t.venue ? ', ' + esc(t.venue) : '') + '</p>'
      + (t.status === 'valid' && t.code ? '<p style="font-size:26px;letter-spacing:.12em;font-weight:700;margin:12px 0 4px">' + esc(t.code.replace(/(\d{4})(\d{4})/, '$1 $2')) + '</p><p class="note" style="margin:0">Show this code at the door. Do not share it. It works once.</p>' : '') + '</div>').join('');
    $('#ccart').innerHTML = (window.ccTk ? window.ccTk.bar() : '') + (CS.err && !CS.events.length ? retryBtn : !CS.loaded ? '<p class="sub">Loading...</p>' : (CS.events.length ? CS.events.map((e) => '<div class="box g" style="margin-bottom:12px"><div class="flex items-center justify-between" style="gap:8px"><b>' + esc(e.title) + '</b><span class="badge">' + esc(evDate(e.date)) + '</span></div>'
      + '<p class="sub" style="margin:6px 0 0">' + (e.venue ? esc(e.venue) : 'Venue to be announced') + (e.organizer ? ' &middot; by ' + esc(e.organizer) : '') + (e.left != null && e.left > 0 && e.left <= 20 ? ' &middot; ' + e.left + ' left' : '') + '</p>' + (e.details ? '<p class="sub" style="margin:6px 0 0;overflow-wrap:anywhere">' + esc(e.details) + '</p>' : '')
      + (e.ticket_price && e.left === 0 ? '<p class="note" style="margin-bottom:0">Sold out</p>' : e.ticket_price ? '<button class="btn p" data-tb="' + esc(e.id) + '" style="width:100%;margin-top:12px">Buy a ticket, ' + kes(e.ticket_price) + '</button>' : '<p class="note" style="margin-bottom:0">No tickets needed for this event.</p>') + '</div>').join('') : '<p class="sub">No upcoming events yet.</p>'))
      + '<h3 style="margin-top:18px">My tickets</h3>' + (mine || '<p class="sub">No tickets yet.</p>');
  }
  if (sub === 'ord') {
    $('#cord').innerHTML = CS.orders.length ? CS.orders.map((o) => '<div class="box g" style="margin-bottom:14px"><div class="flex items-center justify-between"><span class="badge">Ref ' + esc(String(o.id).slice(0, 8).toUpperCase()) + '</span><span class="mst">' + esc(CSTAT[o.status] || o.status) + '</span></div>'
      + '<p style="margin:10px 0 0;font-weight:600">' + esc(o.product || 'Item') + ' x' + o.qty + '</p><b style="display:block;margin-top:6px">' + kes(o.amount) + '</b>'
      + (o.status === 'paid' ? '<p class="note" style="margin-bottom:0">Collect on campus and give your Ref to the Club team.</p>' : '') + '</div>').join('') : '<p class="sub">No orders yet. Join the Club and buy from Shop.</p>';
  }
  if (sub === 'help' && typeof drawHelp === 'function') drawHelp();
}
/* a payment sheet: phone, wait for the M-Pesa prompt, confirm. The amount is only shown here; the Worker fixes it. */
/* Manual M-Pesa (free mode): says how to pay, asks for the M-Pesa code from the message, sends it to the Worker. */
function askCode(id, man) {
  return new Promise((resolve, reject) => {
    const m = sheet('<h3>Pay with M-Pesa</h3><p class="sub" style="margin-top:6px">Send exactly <b>' + kes(man.amount) + '</b>:</p>'
      + '<p class="note" style="color:var(--fg);margin-top:6px">' + esc(man.steps) + (man.name ? '<br>Name M-Pesa shows: <b>' + esc(man.name) + '</b>' : '') + '</p>'
      + (man.pay_to ? '<button class="btn g" id="ccmc2" style="width:100%;margin-top:8px">Copy ' + (man.type === 'send' ? 'number' : man.type === 'till' ? 'till number' : 'business number') + '</button>' : '')
      + '<p class="note">Then paste the 10-character code from the M-Pesa message, like SJK7ABC123.</p>'
      + '<div class="fld" style="margin-top:10px"><input id="ccmc" maxlength="12" autocapitalize="characters" autocomplete="off" placeholder="M-Pesa code" aria-label="M-Pesa code"></div><p class="note" id="ccme" style="color:var(--fg)"></p>'
      + '<div class="two" style="margin-top:12px"><button class="btn g" id="ccmx">Cancel</button><button class="btn p" id="ccmg">I have paid</button></div>');
    const q = (x) => m.querySelector(x);
    if (q('#ccmc2')) q('#ccmc2').onclick = () => copyText(man.pay_to);
    q('#ccmx').onclick = () => { m.close(); reject(new Error('Payment not finished. If you already paid, buy again and enter the M-Pesa code.')); };
    let busy = false;
    q('#ccmg').onclick = async () => {
      if (busy) return;
      const code = q('#ccmc').value.toUpperCase().replace(/[\s-]/g, '');
      if (!/^[A-Z0-9]{10}$/.test(code)) return (q('#ccme').textContent = 'The code has 10 letters and numbers, like SJK7ABC123.');
      busy = true; q('#ccme').textContent = '';
      try { await call('/api/pay/confirm', { body: { id, code } }); m.close(); resolve(); } catch (e) { q('#ccme').textContent = e.message; busy = false; }
    };
  });
}
/* Waits until a payment is paid. Automatic mode: waits for the M-Pesa prompt. Manual mode: asks for the code, then tells the buyer an admin is checking. */
async function waitPaid(id, on) {
  on = on || (() => {});
  let st = null, asked = false;
  for (let i = 0; i < 60; i++) {
    if (i) await sleep(3000);
    try { st = await call('/api/pay/status?id=' + encodeURIComponent(id), { auth: false }); } catch (e) { continue; }
    if (st.manual && !asked) { asked = true; on('manual'); await askCode(id, st.manual); i = -1; continue; }
    if (st.status === 'submitted') { on('verify'); await sleep(900); const e = new Error('Code received. We are checking your payment. It shows under Orders and Wallet once confirmed, usually within a few minutes.'); e.pending = true; throw e; }
    if (st.status !== 'pending') break;
  }
  if (st && st.status !== 'pending') { on('verify'); await sleep(1200); }   // the "Verifying payment" step is always visible for a moment
  if (!st || st.status === 'pending') { const e = new Error('We have not had the M-Pesa confirmation yet. If you entered your PIN, your order appears under Orders as soon as it is confirmed. Keep the M-Pesa SMS.'); e.pending = true; throw e; }
  if (st.status === 'underpaid') throw new Error('The amount paid was less than required. Keep your M-Pesa message and contact support.');
  if (st.status !== 'paid') {
    const WHY = { cancelled: 'You cancelled the M-Pesa prompt. Nothing was charged and no order was made.', insufficient: 'Your M-Pesa balance was too low. Top up M-Pesa and try again. Nothing was charged.', wrong_pin: 'The M-Pesa PIN was wrong. Try again. Nothing was charged.', timeout: 'The prompt timed out or your phone could not be reached. Try again.', expired: 'The prompt expired. Try again.', busy: 'M-Pesa is busy. Wait a minute and try again.' };
    throw new Error(WHY[st.reason] || 'Payment was cancelled or failed. If you did pay, keep your M-Pesa message and contact support.');
  }
}
// Animated "payment received" tick for every success screen. It plays once; with reduced motion it simply appears.
window.ccTick = function (before) {
  if (!before || !before.parentNode) return;
  if (!document.getElementById('cc-tick-css')) {
    const st = document.createElement('style'); st.id = 'cc-tick-css';
    st.textContent = '.cc-tick{width:92px;height:92px;margin:10px auto 2px;display:block}'
      + '.cc-tick .r{fill:none;stroke:#22c55e;stroke-width:4;opacity:0;transform-origin:50% 50%;animation:cct-ring .9s ease-out}'
      + '.cc-tick .c{fill:rgba(34,197,94,.14);stroke:#22c55e;stroke-width:4;stroke-dasharray:264;stroke-dashoffset:0;transform-origin:50% 50%;animation:cct-circ .55s ease-out,cct-pop .5s .45s ease-out}'
      + '.cc-tick .k{fill:none;stroke:#22c55e;stroke-width:6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:60;stroke-dashoffset:0;animation:cct-draw .4s .45s ease-out backwards}'
      + '@keyframes cct-circ{from{stroke-dashoffset:264}}@keyframes cct-draw{from{stroke-dashoffset:60}}'
      + '@keyframes cct-pop{50%{transform:scale(1.08)}}@keyframes cct-ring{from{transform:scale(.7);opacity:.7}to{transform:scale(1.35);opacity:0}}';
    document.head.appendChild(st);
  }
  const old = before.parentNode.querySelector('.cc-tick'); if (old) old.remove();
  const d = document.createElement('div');
  d.innerHTML = '<svg class="cc-tick" viewBox="0 0 100 100" role="img" aria-label="Payment received"><circle class="r" cx="50" cy="50" r="42"/><circle class="c" cx="50" cy="50" r="42"/><path class="k" d="M30 52l13 13 27-29"/></svg>';
  before.parentNode.insertBefore(d.firstChild, before);
  try { if (navigator.vibrate) navigator.vibrate([30, 40, 30]); } catch (e) { /* not supported */ }
};
function payNow(o) {
  const mx = o.qtyMax || 1;
  const m = sheet('<h3>' + esc(o.title) + '</h3><div id="ccpf">' + (o.note ? '<p class="note" style="margin-top:6px">' + esc(o.note) + '</p>' : '')
    + (mx > 1 ? '<div class="fld" style="margin-top:10px"><select id="ccqty" aria-label="Quantity">' + Array.from({ length: mx }, (_, i) => '<option value="' + (i + 1) + '">Quantity ' + (i + 1) + '</option>').join('') + '</select></div>' : '')
    + '<div class="fld" style="margin-top:12px"><input id="ccpp" inputmode="numeric" maxlength="10" placeholder="07XX XXX XXX" aria-label="M-Pesa number"></div><p class="note" id="ccpe" style="color:var(--fg)"></p><div class="rw"><span><b>Total</b></span><b id="cctot"></b></div>'
    + '<div class="two" style="margin-top:12px"><button class="btn g" id="ccpx">Cancel</button><button class="btn p" id="ccpg">Pay with M-Pesa</button></div></div>'
    + '<div id="ccpw" hidden></div>'
    + '<div id="ccpd" hidden><p class="tot" style="font-size:18px;margin-top:14px" id="ccpm"></p><button class="btn p" id="ccpo" style="width:100%;margin-top:14px">Done</button></div>');
  const q = (s) => m.querySelector(s), qty = () => (mx > 1 ? +q('#ccqty').value : 1), show = (w) => { ['f', 'w', 'd'].forEach((k) => { q('#ccp' + k).hidden = k !== w; }); };
  const tot = () => { q('#cctot').textContent = kes(o.unit * qty()); };
  tot(); q('#ccpp').value = '';
  if (mx > 1) q('#ccqty').onchange = tot;
  q('#ccpx').onclick = () => m.close(); q('#ccpo').onclick = () => m.close();
  let busy = false;
  q('#ccpg').onclick = async () => {
    if (busy) return;
    const v = q('#ccpp').value.replace(/\s/g, '');
    if (!/^(07|01)(?!(\d)\2{7}$)\d{8}$/.test(v)) return (q('#ccpe').textContent = 'Enter a Safaricom or Airtel number like 0712345678.');
    busy = true; q('#ccpe').textContent = ''; show('w');
    const total = o.unit * qty(), ps = paySteps(q('#ccpw'), v, total, o.kind || 'club');
    try {
      const d = await o.start(v, qty());
      ps.go('prompt');
      await waitPaid(d.id, (st) => ps.go(st));
      ps.go('done'); await sleep(1100);
      q('#ccpm').textContent = 'Payment received. ' + kes(total) + '. ' + o.done; show('d'); ccTick(q('#ccpm'));
      try { await o.after(); } catch (e) { /* the lists refresh next time */ }
    } catch (e) { if (e.pending) { ps.stop(); q('#ccpm').textContent = e.message; show('d'); try { await o.after(); } catch (x) { /* refreshes later */ } } else { ps.fail(e.message); await sleep(1800); q('#ccpe').textContent = e.message; show('f'); } }
    ps.stop();
    busy = false;
  };
}
function initClub() {
  const baseDrawClub = drawClub;
  drawClub = function () { if (!connected()) return baseDrawClub(); drawClubX(); if (!CS.loaded || Date.now() - CS.at > 20000) loadClub(true); };
  const guard = (sel, fn) => $(sel).addEventListener('click', (e) => { if (!connected()) return; e.stopPropagation(); fn(e); }, true);
  guard('#cmem', async (e) => {
    const b = e.target.closest('#cjoin'); if (!b) return; b.disabled = true;
    try { await call('/api/club/join', { body: {} }); CS.member = true; toast('Welcome to the Club'); } catch (err) { toast(err.message); }
    drawClubX();
  });
  guard('#cgrid', (e) => {
    if (e.target.closest('[data-retry]')) return loadClub();
    const b = e.target.closest('[data-buy]'); if (!b || b.disabled) return;
    const p = CS.products.find((x) => x.id === b.dataset.buy); if (!p) return;
    if (!CS.member) return toast('Join the Club first');
    payNow({ title: p.name, unit: p.price, qtyMax: Math.min(p.stock, 10), note: 'You collect it on campus after paying. Stock is held for you while you pay.', done: 'Your order is in Orders. Collect it on campus with your Ref.',
      start: (phone, qty) => call('/api/club/order', { body: { product_id: p.id, qty, phone } }),
      after: async () => { csub = 'ord'; await loadClub(true); } });
  });
  guard('#ccart', (e) => {
    if (e.target.closest('[data-retry]')) return loadClub();
    const tk = e.target.closest('[data-tk]'); if (tk && window.ccTk) return window.ccTk.click(tk.dataset.tk, () => loadClub(true));
    const b = e.target.closest('[data-tb]'); if (!b) return;
    const ev = CS.events.find((x) => x.id === b.dataset.tb); if (!ev) return;
    if (!hasAuth()) { needSignup('buy a ticket'); return; }
    const have = CS.tickets.filter((t) => t.status !== 'void' && t.event === ev.title).length;
    if (have >= 4) return toast('Maximum 4 tickets per person');
    payNow({ title: ev.title, unit: ev.ticket_price, note: evDate(ev.date) + (ev.venue ? ', ' + ev.venue : ''), done: 'Your ticket code is under My tickets.',
      start: (phone) => call('/api/tickets/buy', { body: { event_id: ev.id, phone } }),
      after: async () => { const n = CS.tickets.length; for (let i = 0; i < 5; i++) { await loadClub(true); if (CS.tickets.length > n) break; await sleep(2000); } } });
  });
  guard('#cord', () => {});
  if ($('#cseg [data-s=cart]')) $('#cseg [data-s=cart]').textContent = connected() ? 'Tickets' : 'Cart';
}
/* ---------- Clips and likes on the server ---------- */
const CLIPS = { more: false, page: 1, at: 0, job: null };
const redrawClips = () => { const y = $('#rls') ? $('#rls').scrollTop : 0; drawVids(); if ($('#rls')) $('#rls').scrollTop = y; };
function loadClips(more) {
  if (CLIPS.job) return CLIPS.job;
  if (more) CLIPS.page++; else CLIPS.page = 1;
  CLIPS.job = (async () => {
    try {
      const d = await call('/api/clips?limit=20&page=' + CLIPS.page, { auth: false });
      const fresh = (d.clips || []).map((c) => ({ id: c.id, cap: c.caption || 'Clip', url: c.url, likes: c.likes || 0, at: c.createdAt, srv: true, liked: !!c.liked, mine: !!c.mine, comments: c.comments || 0 }));
      if (CLIPS.page === 1) VIDS.splice(0, VIDS.length, ...fresh); else fresh.forEach((v) => { if (!VIDS.some((x) => x.id === v.id)) VIDS.push(v); });
      fresh.forEach((v) => { if (v.liked) { vl.add(v.id); if (window.ccLk) window.ccLk.add(v.id); } });
      CLIPS.more = !!d.hasMore; CLIPS.at = Date.now();
    } catch (e) { if (more) CLIPS.page--; toast('Could not load clips. ' + e.message); }
  })().finally(() => { CLIPS.job = null; redrawClips(); });
  return CLIPS.job;
}
/* the old screens like locally; this reconciles with the Worker (a like cannot be undone) */
function syncLikes() {
  if (!connected()) return;
  VIDS.forEach(async (v) => {
    if (!v.srv || v.busy) return;
    const local = vl.has(v.id) || (window.ccLk && window.ccLk.has(v.id));
    if (local && !v.liked) {
      v.busy = true;
      try { const r = await call('/api/clips/' + v.id + '/like', { body: {} }); v.liked = true; v.likes = typeof r.likes === 'number' ? r.likes : v.likes; }
      catch (e) { vl.delete(v.id); if (window.ccLk) window.ccLk.delete(v.id); v.likes = Math.max(0, v.likes - 1); toast(e.message); }
      v.busy = false; redrawClips();
    } else if (!local && v.liked) { vl.add(v.id); if (window.ccLk) window.ccLk.add(v.id); v.likes++; redrawClips(); }
  });
}
async function uploadClip(f) {
  if (!f) return;
  if (!/^video\/(mp4|webm)$/.test(f.type)) return toast('Please use an MP4 or WebM video. On iPhone, set Camera formats to Most Compatible.');
  if (f.size > 25 * 1048576) return toast('That clip is over 25 MB. Trim it and try again.');
  toast('Uploading your clip...');
  try {
    const d = await call('/api/media/upload-url', { body: { kind: 'clip', content_type: f.type, bytes: f.size, caption: $('#vcap').value.trim() } });
    const r = await putFile(d.upload_url, f, f.type);
    if (!r.ok) throw new Error('The upload did not finish. Check your connection and try again.');
    await call('/api/media/' + d.id + '/complete', { body: {} });
    $('#vcap').value = ''; await loadClips(false); earn(5, 'Posted a clip'); toast('Clip posted');
  } catch (e) { toast(e.message); }
}
function initClips() {
  const baseAdd = addClip, baseDraw = drawVids;
  addClip = function (f) { return connected() ? uploadClip(f) : baseAdd(f); };
  drawVids = function () { baseDraw.apply(this, arguments); if (connected() && CLIPS.more && $('#vl')) $('#vl').insertAdjacentHTML('beforeend', '<button class="btn g" id="vmore" style="width:100%">Load more</button>'); };
  $('#vl').addEventListener('click', (e) => {
    if (!connected()) return;
    if (e.target.closest('#vmore')) return loadClips(true);
    const rp = e.target.closest('.vrp');
    if (rp) { e.stopPropagation(); const id = rp.closest('.vcard').dataset.id; return askReason(async (why) => { await call('/api/report', { body: { type: 'clip', id, reason: why } }); const i = VIDS.findIndex((x) => x.id === id); if (i >= 0) VIDS.splice(i, 1); redrawClips(); toast('Reported. It is hidden for you while an admin reviews it.'); }); }
    setTimeout(syncLikes, 0);
  }, true);
  const rr = $('#rlroot'); if (rr) rr.addEventListener('click', () => setTimeout(syncLikes, 0));
  const onView = () => { if (document.body.dataset.view === 'videos' && connected() && Date.now() - CLIPS.at > 30000) loadClips(false); };
  new MutationObserver(onView).observe(document.body, { attributes: true, attributeFilter: ['data-view'] }); onView();
}
/* ---------- message alerts: a banner in the site, plus a browser notification when the tab is in the background ---------- */
const AL = { map: null, busy: false, base: '' };
const alertsOn = () => (ST.get('cs_nt', { n2: 1 }).n2 !== 0);              // the "Replies and messages" switch in Me > Alerts
function showBanner(text) {
  let b = $('#ccbn');
  if (!b) {
    b = document.createElement('div'); b.id = 'ccbn'; b.setAttribute('role', 'status'); b.setAttribute('aria-live', 'polite');
    b.style.cssText = 'position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:9000;max-width:420px;margin:0 auto;display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;background:#161616;color:#fff;border:1px solid rgba(255,255,255,.18);box-shadow:0 8px 30px rgba(0,0,0,.5);font-size:14px';
    b.innerHTML = '<span id="ccbt" style="flex:1"></span><button type="button" id="ccbv" class="btn p" style="padding:8px 14px;min-height:0">View</button><button type="button" id="ccbx" aria-label="Dismiss" class="act" style="padding:6px 10px">x</button>';
    document.body.appendChild(b);
    b.querySelector('#ccbx').onclick = () => { b.hidden = true; };
    b.querySelector('#ccbv').onclick = () => { b.hidden = true; openMessages(); };
  }
  b.querySelector('#ccbt').textContent = text; b.hidden = false;
  clearTimeout(showBanner.t); showBanner.t = setTimeout(() => { b.hidden = true; }, 9000);
}
function openMessages() { go('me'); drawInbox(); setTimeout(() => { const e = $('#dml'); if (e) e.scrollIntoView({ block: 'center' }); }, 120); }
function setUnread(n) {
  document.title = (n ? '(' + n + ') ' : '') + AL.base;
  const t = $('#tb [data-v=me]'); if (!t) return;
  let d = t.querySelector('.ccdot');
  if (n && !d) { t.style.position = 'relative'; d = document.createElement('i'); d.className = 'ccdot'; d.setAttribute('aria-label', 'Unread messages'); d.style.cssText = 'position:absolute;top:6px;right:calc(50% - 16px);width:9px;height:9px;border-radius:50%;background:#ef4444'; t.appendChild(d); }
  if (!n && d) d.remove();
}
async function pollAlerts() {
  if (!connected() || !hasAuth() || AL.busy) return;
  AL.busy = true;
  try {
    const d = await call('/api/messages/inbox', { auth: false }), now = {}; let total = 0, fresh = 0;
    (d.threads || []).forEach((t) => {
      if (t.muted || t.blocked) return;
      now[t.id] = t.unread || 0; total += t.unread || 0;
      const open = DM.on && DM.tid === t.id;                                // the chat on screen is being read already
      if (AL.map && !open && now[t.id] > (AL.map[t.id] || 0)) fresh += now[t.id] - (AL.map[t.id] || 0);
    });
    setUnread(total);
    if (fresh > 0 && alertsOn()) {
      const text = fresh === 1 ? 'You have a new message' : 'You have ' + fresh + ' new messages';
      showBanner(text);
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try { const n = new Notification('Comrade Connect', { body: text, tag: 'cc-msg', icon: 'icon-192.png' }); n.onclick = () => { window.focus(); openMessages(); n.close(); }; } catch (e) { /* some browsers only allow this from a service worker */ }
      }
    }
    AL.map = now;
  } catch (e) { /* offline: try again next time */ }
  AL.busy = false;
}
function initAlerts() {
  AL.base = document.title.replace(/^\(\d+\)\s*/, '');
  setInterval(pollAlerts, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pollAlerts(); });
  window.addEventListener('focus', pollAlerts);
  pollAlerts();
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
window.addEventListener('load', () => setTimeout(() => { try { initExplore(); } catch (err) { console.error('explore', err); } try { initClub(); } catch (err) { console.error('club', err); } try { initClips(); } catch (err) { console.error('clips', err); } try { initAlerts(); } catch (err) { console.error('alerts', err); } }, 0));

/* ---------- welcome sheet Google button + sign out ---------- */
window.ccMountSi = async function () {
  const box = document.getElementById('siGb'), note = document.getElementById('siGn'); if (!box || !note) return;
  const say = (t) => { note.textContent = t; note.hidden = !t; };
  say('');
  if (!googleOn()) { box.style.display = 'none'; say('Google sign-in is not set up on this site yet. Use an anonymous account for now.'); return; }
  box.style.display = 'flex'; box.innerHTML = '<span class="note">Loading Google...</span>';
  const w = Math.max(200, Math.min(360, Math.floor((box.parentElement && box.parentElement.clientWidth) || 300) - 4));
  box.innerHTML = '';
  const ok = await mountGoogle(box, () => { toast('Signed in with Google'); try { shut(); drawMe(); drawMe2(); } catch (e) {} refreshAll(); }, (msg) => say(msg || 'Google sign-in failed. Try again.'), { theme: 'outline', width: w, link: true });
  if (!ok) say('Google sign-in could not load. Check your internet. If you opened this link inside WhatsApp, Instagram or Facebook, open it in Chrome instead.');
};
function signOut() {
  const a = window.ccAuth && window.ccAuth(), linked = !!ME.google;
  let body;
  if (linked) body = '<p class="sub" style="margin-top:6px">You are signed in with Google. You can sign back in any time with the same Google account.</p>';
  else if (a && a.aid) body = '<p class="sub" style="margin-top:6px">This is an anonymous account. After you sign out, the only way back in is your account ID and recovery code.</p>'
    + '<div class="rw" style="margin-top:12px"><span>Account ID</span><b>' + esc(a.aid) + '</b></div><button class="btn g" id="sox-cp" style="width:100%;margin-top:10px">Copy account ID</button>'
    + '<label class="sub" style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="sox-ok"> I saved my account ID and recovery code</label>';
  else body = '<p class="sub" style="margin-top:6px">This clears your handle, points and settings from this phone.</p>';
  const m = sheet('<h3>Sign out?</h3>' + body + '<div class="two" style="margin-top:14px"><button class="btn g" id="sox-x">Cancel</button><button class="btn p" id="sox-go">Sign out</button></div>');
  const go = m.querySelector('#sox-go'), ok = m.querySelector('#sox-ok');
  if (ok) { go.disabled = true; ok.onchange = () => { go.disabled = !ok.checked; }; }
  const cp = m.querySelector('#sox-cp'); if (cp) cp.onclick = () => copyText(a.aid);
  m.querySelector('#sox-x').onclick = () => m.close();
  go.onclick = async () => {
    go.disabled = true;
    try { if (connected() && a && a.token) await Promise.race([fetch(CC_API + '/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), sleep(3000)]); } catch (e) {}
    try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) {}
    try {
      const aid = a && a.aid;
      Object.keys(localStorage).forEach((k) => { if (k === 'cc_auth' || k === 'cc_pending' || k === 'cs_me' || k === 'cs_seen' || (aid && k.endsWith(':' + aid))) localStorage.removeItem(k); });
    } catch (e) {}
    try { window.ccClearOffline && window.ccClearOffline(); } catch (e) {}
    toast('Signed out');
    setTimeout(() => location.reload(), 400);
  };
}
window.ccSignOut = signOut;
window.ccGoogle = { on: googleOn, mount: mountGoogle, signIn: googleSignIn };

window.ccMarketTerms = () => S.list.map((l) => l.title);
// Used by the first-open panel. kind 'password' = username + password, 'random' = anonymous account with a recovery code.
async function createAccount(kind) {
  if (!connected()) throw new Error('We cannot reach the service right now. Please try again in a moment.');
  const d = kind === 'random' ? await rawPost('/api/auth/register', {}) : await registerFlow();
  saveAuth({ aid: d.aid, token: d.token });
  if (ME.aid && ME.aid !== d.aid) ME.oldAid = ME.aid;
  ME.aid = d.aid; saveMe();
  await showRecovery(d);
  setTimeout(() => { attributeRef(); syncVer(); refreshAll(); }, 0);
  return { aid: d.aid, token: d.token };
}
window.CC = { createAccount, signIn: (msg) => promptRestore(msg || 'Enter your username or account ID and your password or recovery code.', 'Log in'), needSignup, registerFlow, showWelcome, ensureAccount, restoreAccount, call, pollAlerts, DM, putFile, waitPaid, payNow };
window.ccSteps = { paySteps, withdrawFlow, stepsCss };
window.ccTools = { sheet, call, toast, copyText, sleep };   // used by cc-tickets.js   // the same progress animation for deposits, withdrawals, boosts, plans and the club      // used by the other sections
})();
